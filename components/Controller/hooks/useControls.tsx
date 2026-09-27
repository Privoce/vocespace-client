'use client';

import type { ForwardedRef } from 'react';
import type { ControlBarExport, ControlBarProps } from '../shared';
import { useControlsMedia } from './useControlsMedia';
import { useControlsPanels } from './useControlsPanels';
export function useControls(props: ControlBarProps, ref: ForwardedRef<ControlBarExport>) {
  const media = useControlsMedia(props, ref);
  return useControlsPanels(media);
}
