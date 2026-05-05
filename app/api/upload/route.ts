import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { ulid } from 'ulid';
import { HandleFileSystemBody, HandleTilePlayerFileBody } from '@/lib/api/chat';
import fs from 'fs/promises';

const uploadDirPath = (roomName: string) => path.join(process.cwd(), 'uploads', roomName);

interface TilePlayerEntry {
  id: string;
  ownerId: string;
  room?: string;
  mode: 'image' | 'iframe' | 'hyperbeam';
  fileName?: string | null;
  iframeUrl?: string | null;
  hyperbeamSessionId?: string | null;
  createdAt: number;
  updatedAt: number;
}

const HYPERBEAM_API_BASE = process.env.HYPERBEAM_API_BASE || 'https://engine.hyperbeam.com';
const HYPERBEAM_DEFAULT_START_URL =
  process.env.HYPERBEAM_DEFAULT_START_URL || 'https://www.google.com/search?q=';

const createHyperbeamSession = async (startUrl?: string) => {
  const apiKey = process.env.HYPERBEAM_API_KEY;
  if (!apiKey) {
    throw new Error('HYPERBEAM_API_KEY is not configured');
  }

  const body: Record<string, unknown> = {
    start_url: startUrl || HYPERBEAM_DEFAULT_START_URL,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  let response: Response;
  try {
    response = await fetch(`${HYPERBEAM_API_BASE}/v0/vm`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown network error';
    throw new Error(`HyperBeam endpoint is unreachable: ${reason}`);
  } finally {
    clearTimeout(timeout);
  }

  const raw = await response.text();
  let data: Record<string, any> = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch (_e) {
      data = { raw };
    }
  }

  if (!response.ok) {
    const message =
      typeof data?.error === 'string'
        ? data.error
        : typeof data?.message === 'string'
          ? data.message
          : `HTTP ${response.status}`;
    throw new Error(`HyperBeam create session failed: ${message}`);
  }

  const embedUrl = data?.embed_url || data?.url || data?.vm?.embed_url || null;
  const sessionId = data?.session_id || data?.id || data?.vm?.id || null;

  if (!embedUrl || !sessionId) {
    throw new Error('HyperBeam create session response missing embed_url or session id');
  }

  return {
    embedUrl,
    sessionId,
  };
};

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
      let identity: string | undefined;
      let playerId: string | undefined;

      if (contentType.includes('multipart/form-data')) {
        // upload 操作：从 FormData 读取真实 File 对象
        const formData = await request.formData();
        spaceName = formData.get('spaceName') as string;
        ty = formData.get('ty') as HandleTilePlayerFileBody['ty'];
        room = (formData.get('room') as string) || undefined;
        file = formData.get('file') as File;
        identity = (formData.get('identity') as string) || undefined;
      } else {
        // ls/rm/set_meta 操作：从 JSON 读取
        const body: Omit<HandleTilePlayerFileBody, 'file'> = await request.json();
        spaceName = body.spaceName;
        ty = body.ty;
        room = body.room;
        iframeUrl = body.iframeUrl;
        identity = body.identity;
        playerId = body.playerId;
      }

      // 多 tile_player 目录结构: uploads/{spaceName}/{room?}/tile_players.json + 文件资源
      const dir = room ? path.join(uploadDirPath(spaceName), room) : uploadDirPath(spaceName);
      const playersPath = path.join(dir, 'tile_players.json');

      const loadPlayers = async (): Promise<TilePlayerEntry[]> => {
        try {
          const raw = await fs.readFile(playersPath, 'utf-8');
          const data = JSON.parse(raw);
          return Array.isArray(data) ? data : [];
        } catch (_e) {
          return [];
        }
      };

      const loadPlayersByPath = async (targetPath: string): Promise<TilePlayerEntry[]> => {
        try {
          const raw = await fs.readFile(targetPath, 'utf-8');
          const data = JSON.parse(raw);
          return Array.isArray(data) ? data : [];
        } catch (_e) {
          return [];
        }
      };

      const countHyperbeamPlayersInSpace = async (): Promise<number> => {
        const baseSpaceDir = uploadDirPath(spaceName);
        const filePaths = new Set<string>([path.join(baseSpaceDir, 'tile_players.json')]);

        try {
          const entries = await fs.readdir(baseSpaceDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              filePaths.add(path.join(baseSpaceDir, entry.name, 'tile_players.json'));
            }
          }
        } catch (_e) {
          return 0;
        }

        let count = 0;
        for (const targetPath of filePaths) {
          const players = await loadPlayersByPath(targetPath);
          count += players.filter((player) => player.mode === 'hyperbeam').length;
        }

        return count;
      };

      const savePlayers = async (players: TilePlayerEntry[]) => {
        await mkdir(dir, { recursive: true });
        await writeFile(playersPath, JSON.stringify(players, null, 2), 'utf-8');
      };

      if (ty === 'ls') {
        try {
          const players = await loadPlayers();
          const result = await Promise.all(
            players.map(async (player) => {
              if (player.mode === 'image' && player.fileName) {
                try {
                  const stat = await fs.stat(path.join(dir, player.fileName));
                  return {
                    ...player,
                    url: `/uploads/${spaceName}/${room ? room + '/' : ''}${player.fileName}?t=${stat.mtimeMs}`,
                  };
                } catch (_e) {
                  return {
                    ...player,
                    url: null,
                  };
                }
              }

              return {
                ...player,
                url: null,
              };
            }),
          );

          return NextResponse.json({ players: result });
        } catch (_e) {
          return NextResponse.json({ players: [] });
        }
      }

      if (ty === 'set_meta') {
        if (!identity) {
          return NextResponse.json(
            { success: false, error: 'identity is required' },
            { status: 400 },
          );
        }
        if (!iframeUrl) {
          return NextResponse.json(
            { success: false, error: 'iframeUrl is required' },
            { status: 400 },
          );
        }

        try {
          const players = await loadPlayers();
          const now = Date.now();
          const id = ulid();
          const entry: TilePlayerEntry = {
            id,
            ownerId: identity,
            room,
            mode: 'iframe',
            iframeUrl,
            fileName: null,
            hyperbeamSessionId: null,
            createdAt: now,
            updatedAt: now,
          };
          players.push(entry);
          await savePlayers(players);
          return NextResponse.json({ success: true, player: entry });
        } catch (_e) {
          return NextResponse.json(
            { success: false, error: 'Failed to set tile player meta' },
            { status: 500 },
          );
        }
      }

      if (ty === 'create_hyperbeam') {
        if (!identity) {
          return NextResponse.json(
            { success: false, error: 'identity is required' },
            { status: 400 },
          );
        }

        const totalHyperbeamPlayers = await countHyperbeamPlayersInSpace();
        if (totalHyperbeamPlayers >= 1) {
          return NextResponse.json(
            { success: false, error: 'Only one HyperBeam player is allowed per space' },
            { status: 409 },
          );
        }

        try {
          const now = Date.now();
          const id = ulid();
          const session = await createHyperbeamSession(iframeUrl);
          const players = await loadPlayers();
          const entry: TilePlayerEntry = {
            id,
            ownerId: identity,
            room,
            mode: 'hyperbeam',
            iframeUrl: session.embedUrl,
            fileName: null,
            hyperbeamSessionId: session.sessionId,
            createdAt: now,
            updatedAt: now,
          };
          players.push(entry);
          await savePlayers(players);
          return NextResponse.json({ success: true, player: entry });
        } catch (e) {
          console.error('Failed to create HyperBeam player:', e);
          const message = e instanceof Error ? e.message : 'Failed to create HyperBeam player';
          return NextResponse.json(
            { success: false, error: message },
            { status: 500 },
          );
        }
      }

      if (ty === 'rm') {
        if (!identity || !playerId) {
          return NextResponse.json(
            { success: false, error: 'identity and playerId are required' },
            { status: 400 },
          );
        }

        try {
          const players = await loadPlayers();
          const found = players.find((item) => item.id === playerId);
          if (!found) {
            return NextResponse.json(
              { success: false, error: 'Player not found' },
              { status: 404 },
            );
          }
          
          // if (found.ownerId !== identity) {
          //   return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
          // }

          if (found.mode === 'image' && found.fileName) {
            try {
              await fs.unlink(path.join(dir, found.fileName));
            } catch (_e) {
              // ignore file deletion error
            }
          }

          const nextPlayers = players.filter((item) => item.id !== playerId);
          await savePlayers(nextPlayers);
          return NextResponse.json({ success: true });
        } catch (_e) {
          return NextResponse.json(
            { success: false, error: 'Failed to remove file' },
            { status: 500 },
          );
        }
      }

      if (ty === 'upload') {
        if (!file) {
          return NextResponse.json({ error: 'No file received' }, { status: 400 });
        }
        if (!identity) {
          return NextResponse.json({ error: 'identity is required' }, { status: 400 });
        }

        const id = ulid();
        const ext = path.extname(file.name);
        const fileName = `tile_player_${id}${ext}`;

        try {
          await mkdir(dir, { recursive: true });
        } catch (error) {
          console.error('Failed to create upload directory:', error);
          return NextResponse.json({ error: 'Failed to create upload directory' }, { status: 500 });
        }

        const filePath = path.join(dir, fileName);
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        const players = await loadPlayers();
        const now = Date.now();
        const entry: TilePlayerEntry = {
          id,
          ownerId: identity,
          room,
          mode: 'image',
          fileName,
          iframeUrl: null,
          hyperbeamSessionId: null,
          createdAt: now,
          updatedAt: now,
        };

        players.push(entry);
        await savePlayers(players);

        return NextResponse.json({
          success: true,
          player: {
            ...entry,
            url: `/uploads/${spaceName}/${room ? room + '/' : ''}${fileName}?t=${now}`,
          },
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
export async function OPTIONS(_request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
