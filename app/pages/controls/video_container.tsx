'use client';
import * as React from 'react';
import { useConference } from '@/features/conference/hooks/useConference';
import { ConferenceSurface } from '@/features/conference/views/surface';
import { VideoContainerProps, VideoContainerExports } from '@/features/conference/shared';
export * from '@/features/conference/shared';
export const VideoContainer = React.forwardRef<VideoContainerExports, VideoContainerProps>(function VideoContainer(props, ref) {
const model = useConference(props, ref);
return <ConferenceSurface model={model} />;
});
