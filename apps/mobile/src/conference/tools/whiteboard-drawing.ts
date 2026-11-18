import type { WhiteboardStroke } from '@vocespace/contracts';

/** Erase only the local author's strokes, including the line between sampled points. */
export function eraseWhiteboardStrokes(
  strokes: WhiteboardStroke[],
  x: number,
  y: number,
  width: number,
  height: number,
) {
  return strokes.filter(
    (stroke) =>
      !stroke.points.some((point, index) => {
        const previous = stroke.points[Math.max(0, index - 1)];
        const ax = previous.x * width;
        const ay = previous.y * height;
        const dx = point.x * width - ax;
        const dy = point.y * height - ay;
        const length = dx * dx + dy * dy;
        const t = length ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length)) : 0;
        return Math.hypot(x - ax - t * dx, y - ay - t * dy) <= 14;
      }),
  );
}
