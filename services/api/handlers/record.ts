import { SendRecordRequestBody } from '@vocespace/domain/requests/record';
import { EgressClient, EncodedFileOutput, S3Upload } from 'livekit-server-sdk';
import { ApiRequest, ApiResponse } from '../http';
import { getConfig } from '../lib/server/config';
import { isUndefinedString } from '@vocespace/domain';
import { addCleanTask } from '../lib/s3-clean';

const {
  livekit: { key: LIVEKIT_API_KEY, secret: LIVEKIT_API_SECRET, url: LIVEKIT_URL },
  s3,
} = getConfig();

const S3_ACCESS_KEY = s3?.accessKey;
const S3_SECRET_KEY = s3?.secretKey;
const S3_BUCKET = s3?.bucket;
const S3_REGION = s3?.region;

// 检查环境变量是否未定义或为空字符串只要任意有一个未设置就不行，未设置返回true
const checkEnv = (): boolean => {
  return (
    isUndefinedString(LIVEKIT_API_KEY) ||
    isUndefinedString(LIVEKIT_API_SECRET) ||
    isUndefinedString(LIVEKIT_URL) ||
    isUndefinedString(S3_ACCESS_KEY) ||
    isUndefinedString(S3_SECRET_KEY) ||
    isUndefinedString(S3_BUCKET) ||
    isUndefinedString(S3_REGION)
  );
};

// 获取环境变量的接口，/api/record?env=true
export async function GET(req: ApiRequest) {
  if (checkEnv()) {
    return ApiResponse.json(
      { error: 'Environment variables are not set properly' },
      { status: 500 },
    );
  }

  const env = req.nextUrl.searchParams.get('env');
  if (env === 'true') {

    return ApiResponse.json(
      {
        configured: true,
        s3_bucket: S3_BUCKET,
        s3_region: S3_REGION,
        server_host: req.nextUrl.origin,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } else {
    return ApiResponse.json(
      {
        error: 'Invalid request, please use /api/record?env=true to get environment variables',
      },
      { status: 400 },
    );
  }
}

export async function POST(req: ApiRequest) {
  if (checkEnv()) {
    return ApiResponse.json(
      { error: 'Environment variables are not set properly' },
      { status: 500 },
    );
  }

  try {
    const { spaceName, type, egressId }: SendRecordRequestBody = await req.json();
    if (spaceName === null) {
      return new ApiResponse('Missing spaceName parameter', { status: 403 });
    }

    if (!LIVEKIT_URL) {
      return ApiResponse.json({ error: 'LIVEKIT_URL is not set' }, { status: 500 });
    }

    const hostURL = LIVEKIT_URL.replace('wss://', 'https://').replace('ws://', 'https://');

    const egressClient = new EgressClient(hostURL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    if (type === 'start' && !egressId) {
      // check if the room egresses are already running
      const existingEgresses = await egressClient.listEgress({ roomName: spaceName });
      console.warn(existingEgresses);
      if (existingEgresses.length > 0 && existingEgresses.some((e) => e.status < 2)) {
        return ApiResponse.json(
          { error: 'Egress is already running for this room' },
          { status: 403 },
        );
      }
      let timestamp = new Date().getTime();
      timestamp = Math.floor(timestamp / 1000); // Convert to seconds
      const fileOutput = new EncodedFileOutput({
        filepath: `${spaceName}/${timestamp}.mp4`,
        output: {
          case: 's3',
          value: new S3Upload({
            accessKey: S3_ACCESS_KEY,
            secret: S3_SECRET_KEY,
            region: S3_REGION,
            bucket: S3_BUCKET,
            forcePathStyle: true,
            tagging: 'vocespace_record=true',
          }),
        },
      });

      const egressInfo = await egressClient.startRoomCompositeEgress(
        spaceName,
        {
          file: fileOutput,
        },
        {
          layout: 'speaker',
        },
      );

      // 添加 7 天后清理该 S3 文件的任务
      addCleanTask(fileOutput.filepath);

      return ApiResponse.json(
        {
          filePath: fileOutput.filepath,
          egressId: egressInfo.egressId,
        },
        { status: 200 },
      );
    } else if (type === 'stop' && egressId) {
      const existingEgresses = await egressClient.listEgress({
        roomName: spaceName,
        active: true,
        egressId,
      });
      if (existingEgresses.length > 0 && existingEgresses.some((e) => e.status < 2)) {
        // Stop the egress
        await egressClient.stopEgress(egressId);
        return ApiResponse.json({ success: true, egressId, stop: true }, { status: 200 });
      }
    } else {
      return ApiResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof Error) {
      return ApiResponse.json({ error: error.message }, { status: 500 });
    }
  }
}
