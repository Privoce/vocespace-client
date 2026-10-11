import type { AvoDrawing } from '@vocespace/ui';
export interface AvoShape {
  tag: 'ellipse' | 'rect' | 'path';
  props: Record<string, string | number>;
}
const AVO_NOISE = Array.from({ length: 4096 }, (_, i) => {
  let x = Math.imul(i + 1, 1597334677);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967295;
});
/** SVG command adapter for the existing Web creature engine; HSB is not HSL. */
export class SvgAvoDrawing implements AvoDrawing {
  readonly TWO_PI = Math.PI * 2;
  readonly PI = Math.PI;
  readonly CLOSE = 'close';
  readonly HSB = 'hsb';
  readonly RGB = 'rgb';
  deltaTime = 1000 / 18;
  shapes: AvoShape[] = [];
  private state = { fill: 'none', stroke: 'none', strokeWidth: 1, transform: '' };
  private stack: Array<typeof this.state> = [];
  private mode: 'hsb' | 'rgb' = 'hsb';
  private path = '';
  private curves: number[][] = [];
  private noiseValues = AVO_NOISE;
  push() {
    this.stack.push({ ...this.state });
  }
  pop() {
    this.state = this.stack.pop() || this.state;
  }
  translate(x: number, y: number) {
    this.state.transform += ` translate(${x} ${y})`;
  }
  rotate(a: number) {
    this.state.transform += ` rotate(${(a * 180) / Math.PI})`;
  }
  scale(x: number, y = x) {
    this.state.transform += ` scale(${x} ${y})`;
  }
  colorMode(mode: 'hsb' | 'rgb') {
    this.mode = mode;
  }
  private color(h: number, s: number, v: number, alpha = 1) {
    if (this.mode === 'rgb') return `rgba(${h},${s},${v},${alpha})`;
    const sat = s / 100,
      val = v / 100;
    const f = (n: number) => {
      const k = (n + h / 60) % 6;
      return Math.round(255 * val * (1 - sat * Math.max(0, Math.min(k, 4 - k, 1))));
    };
    return `rgba(${f(5)},${f(3)},${f(1)},${alpha})`;
  }
  fill(h: number, s = 0, v = 100, a = 1) {
    this.state.fill = this.color(h, s, v, a);
  }
  stroke(h: number, s = 0, v = 100, a = 1) {
    this.state.stroke = this.color(h, s, v, a);
  }
  noFill() {
    this.state.fill = 'none';
  }
  noStroke() {
    this.state.stroke = 'none';
  }
  strokeWeight(value: number) {
    this.state.strokeWidth = value;
  }
  private add(tag: AvoShape['tag'], props: AvoShape['props']) {
    this.shapes.push({ tag, props: { ...this.state, ...props } });
  }
  circle(x: number, y: number, d: number) {
    this.ellipse(x, y, d, d);
  }
  ellipse(x: number, y: number, w: number, h: number) {
    this.add('ellipse', { cx: x, cy: y, rx: Math.abs(w) / 2, ry: Math.abs(h) / 2 });
  }
  rect(x: number, y: number, w: number, h: number, r = 0) {
    this.add('rect', { x, y, width: w, height: h, rx: r });
  }
  arc(x: number, y: number, w: number, h: number, start: number, end: number) {
    const rx = w / 2,
      ry = h / 2;
    this.add('path', {
      d: `M ${x + Math.cos(start) * rx} ${y + Math.sin(start) * ry} A ${rx} ${ry} 0 ${end - start > Math.PI ? 1 : 0} 1 ${x + Math.cos(end) * rx} ${y + Math.sin(end) * ry}`,
    });
  }
  beginShape() {
    this.path = '';
    this.curves = [];
  }
  vertex(x: number, y: number) {
    this.path += `${this.path ? 'L' : 'M'} ${x} ${y} `;
  }
  bezierVertex(...points: [number, number, number, number, number, number]) {
    this.path += `C ${points.join(' ')} `;
  }
  curveVertex(x: number, y: number) {
    this.curves.push([x, y]);
  }
  endShape(mode?: 'close') {
    // Catmull-Rom to cubic Bezier, matching p5 curveVertex's default tightness.
    const points = this.curves;
    if (points.length >= 4) {
      this.path = `M ${points[1].join(' ')} `;
      for (let i = 1; i < points.length - 2; i++) {
        const [a, b, c, d] = points.slice(i - 1, i + 3);
        this.path += `C ${b[0] + (c[0] - a[0]) / 6} ${b[1] + (c[1] - a[1]) / 6} ${c[0] - (d[0] - b[0]) / 6} ${c[1] - (d[1] - b[1]) / 6} ${c[0]} ${c[1]} `;
      }
    }
    this.add('path', { d: this.path + (mode === 'close' ? 'Z' : '') });
  }
  noise(x: number, y: number, z: number) {
    // Same four-octave cosine interpolation used by the Web p5 noise field.
    x = Math.abs(x);
    y = Math.abs(y);
    z = Math.abs(z);
    let xi = Math.floor(x),
      yi = Math.floor(y),
      zi = Math.floor(z),
      xf = x - xi,
      yf = y - yi,
      zf = z - zi,
      result = 0,
      amplitude = 0.5;
    const fade = (t: number) => 0.5 * (1 - Math.cos(t * Math.PI)),
      get = (i: number) => this.noiseValues[i & 4095];
    for (let octave = 0; octave < 4; octave++) {
      let offset = xi + (yi << 4) + (zi << 8);
      const rx = fade(xf),
        ry = fade(yf);
      let n = get(offset);
      n += rx * (get(offset + 1) - n);
      let n2 = get(offset + 16);
      n2 += rx * (get(offset + 17) - n2);
      n += ry * (n2 - n);
      offset += 256;
      n2 = get(offset);
      n2 += rx * (get(offset + 1) - n2);
      let n3 = get(offset + 16);
      n3 += rx * (get(offset + 17) - n3);
      n2 += ry * (n3 - n2);
      n += fade(zf) * (n2 - n);
      result += n * amplitude;
      amplitude *= 0.5;
      xi <<= 1;
      yi <<= 1;
      zi <<= 1;
      xf *= 2;
      yf *= 2;
      zf *= 2;
      if (xf >= 1) {
        xi++;
        xf--;
      }
      if (yf >= 1) {
        yi++;
        yf--;
      }
      if (zf >= 1) {
        zi++;
        zf--;
      }
    }
    return result;
  }
}
