'use client';
import * as React from 'react';
import { useChannel } from '@/features/channel/hooks/useChannel';
import { ChannelSurface } from '@/features/channel/views/surface';
import { ChannelProps, ChannelExports } from '@/features/channel/shared';
export * from '@/features/channel/shared';
export const Channel = React.forwardRef<ChannelExports, ChannelProps>(function Channel(props, ref) {
const model = useChannel(props, ref);
return <ChannelSurface model={model} />;
});
