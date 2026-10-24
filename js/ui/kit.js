import { css, Rng, INK, WHITE } from '../core.js';
import { SYMBOL_WIDTH, hasSymbols, drawMongi, drawBall, label, circle, oval, Face } from '../game/draw.js';
import { Roster } from '../data/teams.js';

/* 화면 부품: 안드로이드 Common.kt 와 같은 모양 */

export const Ink = INK;
export const GoldG = [0xffffe981, 0xffffb627];
export const BlueG = [0xffa8dcff, 0xff55a8ff];
export const GreenG = [0xffb8f59c, 0xff5fd068];
export const PinkG = [0xffffc3dc, 0xffff7eb0];
export const WhiteG = [0xffffffff, 0xfff1edfb];
export const Gold = 0xffffd23f;

const grad = (cs) => `linear-gradient(${cs.map((c) => css(c)).join(',')})`;

/* ───────────── DOM ───────────── */

/** h('div', { class, style, onClick, ... }, ...children) */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') {
      if (typeof v === 'string') el.style.cssText = v;
      else for (const [sk, sv] of Object.entries(v)) if (sv != null) el.style[sk] = typeof sv === 'number' && !NO_PX.has(sk) ? sv + 'px' : sv;
    } else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'ref') v(el);
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}
const NO_PX = new Set(['opacity', 'zIndex', 'flex', 'flexGrow', 'flexShrink', 'fontWeight', 'lineHeight', 'order']);
function append(el, c) {
  if (c == null || c === false) return;
  if (Array.isArray(c)) { c.forEach((x) => append(el, x)); return; }
  el.append(c instanceof Node ? c : document.createTextNode(String(c)));
}

export const div = (props, ...c) => h('div', props, ...c);
export const row = (style, ...c) => h('div', { class: 'row', style }, ...c);
export const col = (style, ...c) => h('div', { class: 'col', style }, ...c);
export const space = (w, hh = w) => h('div', { style: { width: w, height: hh, flex: 'none' } });

/* ───────────── 글자 ───────────── */

/** 주아체에 없는 기호(·, →, ▲ …)는 글자 자리만 비워 두고 같은 굵기로 직접 그린다 */
function symSvg(ch, outline = 0) {
  const w = SYMBOL_WIDTH[ch];
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `${-w * 50} -50 ${w * 100} 100`);
  svg.setAttribute('class', 'sym');
  svg.style.width = w + 'em';
  svg.style.height = '1em';
  svg.style.overflow = 'visible';
  const p = document.createElementNS(ns, 'path');
  const ex = outline; // em 100 기준 바깥선
  let d, fill = true, sw = 8 + ex;
  if (ch === '·') { d = 'M 0 0 m -8.5 0 a 8.5 8.5 0 1 0 17 0 a 8.5 8.5 0 1 0 -17 0'; sw = ex; }
  else if (ch === '→') { d = 'M -36 0 L 32 0 M 8 -23 L 34 0 L 8 23'; fill = false; sw = 11 + ex; }
  else if (ch === '▲') d = 'M 0 -27 L 29.7 21.6 L -29.7 21.6 Z';
  else if (ch === '▼') d = 'M 0 27 L 29.7 -21.6 L -29.7 -21.6 Z';
  else if (ch === '▶') d = 'M 27 0 L -21.6 -29.7 L -21.6 29.7 Z';
  else d = 'M -27 0 L 21.6 -29.7 L 21.6 29.7 Z';
  p.setAttribute('d', d);
  p.setAttribute('fill', fill ? 'currentColor' : 'none');
  p.setAttribute('stroke', 'currentColor');
  p.setAttribute('stroke-width', String(sw));
  p.setAttribute('stroke-linejoin', 'round');
  p.setAttribute('stroke-linecap', 'round');
  svg.append(p);
  return svg;
}

function textParts(text, outline = 0) {
  if (!hasSymbols(text)) return [text];
  const out = [];
  let buf = '', prevSym = false;
  for (const ch of text) {
    if (ch === '️' && prevSym) continue;
    prevSym = ch in SYMBOL_WIDTH;
    if (prevSym) { if (buf) { out.push(buf); buf = ''; } out.push(symSvg(ch, outline)); } else buf += ch;
  }
  if (buf) out.push(buf);
  return out;
}

