'use client';

import { usePreJoin } from './hooks/UsePreJoin';
import { PreJoinPC } from './pc';
import type { PreJoinPropsExt } from '@/components/PreJoin/types';
export type { PreJoinPropsExt } from '@/components/PreJoin/types';

export function PreJoin(props: PreJoinPropsExt) {
  const model = usePreJoin(props);
  return <PreJoinPC {...model} />;
}
