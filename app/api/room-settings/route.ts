// /app/api/room-settings/route.ts
import { UserStatus } from '@/lib/std';
import { ModelBg, ModelRole } from '@/lib/std/virtual';
import { NextRequest, NextResponse } from 'next/server';

// 内存中存储房间设置
interface RoomSettings {
  [roomId: string]: {
    participants: {
      [participantId: string]: {
        name: string;
        volume: number;
        blur: number;
        screenBlur: number;
        status: UserStatus | string;
        socketId: string;
        virtual: {
          role: ModelRole;
          bg: ModelBg;
          enabled: boolean;
        };
      };
    };
    status?: Status[];
  };
}

interface Status {
  id: string;
  creator: {
    name: string;
    id: string;
  };
  name: string;
  desc: string;
  icon: {
    key: string;
    color: string;
  };
  volume: number;
  blur: number;
  screenBlur: number;
}

const roomSettings: RoomSettings = {};

// 获取房间所有参与者设置
export async function GET(request: NextRequest) {
  const all = request.nextUrl.searchParams.get('all') === 'true';
  const roomId = request.nextUrl.searchParams.get('roomId');
  const is_pre = request.nextUrl.searchParams.get('pre') === 'true';

  if (all) {
    const detail = request.nextUrl.searchParams.get('detail') === 'true';
    if (detail) {
      return NextResponse.json(roomSettings);
    } else {
      // 将roomSettings转为Map形式 Map<roomId, participants>
      const roomSettingsMap = Object.entries(roomSettings).reduce(
        (acc, [roomId, { participants }]) => {
          acc[roomId] = Object.keys(participants);
          return acc;
        },
        {} as Record<string, string[]>,
      );

      return NextResponse.json(roomSettingsMap);
    }
  }
  if (roomId == '' || !roomId) {
    return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
  }
  const settings = roomSettings[roomId] || { participants: {} };
  if (is_pre) {
    let participants = Object.values(settings.participants);
    if (participants.length === 0) {
      return NextResponse.json({
        name: `User 01`,
      });
    }

    // 接下来需要便利参与者，获取所有为`User [01~99]`的参与者，得到新参与者可以使用的名字进行返回
    let usedUserNames: number[] = [];
    participants.forEach((participant) => {
      if (participant.name.startsWith('User')) {
        const userName = participant.name.split(' ')[1];
        // 判断是否是数字
        if (!isNaN(parseInt(userName))) {
          // 将数字字符串转换为数字并存储
          usedUserNames.push(parseInt(userName));
        }
      }
    });

    // 直接进行排序并获取最大值，+ 1之后就是可以使用的参与者名字
    let suffix = 1; // 默认从 1 开始
    if (usedUserNames.length > 0) {
      usedUserNames.sort((a, b) => a - b);
      suffix = usedUserNames[usedUserNames.length - 1] + 1;
    }

    let suffix_str = suffix.toString();
    if (suffix < 10) {
      suffix_str = `0${suffix}`;
    }

    const availableUserName = `User ${suffix_str}`;

    return NextResponse.json({
      name: availableUserName,
    });
  } else {
    return NextResponse.json({ settings });
  }
}

// 更新单个参与者设置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, participantId, settings } = body;

    if (!roomId || !participantId || !settings) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 初始化房间设置（如果不存在）
    if (!roomSettings[roomId]) {
      roomSettings[roomId] = { participants: {} };
    }

    // 更新参与者设置
    roomSettings[roomId].participants[participantId] = {
      ...roomSettings[roomId].participants[participantId],
      ...settings,
    };

    console.log(`Updated settings for room ${roomId}, participant ${participantId}:`, settings);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating room settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

// 添加房间状态
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { roomId, status }: { roomId: string; status: Status } = body;
  if (!roomId || !status) {
    return NextResponse.json({ error: 'Room ID and status are required' }, { status: 400 });
  }
  if (!roomSettings[roomId]) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  if (!roomSettings[roomId].status) {
    roomSettings[roomId].status = [];
  }

  // 检查状态是否已存在，若存在则返回错误信息，否则添加
  let existStatus = roomSettings[roomId].status.find((s) => s.name === status.name);
  if (existStatus) {
    return NextResponse.json({
      error: 'Status already exists',
      status: existStatus,
    });
  } else {
    roomSettings[roomId].status.push(status);
    // 返回所有状态
    return NextResponse.json({ success: true, status: roomSettings[roomId].status, roomId });
  }
}

// 清除参与者设置（当参与者离开房间时）
export async function DELETE(request: NextRequest) {
  const roomId = request.nextUrl.searchParams.get('roomId');
  const participantId = request.nextUrl.searchParams.get('participantId');
  let clearRoom;
  if (!roomId || !participantId) {
    return NextResponse.json({ error: 'Room ID and Participant ID are required' }, { status: 400 });
  }

  if (roomSettings[roomId]?.participants?.[participantId]) {
    delete roomSettings[roomId].participants[participantId];

    // 如果房间为空，清除整个房间
    if (Object.keys(roomSettings[roomId].participants).length === 0) {
      delete roomSettings[roomId];
      clearRoom = roomId;
    }

    return NextResponse.json({ success: true, clearRoom });
  }

  return NextResponse.json({ success: false, message: 'Participant not found' });
}
