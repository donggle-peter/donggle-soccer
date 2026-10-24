import { css, darken, withAlpha, alphaOf, INK, WHITE } from '../core.js';
import { Hat } from '../data/teams.js';

/* 캔버스 그림 도구: 글자, 동글이, 머리 장식, 공, 아이템 상자, 트로피 */

export const FONT = 'Jua';
const SHADOW = 0x381e143c;
const BODY = 0xfffffdf7;
const GOLD_BODY = 0xffffd54a;
const MOUTH = 0xff8a2b45;

export const Face = { HAPPY: 0, SHOUT: 1, DIZZY: 2, FOCUS: 3, SAD: 4 };

/* ───────────── 글자 ───────────── */

/**
 * 게임 글꼴(주아체)에 없는 기호들. 다른 글꼴로 그려지면 모양이 튀므로 직접 그린다.
 * 값은 글자 크기(em) 대비 차지하는 너비.
 */
export const SYMBOL_WIDTH = { '·': 0.5, '→': 1, '▲': 0.8, '▼': 0.8, '▶': 0.8, '◀': 0.8 };
export const hasSymbols = (s) => [...s].some((c) => c in SYMBOL_WIDTH);

/** 글자 대신 기호 하나를 그린다. (cx, cy) 가운데, em 글자 크기 */
export function drawSymbol(ctx, ch, cx, cy, em, color, outline = 0, outlineColor = INK) {
  const layer = (c, extra) => {
    ctx.fillStyle = css(c); ctx.strokeStyle = css(c);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (ch === '·') { circle(ctx, cx, cy, em * 0.085 + extra / 2); ctx.fill(); return; }
    if (ch === '→') {
      ctx.beginPath();
      ctx.moveTo(cx - em * 0.36, cy); ctx.lineTo(cx + em * 0.32, cy);
      ctx.moveTo(cx + em * 0.08, cy - em * 0.23); ctx.lineTo(cx + em * 0.34, cy); ctx.lineTo(cx + em * 0.08, cy + em * 0.23);
      ctx.lineWidth = em * 0.11 + extra; ctx.stroke();
      return;
    }
    const r = em * 0.27;
    ctx.beginPath();
    if (ch === '▲') { ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 1.1, cy + r * 0.8); ctx.lineTo(cx - r * 1.1, cy + r * 0.8); }
    else if (ch === '▼') { ctx.moveTo(cx, cy + r); ctx.lineTo(cx + r * 1.1, cy - r * 0.8); ctx.lineTo(cx - r * 1.1, cy - r * 0.8); }
    else if (ch === '▶') { ctx.moveTo(cx + r, cy); ctx.lineTo(cx - r * 0.8, cy - r * 1.1); ctx.lineTo(cx - r * 0.8, cy + r * 1.1); }
    else { ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r * 0.8, cy - r * 1.1); ctx.lineTo(cx + r * 0.8, cy + r * 1.1); }
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = em * 0.08 + extra; ctx.stroke();
  };
  if (outline > 0) layer(outlineColor, outline);
  layer(color, 0);
}

export function textWidth(ctx, s, size) {
  ctx.font = `${size}px ${FONT}`;
  return ctx.measureText(s).width;
}

/**
 * 글자를 세로 가운데에 놓기 위한 기준선 위치. 실제로 그려지는 모양의 위·아래 끝을 재서 맞춘다.
 * (이모지는 기기마다 글꼴 높이가 달라서, 글꼴 기준으로 맞추면 아이폰에서 아래로 쏠린다)
 */
const midCache = new Map();
function middleOffset(ctx, s, size) {
  const key = s + '|' + size;
  let v = midCache.get(key);
  if (v == null) {
    const m = ctx.measureText(s);
    const a = m.actualBoundingBoxAscent, d = m.actualBoundingBoxDescent;
    v = Number.isFinite(a) && Number.isFinite(d) && a + d > 0 ? (a - d) / 2 : size * 0.36;
    if (midCache.size > 2000) midCache.clear();
    midCache.set(key, v);
  }
  return v;
}

