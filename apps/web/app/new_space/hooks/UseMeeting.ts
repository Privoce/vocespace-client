'use client';

import { encodePassphrase,generateRoomId,randomString } from '@/lib/client_utils';
import { useI18n } from '@/lib/i18n/i18n';
import { message } from 'antd';
import { useRouter } from 'next/navigation';
import { useEffect,useRef,useState } from 'react';


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


/** Keep the query before the E2EE fragment so HQ never becomes part of the key. */
export function temporaryRoomLink(roomId: string, hq: boolean, encodedPassphrase?: string) {
  return `/${roomId}${hq ? '?hq=true' : ''}${encodedPassphrase ? `#${encodedPassphrase}` : ''}`;
}

export function resolveRoomLink(input: string, origin: string, extraHost = ''): string | null {
  const value = input.trim();
  if (!value) return null;
  const allowedHosts = new Set(['vocespace.com', 'space.voce.chat', new URL(origin).hostname]);
  if (extraHost) allowedHosts.add(extraHost);
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(value);
  const hostname = value.split('/')[0];
  const isBareHost = allowedHosts.has(hostname) && value.includes('/');
  try {
    const url = new URL(isBareHost ? `https://${value}` : value.startsWith('/') || hasScheme ? value : `/${value}`, origin);
    if (!['http:', 'https:'].includes(url.protocol) || !allowedHosts.has(url.hostname) || url.username || url.password) return null;
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    let pathname = url.pathname;
    for (const prefix of [basePath, '/chat', '/dev'].filter(Boolean)) {
      if (pathname.startsWith(`${prefix}/`)) { pathname = pathname.slice(prefix.length); break; }
    }
    if (!/^\/[^/]+$/.test(pathname)) return null;
    if (url.origin === origin) return `${pathname}${url.search}${url.hash}`;
    return url.href;
  } catch {
    return null;
  }
}
