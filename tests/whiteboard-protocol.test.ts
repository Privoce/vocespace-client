import { expect, it } from 'vitest';
import { parseWhiteboardStrokes } from '@vocespace/contracts';
const stroke = {
  id: 'web',
  color: 'hsl(210 72% 52%)',
  width: 0.006,
  createdAt: 42,
  points: [{ x: 0.2, y: 0.8 }],
};
it('normalizes Web HSL for Native SVG without changing coordinates or relative pen width', () => {
  const [parsed] = parseWhiteboardStrokes([stroke]);
  expect(parsed.color).toBe('#2c85dd');
  expect(parsed.points).toEqual(stroke.points);
  expect(parsed.width).toBe(0.006);
  expect(parsed.createdAt).toBe(42);
  expect(parseWhiteboardStrokes([parsed])[0]).toEqual(parsed);
});
it('rejects active paint URLs, nonfinite points and oversized drawings', () => {
  expect(() => parseWhiteboardStrokes([{ ...stroke, color: 'url(https://invalid)' }])).toThrow();
  expect(() => parseWhiteboardStrokes([{ ...stroke, points: [{ x: NaN, y: 0 }] }])).toThrow();
  expect(() => parseWhiteboardStrokes(Array(201).fill(stroke))).toThrow();
});
