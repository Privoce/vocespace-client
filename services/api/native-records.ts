import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { parseJoinId, type NativeRecording } from '@vocespace/contracts';
import { ApiRequest, ApiResponse } from './http';
import { AccessError } from './access';
import { requireNative } from './native-auth';
import { requireNativeChatMember } from './lib/server/native-chat';
import { spaceRepository } from './lib/server/space-repository';
import { getConfig } from './lib/server/config';

export async function nativeRecordsEndpoint(request: ApiRequest) {
  if (!['POST', 'PUT', 'DELETE'].includes(request.method))
    return new ApiResponse(null, { status: 405 });
  const body = await request.json();
  const joinId = parseJoinId(body);
  const authorize = async () => {
    const { principal } = await requireNative(request);
    const access = await requireNativeChatMember(principal, joinId);
    const space = await spaceRepository.get(access.spaceName);
    const role = space?.participants[access.identity]?.auth?.identity || 'guest';
    const permissionRole =
      role === 'owner' || role === 'manager' || role === 'participant' ? role : 'guest';
    const manager =
      !!space && (space.ownerId === access.identity || space.managers.includes(access.identity));
    if (!space || !(manager || space.auth[permissionRole]?.recording))
      throw new AccessError(403, 'RECORDING_ACCESS_DENIED');
    if (request.method === 'DELETE' && !manager) throw new AccessError(403, 'MANAGER_REQUIRED');
    return { access, manager };
  };
  const { access, manager } = await authorize();
  const config = getConfig().s3;
  const configured = !!(config?.accessKey && config.secretKey && config.bucket && config.region);
  if (!configured) {
    if (request.method !== 'POST') throw new AccessError(503, 'RECORDING_STORAGE_UNAVAILABLE');
    return ApiResponse.json({ configured: false, canDelete: manager, records: [] });
  }
  const client = new S3Client({
    region: config.region,
    credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
  });
  const prefix = `${access.spaceName}/`;
  // Only main-space recording files; never sibling spaces or nested/private room objects.
  const validKey = (key: unknown): key is string =>
    typeof key === 'string' &&
    key.startsWith(prefix) &&
    !!key.slice(prefix.length) &&
    !/[\\/\0]/.test(key.slice(prefix.length)) &&
    key.endsWith('.mp4');
  try {
    if (request.method === 'POST') {
      const records: NativeRecording[] = [];
      let cursor: string | undefined;
      do {
        const result = await client.send(
          new ListObjectsV2Command({
            Bucket: config.bucket,
            Prefix: prefix,
            ContinuationToken: cursor,
          }),
        );
        for (const item of result.Contents || [])
          if (validKey(item.Key))
            records.push({
              key: item.Key,
              size: item.Size || 0,
              lastModified: item.LastModified?.getTime() ?? null,
            });
        cursor = result.NextContinuationToken;
      } while (cursor);
      await authorize();
      return ApiResponse.json({ configured: true, canDelete: manager, records });
    }
    if (!validKey(body.key)) throw new AccessError(400, 'INVALID_RECORDING_KEY');
    await authorize();
    if (request.method === 'DELETE') {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: body.key }));
      return ApiResponse.json({ success: true });
    }
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: body.key,
        ResponseContentDisposition: 'attachment',
      }),
      { expiresIn: 60 },
    );
    await authorize();
    return ApiResponse.json({ url });
  } catch (error) {
    if (error instanceof AccessError) throw error;
    throw new AccessError(503, 'RECORDING_STORAGE_UNAVAILABLE');
  } finally {
    client.destroy();
  }
}
