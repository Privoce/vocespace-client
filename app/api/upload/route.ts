import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { ulid } from 'ulid';

export async function POST(request: NextRequest) {
  try {
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
    const uploadDir = path.join(process.cwd(), 'uploads', roomName);
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
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