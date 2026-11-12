'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Alert, Spin } from 'antd';
import { TeamOutlined, ReloadOutlined } from '@ant-design/icons';
import { allSpaces, type DiscoveryResult } from '@/lib/api/vocespace/space';
import { SpaceState } from '@/lib/std/space';
import { PreviewVideo } from './PreviewVideo';
import { useMobileText } from './useMobileText';
import s from './phone.module.scss';
export function MobilePlaza({ active }: { active: boolean }) {
  const t = useMobileText();
  const [data, setData] = useState<DiscoveryResult>({ spaces: [], unavailable: [] });
  const [loading, setLoading] = useState(false);
  const [revision, refresh] = useState(0);
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const settle = useRef<ReturnType<typeof setTimeout>>();
  const deck = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setLoading(true);
    void allSpaces(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setData({ spaces: [], unavailable: ['live', 'catalog'] });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    const timer = setTimeout(() => refresh((v) => v + 1), 30000);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [active, revision]);
  useEffect(() => () => clearTimeout(settle.current), []);
  const spaces = data.spaces.filter((space) => space.state === SpaceState.Active);
  const selected = Math.min(index, Math.max(0, spaces.length - 1));
  return (
    <section className={s.plaza}>
      <header className={s.header}>
        <strong>{t('meeting_tab.plaza')}</strong>
        <Button
          aria-label={t('native_navigation.refresh')}
          icon={<ReloadOutlined />}
          onClick={() => refresh((v) => v + 1)}
        />
      </header>
      {data.unavailable.includes('live') && (
        <Alert type="error" message={t('native_navigation.error')} />
      )}
      {loading && !spaces.length && <Spin />}
      {!loading && !spaces.length && !data.unavailable.includes('live') && (
        <div className={s.page}>
          <p>{t('meeting_tab.no_active_spaces')}</p>
        </div>
      )}
      <div
        ref={deck}
        className={s.deck}
        onScroll={() => {
          setDragging(true);
          clearTimeout(settle.current);
          settle.current = setTimeout(() => {
            const d = deck.current;
            if (d?.clientHeight) setIndex(Math.round(d.scrollTop / d.clientHeight));
            setDragging(false);
          }, 180);
        }}
      >
        {spaces.map((space, i) => (
          <article className={s.slide} key={space.url}>
            <div className={s.preview}>
              <div className={s.art}>
                <TeamOutlined />
              </div>
              {i === selected && (
                <PreviewVideo
                  space={decodeURIComponent(
                    new URL(space.url, window.location.origin).pathname
                      .split('/')
                      .filter(Boolean)
                      .pop() || space.name,
                  )}
                  active={active && !dragging}
                  onJoin={() => window.location.assign(space.url)}
                />
              )}
              <span className={s.badge}>
                ● {space.online_count || 0} {t('meeting_tab.online')}
              </span>
              <div className={s.caption}>
                <h2>{space.name}</h2>
                <p>{t('meeting_tab.swipe')}</p>
                <Button type="primary" onClick={() => window.location.assign(space.url)}>
                  {t('meeting_tab.enter')}
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
