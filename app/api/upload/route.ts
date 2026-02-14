import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { ulid } from 'ulid';
import { HandleFileSystemBody } from '@/lib/api/chat';
import fs from 'fs/promises';

const uploadDirPath = (roomName: string) => path.join(process.cwd(), 'uploads', roomName);

export async function POST(request: NextRequest) {
  try {
    let action = request.nextUrl.searchParams.get('action');
    // 处理文件系统操作 ------------------------------------------------------------------------------------
    if (action === 'fs') {
      const { spaceName, ty, fileName }: HandleFileSystemBody = await request.json();
      const uploadDir = uploadDirPath(spaceName);
      switch (ty) {
        case 'ls': {
          // 列出所有文件
          const files = await fs.readdir(uploadDir);
          return NextResponse.json({ files });
        }
        case 'rm': {
          if (!fileName) {
            return NextResponse.json(
              { error: 'fileName is required for rm operation' },
              { status: 400 },
            );
          } else {
            const filePath = path.join(uploadDir, fileName);
            await fs.unlink(filePath);
            return NextResponse.json({ success: true });
          }
        }
        case 'rm -a': {
          // 删除所有文件
          const files = await fs.readdir(uploadDir);
          for (const file of files) {
            const filePath = path.join(uploadDir, file);
            await fs.unlink(filePath);
          }
          return NextResponse.json({ success: true });
        }
        case 'download': {
          // 下载文件
          if (!fileName) {
            return NextResponse.json(
              { error: 'fileName is required for download operation' },
              { status: 400 },
            );
          } else {
            // 返回前端文件的下载链接
            const fileUrl = `/uploads/${spaceName}/${fileName}`;
            return NextResponse.json({ fileUrl });
          }
        }
        default: {
          return NextResponse.json({ error: 'Invalid file system operation' }, { status: 400 });
        }
      }

      return NextResponse.json({ success: true });
    }

    // 处理文件上传 ------------------------------------------------------------------------------------
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const roomName = formData.get('roomName') as string;
    const senderId = formData.get('senderId') as string;
    const senderName = formData.get('senderName') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file received' }, { status: 400 });
    }

    if (!roomName || !senderId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 检查文件大小限制（100MB）
    const maxFileSize = 100 * 1024 * 1024;
    if (file.size > maxFileSize) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    // 生成唯一文件名
    const fileExtension = path.extname(file.name);
    const fileName = `${ulid()}${fileExtension}`;

    // 创建上传目录路径：uploads/roomName/
    const uploadDir = uploadDirPath(roomName);
    const filePath = path.join(uploadDir, fileName);

    // 确保目录存在
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create upload directory:', error);
    }

    // 将文件写入磁盘
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // 构建文件访问 URL
    const fileUrl = `/uploads/${roomName}/${fileName}`;

    console.log(`File uploaded successfully: ${filePath}`);
    console.log(`File URL: ${fileUrl}`);

    return NextResponse.json({
      success: true,
      fileUrl,
      fileName: file.name,
      fileSize: file.size,
      uploadedBy: {
        id: senderId,
        name: senderName,
      },
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 处理 OPTIONS 请求（CORS 预检）
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
