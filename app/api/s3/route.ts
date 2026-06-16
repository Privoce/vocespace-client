// S3 API 路由

import { NextRequest, NextResponse } from 'next/server';
import {
  S3Client,
  HeadBucketCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getConfig } from '@/app/api/conf/conf';

function getS3Client() {
  const config = getConfig();
  const s3Config = config.s3;

  if (!s3Config?.accessKey || !s3Config?.secretKey || !s3Config?.bucket || !s3Config?.region) {
    return null;
  }

  return {
    client: new S3Client({
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.accessKey,
        secretAccessKey: s3Config.secretKey,
      },
    }),
    bucket: s3Config.bucket,
  };
}

// GET /api/s3?action=connect - 测试 S3 连接
// GET /api/s3?action=records&room={room} - 获取房间录制记录
// POST /api/s3?action=download&key={key} - 生成下载链接
// DELETE /api/s3?action=delete&key={key} - 删除对象

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'connect') {
    return handleConnect();
  } else if (action === 'records') {
    const room = searchParams.get('room');
    return handleGetRecords(room);
  }

  return NextResponse.json(
    { success: false, error: 'Invalid action parameter' },
    { status: 400 },
  );
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'download') {
    const key = searchParams.get('key');
    return handleGenerateDownloadUrl(key);
  }

  return NextResponse.json(
    { success: false, error: 'Invalid action parameter' },
    { status: 400 },
  );
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'delete') {
    const key = searchParams.get('key');
    return handleDeleteObject(key);
  }

  return NextResponse.json(
    { success: false, error: 'Invalid action parameter' },
    { status: 400 },
  );
}

async function handleConnect() {
  try {
    const s3 = getS3Client();
    if (!s3) {
      return NextResponse.json(
        { success: false, error: 'S3 configuration is not set' },
        { status: 500 },
      );
    }

    const command = new HeadBucketCommand({ Bucket: s3.bucket });
    await s3.client.send(command);

    return NextResponse.json({
      success: true,
      message: 'S3 connection successful',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: `Failed to connect to S3: ${error.message}` },
      { status: 500 },
    );
  }
}

async function handleGetRecords(room: string | null) {
    console.warn("获取records！！！",room);
  try {
    const s3 = getS3Client();   
    if (!s3) {
      return NextResponse.json(
        { success: false, error: 'S3 configuration is not set' },
        { status: 500 },
      );
    }

    if (!room) {
      return NextResponse.json(
        { success: false, error: 'Room parameter is required' },
        { status: 400 },
      );
    }

    const objects: Array<{ key: string; size: number; last_modified: number | null }> = [];
    let continuationToken: string | undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: s3.bucket,
        Prefix: room,
        ContinuationToken: continuationToken,
      });

      const response = await s3.client.send(command);

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key) {
            objects.push({
              key: obj.Key,
              size: obj.Size ?? 0,
              last_modified: obj.LastModified ? Math.floor(obj.LastModified.getTime() / 1000) : null,
            });
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);
    console.warn("objects:", objects);
    return NextResponse.json({
      success: true,
      records: objects,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: `Failed to list objects in S3: ${error.message}` },
      { status: 500 },
    );
  }
}

async function handleGenerateDownloadUrl(key: string | null) {
  try {
    const s3 = getS3Client();
    if (!s3) {
      return NextResponse.json(
        { success: false, error: 'S3 configuration is not set' },
        { status: 500 },
      );
    }

    if (!key || key === '') {
      return NextResponse.json(
        { success: false, error: "Query parameter 'key' is required" },
        { status: 400 },
      );
    }

    const command = new GetObjectCommand({
      Bucket: s3.bucket,
      Key: key,
      ResponseContentDisposition: 'attachment',
    });

    // 链接有效期 3 天
    const url = await getSignedUrl(s3.client, command, { expiresIn: 60 * 60 * 24 * 3 });

    return NextResponse.json({
      success: true,
      url,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: `Failed to generate download URL: ${error.message}` },
      { status: 500 },
    );
  }
}

async function handleDeleteObject(key: string | null) {
  try {
    const s3 = getS3Client();
    if (!s3) {
      return NextResponse.json(
        { success: false, error: 'S3 configuration is not set' },
        { status: 500 },
      );
    }

    if (!key || key === '') {
      return NextResponse.json(
        { success: false, error: "Query parameter 'key' is required" },
        { status: 400 },
      );
    }

    const command = new DeleteObjectCommand({
      Bucket: s3.bucket,
      Key: key,
    });

    await s3.client.send(command);

    return NextResponse.json({
      success: true,
      message: 'Object deleted successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: `Failed to delete object from S3: ${error.message}` },
      { status: 500 },
    );
  }
}
