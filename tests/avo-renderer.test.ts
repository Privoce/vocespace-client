// @vitest-environment node
import { expect, it } from 'vitest';
import { Creature, type AvoParams } from '@vocespace/meeting-core';
import { SvgAvoDrawing } from '../apps/mobile/src/ui/avo-drawing';
const params: AvoParams = {
  name: 'Ada',
  variant: 123,
  hue: 193,
  style: 'ring',
  energy: 0.6,
  isUsed: true,
  enabled: true,
};
function draw(patch: Partial<AvoParams> = {}) {
  const creature = new Creature();
  creature.applyParams({ ...params, ...patch });
  const svg = new SvgAvoDrawing();
  creature.render(svg, 100, 100, 124, { t: 1, level: 0.2, pointer: null, pointerSpeed: 0 });
  return svg.shapes;
}
it('renders each backend-selected Web AVO type through the same engine', () => {
  const ring = draw(),
    blob = draw({ style: 'blob' }),
    wave = draw({ style: 'wave' });
  expect(ring.length).toBeGreaterThan(10);
  expect(blob.some((shape) => shape.tag === 'path')).toBe(true);
  expect(wave.some((shape) => shape.props.fill === 'none' && shape.props.stroke !== 'none')).toBe(
    true,
  );
  expect(draw({ variant: 999 })).not.toEqual(ring);
  expect(draw({ hue: 42 })).not.toEqual(ring);
  for (const shapes of [ring, blob, wave])
    expect(JSON.stringify(shapes)).not.toMatch(/NaN|undefined/);
});
it('converts Web HSB fill values to RGB without mistaking them for HSL', () => {
  const svg = new SvgAvoDrawing();
  svg.fill(0, 100, 100, 0.5);
  svg.circle(0, 0, 20);
  expect(svg.shapes[0].props.fill).toBe('rgba(255,0,0,0.5)');
  svg.fill(120, 100, 50);
  svg.circle(0, 0, 20);
  expect(svg.shapes[1].props.fill).toBe('rgba(0,128,0,1)');
});