/** 글자 한 줄 (기본 한 줄, 넘치면 …) */
export function Txt(text, size, color = INK, o = {}) {
  const st = { fontSize: size, color: typeof color === 'number' ? css(color) : color, ...o.style };
  if (o.align) st.textAlign = o.align;
  const cls = 't' + (o.multi ? ' multi' : '') + (o.ellipsis ? ' ellipsis' : '');
  if (o.ellipsis) { st.display = 'block'; st.maxWidth = '100%'; }
  return h('span', { class: cls, style: st }, textParts(String(text)));
}

/** 외곽선 글자. o: { stroke, strokeWidth, gradient: [색...] } */
export function OTxt(text, size, color = WHITE, o = {}) {
  const sw = o.strokeWidth ?? 6;
  const stroke = o.stroke ?? INK;
  const back = h('span', { style: { color: css(stroke), WebkitTextStroke: `${sw}px ${css(stroke)}`, display: 'inline-block' } }, textParts(String(text), sw * (100 / size)));
  const fstyle = { display: 'inline-block' };
  if (o.gradient) {
    fstyle.backgroundImage = grad(o.gradient);
    fstyle.WebkitBackgroundClip = 'text';
    fstyle.backgroundClip = 'text';
    fstyle.color = 'transparent';
  } else fstyle.color = css(color);
  const front = h('span', { class: 'ot-f', style: fstyle }, textParts(String(text)));
  if (o.gradient) front.querySelectorAll('svg').forEach((s) => (s.style.color = css(o.gradient[1])));
  return h('span', { class: 'ot', style: { fontSize: size, ...o.style } }, back, front);
}

/* ───────────── 버튼 · 판 ───────────── */

/** 사탕 버튼. 크기는 아래 그림자 7 까지 포함 */
export function CandyButton(onClick, colors, o, ...content) {
  const r = o.radius ?? 24;
  return h('div', {
    class: 'candy' + (o.enabled === false ? ' disabled' : ''),
    style: { width: o.w, height: o.h, flex: o.flex, ...o.style },
    onClick: (ev) => { ev.stopPropagation(); onClick?.(ev); },
  },
  h('div', { class: 'c-shadow', style: { borderRadius: r } }),
  h('div', { class: 'c-body', style: { borderRadius: r, background: grad(colors) } }, h('div', { class: 'c-shine' })),
  h('div', { class: 'c-content', style: o.contentStyle }, ...content));
}

/** 글자 버튼. 높이는 몸통 높이 (그림자 7 은 따로 붙음) */
export function TextButton(text, onClick, colors, width, height = 56, size = 22, o = {}) {
  return CandyButton(onClick, colors, { w: width, h: height + 7, radius: height / 2, enabled: o.enabled, style: o.style, flex: o.flex },
    Txt(text, size, o.textColor ?? INK));
}

export function CircleButton(text, onClick, size = 50, fontSize = 22, o = {}) {
  return CandyButton(onClick, WhiteG, { w: size, h: size + 7, radius: size / 2, style: o.style }, Txt(text, fontSize));
}

export function Panel(o, ...content) {
  const r = o.radius ?? 26;
  return h('div', { class: 'panel', style: { width: o.w, height: o.h, flex: o.flex, ...o.style }, onClick: o.onClick },
    h('div', { class: 'p-shadow', style: { borderRadius: r } }),
    h('div', { class: 'p-body', style: { borderRadius: r, background: o.color != null ? css(o.color) : '#fff', ...o.bodyStyle } }, ...content),
    h('div', { class: 'p-border', style: { borderRadius: r, borderColor: o.border != null ? css(o.border) : undefined } }));
}

export function Chip(o, ...content) {
  return h('div', { class: 'chip', style: o.style, onClick: o.onClick },
    h('div', { class: 'ch-shadow' }), h('div', { class: 'ch-body' }, ...content));
}

