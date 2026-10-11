'use client';
import { channelContent } from '@vocespace/ui';
import { Drawer, Collapse } from 'antd';
import { useEffect } from 'react';
import { useSpaceStore } from '@/lib/store';
import * as React from 'react';
import { useChannel } from '@/components/Channel/hooks/useChannel';
import { ChannelProps, ChannelExports } from '@/components/Channel/types';
import { getChannelContent } from './content';
import { ChannelPC } from './pc';

export * from '@/components/Channel/types';

export const Channel = React.forwardRef<ChannelExports, ChannelProps>(function Channel(props, ref) {
  const model = useChannel(props, ref);
  const { mainItems, modals } = getChannelContent(model);
  useEffect(() => {
    if (model.isMobile) useSpaceStore.getState().setCollapsed(true);
  }, [model.isMobile]);
  return (
    <>
      {model.isMobile ? (
        <Drawer
          placement="left"
          width="min(360px, 88vw)"
          title={model.space.name}
          open={!model.collapsed}
          onClose={() => useSpaceStore.getState().setCollapsed(true)}
          styles={{ body: { padding: 8, background: '#1e1e1e' } }}
        >
          {channelContent({
            main: (
              <Collapse
                bordered={false}
                activeKey={model.mainActiveKey}
                expandIcon={() => undefined}
                items={mainItems?.slice(0, 1)}
              />
            ),
            rooms: (
              <Collapse
                bordered={false}
                activeKey={model.mainActiveKey}
                expandIcon={() => undefined}
                items={mainItems?.slice(1)}
              />
            ),
          })}
        </Drawer>
      ) : (
        <ChannelPC model={model} mainItems={mainItems} />
      )}
      {modals}
    </>
  );
});
