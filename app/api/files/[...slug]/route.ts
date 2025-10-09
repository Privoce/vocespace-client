import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  try {
    // 从 URL 路径中提取文件路径：/api/files/roomName/fileName
    const [roomName, fileName] = params.slug;
    
    if (!roomName || !fileName) {
      return new NextResponse('File not found', { status: 404 });
    }

    // 构建文件路径
    const filePath = path.join(process.cwd(), 'uploads', roomName, fileName);
    
    // 检查文件是否存在
    try {
      const fileStats = await stat(filePath);
      if (!fileStats.isFile()) {
        return new NextResponse('File not found', { status: 404 });
      }
    } catch (error) {
      return new NextResponse('File not found', { status: 404 });
    }

    // 读取文件
    const fileBuffer = await readFile(filePath);
    
    // 从文件扩展名推断 MIME 类型
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    console.error('Error serving file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}