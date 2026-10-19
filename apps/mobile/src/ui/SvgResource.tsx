import { createSvgResource } from '@vocespace/ui';
import { VectorIcon } from './SettingsIcon';

/** Same resources and props as Web; only SVG host elements are Native-specific. */
export const SvgResource = createSvgResource((node) => <VectorIcon node={node} />);
export type { SvgType, SvgResourceProps } from '@vocespace/ui';
