import { createElement, type ReactElement, type ElementType } from 'react';
import { Text, View } from 'react-native';
import Svg, {
  Path,
  Circle,
  Rect,
  G,
  Defs,
  LinearGradient,
  Stop,
  Ellipse,
  Polygon,
  Line,
  Polyline,
} from 'react-native-svg';
import { settingsVector, type SettingsIconName, type SvgResourceNode } from '@vocespace/ui';
const elements: Record<string, ElementType> = {
  svg: Svg,
  path: Path,
  circle: Circle,
  rect: Rect,
  g: G,
  defs: Defs,
  linearGradient: LinearGradient,
  stop: Stop,
  ellipse: Ellipse,
  polygon: Polygon,
  line: Line,
  polyline: Polyline,
  div: View,
  span: Text,
};
export function SettingsIcon({
  name,
  size = 14,
  color = '#ffffff',
}: {
  name: SettingsIconName;
  size?: number;
  color?: string;
}) {
  return <VectorIcon node={settingsVector(name, size, color)} />;
}
export function VectorIcon({ node }: { node: SvgResourceNode }) {
  const render = (node: SvgResourceNode, key = 0): ReactElement => {
    const props = Object.fromEntries(
      Object.entries(node.attrs).filter(
        ([name]) =>
          name !== 'xmlns' &&
          name !== 'version' &&
          !name.startsWith('p-') &&
          !name.startsWith('data-'),
      ),
    );
    // CSS's circular radius is represented by a large numeric radius on Native.
    if (typeof props.style === 'object' && props.style.borderRadius === '50%') {
      props.style = { ...props.style, borderRadius: 9999 };
    }
    return createElement(
      elements[node.tag],
      { ...props, key },
      ...node.children
        .filter((child) => typeof child === 'string' || child.tag !== 'style')
        .map((child, index) => (typeof child === 'string' ? child : render(child, index))),
    );
  };
  return render(node);
}
