/* 공통 도구: 색, 난수, 숫자 */

/** 색은 안드로이드처럼 0xAARRGGBB 숫자로 들고 다닌다 */
export function css(c, alpha = null) {
  const a = alpha ?? ((c >>> 24) & 255) / 255;
  return `rgba(${(c >>> 16) & 255},${(c >>> 8) & 255},${c & 255},${+a.toFixed(3)})`;
}
export function withAlpha(c, a) {
  return ((Math.round(clamp(a, 0, 1) * 255) << 24) | (c & 0xffffff)) >>> 0;
}
export function alphaOf(c) { return ((c >>> 24) & 255) / 255; }
export function darken(c, k) {
  const r = Math.round(((c >>> 16) & 255) * k), g = Math.round(((c >>> 8) & 255) * k), b = Math.round((c & 255) * k);
  return ((c & 0xff000000) | (r << 16) | (g << 8) | b) >>> 0;
}
export function rgbOf(c) { return [((c >>> 16) & 255) / 255, ((c >>> 8) & 255) / 255, (c & 255) / 255]; }

export const WHITE = 0xffffffff;
export const INK = 0xff2b2150;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const hypot = Math.hypot;

/** 시드 난수 (mulberry32) */
export class Rng {
  constructor(seed = (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0) { this.s = seed >>> 0; }
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  float() { return this.next(); }
  double() { return this.next(); }
  bool() { return this.next() < 0.5; }
  int(n) { return n <= 0 ? 0 : Math.floor(this.next() * n); }
  shuffled(a) {
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) { const j = this.int(i + 1); [x[i], x[j]] = [x[j], x[i]]; }
    return x;
  }
}

export function chunked(a, n) {
  const out = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}
export const sum = (a, f = (x) => x) => a.reduce((s, x) => s + f(x), 0);
export function minBy(a, f) { let b = null, bv = Infinity; for (const x of a) { const v = f(x); if (v < bv) { bv = v; b = x; } } return b; }
export function maxBy(a, f) { let b = null, bv = -Infinity; for (const x of a) { const v = f(x); if (v > bv) { bv = v; b = x; } } return b; }

export const comma = (n) => n.toLocaleString('en-US');
export const coins = (n) => '🪙' + comma(n);
/** 소수 한 자리 (정수면 정수로) */
export const fmt1 = (v) => (v % 1 === 0 ? String(v) : v.toFixed(1));
export const afterLastSpace = (s) => s.slice(s.lastIndexOf(' ') + 1);