/** 외곽선 있는 글자. y 는 글자 세로 가운데 기준. align: 'center' | 'left' | 'right' */
export function label(ctx, s, x, y, size, color = WHITE, stroke = 0, strokeColor = INK, align = 'center', alpha = 1) {
  if (hasSymbols(s)) return labelWithSymbols(ctx, s, x, y, size, color, stroke, strokeColor, align, alpha);
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  const base = y + middleOffset(ctx, s, size);
  if (stroke > 0) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = stroke;
    ctx.strokeStyle = css(strokeColor, alphaOf(strokeColor) * alpha);
    ctx.strokeText(s, x, base);
  }
  ctx.fillStyle = css(color, alphaOf(color) * alpha);
  ctx.fillText(s, x, base);
}

function labelWithSymbols(ctx, s, x, y, size, color, stroke, strokeColor, align, alpha) {
  const runs = [];
  let buf = '';
  for (const ch of s) {
    if (ch === '️') continue;
    if (ch in SYMBOL_WIDTH) { if (buf) { runs.push(buf); buf = ''; } runs.push(ch); } else buf += ch;
  }
  if (buf) runs.push(buf);
  const isSym = (r) => r.length === 1 && r in SYMBOL_WIDTH;
  const widths = runs.map((r) => (isSym(r) ? SYMBOL_WIDTH[r] * size : textWidth(ctx, r, size)));
  const total = widths.reduce((a, b) => a + b, 0);
  let left = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  runs.forEach((r, i) => {
    if (isSym(r)) drawSymbol(ctx, r, left + widths[i] / 2, y, size, withAlpha(color, alphaOf(color) * alpha), stroke, withAlpha(strokeColor, alphaOf(strokeColor) * alpha));
    else label(ctx, r, left, y, size, color, stroke, strokeColor, 'left', alpha);
    left += widths[i];
  });
}

/* ───────────── 기본 도형 ───────────── */

export function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(r, 0), 0, Math.PI * 2); }
export function oval(ctx, cx, cy, rx, ry) { ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(rx, 0), Math.max(ry, 0), 0, 0, Math.PI * 2); }

function fillStroke(ctx, fill, lw = 3) {
  ctx.fillStyle = css(fill); ctx.fill();
  ctx.strokeStyle = css(INK); ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
}
function ovalFO(ctx, cx, cy, rx, ry, fill, lw = 3) { oval(ctx, cx, cy, rx, ry); fillStroke(ctx, fill, lw); }
function circleFO(ctx, cx, cy, r, fill, lw = 3) { circle(ctx, cx, cy, r); fillStroke(ctx, fill, lw); }
function strokePath(ctx, build, color, lw, cap = 'round') {
  ctx.beginPath(); build(ctx);
  ctx.strokeStyle = css(color); ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = cap; ctx.stroke();
}

/* ───────────── 동글이 ───────────── */

const bodyPath = (c) => c.ellipse(0, -31, 30, 30, 0, 0, Math.PI * 2);
const jerseyPath = (c) => { c.moveTo(-40, -18); c.quadraticCurveTo(0, -8, 40, -18); c.lineTo(40, 10); c.lineTo(-40, 10); c.closePath(); };
const jerseyEdge = (c) => { c.moveTo(-40, -18); c.quadraticCurveTo(0, -8, 40, -18); };
/** 손그림처럼 오른쪽으로 휘어진 ")" 입 */
const mouthSmile = (c) => { c.moveTo(8, -47); c.bezierCurveTo(17, -41, 17, -28, 9, -23); c.quadraticCurveTo(5, -20.5, 1.5, -22.5); };
const mouthOpen = (c) => { c.moveTo(7, -45); c.bezierCurveTo(19, -40, 19, -27, 7, -23); c.quadraticCurveTo(10, -34, 7, -45); c.closePath(); };
const mouthSad = (c) => { c.moveTo(9, -22); c.bezierCurveTo(15, -27, 15, -36, 9, -40); };
const mouthWavy = (c) => { c.moveTo(9, -44); c.quadraticCurveTo(15, -40, 10, -36); c.quadraticCurveTo(5, -32, 10, -28); c.quadraticCurveTo(14, -25, 9, -22); };
const squint = (c) => { c.moveTo(-16, -36); c.quadraticCurveTo(-12, -44, -8, -36); c.moveTo(-6, -36); c.quadraticCurveTo(-2, -44, 2, -36); };
const brows = (c) => { c.moveTo(-17, -49); c.lineTo(-8, -47); c.moveTo(-5, -47.5); c.lineTo(3, -49.5); };

