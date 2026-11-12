'use client';
import { useState } from 'react';
import { TeamOutlined, UserOutlined } from '@ant-design/icons';
import { MobileProfile } from './Profile';
import { MobilePlaza } from './Plaza';
import { useMobileText } from './useMobileText';
import s from './phone.module.scss';
export function MobileHome({
  active,
  initialTab = 'plaza',
}: {
  active: boolean;
  initialTab?: 'plaza' | 'profile';
}) {
  const [tab, setTab] = useState(initialTab);
  const t = useMobileText();
  return (
    <div className={s.root} style={{ display: active ? undefined : 'none' }}>
      <div className={s.content} style={{ display: tab === 'plaza' ? undefined : 'none' }}>
        <MobilePlaza active={active && tab === 'plaza'} />
      </div>
      <div className={s.content} style={{ display: tab === 'profile' ? undefined : 'none' }}>
        <MobileProfile onBrowse={() => setTab('plaza')} />
      </div>
      <nav className={s.nav} role="tablist">
        <button role="tab" aria-selected={tab === 'plaza'} onClick={() => setTab('plaza')}>
          <TeamOutlined />
          {t('meeting_tab.plaza')}
        </button>
        <button role="tab" aria-selected={tab === 'profile'} onClick={() => setTab('profile')}>
          <UserOutlined />
          {t('native_tabs.profile')}
        </button>
      </nav>
    </div>
  );
}
