'use client';

import { useRoomStore } from '@/lib/store';
import { AppstoreOutlined } from '@ant-design/icons';
import { useLocalParticipant } from '@livekit/components-react';
import { Button } from 'antd';
import { FlotButtonProps } from './types';

export function FlotButton({ style, openApp, setOpenApp }: FlotButtonProps) {
  const { localParticipant } = useLocalParticipant();
  const targetParticipant = useRoomStore((s) => s.remoteApp);

  return (
    <Button
      onClick={async () => {
        if (!openApp && targetParticipant.participantId !== localParticipant.identity) {
          useRoomStore.getState().setRemoteApp({
            participantId: localParticipant.identity,
            participantName: localParticipant.name,
            auth: 'write',
          });
        }
        setOpenApp(!openApp);
      }}
      type="text"
      style={{
        height: 'fit-content',
        width: 'fit-content',
        padding: '6px 2px',
        backgroundColor: '#00000050',
        borderRadius: '24px',
        color: '#fff',
        ...style,
      }}
      icon={<AppstoreOutlined style={{ fontSize: 16 }} />}
    ></Button>
  );
}