/**
 * 동글이 한 명. (x, y) 는 발밑. 몸 좌표: 몸통 원 중심 (0,-31) 반지름 30.
 * o: { face, flip, phase, moving, gloves, hop, shadow, hat, golden }
 */
export function drawMongi(ctx, x, y, scale, jersey, o = {}) {
  const face = o.face ?? Face.HAPPY;
  const moving = o.moving ?? false;
  const hop = o.hop ?? 0;
  const feet = darken(jersey, 0.7);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(o.flip ? -scale : scale, scale);
  if (o.shadow ?? true) { oval(ctx, 0, 1, 26, 6); ctx.fillStyle = css(SHADOW); ctx.fill(); }
  ctx.translate(0, -hop);
  const s = Math.sin(o.phase ?? 0);
  const fl = moving ? Math.max(0, s) * 6 : 0;
  const fr = moving ? Math.max(0, -s) * 6 : 0;
  const bob = moving ? -Math.abs(s) * 3 : 0;
  ovalFO(ctx, -11, -3 - fl, 9.5, 6.5, feet);
  ovalFO(ctx, 11, -3 - fr, 9.5, 6.5, feet);
  ctx.translate(0, bob);
  ctx.beginPath(); bodyPath(ctx);
  ctx.fillStyle = css(o.golden ? GOLD_BODY : BODY); ctx.fill();
  ctx.save();
  ctx.beginPath(); bodyPath(ctx); ctx.clip();
  ctx.beginPath(); jerseyPath(ctx); ctx.fillStyle = css(jersey); ctx.fill();
  oval(ctx, -14, -50, 8, 5); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
  strokePath(ctx, jerseyEdge, INK, 2.5);
  ctx.restore();
  ctx.beginPath(); bodyPath(ctx); ctx.strokeStyle = css(INK); ctx.lineWidth = 3; ctx.stroke();
  if (o.gloves) {
    circleFO(ctx, -30, -24 + (moving ? s * 5 : 0), 6.5, 0xffffd23f);
    circleFO(ctx, 30, -24 - (moving ? s * 5 : 0), 6.5, 0xffffd23f);
  }
  // 눈
  if (face === Face.SHOUT) strokePath(ctx, squint, INK, 3.2);
  else if (face === Face.DIZZY) {
    for (const ex of [-12, -2]) {
      circle(ctx, ex, -38, 5); ctx.strokeStyle = css(INK); ctx.lineWidth = 2.2; ctx.stroke();
      circle(ctx, ex + 1, -38, 1.8); ctx.fillStyle = css(INK); ctx.fill();
    }
  } else {
    const ry = face === Face.SAD ? 5.5 : 7;
    const cy = face === Face.SAD ? -36 : -38;
    for (const ex of [-12, -2]) ovalFO(ctx, ex, cy, 4.3, ry, WHITE, 2.6);
    if (face === Face.FOCUS) strokePath(ctx, brows, INK, 3.2);
    if (face === Face.SAD) { oval(ctx, -13.5, -24, 2.5, 4); ctx.fillStyle = css(0xff8fd3ff); ctx.fill(); }
  }
  // 입
  if (face === Face.SHOUT) {
    ctx.beginPath(); mouthOpen(ctx); ctx.fillStyle = css(MOUTH); ctx.fill();
    ctx.strokeStyle = css(INK); ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.stroke();
  } else if (face === Face.DIZZY) strokePath(ctx, mouthWavy, INK, 2.3);
  else if (face === Face.SAD) strokePath(ctx, mouthSad, INK, 3.2);
  else strokePath(ctx, mouthSmile, INK, 3.2);
  const hat = o.hat ?? Hat.NONE;
  if (hat !== Hat.NONE) drawHat(ctx, hat);
  ctx.restore();
}