export const CoinChip = (coins) => Chip({}, Txt('🪙', 18), Txt(coins.toLocaleString('en-US'), 20));

export function TopBar(title, color, onBack, coins = null, right = null) {
  return h('div', { style: { position: 'relative', height: 68, flex: 'none' } },
    h('div', { class: 'abs', style: { left: 0, right: 0, top: 0, height: 64, background: css(color) } }),
    h('div', { class: 'abs', style: { left: 0, right: 0, top: 64, height: 4, background: css(INK) } }),
    CircleButton('◀', onBack, 48, 20, { style: { position: 'absolute', left: 16, top: 6 } }),
    h('div', { class: 'abs center', style: { left: 0, right: 0, top: 0, height: 64, pointerEvents: 'none' } }, OTxt(title, 30)),
    h('div', { class: 'abs row', style: { right: 16, top: 9, gap: 10 } }, right, coins != null ? CoinChip(coins) : null));
}

export function Stars(n, size = 15) {
  return h('span', { class: 'nowrap' }, Txt('★'.repeat(n), size, 0xffffb627), Txt('★'.repeat(5 - n), size, 0xffddd8ea));
}

export function Badge(text) { return h('div', { class: 'badge' }, text); }

/** 아래쪽에 잠깐 뜨는 알림 */
export function showToast(root, text, ms = 2400) {
  root.querySelectorAll(':scope > .toast').forEach((t) => t.remove());
  const t = h('div', { class: 'toast' }, Txt(text, 20, WHITE));
  root.append(t);
  setTimeout(() => t.remove(), ms);
}

/* ───────────── 캔버스 ───────────── */

/**
 * 가상 좌표 캔버스. draw(ctx, t, w, h) 는 매 프레임(anim) 또는 한 번만 불린다.
 * 화면 확대율에 맞춰 선명하게 그린다.
 */
export function Canvas(w, hgt, draw, o = {}) {
  const c = h('canvas', { style: { width: w === '100%' ? '100%' : w, height: hgt === '100%' ? '100%' : hgt, ...o.style }, class: o.class });
  c._draw = draw;
  c._anim = o.anim ?? false;
  return c;
}

let scale = 1;
export function setScale(s) { scale = s; }

const t0 = performance.now();
/** 화면에 있는 캔버스들을 그린다 (static 은 처음 한 번, anim 은 매 프레임) */
export function paintCanvases(root, now = performance.now()) {
  const t = (now - t0) / 1000;
  for (const c of root.querySelectorAll('canvas')) {
    if (!c._draw) continue;
    const w = c.clientWidth, hh = c.clientHeight;
    if (!w || !hh) continue;
    const k = scale * Math.min(window.devicePixelRatio || 1, 3);
    const pw = Math.round(w * k), ph = Math.round(hh * k);
    const resized = c.width !== pw || c.height !== ph;
    if (!resized && !c._anim && c._painted) continue;
    if (resized) { c.width = pw; c.height = ph; }
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pw, ph);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    c._draw(ctx, t, w, hh);
    c._painted = true;
  }
}

/* ───────────── 배경 ───────────── */

export function DotsBackground(base, dot = 'rgba(255,255,255,0.55)') {
  return Canvas('100%', '100%', (ctx, t, vw, vh) => {
    ctx.fillStyle = css(base); ctx.fillRect(0, 0, vw, vh);
    ctx.fillStyle = dot;
    ctx.beginPath();
    let rowi = 0;
    for (let y = 0; y < vh + 40; y += 64, rowi++) {
      for (let x = rowi % 2 === 0 ? 0 : 45; x < vw + 40; x += 90) { ctx.moveTo(x + 8, y); ctx.arc(x, y, 8, 0, Math.PI * 2); }
    }
    ctx.fill();
  }, { class: 'fill' });
}

const confetti = (() => {
  const r = new Rng(11);
  const cc = [0xffff7eb0, 0xffffd23f, 0xff6ab8ff, 0xff6ee7a8, 0xffffffff, 0xffff9f1c];
  return [...Array(90)].map((_, i) => ({ x: r.float() * 1600, y: r.float() * 700, w: 6 + r.float() * 6, h: 3 + r.float() * 4, c: cc[i % cc.length], sp: 20 + r.float() * 40, rot: r.float() * 180 }));
})();

