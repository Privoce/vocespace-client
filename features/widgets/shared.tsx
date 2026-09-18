'use client';

import { useWidgetApps } from '@/features/widget-apps/hooks/useWidgetApps';
import { FlotAppExports, FlotAppItemProps } from '@/features/widget-apps/shared';
import { FlotAppItemPC } from '@/features/widget-apps/views/pc';
import * as React from 'react';
export * from '@/features/widget-apps/shared';
export const FlotAppItem = React.forwardRef<FlotAppExports, FlotAppItemProps>(function FlotAppItem(props, ref) {
  const model = useWidgetApps(props, ref);
  return <FlotAppItemPC model={model} />;
});
