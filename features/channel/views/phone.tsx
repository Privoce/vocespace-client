'use client';

import mobile from '@/features/shared/mobile.module.scss';
import { CommentOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Collapse, Drawer, type CollapseProps } from 'antd';
import type { ChannelModel } from './content';

export function ChannelPhone({ model, mainItems }: { model: ChannelModel; mainItems: CollapseProps['items'] }) {
  const { t, space, collapsed, setCollapsed, mainActiveKey, allParticipants, setFeedbackOpen, createOwnSpace } = model;
  return <Drawer width="100%" placement="left" open={!collapsed} onClose={() => setCollapsed(true)}
    rootClassName={mobile.drawer} title={<span style={{ overflowWrap: 'anywhere' }}>{space.name} · {allParticipants.length} {t('channel.menu.active')}</span>}
    styles={{ body: { padding: 16, background: '#0c0f14', overflowY: 'auto' } }}>
    <div className={mobile.surface}>
      <Collapse bordered={false} activeKey={mainActiveKey} expandIcon={() => null} items={mainItems} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '24px 0' }}>
        <Button icon={<PlusOutlined />} onClick={createOwnSpace}>{t('common.create_own_space')}</Button>
        <Button icon={<CommentOutlined />} onClick={() => setFeedbackOpen(true)}>{t('channel.feedback.title')}</Button>
      </div>
    </div>
  </Drawer>;
}
