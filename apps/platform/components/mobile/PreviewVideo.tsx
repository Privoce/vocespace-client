'use client';
import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { SoundOutlined, AudioMutedOutlined } from '@ant-design/icons';
import { platformFetch } from '@/lib/api/client';
import { Button } from 'antd';
import { useMobileText } from './useMobileText';

export function PreviewVideo({
  space,
  active,
  onJoin,
}: {
  space: string;
  active: boolean;
  onJoin: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const join = useRef(onJoin);
  join.current = onJoin;
  const [status, setStatus] = useState('loading');
  const [revision, retry] = useState(0);
  const [muted, setMuted] = useState(true);
  const t = useMobileText();
  useEffect(() => {
    if (!active || !video.current) return;
    const element = video.current;
    const abort = new AbortController();
    let lease: string | undefined,
      timer: ReturnType<typeof setTimeout> | undefined,
      hls: Hls | undefined;
    let stopped = false,
      elapsed = 0,
      previous = 0,
      autoJoin = false;
    const preference = () => {
      try {
        const p = JSON.parse(localStorage.getItem('vocespace.platform.preferences') || '{}');
        element.muted = p.previewMuted !== false;
        setMuted(element.muted);
        autoJoin = p.autoJoin !== false;
      } catch {}
    };
    preference();
    const request = async (method: string, body: object, signal?: AbortSignal) => {
      const r = await platformFetch('preview', {
        method,
        headers: { 'Content-Type': 'application/json', 'x-vocespace-request': '1' },
        body: JSON.stringify(body),
        signal,
        keepalive: method === 'DELETE',
      });
      if (!r.ok) throw new Error('PREVIEW_FAILED');
      return r.json();
    };
    const release = (id: string) => {
      void request('DELETE', { leaseId: id }).catch(() => undefined);
    };
    const stop = () => {
      if (stopped) return;
      stopped = true;
      abort.abort();
      clearTimeout(timer);
      hls?.destroy();
      element.pause();
      element.removeAttribute('src');
      element.load();
      if (lease) release(lease);
    };
    const fail = () => {
      if (!stopped) {
        setStatus('error');
        stop();
      }
    };
    const renew = async () => {
      try {
        await request('PUT', { leaseId: lease }, abort.signal);
        if (!stopped) timer = setTimeout(() => void renew(), 30000);
      } catch {
        fail();
      }
    };
    const load = async () => {
      try {
        const result = await request('POST', { spaceName: space }, abort.signal);
        if (stopped) {
          if (result.leaseId) release(result.leaseId);
          return;
        }
        if (result.status !== 'ready') {
          setStatus(result.status === 'starting' ? 'loading' : 'unavailable');
          timer = setTimeout(() => void load(), result.status === 'starting' ? 2500 : 10000);
          return;
        }
        if (
          typeof result.leaseId !== 'string' ||
          typeof result.url !== 'string' ||
          !result.url.startsWith('/api/platform/preview/media/')
        )
          throw new Error('INVALID_PREVIEW');
        lease = result.leaseId;
        if (element.canPlayType('application/vnd.apple.mpegurl')) {
          element.src = result.url;
        } else if (Hls.isSupported()) {
          hls = new Hls();
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) fail();
          });
          hls.loadSource(result.url);
          hls.attachMedia(element);
        } else throw new Error('HLS_UNSUPPORTED');
        timer = setTimeout(() => void renew(), 30000);
        void element.play().catch(() => {
          if (!stopped) setStatus('tap');
        });
      } catch {
        fail();
      }
    };
    const playing = () => {
      if (stopped) return;
      setStatus('ready');
      previous = element.currentTime;
    };
    const progress = () => {
      if (stopped) return;
      const delta = element.currentTime - previous;
      previous = element.currentTime;
      if (!element.paused && element.readyState >= 3 && delta > 0 && delta < 1.5) elapsed += delta;
      else elapsed = 0;
      if (autoJoin && elapsed >= 10) {
        stop();
        join.current();
      }
    };
    const waiting = () => {
      elapsed = 0;
    };
    const visibility = () => {
      if (document.hidden) stop();
      else retry((v) => v + 1);
    };
    element.addEventListener('playing', playing);
    element.addEventListener('timeupdate', progress);
    element.addEventListener('waiting', waiting);
    element.addEventListener('error', fail);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('vocespace-preferences', preference);
    setStatus('loading');
    if (!document.hidden) timer = setTimeout(() => void load(), 300);
    return () => {
      stop();
      element.removeEventListener('playing', playing);
      element.removeEventListener('timeupdate', progress);
      element.removeEventListener('waiting', waiting);
      element.removeEventListener('error', fail);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('vocespace-preferences', preference);
    };
  }, [space, active, revision]);
  return (
    <>
      <video ref={video} playsInline muted={muted} aria-label={space} />
      {active && status !== 'ready' && (
        <div style={{ position: 'absolute', top: '35%', left: 20, right: 20, textAlign: 'center' }}>
          <p role="status">
            {t(
              status === 'error'
                ? 'native_navigation.preview_error'
                : status === 'unavailable'
                  ? 'native_navigation.preview_unavailable'
                  : 'native_navigation.preview_loading',
            )}
          </p>
          <Button
            onClick={() => {
              if (status === 'tap') void video.current?.play();
              else retry((v) => v + 1);
            }}
          >
            {t('native_navigation.refresh')}
          </Button>
        </div>
      )}
      <Button
        aria-label={t('native_account.preview_muted')}
        aria-pressed={muted}
        icon={muted ? <AudioMutedOutlined /> : <SoundOutlined />}
        style={{ position: 'absolute', top: 12, right: 12 }}
        onClick={() => {
          if (video.current) {
            video.current.muted = !muted;
            setMuted(!muted);
          }
        }}
      ></Button>
    </>
  );
}
