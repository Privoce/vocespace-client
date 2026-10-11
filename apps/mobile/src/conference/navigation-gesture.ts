/** Require a committed, dominant-axis drag; returning to the origin cancels navigation. */
export function navigationGesture(dx: number, dy: number) {
  if (Math.abs(dx) >= 64 && Math.abs(dx) > Math.abs(dy) * 1.5)
    return { axis: 'room' as const, direction: dx < 0 ? 1 : -1 };
  if (Math.abs(dy) >= 80 && Math.abs(dy) > Math.abs(dx) * 1.5)
    return { axis: 'space' as const, direction: dy < 0 ? 1 : -1 };
  return undefined;
}
