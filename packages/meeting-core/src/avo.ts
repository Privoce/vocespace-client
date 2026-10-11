import { avoStyles, avoPalette } from './settings';
/** Extracted unchanged from Web Participant/avo: platform-independent creature renderer. */
export interface AvoParams {
  name: string;
  variant: number;
  hue: number;
  style: 'blob' | 'ring' | 'wave';
  energy: number;
  isUsed: boolean;
  enabled: boolean;
}
export interface AvoDrawing {
  deltaTime: number;
  TWO_PI: number;
  PI: number;
  CLOSE: 'close';
  HSB: 'hsb';
  RGB: 'rgb';
  push(): void;
  pop(): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  scale(x: number, y?: number): void;
  colorMode(mode: 'hsb' | 'rgb', ...values: number[]): void;
  fill(...values: number[]): void;
  noFill(): void;
  stroke(...values: number[]): void;
  noStroke(): void;
  strokeWeight(value: number): void;
  beginShape(): void;
  vertex(x: number, y: number): void;
  bezierVertex(...values: [number, number, number, number, number, number]): void;
  curveVertex(x: number, y: number): void;
  endShape(mode?: 'close'): void;
  circle(x: number, y: number, d: number): void;
  ellipse(x: number, y: number, w: number, h: number): void;
  rect(x: number, y: number, w: number, h: number, r?: number): void;
  arc(x: number, y: number, w: number, h: number, start: number, end: number): void;
  noise(x: number, y: number, z: number): number;
}
function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function drawHeart(p: AvoDrawing, x: number, y: number, s: number) {
  p.beginShape();
  p.vertex(x, y + s * 0.35);
  p.bezierVertex(x - s, y - s * 0.35, x - s * 0.45, y - s, x, y - s * 0.3);
  p.bezierVertex(x + s * 0.45, y - s, x + s, y - s * 0.35, x, y + s * 0.35);
  p.endShape(p.CLOSE);
}

export interface CreaturePointer {
  x: number;
  y: number;
}

interface CreatureState {
  t: number;
  level: number;
  pointer: CreaturePointer | null;
  pointerSpeed: number;
}

const THEME_HUE = 193;

export class Creature {
  blink = 0;
  nextBlink = 1 + Math.random() * 3;
  popT = 99;
  hover = 0;
  petGlow = 0;
  leanX = 0;
  leanY = 0;
  particles: Array<{
    type: 'heart' | 'spark';
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    spin: number;
  }> = [];

  hue = THEME_HUE;
  style: AvoParams['style'] = 'blob';
  energy = 0.6;
  name = 'guest';
  seed = 0;
  lobes = 5;
  orbiters = 6;
  squish = 0.85;
  eyeGap = 0.3;
  eyeSize = 0.1;
  noiseOff = 0;

  applyParams(params: AvoParams) {
    this.hue = params.hue;
    this.style = params.style;
    this.energy = params.energy;
    this.name = params.name;
    const s = hashString((params.name || 'guest') + '#' + (params.variant | 0));
    this.seed = s;
    this.lobes = 5 + (s % 4);
    this.orbiters = 6 + ((s >> 3) % 7);
    this.squish = 0.85 + ((s >> 6) % 30) / 100;
    this.eyeGap = 0.3 + ((s >> 9) % 14) / 100;
    this.eyeSize = 0.1 + ((s >> 12) % 8) / 100;
    this.noiseOff = (s % 1000) / 10;
  }

