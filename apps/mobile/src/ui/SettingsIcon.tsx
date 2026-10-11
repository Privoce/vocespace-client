import { createElement, type ReactElement, type ElementType } from 'react';
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
import { settingsVector, type SettingsIconName, type SettingsVectorNode } from '@vocespace/ui';
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
export function VectorIcon({ node }: { node: SettingsVectorNode }) {
  const render = (node: SettingsVectorNode, key = 0): ReactElement => {
    const props = Object.fromEntries(
      Object.entries(node.attrs).filter(
        ([name]) => name !== 'xmlns' && name !== 'version' && !name.startsWith('p-'),
      ),
    );
    return createElement(
      elements[node.tag],
      { ...props, key },
      ...node.children.filter((child) => child.tag !== 'style').map(render),
    );
  };
  return render(node);
}
