'use client';

import type { ForwardedRef } from 'react';
import { useControlsMedia } from './useControlsMedia';
import { useControlsPanels } from './useControlsPanels';
import { ControlBarExport, ControlBarProps } from '../types';

export function useControls(props: ControlBarProps, ref: ForwardedRef<ControlBarExport>) {
  const media = useControlsMedia(props, ref);
  return useControlsPanels(media);
}
