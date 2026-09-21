'use client';
import * as React from 'react';
import { useChannel } from '@/components/Channel/hooks/useChannel';

import { ChannelProps, ChannelExports } from '@/components/Channel/types';
import { ChannelSurface } from '@/components/Channel';
export * from '@/components/Channel/types';
export const Channel = React.forwardRef<ChannelExports, ChannelProps>(function Channel(props, ref) {
const model = useChannel(props, ref);
return <ChannelSurface model={model} />;
});