/* ───────────── 머리 장식 ───────────── */

const HAT_RED = 0xffff4f64;
const LEAF = 0xff7bd36b;
const pathFS = (ctx, build, fill) => { ctx.beginPath(); build(ctx); fillStroke(ctx, fill, 2.6); };

/** 머리 장식 (몸 좌표 그대로, 몸 위에 그림) */
export function drawHat(ctx, hat) {
  switch (hat) {
    case Hat.BAND: {
      ctx.save();
      ctx.beginPath(); bodyPath(ctx); ctx.clip();
      const band = (c) => { c.moveTo(-34, -48); c.quadraticCurveTo(0, -60, 34, -48); };
      strokePath(ctx, band, INK, 10, 'butt');
      strokePath(ctx, band, HAT_RED, 6.5, 'butt');
      strokePath(ctx, (c) => { c.moveTo(-34, -49); c.quadraticCurveTo(0, -61, 34, -49); }, withAlpha(WHITE, 0.9), 1.6, 'butt');
      ctx.restore();
      pathFS(ctx, (c) => {
        c.moveTo(-27, -53); c.quadraticCurveTo(-37, -60, -44, -55); c.quadraticCurveTo(-38, -49, -27, -49); c.closePath();
        c.moveTo(-27, -50); c.quadraticCurveTo(-36, -46, -41, -38); c.quadraticCurveTo(-32, -38, -27, -46); c.closePath();
      }, HAT_RED);
      break;
    }
    case Hat.SPROUT:
      strokePath(ctx, (c) => { c.moveTo(0, -61); c.quadraticCurveTo(-1, -68, 1, -73); }, INK, 2.6);
      ctx.beginPath(); ctx.ellipse(-6, -74, 7, 4, -Math.PI / 6, 0, Math.PI * 2); fillStroke(ctx, LEAF, 2.6);
      ctx.beginPath(); ctx.ellipse(8, -75, 7, 4, Math.PI / 6, 0, Math.PI * 2); fillStroke(ctx, LEAF, 2.6);
      break;
    case Hat.BOW:
      ctx.save(); ctx.translate(16, -60);
      pathFS(ctx, (c) => { c.moveTo(0, 0); c.lineTo(12, -8); c.lineTo(13, 7); c.closePath(); c.moveTo(0, 0); c.lineTo(-11, -9); c.lineTo(-12, 6); c.closePath(); }, 0xffff7eb0);
      circleFO(ctx, 0, 0, 4.5, 0xffff7eb0, 2.6);
      ctx.restore();
      break;
    case Hat.FLOWER:
      for (let k = 0; k < 5; k++) {
        const a = (k * 72 * Math.PI) / 180;
        circleFO(ctx, -15 + Math.cos(a) * 5.5, -57 + Math.sin(a) * 5.5, 4.5, 0xffff9fc6, 2.6);
      }
      circleFO(ctx, -15, -57, 3.5, 0xffffd23f, 2.6);
      break;
    case Hat.STAR:
      pathFS(ctx, (c) => {
        const pts = [[0, -8], [2.4, -2.5], [8, -2.5], [3.5, 1.2], [5, 7], [0, 3.6], [-5, 7], [-3.5, 1.2], [-8, -2.5], [-2.4, -2.5]];
        pts.forEach(([x, y], i) => (i === 0 ? c.moveTo(x - 18, y - 55) : c.lineTo(x - 18, y - 55)));
        c.closePath();
      }, 0xffffd23f);
      break;
    case Hat.ANTENNA:
      strokePath(ctx, (c) => { c.moveTo(2, -61); c.quadraticCurveTo(8, -71, 4, -80); }, INK, 2.6);
      pathFS(ctx, (c) => { c.moveTo(4, -80); c.bezierCurveTo(-3, -85, 0, -91, 4, -87); c.bezierCurveTo(8, -91, 11, -85, 4, -80); c.closePath(); }, HAT_RED);
      break;
    case Hat.PARTY:
      pathFS(ctx, (c) => { c.moveTo(-11, -57); c.lineTo(3, -88); c.lineTo(14, -58); c.closePath(); }, 0xff6ab8ff);
      strokePath(ctx, (c) => { c.moveTo(-6, -68); c.lineTo(11, -66); c.moveTo(-1, -78); c.lineTo(8, -77); }, WHITE, 3, 'butt');
      circleFO(ctx, 3, -89, 4, 0xffffd23f, 2.6);
      break;
    case Hat.HALO:
      oval(ctx, 0, -74, 17, 5.5); ctx.strokeStyle = css(INK); ctx.lineWidth = 6.5; ctx.stroke();
      oval(ctx, 0, -74, 17, 5.5); ctx.strokeStyle = css(0xffffd23f); ctx.lineWidth = 3.5; ctx.stroke();
      break;
    case Hat.TANGERINE: {
      // 귤 껍질 헬멧: 머리 위를 덮는 주황 반구 + 꼭지 잎
      ctx.beginPath(); ctx.ellipse(0, -46, 31, 22, 0, Math.PI, Math.PI * 2); ctx.closePath();
      fillStroke(ctx, 0xffff9f1c, 2.6);
      ctx.fillStyle = css(0xffe07d00);
      for (const [x, y] of [[-16, -55], [-6, -61], [7, -59], [17, -52], [-22, -48], [1, -51], [12, -64]]) { circle(ctx, x, y, 1.3); ctx.fill(); }
      strokePath(ctx, (c) => { c.moveTo(-20, -60); c.quadraticCurveTo(-12, -66, -3, -67); }, withAlpha(WHITE, 0.75), 3);
      strokePath(ctx, (c) => { c.moveTo(-31, -46); c.lineTo(31, -46); }, INK, 2.6);
      strokePath(ctx, (c) => { c.moveTo(0, -68); c.quadraticCurveTo(1, -72, 0, -75); }, INK, 2.6);
      ctx.beginPath(); ctx.ellipse(7, -75, 7, 3.6, -0.35, 0, Math.PI * 2); fillStroke(ctx, LEAF, 2.4);
      break;
    }
    case Hat.AVOCADO: {
      // 반으로 자른 아보카도를 비스듬히 얹은 모자
      ctx.save(); ctx.translate(5, -71); ctx.rotate(-0.25);
      const pear = (k) => { ctx.beginPath(); ctx.moveTo(0, -13 * k); ctx.bezierCurveTo(9 * k, -13 * k, 13 * k, 4 * k, 12 * k, 8 * k); ctx.bezierCurveTo(10 * k, 16 * k, -10 * k, 16 * k, -12 * k, 8 * k); ctx.bezierCurveTo(-13 * k, 4 * k, -9 * k, -13 * k, 0, -13 * k); ctx.closePath(); };
      pear(1.05); fillStroke(ctx, 0xff3f7d2a, 2.6);
      pear(0.78); ctx.fillStyle = css(0xffd6ee8a); ctx.fill();
      circle(ctx, 0, 5, 5.6); fillStroke(ctx, 0xff9a5b2c, 2.2);
      circle(ctx, -1.6, 3.4, 1.6); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
      ctx.restore();
      break;
    }
    case Hat.BALLBAND: {
      // 파란 머리띠 + 옆에 꽂은 작은 축구공
      ctx.save();
      ctx.beginPath(); bodyPath(ctx); ctx.clip();
      const band = (c) => { c.moveTo(-34, -48); c.quadraticCurveTo(0, -60, 34, -48); };
      strokePath(ctx, band, INK, 10, 'butt');
      strokePath(ctx, band, 0xff4f8cff, 6.5, 'butt');
      strokePath(ctx, (c) => { c.moveTo(-34, -49); c.quadraticCurveTo(0, -61, 34, -49); }, withAlpha(WHITE, 0.9), 1.6, 'butt');
      ctx.restore();
      drawBall(ctx, -24, -56, 8.5, 0.4);
      break;
    }
    case Hat.COLA: {
      // 머리 위에 꽂힌 콜라 병
      ctx.save(); ctx.translate(6, -60); ctx.rotate(0.18);
      ctx.beginPath();
      ctx.moveTo(-7, 0); ctx.lineTo(-7, -14); ctx.quadraticCurveTo(-7, -19, -3.5, -22); ctx.lineTo(-3.5, -29);
      ctx.lineTo(3.5, -29); ctx.lineTo(3.5, -22); ctx.quadraticCurveTo(7, -19, 7, -14); ctx.lineTo(7, 0); ctx.closePath();
      fillStroke(ctx, 0xff5a2a1e, 2.4);
      ctx.beginPath(); ctx.rect(-7, -12, 14, 7); ctx.fillStyle = css(0xffe63946); ctx.fill(); ctx.strokeStyle = css(INK); ctx.lineWidth = 1.8; ctx.stroke();
      strokePath(ctx, (c) => { c.moveTo(-5, -8); c.quadraticCurveTo(-1, -11, 1, -8); c.quadraticCurveTo(3, -5, 5, -8); }, WHITE, 1.4);
      strokePath(ctx, (c) => { c.moveTo(-4, -2); c.lineTo(-4, -4); c.moveTo(-4.5, -15); c.lineTo(-4.5, -19); }, withAlpha(WHITE, 0.6), 1.6);
      ctx.beginPath(); ctx.roundRect(-4.6, -33, 9.2, 5, 1.5); fillStroke(ctx, 0xffe63946, 2);
      ctx.restore();
      break;
    }
    case Hat.CROWN:
      pathFS(ctx, (c) => { c.moveTo(-12, -58); c.lineTo(-14, -74); c.lineTo(-6, -66); c.lineTo(0, -78); c.lineTo(6, -66); c.lineTo(14, -74); c.lineTo(12, -58); c.closePath(); }, 0xffffc93c);
      circle(ctx, 0, -63, 2.6); ctx.fillStyle = css(HAT_RED); ctx.fill();
      circle(ctx, -8, -62, 2); ctx.fillStyle = css(0xff6ab8ff); ctx.fill();
      circle(ctx, 8, -62, 2); ctx.fill();
      break;
  }
}