export function NightBackground() {
  return Canvas('100%', '100%', (ctx, t, vw, vh) => {
    const g = ctx.createRadialGradient(vw / 2, vh * 0.45, 0, vw / 2, vh * 0.45, vw * 0.75);
    g.addColorStop(0, css(0xff6a45d6)); g.addColorStop(1, css(0xff1c1347));
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    for (const [a, b] of [[0.23, 0.5], [0.7, 0.55], [0.06, 0.28]]) {
      const sw = Math.sin(t * 0.6 + a * 10) * 60;
      ctx.beginPath(); ctx.moveTo(vw * a, 0); ctx.lineTo(vw * a + 70, 0); ctx.lineTo(vw * b + 90 + sw, vh); ctx.lineTo(vw * b - 90 + sw, vh); ctx.closePath(); ctx.fill();
    }
    for (const c of confetti) {
      if (c.x > vw) continue;
      const y = ((c.y + t * c.sp) % (vh + 20)) - 10;
      const x = c.x + Math.sin(t + c.rot) * 10;
      ctx.save(); ctx.translate(x, y); ctx.rotate(((c.rot + t * 90) * Math.PI) / 180);
      ctx.fillStyle = css(c.c, 0.8); ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); ctx.restore();
    }
  }, { class: 'fill', anim: true });
}

const menuCrowd = (() => {
  const r = new Rng(7);
  const cc = [0xffff7eb0, 0xffffd23f, 0xff6ab8ff, 0xff6ee7a8, 0xffffffff, 0xffff9f1c, 0xffb18cff, 0xffff4f64];
  return [...Array(700)].map(() => [r.float(), r.float(), cc[r.int(cc.length)]]);
})();

function cloud(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  oval(ctx, x, y, 60 * s, 24 * s); ctx.fill();
  circle(ctx, x - 24 * s, y - 14 * s, 24 * s); ctx.fill();
  circle(ctx, x + 12 * s, y - 24 * s, 30 * s); ctx.fill();
  circle(ctx, x + 40 * s, y - 8 * s, 20 * s); ctx.fill();
}

