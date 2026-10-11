import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import Svg, { Ellipse, Rect, Path } from 'react-native-svg';
import { Creature, normalizeAvo, type AvoParams } from '@vocespace/ui';
import { SvgAvoDrawing } from './avo-drawing';
import { MeetingIcon } from './meeting';
const elements = { ellipse: Ellipse, rect: Rect, path: Path };
export function MeetingAvo({
  avo,
  level = 0,
  animate = true,
}: {
  avo?: AvoParams;
  level?: number;
  animate?: boolean;
}) {
  const creature = useMemo(() => new Creature(), []);
  const live = useRef({ avo, level });
  live.current = { avo, level };
  const [drawing, setDrawing] = useState<SvgAvoDrawing>();
  useEffect(() => {
    if (!avo?.enabled) return;
    let time = 0,
      last = Date.now();
    const draw = () => {
      if (AppState.currentState !== 'active') {
        last = Date.now();
        return;
      }
      const current = live.current;
      if (!current.avo?.enabled) return;
      const next = new SvgAvoDrawing();
      next.deltaTime = Math.min(Date.now() - last, 100);
      last = Date.now();
      time += next.deltaTime / 1000;
      creature.applyParams(normalizeAvo(current.avo, current.avo.name));
      creature.render(next, 100, 100, 124, {
        t: time,
        level: current.level,
        pointer: null,
        pointerSpeed: 0,
      });
      setDrawing(next);
    };
    draw();
    if (!animate) return;
    const timer = setInterval(draw, 1000 / 18);
    return () => clearInterval(timer);
  }, [avo?.enabled, avo?.name, avo?.variant, avo?.style, avo?.hue, avo?.energy, animate, creature]);
  if (!avo?.enabled) return <MeetingIcon name="members" size={80} color="#666" />;
  return (
    <View style={{ width: '100%', height: '100%', maxWidth: 260, maxHeight: 260, aspectRatio: 1 }}>
      <Svg width="100%" height="100%" viewBox="0 0 200 200">
        {drawing?.shapes.map((shape, index) => {
          const Shape = elements[shape.tag];
          return <Shape key={index} {...shape.props} />;
        })}
      </Svg>
    </View>
  );
}