/* ───────────── 공 / 아이템 ───────────── */

export function drawBall(ctx, x, y, r, spin) {
  circle(ctx, x, y, r); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.save();
  ctx.translate(x, y); ctx.rotate(spin);
  ctx.beginPath();
  ctx.strokeStyle = css(INK); ctx.lineWidth = r / 7;
  for (let k = 0; k < 5; k++) {
    const a = ((-90 + 72 * k) * Math.PI) / 180;
    ctx.moveTo(Math.cos(a) * r * 0.38, Math.sin(a) * r * 0.38);
    ctx.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95);
  }
  ctx.stroke();
  ctx.beginPath();
  for (let k = 0; k < 5; k++) {
    const a = ((-90 + 72 * k) * Math.PI) / 180;
    const px = Math.cos(a) * r * 0.38, py = Math.sin(a) * r * 0.38;
    if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fillStyle = css(INK); ctx.fill();
  ctx.restore();
  circle(ctx, x, y, r); ctx.strokeStyle = css(INK); ctx.lineWidth = r / 4.5; ctx.stroke();
  circle(ctx, x - r * 0.4, y - r * 0.45, r * 0.18); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
}

export function sparkle(ctx, x, y, s, color = WHITE, alpha = 1) {
  ctx.beginPath();
  ctx.moveTo(x, y - 10 * s); ctx.quadraticCurveTo(x + 2 * s, y - 2 * s, x + 10 * s, y);
  ctx.quadraticCurveTo(x + 2 * s, y + 2 * s, x, y + 10 * s); ctx.quadraticCurveTo(x - 2 * s, y + 2 * s, x - 10 * s, y);
  ctx.quadraticCurveTo(x - 2 * s, y - 2 * s, x, y - 10 * s); ctx.closePath();
  ctx.fillStyle = css(color, alphaOf(color) * alpha); ctx.fill();
  ctx.strokeStyle = css(INK, alpha); ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.stroke();
}