/** 메인 메뉴 배경: 하늘, 경기장, 뛰노는 동글이들 */
export function drawMenuBackground(ctx, t, vw, vh, cast = Roster.defaults, showCharacters = true) {
  const g = ctx.createLinearGradient(0, 0, 0, vh);
  g.addColorStop(0, css(0xff6ec3ff)); g.addColorStop(1, css(0xffd6f2ff));
  ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
  // 햇살
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  for (let k = 0; k < 12; k++) {
    const a = k * 0.5236 + t * 0.05;
    ctx.beginPath(); ctx.moveTo(330, 200);
    ctx.lineTo(330 + Math.cos(a) * 1500, 200 + Math.sin(a) * 1500);
    ctx.lineTo(330 + Math.cos(a + 0.17) * 1500, 200 + Math.sin(a + 0.17) * 1500); ctx.closePath(); ctx.fill();
  }
  // 구름
  [[140, 90, 0.9], [620, 60, 0.7], [1010, 70, 0.8], [780, 150, 0.5]].forEach(([cx, cy, s], i) => {
    const x = ((cx + t * (8 + i * 3)) % (vw + 260)) - 130;
    cloud(ctx, x, cy, s);
  });
  // 조명탑
  for (const lx of [96, vw - 136]) {
    ctx.fillStyle = css(0xff9a8fc4); ctx.fillRect(lx, vh - 366, 10, 190);
    ctx.strokeStyle = css(INK); ctx.lineWidth = 3; ctx.strokeRect(lx, vh - 366, 10, 190);
    ctx.beginPath(); ctx.roundRect(lx - 30, vh - 390, 70, 34, 8); ctx.fillStyle = css(0xfffff6c8); ctx.fill(); ctx.stroke();
  }
  // 관중석
  const y0 = vh - 176, yc = vh - 476;
  ctx.beginPath(); ctx.moveTo(-20, y0); ctx.quadraticCurveTo(vw / 2, yc, vw + 20, y0); ctx.lineTo(vw + 20, vh - 146); ctx.lineTo(-20, vh - 146); ctx.closePath();
  ctx.fillStyle = css(0xff8a76d0); ctx.fill(); ctx.strokeStyle = css(INK); ctx.lineWidth = 4; ctx.stroke();
  menuCrowd.forEach(([fx, fy, c], i) => {
    const x = fx * vw;
    const u = (x + 20) / (vw + 40);
    const top = y0 - 2 * u * (1 - u) * (y0 - yc);
    const y = top + 8 + fy * (vh - 152 - top - 10);
    circle(ctx, x, y - Math.abs(Math.sin(t * 3 + i)) * 2, 4.5 + (i % 3)); ctx.fillStyle = css(c, 0.9); ctx.fill();
  });
  // 광고판
  const cols = [0xffff4f64, 0xffffd23f, 0xff6ab8ff, 0xffb18cff];
  const texts = ['DONGGLE', '⚽ CUTE CUP', 'SOCCER', '★ ITEM'];
  for (let bx = -10, k = 0; bx < vw; bx += 145, k++) {
    ctx.fillStyle = css(cols[k % 4]); ctx.fillRect(bx, vh - 178, 145, 22);
    ctx.strokeStyle = css(INK); ctx.lineWidth = 2.5; ctx.strokeRect(bx, vh - 178, 145, 22);
    label(ctx, texts[k % 4], bx + 72, vh - 167, 14, WHITE, 2.5);
  }
  // 잔디
  [158, 130, 98, 60, 16].forEach((top, i) => { ctx.fillStyle = css(i % 2 === 0 ? 0xff7bd36b : 0xff6cc65e); ctx.fillRect(0, vh - top, vw, top); });
  if (showCharacters) {
    const hop = Math.abs(Math.sin(t * 4)) * 24;
    const bxBall = 382 + Math.sin(t * 2) * 30;
    const byBall = vh - 96 - Math.abs(Math.sin(t * 4)) * 60;
    // 내 선수 꾸미기(이름·번호·머리 장식)가 그대로 보인다
    const a = cast.find((p) => p.slot === 3), b = cast.find((p) => p.slot === 4), c = cast.find((p) => p.slot === 2);
    drawMongi(ctx, 150, vh - 28, 1.95, 0xffff5a6e, { phase: t * 9, moving: true, hat: a.hat, golden: a.golden });
    label(ctx, String(a.num), 150, vh - 28 - 8 * 1.95, 22, WHITE, 5);
    drawMongi(ctx, 300, vh - 54, 1.72, 0xffffc93c, { face: hop > 18 ? Face.SHOUT : Face.HAPPY, hop: hop / 1.72, hat: b.hat, golden: b.golden });
    label(ctx, String(b.num), 300, vh - 54 - 8 * 1.72 - hop, 20, WHITE, 5);
    drawMongi(ctx, 465, vh - 24, 1.88, 0xff4f8cff, { flip: true, phase: t * 7, moving: true, hat: c.hat, golden: c.golden });
    label(ctx, String(c.num), 465, vh - 24 - 8 * 1.88, 22, WHITE, 5);
    drawBall(ctx, bxBall, byBall, 19, t * 4);
  }
}

/** 일시정지 창 */
export function PauseOverlay(note, onResume, onQuit, quitText = '경기 포기하기') {
  return h('div', { class: 'dim', onClick: (e) => e.stopPropagation(), onPointerdown: (e) => e.stopPropagation() },
    Panel({ w: 420, h: 300 },
      col({ alignItems: 'center', padding: 20, height: '100%' },
        OTxt('일시정지', 40, Gold, { strokeWidth: 8 }),
        space(18),
        TextButton('▶ 계속하기', onResume, GreenG, 260, 56, 24),
        space(10),
        TextButton(quitText, onQuit, PinkG, 260, 56, 20),
        note ? [space(4), Txt(note, 14, 'rgba(43,33,80,0.6)')] : null)));
}

export { css };
