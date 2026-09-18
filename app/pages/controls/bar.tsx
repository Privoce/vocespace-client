'use client';
import * as React from 'react';
import { useControls } from '@/features/controls/hooks/useControls';
import { ControlsSurface } from '@/features/controls/views/surface';
import { ControlBarProps, ControlBarExport } from '@/features/controls/shared';
export * from '@/features/controls/shared';
export const Controls = React.forwardRef<ControlBarExport, ControlBarProps>(function Controls(props, ref) {
const model = useControls(props, ref);
return <ControlsSurface model={model} />;
});