export function glow(ctx, x, y, r, inner = 'rgba(255,246,176,0.8)') {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner); g.addColorStop(1, 'rgba(255,246,176,0)');
  circle(ctx, x, y, r); ctx.fillStyle = g; ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

export function drawItemBox(ctx, x, y, sz, t) {
  const h = sz / 2;
  const fl = Math.sin(t * 3) * 4;
  oval(ctx, x, y, sz * 0.45, sz * 0.13); ctx.fillStyle = css(SHADOW); ctx.fill();
  const cy = y - sz * 0.95 + fl;
  glow(ctx, x, cy, sz * 0.95);
  ctx.save();
  ctx.translate(x, cy); ctx.rotate(((-10 + Math.sin(t * 2) * 6) * Math.PI) / 180); ctx.translate(-x, -cy);
  const g = ctx.createLinearGradient(x - h, cy - h, x + h, cy + h);
  [0xffff7eb0, 0xffffd23f, 0xff6ee7a8, 0xff6ab8ff].forEach((c, i) => g.addColorStop(i / 3, css(c)));
  roundRect(ctx, x - h, cy - h, sz, sz, sz * 0.22); ctx.fillStyle = g; ctx.fill();
  roundRect(ctx, x - h + 4, cy - h + 4, sz - 8, sz * 0.28, sz * 0.12); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();
  roundRect(ctx, x - h, cy - h, sz, sz, sz * 0.22); ctx.strokeStyle = css(INK); ctx.lineWidth = 3; ctx.stroke();
  label(ctx, '?', x, cy + 1, sz * 0.72, WHITE, 4);
  ctx.restore();
  const tw = (Math.sin(t * 5) + 1) / 2;
  sparkle(ctx, x + sz * 0.75, cy - sz * 0.55, 0.55 + tw * 0.25, 0xfffff6a0);
  sparkle(ctx, x - sz * 0.8, cy - sz * 0.1, 0.45 + (1 - tw) * 0.2);
}

