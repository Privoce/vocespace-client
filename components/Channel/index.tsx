'use client';
import * as React from 'react';
import { useChannel } from '@/components/Channel/hooks/useChannel';
import { ChannelProps, ChannelExports } from '@/components/Channel/types';
import { getChannelContent, type ChannelModel } from './content';
import { ChannelPC } from './pc';

export * from '@/components/Channel/types';

export const Channel = React.forwardRef<ChannelExports, ChannelProps>(function Channel(props, ref) {
  const model = useChannel(props, ref);
  const { mainItems, modals } = getChannelContent(model);
  return (
    <>
      <ChannelPC model={model} mainItems={mainItems} />
      {modals}
    </>
  );
});
