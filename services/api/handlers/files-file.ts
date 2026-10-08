import { ApiRequest, ApiResponse } from '../http';
import { readFile, stat } from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';

export async function GET(
  request: ApiRequest,
  { params }: { params: { slug: string[] } }
) {
  try {
    // 从 URL 路径中提取文件路径：/api/files/roomName/fileName
    const roomName = params.slug[0];
    const fileName = params.slug.at(-1);
    
    if (!roomName || !fileName) {
      return new ApiResponse('File not found', { status: 404 });
    }

    // 构建文件路径
    const filePath = path.join(process.cwd(), 'uploads', ...params.slug);
    
    // 检查文件是否存在
    try {
      const fileStats = await stat(filePath);
      if (!fileStats.isFile()) {
        return new ApiResponse('File not found', { status: 404 });
      }
    } catch (error) {
      return new ApiResponse('File not found', { status: 404 });
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

    const headers = new Headers({
      'Content-Type': contentType, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    });
    const range = request.headers.get('range');
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      const start = match?.[1] ? Number(match[1]) : Math.max(0, fileBuffer.length - Number(match?.[2]));
      const end = match?.[1] && match[2] ? Math.min(Number(match[2]), fileBuffer.length - 1) : fileBuffer.length - 1;
      if (!match || !Number.isFinite(start) || start > end || start >= fileBuffer.length) {
        headers.set('Content-Range', `bytes */${fileBuffer.length}`);
        return new ApiResponse(null, { status: 416, headers });
      }
      headers.set('Content-Range', `bytes ${start}-${end}/${fileBuffer.length}`);
      headers.set('Content-Length', String(end - start + 1));
      return new ApiResponse(new Uint8Array(fileBuffer.subarray(start, end + 1)), { status: 206, headers });
    }
    headers.set('Content-Length', String(fileBuffer.length));
    return new ApiResponse(new Uint8Array(fileBuffer), { headers });
  } catch (error) {
    console.error('Error serving file:', error);
    return new ApiResponse('Internal Server Error', { status: 500 });
  }
}