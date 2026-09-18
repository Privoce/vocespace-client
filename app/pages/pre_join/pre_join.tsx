'use client';

import { usePreJoin } from '@/features/pre-join/hooks/use-pre-join';
import { PreJoinPC } from '@/features/pre-join/views/pc';
import { PreJoinPhone } from '@/features/pre-join/views/phone';
import type { PreJoinPropsExt } from '@/features/pre-join/types';
export type { PreJoinPropsExt } from '@/features/pre-join/types';

export function PreJoin(props: PreJoinPropsExt) {
  const model = usePreJoin(props);
  return model.device === 'phone' ? <PreJoinPhone {...model} /> : <PreJoinPC {...model} />;
}
