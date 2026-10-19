import { createElement, type ReactElement } from 'react';
import { createSvgResource, type SvgResourceNode } from '@vocespace/ui';
export { pictureCallback } from '@vocespace/ui';
export type { SvgType, SvgResourceProps } from '@vocespace/ui';

function render(node: SvgResourceNode, key = 0): ReactElement {
  return createElement(
    node.tag,
    { ...node.attrs, key },
    ...node.children.map((child, index) =>
      typeof child === 'string' ? child : render(child, index),
    ),
  );
}
/** Compatibility entry: preserves the existing DOM and public props. */
export const SvgResource = createSvgResource(render);