export function drawBanana(ctx, x, y, s) {
  oval(ctx, x, y + 0.5 * s, 12 * s, 3.5 * s); ctx.fillStyle = css(SHADOW); ctx.fill();
  label(ctx, '🍌', x, y - 9 * s, 22 * s);
}

/* ───────────── 트로피 ───────────── */

export function drawTrophy(ctx, x, y, s) {
  glow(ctx, x, y - 20 * s, 130 * s);
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  const handle = (sx) => (c) => { c.moveTo(52 * sx, -82); c.quadraticCurveTo(92 * sx, -82, 84 * sx, -48); c.quadraticCurveTo(76 * sx, -20, 40 * sx, -16); };
  for (const sx of [-1, 1]) { strokePath(ctx, handle(sx), INK, 12); strokePath(ctx, handle(sx), 0xffffc93c, 5); }
  ctx.beginPath();
  ctx.moveTo(-58, -92); ctx.lineTo(58, -92); ctx.quadraticCurveTo(56, -10, 12, 8); ctx.lineTo(12, 30); ctx.lineTo(-12, 30); ctx.lineTo(-12, 8);
  ctx.quadraticCurveTo(-56, -10, -58, -92); ctx.closePath();
  const g = ctx.createLinearGradient(-60, -90, 60, 30);
  g.addColorStop(0, css(0xfffff3a0)); g.addColorStop(0.5, css(0xffffc93c)); g.addColorStop(1, css(0xffe08a00));
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = css(INK); ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();
  strokePath(ctx, (c) => { c.moveTo(-40, -82); c.quadraticCurveTo(-38, -34, -12, -8); }, withAlpha(WHITE, 0.7), 6);
  roundRect(ctx, -40, 30, 80, 18, 6); fillStroke(ctx, 0xffffc93c, 4);
  roundRect(ctx, -54, 48, 108, 26, 8); fillStroke(ctx, 0xff6b4bd6, 4);
  sparkle(ctx, 0, -58, 1.4, WHITE);
  ctx.restore();
}
