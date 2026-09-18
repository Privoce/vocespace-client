'use client';

import { encodePassphrase,generateRoomId,randomString } from '@/lib/client_utils';
import { useI18n } from '@/lib/i18n/i18n';
import { message } from 'antd';
import { useRouter } from 'next/navigation';
import { useEffect,useRef,useState } from 'react';
import { resolveRoomLink,temporaryRoomLink } from '../room-link';

export interface MeetingTabProps { hq: boolean; setHq: (hq: boolean) => void }

export function useMeeting({ hq, setHq }: MeetingTabProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [e2ee, setE2ee] = useState(false);
  const [roomUrl, setRoomUrl] = useState('');
  const [optionVal, setOptionVal] = useState('demo');
  const [spinning, setSpinning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const options = [
    { label: t('common.demo'), value: 'demo' },
    { label: t('common.custom'), value: 'custom' },
  ];

  useEffect(() => {
    const reloadRoom = localStorage.getItem('reload');
    if (reloadRoom) router.push(`/${encodeURIComponent(reloadRoom)}`);
    return () => clearTimeout(timer.current);
  }, [router]);

  const startMeeting = () => {
    if (spinning) return;
    const target = e2ee || !roomUrl.trim()
      ? temporaryRoomLink(generateRoomId(), hq, e2ee ? encodePassphrase(randomString(64)) : undefined)
      : resolveRoomLink(roomUrl, window.location.origin, process.env.SERVER_NAME);
    if (!target) { messageApi.error(t('msg.error.room.invalid')); return; }
    setSpinning(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSpinning(false), 5000);
    if (target.startsWith('/')) router.push(target);
    else router.replace(target);
  };

  return { t, contextHolder, e2ee, setE2ee, roomUrl, setRoomUrl, optionVal, setOptionVal,
    spinning, percent: undefined, options, startMeeting, hq, setHq };
}
export type MeetingModel = ReturnType<typeof useMeeting>;
