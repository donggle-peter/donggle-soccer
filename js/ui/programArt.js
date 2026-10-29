import { div, col, space, Txt, OTxt, Canvas } from './kit.js';
import { drawMongi, label, glow } from '../game/draw.js';
import { Pos } from '../data/legends.js';
import { css, Rng, INK, WHITE } from '../core.js';

/* ───────── 프로그램 선수 그림 (검은 바탕 + 대각선 빛줄기·조각 무늬) ───────── */

const LegendRed = 0xffff4f64;
const GkGreen = 0xff5fd068;
export const ProgramGold = 0xffffc340;
export const ProgramYellow = 0xffffe066;
export const PROGRAM_BG = 'linear-gradient(#2a1630, #150a1c)';

const LINES = ['rgba(255,130,60,0.55)', 'rgba(255,60,90,0.5)', 'rgba(190,90,255,0.45)', 'rgba(255,215,90,0.55)'];
const SHARDS = [[0xffffe066, 0xffff8a1c], [0xffff9a2e, 0xffd81f3c], [0xffff5a3c, 0xff9c1450], [0xffffc340, 0xffff5a1f]];

/** 프로그램 무늬. seed 가 같으면 늘 같은 무늬 */
export function drawProgram(ctx, w, hgt, seed = 1) {
  const r = new Rng(seed);
  ctx.fillStyle = '#150a1c'; ctx.fillRect(0, 0, w, hgt);
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (let y = 0; y < hgt; y += 7) for (let x = ((y / 7) % 2) * 7; x < w; x += 14) ctx.fillRect(x, y, 7, 7);
  const D = Math.hypot(w, hgt);
  for (const dir of [-1, 1]) {
    ctx.save(); ctx.translate(w / 2, hgt / 2); ctx.rotate(dir * Math.PI / 4);
    for (let i = 0; i < 26; i++) {
      const y = (r.float() - 0.5) * D;
      ctx.strokeStyle = LINES[r.int(LINES.length)]; ctx.lineWidth = 0.6 + r.float() * 1.4;
      const x0 = (r.float() - 0.5) * D, len = D * (0.3 + r.float() * 0.7);
      ctx.beginPath(); ctx.moveTo(x0 - len / 2, y); ctx.lineTo(x0 + len / 2, y); ctx.stroke();
    }
    for (let i = 0; i < 7; i++) {
      const x = (r.float() - 0.5) * D * 0.9, y = (r.float() - 0.5) * D * 0.9;
      const len = 18 + r.float() * 60, th = 4 + r.float() * 13;
      const [a, b] = SHARDS[r.int(SHARDS.length)];
      const g = ctx.createLinearGradient(x, 0, x + len, 0);
      g.addColorStop(0, css(a, 0.95)); g.addColorStop(1, css(b, 0.25));
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.lineTo(x + len + th, y + th); ctx.lineTo(x + th, y + th); ctx.closePath();
      ctx.fillStyle = g; ctx.fill();
    }
    ctx.restore();
  }
}

/** 무늬만 깔린 배경 (부모를 꽉 채움) */
export function ProgramBackground(seed = 1) {
  return Canvas('100%', '100%', (ctx, t, vw, vh) => drawProgram(ctx, vw, vh, seed), { class: 'fill' });
}

/** 프로그램 엠블럼: 방패 안에 무늬 + ⚡ + 이름 */
export function ProgramEmblem(program, size) {
  return Canvas(size, size, (ctx, t, w, hh) => {
    const shield = () => {
      ctx.beginPath();
      ctx.moveTo(w * 0.5, hh * 0.04); ctx.lineTo(w * 0.9, hh * 0.18); ctx.lineTo(w * 0.86, hh * 0.6);
      ctx.quadraticCurveTo(w * 0.78, hh * 0.86, w * 0.5, hh * 0.97); ctx.quadraticCurveTo(w * 0.22, hh * 0.86, w * 0.14, hh * 0.6);
      ctx.lineTo(w * 0.1, hh * 0.18); ctx.closePath();
    };
    ctx.save(); shield(); ctx.clip(); drawProgram(ctx, w, hh, 3); ctx.restore();
    shield(); ctx.strokeStyle = css(ProgramGold); ctx.lineWidth = size * 0.05; ctx.stroke();
    label(ctx, '⚡', w / 2, hh * 0.48, size * 0.34);
    if (size >= 56) label(ctx, program.name, w / 2, hh * 0.76, size * 0.13, ProgramYellow, size * 0.04);
  }, { style: { flex: 'none' } });
}

