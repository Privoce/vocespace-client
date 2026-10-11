import { randomBytes, randomUUID, createHash } from 'node:crypto';
import {
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  AccessToken,
  EgressClient,
  SegmentedFileOutput,
  S3Upload,
  EncodingOptions,
} from 'livekit-server-sdk';
import { previewMembers, StorageUnavailableError } from '@vocespace/server-core';
import { getConfig } from '../lib/server/config';
import { getSpaceRedisClient } from '../lib/server/space-redis';
import { spaceRepository } from '../lib/server/space-repository';
import { withMediaMember } from '../lib/server/media-lock';

const JOBS = 'v1:preview:jobs';
const CLEANUP = 'v1:preview:cleanup';
export const epochKey = (space: string) => `v1:preview:epoch:${space}`;
export const previewRedis = () => {
  const redis = getSpaceRedisClient();
  if (!redis) throw new StorageUnavailableError();
  return redis;
};
export interface PreviewJob {
  id: string;
  space: string;
  fingerprint: string;
  members: { id: string; name: string }[];
  key: string;
  createdAt: number;
  lastViewedAt: number;
  egressId?: string;
  healthCheckedAt?: number;
  status: 'starting' | 'active' | 'stopping';
}
function config() {
  const conf = getConfig();
  const renderer = process.env.PREVIEW_RENDERER_BASE_URL;
  if (
    process.env.PREVIEW_ENABLED !== 'true' ||
    !renderer ||
    !conf.s3?.bucket ||
    !conf.s3.accessKey ||
    !conf.s3.secretKey ||
    !conf.s3.region ||
    !conf.livekit.url ||
    !conf.livekit.key ||
    !conf.livekit.secret
  )
    return null;
  const base = new URL(renderer.endsWith('/') ? renderer : `${renderer}/`);
  if (
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    return null;
  return { ...conf, s3: conf.s3, base };
}
export async function previewSnapshot(space: string) {
  const data = await spaceRepository.get(space);
  const members = previewMembers(data);
  if (!members?.length) return null;
  const epoch = await previewRedis().get(epochKey(space));
  return {
    members,
    fingerprint: createHash('sha256')
      .update(JSON.stringify([epoch, members.map((member) => member.id)]))
      .digest('hex'),
  };
}
export async function readJob(id: string): Promise<PreviewJob | null> {
  const raw = await previewRedis().hget(JOBS, id);
  return raw ? JSON.parse(raw) : null;
}
const saveJob = (job: PreviewJob) => previewRedis().hset(JOBS, job.id, JSON.stringify(job));
const egressClient = () => {
  const { livekit } = getConfig();
  return new EgressClient(livekit.url.replace(/^ws/, 'http'), livekit.key, livekit.secret);
};
export async function validJob(job: PreviewJob) {
  return (
    !!config() &&
    job.status !== 'stopping' &&
    Date.now() - job.createdAt < 20 * 60_000 &&
    (await previewSnapshot(job.space))?.fingerprint === job.fingerprint
  );
}
export async function touchJob(id: string) {
  // Serialize against stop/replace so an old resource read cannot revive a stopped source.
  await withMediaMember('__preview__', 'sources', async () => {
    const job = await readJob(id);
    if (job && job.status !== 'stopping') {
      job.lastViewedAt = Date.now();
      await saveJob(job);
    }
  });
}
function rendererUrl(job: PreviewJob) {
  const url = new URL('api/v1/preview/render', config()!.base);
  url.searchParams.set('job', job.id);
  // Render capability is short lived and separate from any user session / LiveKit credentials.
  url.searchParams.set('key', job.key);
  return url.toString();
}
async function stopJob(job: PreviewJob) {
  job.status = 'stopping';
  await saveJob(job); // Revoke playback before contacting Egress; failure retries on the next worker pass.
  const client = egressClient();
  // Also recover the job after an API crash between Egress acceptance and saving its id.
  const jobs = await client.listEgress({ active: true });
  for (const entry of jobs) {
    if (
      entry.egressId === job.egressId ||
      (entry.request.case === 'web' &&
        new URL(entry.request.value.url).searchParams.get('job') === job.id)
    )
      await client.stopEgress(entry.egressId);
  }
  await previewRedis().hset(CLEANUP, job.id, String(Date.now() + 120_000));
  await previewRedis().hdel(JOBS, job.id);
}
export async function ensurePreview(space: string): Promise<PreviewJob | null> {
  return withMediaMember('__preview__', 'sources', async () => {
    const conf = config();
    const snapshot = conf && (await previewSnapshot(space));
    if (!conf || !snapshot) return null;
    const jobs = Object.values(await previewRedis().hgetall(JOBS)).map(
      (raw) => JSON.parse(raw) as PreviewJob,
    );
    for (const job of jobs.filter((job) => job.space === space)) {
      let healthy = job.status !== 'stopping' && (await validJob(job));
      if (healthy && Date.now() - (job.healthCheckedAt || job.createdAt) > 30_000) {
        healthy =
          !!job.egressId &&
          (await egressClient().listEgress({ egressId: job.egressId, active: true })).some(
            (entry) => entry.status < 2,
          );
        job.healthCheckedAt = Date.now();
      }
      if (healthy) {
        job.lastViewedAt = Date.now();
        await saveJob(job);
        return job;
      }
      await stopJob(job);
    }
    const limit = Math.max(1, Math.min(20, Number(process.env.PREVIEW_MAX_SOURCES) || 3));
    if ((await previewRedis().hlen(JOBS)) >= limit) return null;
    const job: PreviewJob = {
      id: randomUUID(),
      space,
      ...snapshot,
      key: randomBytes(32).toString('hex'),
      createdAt: Date.now(),
      lastViewedAt: Date.now(),
      status: 'starting',
    };
    await saveJob(job);
    try {
      const result = await egressClient().startWebEgress(
        rendererUrl(job),
        {
          segments: new SegmentedFileOutput({
            filenamePrefix: `vocespace-preview/${job.id}/segment`,
            playlistName: 'index.m3u8',
            livePlaylistName: 'live.m3u8',
            segmentDuration: 2,
            output: {
              case: 's3',
              value: new S3Upload({
                accessKey: conf.s3.accessKey,
                secret: conf.s3.secretKey,
                bucket: conf.s3.bucket,
                region: conf.s3.region,
                endpoint: process.env.PREVIEW_S3_ENDPOINT || '',
                forcePathStyle: true,
              }),
            },
          }),
        },
        {
          awaitStartSignal: true,
          encodingOptions: new EncodingOptions({
            width: 720,
            height: 1280,
            framerate: 15,
            videoBitrate: 1000,
            audioBitrate: 64,
          }),
        },
      );
      job.egressId = result.egressId;
      job.status = 'active';
      await saveJob(job);
      return job;
    } catch {
      // An uncertain RPC may have started a job. Keep it for worker reconciliation, never double start.
      job.status = 'stopping';
      await saveJob(job);
      throw new Error('PREVIEW_START_FAILED');
    }
  });
}
export async function reconcilePreviews() {
  await withMediaMember('__preview__', 'sources', async () => {
    const jobs = Object.values(await previewRedis().hgetall(JOBS)).map(
      (raw) => JSON.parse(raw) as PreviewJob,
    );
    for (const job of jobs) {
      try {
        if (
          job.status === 'stopping' ||
          Date.now() - job.lastViewedAt > 45_000 ||
          !(await validJob(job))
        )
          await stopJob(job);
      } catch {
        /* Persisted stopping jobs retry; no capability or upstream error is logged. */
      }
    }
    const conf = getConfig();
    if (conf.s3) {
      const storage = new S3Client({
        region: conf.s3.region,
        endpoint: process.env.PREVIEW_S3_ENDPOINT || undefined,
        forcePathStyle: true,
        credentials: { accessKeyId: conf.s3.accessKey, secretAccessKey: conf.s3.secretKey },
      });
      try {
        for (const [id, due] of Object.entries(await previewRedis().hgetall(CLEANUP))) {
          if (Number(due) > Date.now() || !/^[a-f0-9-]{36}$/.test(id)) continue;
          const objects = await storage.send(
            new ListObjectsV2Command({
              Bucket: conf.s3.bucket,
              Prefix: `vocespace-preview/${id}/`,
            }),
          );
          const keys =
            objects.Contents?.filter((object) => object.Key).map((object) => ({
              Key: object.Key!,
            })) || [];
          if (keys.length) {
            const deleted = await storage.send(
              new DeleteObjectsCommand({ Bucket: conf.s3.bucket, Delete: { Objects: keys } }),
            );
            if (deleted.Errors?.length) continue;
          }
          if (!objects.IsTruncated) await previewRedis().hdel(CLEANUP, id);
        }
      } finally {
        storage.destroy();
      }
    }
  });
}
export async function previewObject(job: PreviewJob, name: string) {
  const conf = config();
  if (!conf) throw new Error('PREVIEW_UNAVAILABLE');
  const client = new S3Client({
    region: conf.s3.region,
    endpoint: process.env.PREVIEW_S3_ENDPOINT || undefined,
    forcePathStyle: true,
    credentials: { accessKeyId: conf.s3.accessKey, secretAccessKey: conf.s3.secretKey },
  });
  try {
    const response = await client.send(
      new GetObjectCommand({ Bucket: conf.s3.bucket, Key: `vocespace-preview/${job.id}/${name}` }),
      { abortSignal: AbortSignal.timeout(8000) },
    );
    if (!response.Body || !response.ContentLength || response.ContentLength > 8 * 1024 * 1024)
      throw new Error('INVALID_PREVIEW_OBJECT');
    return await response.Body.transformToByteArray();
  } finally {
    client.destroy();
  }
}
export async function rendererDetails(job: PreviewJob) {
  const { livekit } = getConfig();
  const token = new AccessToken(livekit.key, livekit.secret, {
    identity: 'preview_main',
    ttl: Math.max(1, Math.ceil((job.createdAt + 20 * 60_000 - Date.now()) / 1000)),
  });
  token.addGrant({
    roomJoin: true,
    room: job.space,
    hidden: true,
    canSubscribe: true,
    canPublish: false,
    canPublishData: false,
  });
  return { serverUrl: livekit.url, token: await token.toJwt(), members: job.members };
}
