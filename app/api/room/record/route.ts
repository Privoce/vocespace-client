// 使用livekit egress api处理房间录制

import { isUndefinedString } from '@/lib/std';
import { getConfig } from '../../conf';
import { EgressClient, EncodedFileOutput, SegmentedFileOutput } from 'livekit-server-sdk';
import { NextResponse, NextRequest } from 'next/server';
const {
  s3,
  livekit: { url: SERVR_URL },
} = getConfig();

const S3_ACCESS_KEY = s3?.access_key;
const S3_SECRET_KEY = s3?.secret_key;
const S3_BUCKET = s3?.bucket;
const S3_REGION = s3?.region;

export async function POST(request: NextRequest) {
  if (
    isUndefinedString(SERVR_URL) ||
    isUndefinedString(S3_ACCESS_KEY) ||
    isUndefinedString(S3_SECRET_KEY) ||
    isUndefinedString(S3_BUCKET) ||
    isUndefinedString(S3_REGION)
  ) {
    return NextResponse.json(
      { error: 'Environment variables are not set properly.' },
      { status: 500 },
    );
  }

  if (!SERVR_URL) {
    return NextResponse.json({ error: 'LiveKit server URL is not configured.' }, { status: 500 });
  }

  const { roomName, senderId, senderName } = await request.json();

  const egress = new EgressClient(SERVR_URL);
  const startTime = new Date().toUTCString();
  const output = {
    file: new EncodedFileOutput({
      filepath: `${roomName}_${startTime}.mp4`,
      output: {
        case: 's3',
        value: {
          accessKey: S3_ACCESS_KEY,
          secret: S3_SECRET_KEY,
          bucket: S3_BUCKET,
          region: S3_REGION,
          forcePathStyle: true,
        },
      },
    }),
  } as { file: EncodedFileOutput };

  await egress.startRoomCompositeEgress(roomName, output, {
    layout: '',
  });
}
