import type { PlatformUser } from '@/lib/std';
import type { ReadableConf,VocespaceConfig } from '@/lib/std/conf';
import type { LocalUserChoices,PreJoinProps } from '@livekit/components-react';

export interface PreJoinPropsExt extends Omit<PreJoinProps, 'onSubmit'> {
  onSubmit?: (choices: LocalUserChoices) => void | Promise<void>;
  data: PlatformUser | undefined;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  space: string;
  config: VocespaceConfig | ReadableConf;
}
