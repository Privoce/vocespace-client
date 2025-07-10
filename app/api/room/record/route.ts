// 使用livekit egress api处理房间录制

import { EgressClient, EncodedFileOutput, SegmentedFileOutput } from 'livekit-server-sdk';
import { NextResponse, NextRequest } from 'next/server';

const SERVR_URL = process.env.LIVEKIT_URL;
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY;
const S3_BUCKET = process.env.S3_BUCKET;
const S3_REGION = process.env.S3_REGION;

export async function POST(request: NextRequest) {
  if (!SERVR_URL) {
    return NextResponse.json({ error: 'LiveKit server URL is not configured.' }, { status: 500 });
  }

  const { roomName, senderId, senderName } = await request.json();

  const egress = new EgressClient(SERVR_URL);
  const startTime = new Date().toUTCString();
  const output = {
    // segments: new SegmentedFileOutput({
    //     filenamePrefix: `${roomName}_${startTime}`,
    //     playlistName: `${roomName}_${startTime}_playlist.m3u8`,
    //     livePlaylistName: `${roomName}_${startTime}_live.m3u8`,
    //     segmentDuration: 10,
    //     output: {
    //         case: "",

    //     }
    // })
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
