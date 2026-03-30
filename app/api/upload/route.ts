import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { ulid } from 'ulid';
import { HandleFileSystemBody, HandleTilePlayerFileBody } from '@/lib/api/chat';
import fs from 'fs/promises';

const uploadDirPath = (roomName: string) => path.join(process.cwd(), 'uploads', roomName);

export async function POST(request: NextRequest) {
  try {
    const action = request.nextUrl.searchParams.get('action');
    const isTilePlayerFile = request.nextUrl.searchParams.get('tilePlayer') === 'true';
    // 处理TilePlayer组件的文件操作请求 ------------------------------------------------------------------------------------
    if (isTilePlayerFile) {
      const contentType = request.headers.get('content-type') || '';

      let spaceName: string;
      let ty: HandleTilePlayerFileBody['ty'];
      let room: string | undefined;
      let file: File | undefined;
      let iframeUrl: string | undefined;

      if (contentType.includes('multipart/form-data')) {
        // upload 操作：从 FormData 读取真实 File 对象
        const formData = await request.formData();
        spaceName = formData.get('spaceName') as string;
        ty = formData.get('ty') as HandleTilePlayerFileBody['ty'];
        room = (formData.get('room') as string) || undefined;
        file = formData.get('file') as File;
      } else {
        // ls 等操作：从 JSON 读取
        const body: Omit<HandleTilePlayerFileBody, 'file'> = await request.json();
        spaceName = body.spaceName;
        ty = body.ty;
        room = body.room;
        iframeUrl = body.iframeUrl;
      }
      // 获取文件URL
      // 这个tile_player文件目前只会是图片文件，并且只会存储在uploads/spaceName/{room?}目录下
      const dir = room ? path.join(uploadDirPath(spaceName), room) : uploadDirPath(spaceName);
      const metaPath = path.join(dir, 'tile_player_meta.json');

      if (ty === 'ls') {
        // 直接找dir路径下的文件，如果存在叫tile_player的就返回URL，不存在就返回null
        try {
          const files = await fs.readdir(dir);
          const tilePlayerFile = files.find((file) => file.startsWith('tile_player'));
          let mode: 'image' | 'iframe' | 'none' = tilePlayerFile ? 'image' : 'none';
          let iframeUrl: string | null = null;

          try {
            const metaRaw = await fs.readFile(metaPath, 'utf-8');
            const meta = JSON.parse(metaRaw) as {
              mode?: 'image' | 'iframe' | 'none';
              iframeUrl?: string | null;
            };
            mode = meta.mode || mode;
            iframeUrl = meta.iframeUrl || null;
          } catch (e) {
            // ignore
          }

          if (tilePlayerFile) {
            const fileStat = await fs.stat(path.join(dir, tilePlayerFile));
            const mtime = fileStat.mtimeMs;
            const fileUrl = `/uploads/${spaceName}/${room ? room + '/' : ''}${tilePlayerFile}?t=${mtime}`;
            return NextResponse.json({ url: fileUrl, iframeUrl, mode });
          } else {
            return NextResponse.json({ url: null, iframeUrl, mode });
          }
        } catch (e) {
          return NextResponse.json({ url: null, iframeUrl: null, mode: 'none' });
        }
      }

      if (ty === 'set_meta') {
        try {
          await mkdir(dir, { recursive: true });
          const meta = {
            mode: iframeUrl ? 'iframe' : 'none',
            iframeUrl: iframeUrl || null,
            updatedAt: Date.now(),
          };
          await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
          return NextResponse.json({ success: true });
        } catch (e) {
          return NextResponse.json(
            { success: false, error: 'Failed to set tile player meta' },
            { status: 500 },
          );
        }
      }

      if (ty === 'rm') {
        // 删除tile_player文件
        try {
          const files = await fs.readdir(dir);
          const tilePlayerFile = files.find((file) => file.startsWith('tile_player'));
          if (tilePlayerFile) {
            await fs.unlink(path.join(dir, tilePlayerFile));
          }
          try {
            await fs.unlink(metaPath);
          } catch (e) {
            // ignore
          }
          return NextResponse.json({ success: true });
        } catch (e) {
          return NextResponse.json(
            { success: false, error: 'Failed to remove file' },
            { status: 500 },
          );
        }
      }

      // 上传文件，直接把文件命名为tile_player，覆盖之前的文件
      if (ty === 'upload') {
        // const formData = await request.formData();
        // const file = formData.get('file') as File;
        if (!file) {
          return NextResponse.json({ error: 'No file received' }, { status: 400 });
        }
        // 确保目录存在
        try {
          await mkdir(dir, { recursive: true });
        } catch (error) {
          console.error('Failed to create upload directory:', error);
          return NextResponse.json({ error: 'Failed to create upload directory' }, { status: 500 });
        }
        const filePath = path.join(dir, 'tile_player' + path.extname(file.name));
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        // 上传图片时将 mode 置为 image，并清除 iframeUrl
        try {
          await writeFile(
            metaPath,
            JSON.stringify({ mode: 'image', iframeUrl: null, updatedAt: Date.now() }, null, 2),
            'utf-8',
          );
        } catch (e) {
          // ignore
        }

        const uploadedAt = Date.now();
        return NextResponse.json({
          success: true,
          url: `/uploads/${spaceName}/${room ? room + '/' : ''}tile_player${path.extname(file.name)}?t=${uploadedAt}`,
        });
      }
    }
    // 处理文件系统操作 ------------------------------------------------------------------------------------
    if (action === 'fs') {
      const { spaceName, ty, fileName }: HandleFileSystemBody = await request.json();
      const uploadDir = uploadDirPath(spaceName);
      switch (ty) {
        case 'ls': {
          // 列出所有文件（withFileTypes 可以直接判断是否为文件，避免把目录误认为文件）
          const entries = await fs.readdir(uploadDir, { withFileTypes: true });
          const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
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
    // 处理文件上传(聊天业务) ------------------------------------------------------------------------------------
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
    const fileName = `${senderId}_${ulid()}${fileExtension}`;

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

    // console.log(`File uploaded successfully: ${filePath}`);
    // console.log(`File URL: ${fileUrl}`);

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