/** 동글이 그림 (프로그램 카드 안) */
export function ProgramFigure(l, scale, height) {
  return Canvas('100%', height, (ctx, t, vw, vh) => {
    const cx = vw / 2, base = vh - 6;
    glow(ctx, cx, base - 34 * scale, 56 * scale, 'rgba(255,150,60,0.55)');
    drawMongi(ctx, cx, base, scale, l.pos === Pos.GK ? GkGreen : LegendRed, { gloves: l.pos === Pos.GK, hat: l.grade.hat });
    label(ctx, String(l.num), cx, base - 8 * scale, 11 * scale, WHITE, 2.4 * scale);
  }, { style: { flex: 'none' } });
}

/**
 * 프로그램 선수 카드. o: { h, selected, footer(글자), footerColor, onClick, mini, dim, check }
 * mini 는 이벤트 센터에서 쓰는 작은 카드
 */
export function ProgramCard(l, o = {}) {
  const mini = o.mini ?? false;
  const border = o.selected ? (mini ? 0xff7dff8a : 0xffffd23f) : mini ? ProgramGold : INK;
  return div({ style: { position: 'relative', height: o.h ?? 196, cursor: o.onClick ? 'pointer' : 'default', opacity: o.dim ? 0.45 : 1 }, onClick: o.onClick },
    mini ? null : div({ class: 'abs', style: { left: 0, right: 0, top: 6, bottom: 0, background: css(INK), borderRadius: 20 } }),
    div({ class: 'abs', style: { left: 0, right: 0, top: 0, bottom: mini ? 0 : 7, borderRadius: mini ? 14 : 20, overflow: 'hidden',
      border: `${mini ? 3 : 4}px solid ${css(border)}`, boxShadow: o.selected && mini ? '0 0 14px #7dff8a' : 'none' } },
    ProgramBackground(l.id),
    mini ? null : div({ class: 'abs', style: { inset: 5, borderRadius: 15, border: `2.5px solid ${css(ProgramGold, 0.9)}`, pointerEvents: 'none' } }),
    mini
      ? col({ position: 'absolute', inset: 0, alignItems: 'center' }, space(20), ProgramFigure(l, 0.62, 64), OTxt(l.short, l.short.length > 4 ? 12 : 14, WHITE, { strokeWidth: 3 }))
      : col({ position: 'absolute', inset: 0, alignItems: 'center' },
        space(18), ProgramFigure(l, 0.95, 92),
        OTxt(l.name, l.name.length > 7 ? 14 : 18, WHITE, { strokeWidth: 4 }),
        OTxt(`⚡ ${l.program.name}`, 12, ProgramGold, { strokeWidth: 3 }),
        o.footer ? OTxt(o.footer, 13, o.footerColor ?? ProgramYellow, { strokeWidth: 3 }) : null),
    mini
      ? div({ class: 'abs', style: { left: 6, top: 2 } }, OTxt(String(l.ovr), 15, ProgramYellow, { strokeWidth: 3 }))
      : col({ position: 'absolute', left: 10, top: 5 }, OTxt(String(l.ovr), 25, ProgramYellow, { strokeWidth: 5 }), OTxt(l.pos.name, 12, WHITE, { strokeWidth: 3 })),
    mini
      ? div({ class: 'abs', style: { right: 6, top: 3 } }, OTxt(l.pos.name, 10, WHITE, { strokeWidth: 3 }))
      : div({ class: 'abs', style: { right: 9, top: 6 } }, Txt(l.flag, 17)),
    o.check ? div({ class: 'abs', style: { right: 4, bottom: 4 } }, Txt(o.check, 16)) : null));
}