  pop() {
    this.popT = 0;
    this.blink = 0;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.random() * 0.4;
      const v = 1.0 + Math.random() * 1.6;
      this.spawnParticle(
        'spark',
        Math.cos(a) * 8,
        Math.sin(a) * 8,
        Math.cos(a) * v,
        Math.sin(a) * v,
      );
    }
  }

  pet() {
    this.petGlow = 1;
    for (let i = 0; i < 5; i++) {
      this.spawnParticle(
        'heart',
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 25,
        (Math.random() - 0.5) * 1.2,
        -1.5 - Math.random(),
      );
    }
  }

  private spawnParticle(type: 'heart' | 'spark', x: number, y: number, vx: number, vy: number) {
    if (this.particles.length > 40) this.particles.shift();
    this.particles.push({ type, x, y, vx, vy, life: 1, spin: Math.random() * 6 });
  }

  render(p: AvoDrawing, x: number, y: number, size: number, state: CreatureState) {
    const { t, level, pointer } = state;
    const pointerSpeed = state.pointerSpeed || 0;
    const dt = p.deltaTime / 1000;
    this.popT += dt;

    // Blink bookkeeping.
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blink = 1;
      this.nextBlink = 1.5 + Math.random() * 3.5;
    }
    this.blink = Math.max(0, this.blink - p.deltaTime / 110);

    // Pointer state.
    const r0 = size * 0.5;
    const overBody = !!pointer && Math.hypot(pointer.x, pointer.y) < r0 * 0.95;

    // Hover excitement.
    this.hover += ((overBody ? 1 : 0) - this.hover) * Math.min(1, dt * 8);

    // Petting: rub the cursor across the body.
    if (overBody && pointerSpeed > 3) {
      this.petGlow = Math.min(1, this.petGlow + pointerSpeed * 0.0035);
      if (this.petGlow > 0.3 && Math.random() < 0.12) {
        this.spawnParticle(
          'heart',
          pointer.x * 0.8,
          pointer.y * 0.8,
          (Math.random() - 0.5) * 1.2,
          -1.5 - Math.random(),
        );
      }
    }
    this.petGlow = Math.max(0, this.petGlow - dt * 0.35);

    // Body leans toward cursor.
    let targetLX = 0,
      targetLY = 0;
    if (pointer) {
      const m = Math.hypot(pointer.x, pointer.y) || 1;
      const pull = Math.max(0, 1 - m / (r0 * 3.5));
      targetLX = (pointer.x / m) * pull * r0 * 0.16;
      targetLY = (pointer.y / m) * pull * r0 * 0.12;
    }
    this.leanX += (targetLX - this.leanX) * Math.min(1, dt * 6);
    this.leanY += (targetLY - this.leanY) * Math.min(1, dt * 6);

    const pop = Math.max(0, 1 - this.popT * 1.35);
    const breathe = Math.sin(t * 1.4 + this.noiseOff) * 0.02;
    const excite = this.hover * 0.02 + this.petGlow * 0.07;
    const scale = 1 + breathe + level * 0.16 * this.energy + excite;

    p.push();
    p.translate(x + this.leanX, y + this.leanY - pop * r0 * 0.07);
    p.rotate((this.leanX / r0) * 0.14 + pop * Math.sin(this.popT * 28) * 0.025);
    const jelly = pop * Math.sin(this.popT * 24) * 0.055;
    p.scale(1 + jelly, 1 - jelly * 0.85);
    p.colorMode(p.HSB, 360, 100, 100, 1);

    const liveliness = Math.min(1, level + this.hover * 0.12 + this.petGlow * 0.5);

    if (this.style === 'blob') this.drawBlob(p, size * scale, t, liveliness, pop);
    else if (this.style === 'ring') this.drawRing(p, size * scale, t, liveliness, pop);
    else this.drawWave(p, size * scale, t, liveliness, pop);

    this.drawFace(p, size * scale, t, level, pointer);
    this.drawParticles(p, size, dt);
    p.colorMode(p.RGB, 255);
    p.pop();
  }

  private drawParticles(p: AvoDrawing, size: number, dt: number) {
    const k = size / 100;
    p.noStroke();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt * (pt.type === 'heart' ? 0.7 : 1.4);
      if (pt.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      pt.x += pt.vx * k;
      pt.y += pt.vy * k;
      pt.vx *= 0.97;
      if (pt.type === 'heart') pt.vy -= dt * 1.2;
      pt.spin += dt * 3;

      if (pt.type === 'heart') {
        p.fill((THEME_HUE + 150) % 360, 65, 100, pt.life * 0.9);
        drawHeart(p, pt.x, pt.y + Math.sin(pt.spin) * 1.5, (5 + (1 - pt.life) * 4) * k);
      } else {
        p.fill(this.hue, 45, 100, pt.life);
        const s = (2 + pt.life * 3) * k;
        p.push();
        p.translate(pt.x, pt.y);
        p.rotate(pt.spin);
        p.rect(-s / 2, -s / 2, s, s, s * 0.3);
        p.pop();
      }
    }
  }

  private drawBlob(p: AvoDrawing, size: number, t: number, level: number, pop: number) {
    const r = size * 0.5;
    const wob = (0.06 + level * 0.22 * this.energy + pop * 0.1) * r;

    if (level > 0.04) {
      p.noStroke();
      p.fill(this.hue, 70, 90, 0.06 + level * 0.12);
      p.circle(0, 0, size * (1.25 + level * 0.35));
    }

    p.noStroke();
    for (let layer = 2; layer >= 0; layer--) {
      const lr = r * (1 + layer * 0.1);
      const alpha = layer === 0 ? 1 : 0.16 - layer * 0.04;
      p.fill(this.hue, 62 - layer * 8, layer === 0 ? 78 : 90, alpha);
      p.beginShape();
      for (let a = 0; a < p.TWO_PI; a += 0.22) {
        const n = p.noise(
          Math.cos(a) * 0.8 + this.noiseOff,
          Math.sin(a) * 0.8 + this.noiseOff,
          t * (0.35 + level * 1.2) + layer * 3,
        );
        const rr = lr + (n - 0.5) * 2 * wob;
        p.curveVertex(Math.cos(a) * rr * this.squish, Math.sin(a) * rr);
      }
      p.endShape(p.CLOSE);
    }
  }

  private drawRing(p: AvoDrawing, size: number, t: number, level: number, pop: number) {
    const r = size * 0.5;

    p.noStroke();
    p.fill(this.hue, 55, 75);
    p.circle(0, 0, r * 1.1);
    p.fill(this.hue, 40, 92, 0.35);
    p.circle(0, 0, r * 1.28);

    const speed = 0.5 + level * 2.4 * this.energy + pop * 1.5;
    for (let i = 0; i < this.orbiters; i++) {
      const frac = i / this.orbiters;
      const a = t * speed * (0.6 + frac * 0.7) + frac * p.TWO_PI + this.noiseOff;
      const orbitR = r * (0.75 + frac * 0.45) + level * r * 0.3;
      const px = Math.cos(a) * orbitR;
      const py = Math.sin(a) * orbitR * 0.92;
      const d = r * (0.1 + frac * 0.1) * (1 + level * 0.8);
      const satHue = (this.hue + (frac - 0.5) * 24 + 360) % 360;
      p.fill(satHue, 70, 95, 0.85);
      p.circle(px, py, d);
      p.fill(satHue, 70, 95, 0.25);
      p.circle(Math.cos(a - 0.25) * orbitR, Math.sin(a - 0.25) * orbitR * 0.92, d * 0.6);
    }
  }

  private drawWave(p: AvoDrawing, size: number, t: number, level: number, pop: number) {
    const r = size * 0.5;

    p.noStroke();
    p.fill(this.hue, 55, 75);
    p.circle(0, 0, r * 1.15);

    p.noFill();
    const rings = 4;
    for (let i = 0; i < rings; i++) {
      const phase = (t * (0.5 + level * 1.6) + i / rings) % 1;
      const rr = r * (0.6 + phase * (0.9 + level * 0.9 + pop * 0.4));
      const alpha = (1 - phase) * (0.16 + level * 0.55);
      p.stroke(this.hue, 65, 95, alpha);
      p.strokeWeight(2 + (1 - phase) * 3 + level * 2);
      p.circle(0, 0, rr * 2);
    }
    p.noStroke();
  }

  private drawFace(
    p: AvoDrawing,
    size: number,
    t: number,
    level: number,
    pointer: CreaturePointer | null,
  ) {
    const r = size * 0.5;

    const startle = Math.max(0, 1 - this.popT / 0.55);
    const happy = startle > 0.25 ? 0 : this.petGlow;
    const curious = startle > 0.25 ? 0 : Math.max(0, this.hover * (1 - happy * 1.4));

    let lookX = 0,
      lookY = 0;
    if (pointer) {
      const dx = pointer.x,
        dy = pointer.y;
      const m = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, m / (r * 2));
      lookX = (dx / m) * k * r * 0.09;
      lookY = (dy / m) * k * r * 0.09;
    } else {
      lookX = Math.cos(t * 0.6 + this.noiseOff) * r * 0.04;
      lookY = Math.sin(t * 0.45 + this.noiseOff) * r * 0.03;
    }
    const lookBoost = 1 + curious * 0.4;
    lookX *= lookBoost;
    lookY *= lookBoost;
    lookX *= 1 - startle * 0.75;
    lookY = lookY * (1 - startle * 0.75) - startle * r * 0.03 - curious * r * 0.018;

    const eyeY = -r * 0.08 + lookY;
    const gap = r * this.eyeGap;
    const eyeR = r * this.eyeSize * 2 * (1 + startle * 0.16 + curious * 0.08);
    const openness = Math.max(1 - this.blink, 0.85 + startle * 0.15 + curious * 0.06);
    const pupilK = 0.45 * (1 - startle * 0.28 + curious * 0.14);

    if (happy > 0.35) {
      const hEye = eyeR * 0.8;
      p.noFill();
      p.stroke(0, 0, 100, 0.95);
      p.strokeWeight(hEye * 0.22);
      for (const side of [-1, 1]) {
        const ex = side * gap + lookX;
        p.arc(ex, eyeY + hEye * 0.15, hEye, hEye * 0.9, p.PI, p.TWO_PI);
      }
      p.noStroke();
    } else {
      p.noStroke();
      for (const side of [-1, 1]) {
        const ex = side * gap + lookX;
        p.fill(0, 0, 100, 0.95);
        p.ellipse(ex, eyeY, eyeR, eyeR * Math.max(0.08, openness));
        if (openness > 0.35) {
          p.fill(0, 0, 12);
          p.ellipse(ex + lookX * 0.6, eyeY + lookY * 0.4, eyeR * pupilK, eyeR * pupilK * openness);
        }
      }
    }

    if (happy > 0.2) {
      p.noStroke();
      p.fill((THEME_HUE + 180) % 360, 55, 100, (happy - 0.2) * 0.5);
      p.ellipse(-gap * 1.5 + lookX, eyeY + eyeR * 0.9, eyeR * 0.9, eyeR * 0.5);
      p.ellipse(gap * 1.5 + lookX, eyeY + eyeR * 0.9, eyeR * 0.9, eyeR * 0.5);
    }

    const mouthY = r * 0.22;
    if (startle > 0.35) {
      const ow = r * (0.07 + startle * 0.05);
      p.fill(0, 0, 10, 0.85);
      p.ellipse(lookX * 0.5, mouthY + lookY * 0.3 + r * 0.01, ow, ow * 1.1);
    } else if (startle > 0.08) {
      p.fill(0, 0, 10, 0.75);
      const mw = r * 0.22 * (1 - startle);
      p.ellipse(lookX * 0.5, mouthY + lookY * 0.3, mw, r * 0.025);
    } else if (happy > 0.35 && level < 0.12) {
      p.noFill();
      p.stroke(0, 0, 10, 0.85);
      p.strokeWeight(r * 0.045);
      const mw = r * (0.24 + happy * 0.14);
      p.arc(lookX * 0.5, mouthY + lookY * 0.3 - mw * 0.15, mw, mw * 0.8, 0.25, p.PI - 0.25);
      p.noStroke();
    } else if (curious > 0.2 && level < 0.1) {
      p.fill(0, 0, 10, 0.8);
      const mw = r * (0.14 + curious * 0.04);
      const mh = r * (0.022 + curious * 0.014);
      p.ellipse(lookX * 0.5, mouthY + lookY * 0.3, mw, mh);
    } else {
      const mw = r * 0.3 * (1 + level * 0.25);
      const mh = r * (0.035 + level * 0.3 * this.energy);
      p.fill(0, 0, 10, 0.85);
      p.ellipse(lookX * 0.5, mouthY + lookY * 0.3, mw, mh);
      if (mh > r * 0.09) {
        p.fill(0, 70, 90, 0.9);
        p.ellipse(lookX * 0.5, mouthY + mh * 0.22, mw * 0.5, mh * 0.4);
      }
    }
  }
}

/** Parameter fallback shared with the Web p5 host. */
export function normalizeAvo(avo: Partial<AvoParams> | undefined, name: string): AvoParams {
  const fallback: AvoParams = {
    name: name || 'guest',
    variant: 0,
    hue: 193,
    style: 'blob',
    energy: 0.6,
    isUsed: false,
    enabled: true,
  };
  const energy = Number(avo?.energy ?? fallback.energy);
  return {
    ...fallback,
    ...avo,
    name: avo?.name || fallback.name,
    hue: (avoPalette as readonly number[]).includes(Number(avo?.hue))
      ? Number(avo?.hue)
      : fallback.hue,
    style: avoStyles.includes(avo?.style as AvoParams['style']) ? avo!.style! : fallback.style,
    energy: Math.max(0.1, Math.min(1, Number.isFinite(energy) ? energy : 0.6)),
  };
}
