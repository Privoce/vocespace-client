import { ContractError } from './connection';

export interface WhiteboardStroke {
  id: string;
  color: string;
  tool: 'pen';
  width: number;
  createdAt: number;
  points: { x: number; y: number }[];
}

// Web Avo colours use CSS's space-separated HSL. Normalize to hex for Native SVG.
function color(value: unknown): string {
  if (typeof value !== 'string') throw new ContractError('Invalid drawing color');
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  const hsl = /^hsl\(\s*(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*\)$/i.exec(value);
  if (!hsl) throw new ContractError('Invalid drawing color');
  const hue = ((Number(hsl[1]) % 360) + 360) % 360;
  const s = Number(hsl[2]) / 100;
  const l = Number(hsl[3]) / 100;
  if (!Number.isFinite(hue) || s > 1 || l > 1) throw new ContractError('Invalid drawing color');
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

export function parseWhiteboardStrokes(value: unknown): WhiteboardStroke[] {
  if (!Array.isArray(value) || value.length > 200) throw new ContractError('Invalid drawing');
  return value.map((stroke) => {
    if (
      !stroke ||
      typeof stroke !== 'object' ||
      typeof stroke.id !== 'string' ||
      stroke.id.length > 100 ||
      !Array.isArray(stroke.points) ||
      stroke.points.length > 2000
    )
      throw new ContractError('Invalid drawing');
    return {
      id: stroke.id,
      color: color(stroke.color),
      tool: 'pen',
      width:
        typeof stroke.width === 'number' && Number.isFinite(stroke.width)
          ? Math.max(0.002, Math.min(0.02, stroke.width))
          : 0.006,
      createdAt:
        typeof stroke.createdAt === 'number' && Number.isFinite(stroke.createdAt)
          ? stroke.createdAt
          : 0,
      points: stroke.points.map((point: { x: unknown; y: unknown }) => {
        if (
          !point ||
          typeof point.x !== 'number' ||
          typeof point.y !== 'number' ||
          !Number.isFinite(point.x) ||
          !Number.isFinite(point.y) ||
          point.x < 0 ||
          point.x > 1 ||
          point.y < 0 ||
          point.y > 1
        )
          throw new ContractError('Invalid drawing point');
        return { x: point.x, y: point.y };
      }),
    };
  });
}
