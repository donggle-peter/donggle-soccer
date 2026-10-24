import { FL, FW, GOAL_HALF, GOAL_H, Phase, Stun, Fx, Btn } from './engine.js';
import { drawMongi, drawBall, drawItemBox, drawBanana, sparkle, label, textWidth, circle, oval, glow, Face } from './draw.js';
import { css, withAlpha, Rng, clamp, INK, WHITE } from '../core.js';

/* 화면은 가상 좌표(높이 576)로 그린다 */

const TOP = 150;
const KY = 7.8;
const KX = 17;
const KH = 21;

class Proj {
  constructor(cx, cam) { this.cx = cx; this.cam = cam; }
  s(fy) { return 0.78 + 0.44 * (fy / FW); }
  x(fx, fy) { return this.cx + (fx - this.cam) * this.s(fy) * KX; }
  y(fy, h = 0) { return TOP + fy * KY - h * this.s(fy) * KH; }
  pt(fx, fy, h = 0) { return [this.x(fx, fy), this.y(fy, h)]; }
}

export class ControlLayout {
  constructor(vw) {
    this.shoot = [vw - 100, 470]; this.shootR = 60;
    this.pass = [vw - 236, 506]; this.passR = 44;
    this.dash = [vw - 218, 396]; this.dashR = 37;
    this.item = [vw - 98, 334]; this.itemR = 40;
    this.pause = [44, 42]; this.pauseR = 28;
    this.joyHome = [150, 452]; this.joyR = 80;
  }
  hit([x, y]) {
    const d = (c) => Math.hypot(x - c[0], y - c[1]);
    if (d(this.shoot) < this.shootR + 14) return Btn.SHOOT;
    if (d(this.pass) < this.passR + 12) return Btn.PASS;
    if (d(this.dash) < this.dashR + 12) return Btn.DASH;
    if (d(this.item) < this.itemR + 12) return Btn.ITEM;
    return null;
  }
  isPause([x, y]) { return Math.hypot(x - this.pause[0], y - this.pause[1]) < this.pauseR + 16; }
}

export class TouchState {
  constructor() { this.joyActive = false; this.joyBase = [0, 0]; this.joyKnob = [0, 0]; this.down = [false, false, false, false]; }
}

/** 관중석은 경기장 왼쪽 끝보다 이만큼 앞에서 시작해 CROWD_WIDTH 만큼 이어진다 */
const CROWD_MARGIN = 700;
const CROWD_WIDTH = 2600;
const crowdCols = [0xffff7eb0, 0xffffd23f, 0xff6ab8ff, 0xff6ee7a8, 0xffffffff, 0xffff9f1c, 0xffb18cff, 0xffff4f64];
const crowd = (() => {
  const r = new Rng(3);
  return [...Array(1300)].map(() => ({ x: r.float() * CROWD_WIDTH, y: 8 + r.float() * 96, r: 4 + r.float() * 2.5, c: r.int(crowdCols.length) }));
})();
const boardCols = [0xffff4f64, 0xffffd23f, 0xff6ab8ff, 0xffff7eb0];
const boardText = ['DONGGLE', '⚽ PLAY!', 'CUTE CUP', '★ ITEM'];
const STRIPE_A = 0xff79d36b;
const STRIPE_B = 0xff6bc65d;
const OUT_GRASS = 0xff5fb553;
const YELLOW = 0xffffd23f;

/** 경기 화면 전체. ctx 는 가상 좌표로 맞춰 둔 상태 (vw × vh) */
export function drawMatch(ctx, e, touch, vw, vh) {
  const sx = e.shake > 0 ? Math.sin(e.time * 70) * e.shake * 8 : 0;
  ctx.save();
  ctx.translate(sx, 0);
  drawWorld(ctx, e, vw, vh);
  ctx.restore();
  drawHud(ctx, e, vw, touch);
}

function rect(ctx, x, y, w, h, color) { ctx.fillStyle = css(color); ctx.fillRect(x, y, w, h); }
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

/* ───────────── 경기장 ───────────── */

function drawWorld(ctx, e, vw, vh) {
  const half = vw / 2 / KX;
  const lo = half - 7, hi = FL - half + 7;
  const P = new Proj(vw / 2, lo < hi ? clamp(e.camX, lo, hi) : FL / 2);

  // 관중석
  rect(ctx, 0, 0, vw, 112, 0xff7a66c6);
  // 관중석·광고판은 경기장에 붙어 있다: 카메라가 움직여도 먼 쪽 터치라인과 똑같이 밀려서 선수를 따라오지 않는다
  const ox = P.x(0, 0) - CROWD_MARGIN;
  // 골이 들어가면 응원객들이 폴짝폴짝 뛴다 (평소엔 가만히)
  const cheer = e.phase === Phase.GOAL ? Math.min(1, e.phaseT / 0.5) : 0;
  for (let ci = 0; ci < crowdCols.length; ci++) {
    ctx.beginPath();
    for (let i = 0; i < crowd.length; i++) {
      const d = crowd[i];
      if (d.c !== ci) continue;
      const x = ox + d.x;
      if (x < -10 || x > vw + 10) continue;
      const y = cheer > 0 ? d.y - Math.abs(Math.sin(e.time * 12 + i * 1.7)) * 7 * cheer : d.y;
      ctx.moveTo(x + d.r, y); ctx.arc(x, y, d.r, 0, Math.PI * 2);
    }
    ctx.fillStyle = css(crowdCols[ci], 0.9); ctx.fill();
  }
  rect(ctx, 0, 110, vw, 4, INK);
  let k = Math.max(0, Math.floor((-ox - 20) / 150));
  let bx = ox + k * 150;
  while (bx < vw) {
    rect(ctx, bx, 114, 150, 26, boardCols[k % 4]);
    ctx.strokeStyle = css(INK); ctx.lineWidth = 2.5; ctx.strokeRect(bx, 114, 150, 26);
    label(ctx, boardText[k % 4], bx + 75, 127, 15, WHITE, 3);
    bx += 150; k++;
  }
  rect(ctx, 0, 140, vw, vh - 140, OUT_GRASS);

  // 잔디 줄무늬
  const stripes = 12, w = FL / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.beginPath();
    ctx.moveTo(P.x(i * w, 0), P.y(0)); ctx.lineTo(P.x((i + 1) * w, 0), P.y(0));
    ctx.lineTo(P.x((i + 1) * w, FW), P.y(FW)); ctx.lineTo(P.x(i * w, FW), P.y(FW)); ctx.closePath();
    ctx.fillStyle = css(i % 2 === 0 ? STRIPE_A : STRIPE_B); ctx.fill();
  }

  // 라인
  ctx.beginPath();
  const seg = (x1, y1, x2, y2) => { ctx.moveTo(P.x(x1, y1), P.y(y1)); ctx.lineTo(P.x(x2, y2), P.y(y2)); };
  const arc = (cx, cy, r, a0, a1) => {
    let first = true;
    for (let a = a0; a <= a1 + 0.01; a += 8) {
      const rad = (a * Math.PI) / 180;
      const fx = cx + Math.cos(rad) * r, fy = cy + Math.sin(rad) * r;
      if (first) ctx.moveTo(P.x(fx, fy), P.y(fy)); else ctx.lineTo(P.x(fx, fy), P.y(fy));
      first = false;
    }
  };
  seg(0, 0, FL, 0); seg(0, FW, FL, FW); seg(0, 0, 0, FW); seg(FL, 0, FL, FW); seg(FL / 2, 0, FL / 2, FW);
  arc(FL / 2, FW / 2, 7, 0, 360);
  for (const side of [0, 1]) {
    const gx = side === 0 ? 0 : FL, d = side === 0 ? 1 : -1;
    seg(gx, FW / 2 - 10.5, gx + d * 13, FW / 2 - 10.5); seg(gx + d * 13, FW / 2 - 10.5, gx + d * 13, FW / 2 + 10.5);
    seg(gx + d * 13, FW / 2 + 10.5, gx, FW / 2 + 10.5);
    seg(gx, FW / 2 - 6.5, gx + d * 4.5, FW / 2 - 6.5); seg(gx + d * 4.5, FW / 2 - 6.5, gx + d * 4.5, FW / 2 + 6.5);
    seg(gx + d * 4.5, FW / 2 + 6.5, gx, FW / 2 + 6.5);
    if (side === 0) arc(9.5, FW / 2, 6, -54, 54); else arc(FL - 9.5, FW / 2, 6, 126, 234);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  for (const fx of [FL / 2, 9.5, FL - 9.5]) { circle(ctx, P.x(fx, FW / 2), P.y(FW / 2), 3.5); ctx.fillStyle = '#fff'; ctx.fill(); }

  goal(ctx, P, false, false);
  goal(ctx, P, true, false);
  for (let t = 0; t < 2; t++) if (e.wallT[t] > 0) wall(ctx, P, t, e.wallT[t], e.time);

  // 깊이 순서대로
  const order = [];
  e.players.forEach((p, i) => { if (!p.hidden) order.push([p.y, i]); });
  e.boxes.forEach((b, i) => order.push([b.y, 100 + i]));
  e.bananas.forEach((b, i) => order.push([b.y, 200 + i]));
  // 공을 가진 선수가 있으면 공은 항상 그 선수 바로 앞에 그린다
  if (!e.ballHidden) order.push([e.ball.owner ? e.ball.owner.y + 0.01 : e.ball.y + 0.05, 300]);

  // 튜토리얼 목표 별
  for (const [tx, ty] of e.targets) {
    const [cx, cy] = P.pt(tx, ty);
    const s = P.s(ty);
    const pulse = 1 + 0.08 * Math.sin(e.time * 5);
    oval(ctx, cx, cy, 46 * s * pulse, 15 * s * pulse); ctx.fillStyle = css(YELLOW, 0.35); ctx.fill();
    ctx.save();
    ctx.setLineDash([12, 8]); ctx.lineDashOffset = -e.time * 30;
    oval(ctx, cx, cy, 46 * s * pulse, 15 * s * pulse); ctx.strokeStyle = css(YELLOW); ctx.lineWidth = 4; ctx.stroke();
    ctx.restore();
    label(ctx, '⭐', cx, cy - 30 * s + Math.sin(e.time * 4) * 5, 40 * s);
  }
  order.sort((a, b) => a[0] - b[0]);
  for (const [, id] of order) {
    if (id < 100) drawPlayer(ctx, e, P, e.players[id]);
    else if (id < 200) { const b = e.boxes[id - 100]; drawItemBox(ctx, P.x(b.x, b.y), P.y(b.y), 30 * P.s(b.y), b.t); }
    else if (id < 300) { const b = e.bananas[id - 200]; drawBanana(ctx, P.x(b.x, b.y), P.y(b.y), P.s(b.y)); }
    else drawBallAt(ctx, e, P);
  }

  // 파티클
  for (const p of e.particles) {
    const [px, py] = P.pt(p.x, p.y, p.z);
    const a = clamp(p.life / p.maxLife, 0, 1);
    const s = P.s(p.y);
    switch (p.kind) {
      case Fx.STAR: sparkle(ctx, px, py, p.size * s * (0.4 + a * 0.6), p.color, a); break;
      case Fx.FLAME: circle(ctx, px, py, 7 * p.size * s * (0.4 + a)); ctx.fillStyle = css(p.color, a * 0.85); ctx.fill(); break;
      case Fx.CONFETTI:
        ctx.save(); ctx.translate(px, py); ctx.rotate(((p.rot + p.life * 300) * Math.PI) / 180);
        ctx.fillStyle = css(p.color, Math.min(1, a * 2)); ctx.fillRect(-4, -2, 8, 4); ctx.restore(); break;
      case Fx.DUST: circle(ctx, px, py, 6 * p.size * s * (1.6 - a)); ctx.fillStyle = css(WHITE, a * 0.7); ctx.fill(); break;
      case Fx.ICE:
        ctx.save(); ctx.translate(px, py); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = css(p.color, a); ctx.fillRect(-3, -3, 6, 6); ctx.restore(); break;
    }
  }

  goal(ctx, P, false, true);
  goal(ctx, P, true, true);

  // 내 선수 이름표
  for (const p of e.players) {
    if (p.team !== 0 || p.hidden || !p.m.name || (p === e.human && !e.autopilot)) continue;
    const ps = P.s(p.y) * p.size;
    if (p.m.glow) label(ctx, '⭐' + p.m.name, P.x(p.x, p.y), P.y(p.y) - 100 * ps * 0.95, 15, YELLOW, 4);
    else label(ctx, p.m.name, P.x(p.x, p.y), P.y(p.y) - 100 * ps * 0.95, 14, WHITE, 4);
  }

  // 내 선수 표시 (노란 화살표 + 이름)
  if (!e.autopilot && e.phase !== Phase.END) {
    const h = e.human;
    const s = P.s(h.y) * h.size;
    const x = P.x(h.x, h.y);
    const y = P.y(h.y) - 104 * s * 0.95 + Math.sin(e.time * 6) * 3;
    // 공을 몰고 갈 때(내가 조종할 때)도 레전드는 이름 왼쪽에 ⭐
    if (h.m.name) label(ctx, h.m.glow ? '⭐' + h.m.name : h.m.name, x, y - 24, 16, YELLOW, 4.5);
    ctx.beginPath(); ctx.moveTo(x - 11, y - 12); ctx.lineTo(x + 11, y - 12); ctx.lineTo(x, y + 2); ctx.closePath();
    ctx.fillStyle = css(YELLOW); ctx.fill();
    ctx.strokeStyle = css(INK); ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
    if (e.armedFire[0]) label(ctx, '🔥', x + 20, y - 8, 20);
    else if (e.armedCurve[0]) label(ctx, '🌀', x + 20, y - 8, 20);
  }
}

function drawBallAt(ctx, e, P) {
  const b = e.ball;
  const s = P.s(b.y);
  const gx = P.x(b.x, b.y), gy = P.y(b.y);
  const shrink = 1 / (1 + b.z * 0.25);
  oval(ctx, gx, gy, 9 * s * shrink, 3 * s * shrink); ctx.fillStyle = css(0x401e143c); ctx.fill();
  const r = 10 * s;
  const by = P.y(b.y, b.z) - r;
  if (b.fire) {
    circle(ctx, gx, by, r * 2.2); ctx.fillStyle = css(0x99ff6b3a); ctx.fill();
    circle(ctx, gx, by, r * 1.5); ctx.fillStyle = css(0xaaffd23f); ctx.fill();
  }
  if (b.curve && b.curveT > 0) { circle(ctx, gx, by, r * 2); ctx.fillStyle = css(0x669fd8ff); ctx.fill(); }
  drawBall(ctx, gx, by, r, b.spin);
}

function drawPlayer(ctx, e, P, p) {
  const s = P.s(p.y);
  const sx = P.x(p.x, p.y), sy = P.y(p.y);
  const sc = 0.95 * s * p.size;
  const isMe = p === e.human && !e.autopilot && e.phase !== Phase.END;
  if (p.m.glow) {
    // 레전드: 발밑 금빛 고리 + 반짝이
    oval(ctx, sx, sy, 40 * sc, 12 * sc); ctx.fillStyle = css(YELLOW, 0.4); ctx.fill();
    ctx.strokeStyle = css(YELLOW); ctx.lineWidth = 3; ctx.stroke();
    const tw = (Math.sin(e.time * 4 + p.slot) + 1) / 2;
    sparkle(ctx, sx + 30 * sc, sy - 60 * sc - tw * 10, 0.4 + tw * 0.3, 0xfffff6a0, 0.5 + tw * 0.5);
  }
  if (isMe) { oval(ctx, sx, sy + 0.5 * sc, 30 * sc, 8.5 * sc); ctx.strokeStyle = css(YELLOW); ctx.lineWidth = 4; ctx.stroke(); }
  if (p.speedT > 0) {
    const d = p.faceRight ? -1 : 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const yy = sy - (18 + i * 12) * sc;
      const x0 = sx + d * (34 + i * 4) * sc;
      ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + d * (22 + (i % 2) * 12) * sc, yy); ctx.stroke();
    }
  }
  if (p.giantT > 0) { circle(ctx, sx, sy - 30 * sc, 46 * sc); ctx.fillStyle = css(0x55ffd23f); ctx.fill(); }
  const res = e.outcome?.homeResult ?? 0;
  const celebrating = e.phase === Phase.GOAL && e.lastGoalTeam === p.team;
  const sad = (e.phase === Phase.GOAL && e.lastGoalTeam !== p.team) || (e.phase === Phase.END && (p.team === 0 ? res < 0 : res > 0));
  const won = e.phase === Phase.END && (p.team === 0 ? res > 0 : res < 0);
  let face = Face.HAPPY;
  if (p.stunKind === Stun.SLIP || p.stunKind === Stun.KNOCK || p.stunKind === Stun.WHIFF) face = Face.DIZZY;
  else if (p.stunKind === Stun.ICE) face = Face.SAD;
  else if (celebrating || won) face = Face.SHOUT;
  else if (sad) face = Face.SAD;
  else if (p.kickAnim > 0) face = Face.SHOUT;
  else if (p.moving && e.ball.owner?.team !== p.team) face = Face.FOCUS;
  const hop = celebrating || won ? Math.abs(Math.sin(e.time * 9 + p.slot)) * 18 : 0;
  let tilt = 0;
  if (p.stunKind === Stun.SLIP) tilt = 75 * (p.faceRight ? 1 : -1);
  else if (p.stunKind === Stun.DIVE) tilt = 55 * (p.y < FW / 2 ? -1 : 1);
  else if (p.stunKind === Stun.KNOCK) tilt = 25 * (p.faceRight ? -1 : 1);
  ctx.save();
  ctx.translate(sx, sy); ctx.rotate((tilt * Math.PI) / 180); ctx.translate(-sx, -sy);
  drawMongi(ctx, sx, sy, sc, e.setup.kit(p.team), {
    face, flip: !p.faceRight, phase: p.phase, moving: p.moving && p.stun <= 0, gloves: p.gk, hop, hat: p.m.hat, golden: p.m.golden,
  });
  label(ctx, String(p.m.num), sx, sy - (8 + hop) * sc, 13 * sc, WHITE, 3 * sc);
  ctx.restore();
  if (p.stunKind === Stun.ICE) {
    rrect(ctx, sx - 38 * sc, sy - 74 * sc, 76 * sc, 78 * sc, 12 * sc); ctx.fillStyle = css(0x669fd8ff); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3; ctx.stroke();
    sparkle(ctx, sx + 26 * sc, sy - 66 * sc, 0.6, WHITE);
  }
  if (p.stunKind === Stun.SLIP || p.stunKind === Stun.KNOCK) {
    for (let i = 0; i < 3; i++) {
      const a = e.time * 5 + i * 2.09;
      sparkle(ctx, sx + Math.cos(a) * 22 * sc, sy - 78 * sc + Math.sin(a) * 6 * sc, 0.5, YELLOW);
    }
  }
}

function netPanel(ctx, P, pts) {
  const o = pts.map(([x, y, z]) => P.pt(x, y, z));
  const path = () => { ctx.beginPath(); ctx.moveTo(o[0][0], o[0][1]); for (let i = 1; i < o.length; i++) ctx.lineTo(o[i][0], o[i][1]); ctx.closePath(); };
  path(); ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill();
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  ctx.beginPath();
  for (let i = 1; i <= 5; i++) {
    const t = i / 6;
    let a = lerp(o[0], o[1], t), b = lerp(o[3], o[2], t); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    a = lerp(o[0], o[3], t); b = lerp(o[1], o[2], t); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
  path(); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.8; ctx.stroke();
}

function goal(ctx, P, right, front) {
  const lx = right ? FL : 0;
  const gd = right ? FL + 3 : -3;
  const g0 = FW / 2 - GOAL_HALF, g1 = FW / 2 + GOAL_HALF, h = GOAL_H;
  if (!front) {
    netPanel(ctx, P, [[gd, g0, 0], [gd, g1, 0], [gd, g1, h], [gd, g0, h]]);
    netPanel(ctx, P, [[lx, g0, h], [gd, g0, h], [gd, g1, h], [lx, g1, h]]);
    netPanel(ctx, P, [[lx, g0, 0], [gd, g0, 0], [gd, g0, h], [lx, g0, h]]);
  } else {
    netPanel(ctx, P, [[gd, g1, 0], [lx, g1, 0], [lx, g1, h], [gd, g1, h]]);
    const pts = [P.pt(lx, g0), P.pt(lx, g0, h), P.pt(lx, g1, h), P.pt(lx, g1)];
    for (const [c, w] of [[INK, 10], [WHITE, 5.5]]) {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.strokeStyle = css(c); ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    }
  }
}

function wall(ctx, P, team, t, time) {
  const lx = team === 0 ? 1.4 : FL - 1.4;
  const g0 = FW / 2 - GOAL_HALF - 0.6, g1 = FW / 2 + GOAL_HALF + 0.6, hh = 3;
  const alpha = t < 1.5 ? 0.5 + 0.5 * Math.abs(Math.sin(time * 10)) : 1;
  const a = P.pt(lx, g0), b = P.pt(lx, g1), c = P.pt(lx, g1, hh), d = P.pt(lx, g0, hh);
  const path = () => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); };
  path(); ctx.fillStyle = css(0xffd9774b, 0.92 * alpha); ctx.fill();
  ctx.beginPath();
  for (let i = 1; i <= 3; i++) {
    const t2 = i / 4;
    ctx.moveTo(a[0] + (d[0] - a[0]) * t2, a[1] + (d[1] - a[1]) * t2); ctx.lineTo(b[0] + (c[0] - b[0]) * t2, b[1] + (c[1] - b[1]) * t2);
  }
  ctx.strokeStyle = css(0xff8a3e22, alpha); ctx.lineWidth = 2.5; ctx.stroke();
  path(); ctx.strokeStyle = css(INK, alpha); ctx.lineWidth = 3.5; ctx.lineJoin = 'round'; ctx.stroke();
}

/* ───────────── HUD ───────────── */

function drawHud(ctx, e, vw, touch) {
  const L = new ControlLayout(vw);
  const home = e.setup.home, away = e.setup.away;

  // 점수판
  const w = 480, x0 = vw / 2 - w / 2;
  rrect(ctx, x0, 16, w, 56, 28); ctx.fillStyle = css(INK); ctx.fill();
  rrect(ctx, x0, 10, w, 56, 28); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = css(INK); ctx.lineWidth = 4; ctx.stroke();
  const fit = (s, max) => Math.min(22, (22 * max) / Math.max(textWidth(ctx, s, 22), 1));
  label(ctx, home.emoji, x0 + 32, 38, 26);
  label(ctx, home.short, x0 + 54, 38, fit(home.short, 120), INK, 0, INK, 'left');
  rrect(ctx, vw / 2 - 56, 18, 112, 40, 16); ctx.fillStyle = css(INK); ctx.fill();
  label(ctx, `${e.score[0]} : ${e.score[1]}`, vw / 2, 38, 30, WHITE);
  label(ctx, away.short, x0 + w - 54, 38, fit(away.short, 120), INK, 0, INK, 'right');
  label(ctx, away.emoji, x0 + w - 32, 38, 26);
  if (!e.tutorial) {
    const info = e.extra ? `⏱ 연장 ${e.minute}' · 골든골` : `⏱ ${e.minute}' · ${e.setup.title}`;
    const iw = textWidth(ctx, info, 15) + 34;
    rrect(ctx, vw / 2 - iw / 2, 68, iw, 30, 15); ctx.fillStyle = css(YELLOW); ctx.fill();
    ctx.strokeStyle = css(INK); ctx.lineWidth = 3; ctx.stroke();
    label(ctx, info, vw / 2, 83, 15, INK);
  }

  // 일시정지
  const [px, py] = L.pause;
  circle(ctx, px, py + 5, L.pauseR); ctx.fillStyle = css(INK); ctx.fill();
  circle(ctx, px, py, L.pauseR); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = css(INK); ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = css(INK);
  rrect(ctx, px - 9, py - 10, 6.5, 20, 2); ctx.fill();
  rrect(ctx, px + 2.5, py - 10, 6.5, 20, 2); ctx.fill();

  // 미니맵
  if (!e.tutorial) {
    const mx = vw - 166, my = 10, mw = 150, mh = 92;
    rrect(ctx, mx, my, mw, mh, 10); ctx.fillStyle = css(0xff5fb553); ctx.fill(); ctx.strokeStyle = css(INK); ctx.lineWidth = 3; ctx.stroke();
    const mp = (fx, fy) => [mx + 5 + (fx / FL) * (mw - 10), my + 5 + (fy / FW) * (mh - 10)];
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5;
    let a = mp(FL / 2, 0), b = mp(FL / 2, FW);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    a = mp(FL / 2, FW / 2); circle(ctx, a[0], a[1], 11); ctx.stroke();
    const bw = (13 / FL) * (mw - 10), bh = (21 / FW) * (mh - 10);
    a = mp(0, FW / 2 - 10.5); ctx.strokeRect(a[0], a[1], bw, bh);
    a = mp(FL - 13, FW / 2 - 10.5); ctx.strokeRect(a[0], a[1], bw, bh);
    for (const p of e.players) {
      if (p.hidden) continue;
      const [ox, oy] = mp(p.x, p.y);
      circle(ctx, ox, oy, 5); ctx.fillStyle = '#fff'; ctx.fill();
      circle(ctx, ox, oy, 3.6); ctx.fillStyle = css(e.setup.kit(p.team)); ctx.fill();
      if (p === e.human && !e.autopilot) { circle(ctx, ox, oy, 6.5); ctx.strokeStyle = css(YELLOW); ctx.lineWidth = 2; ctx.stroke(); }
    }
    const [bx, by] = mp(clamp(e.ball.x, 0, FL), e.ball.y);
    circle(ctx, bx, by, 3.2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = css(INK); ctx.lineWidth = 1.5; ctx.stroke();
  }

  // 알림
  e.toasts.forEach((t, i) => {
    const a = Math.min(1, t.life / 0.4);
    const y = 116 + i * 42;
    const tw = textWidth(ctx, t.text, 15) + 30;
    rrect(ctx, 16, y, tw, 34, 17); ctx.fillStyle = css(INK, 0.82 * a); ctx.fill();
    ctx.strokeStyle = css(WHITE, a); ctx.lineWidth = 2.5; ctx.stroke();
    label(ctx, t.text, 31, y + 17, 15, WHITE, 0, INK, 'left', a);
  });

  // 조이스틱
  const base = touch.joyActive ? touch.joyBase : L.joyHome;
  const knob = touch.joyActive ? touch.joyKnob : base;
  circle(ctx, base[0], base[1], L.joyR); ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 4; ctx.stroke();
  circle(ctx, knob[0], knob[1] + 5, 34); ctx.fillStyle = css(INK); ctx.fill();
  circle(ctx, knob[0], knob[1], 34); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = css(INK); ctx.lineWidth = 4; ctx.stroke();

  // 버튼
  const has = e.ball.owner === e.human;
  roundButton(ctx, L.shoot, L.shootR, has ? 0xffff4f64 : 0xffff7a45, has ? '슛' : '태클', has ? 34 : 26, touch.down[Btn.SHOOT]);
  roundButton(ctx, L.pass, L.passR, 0xff4f8cff, has ? '패스' : '교체', 23, touch.down[Btn.PASS]);
  roundButton(ctx, L.dash, L.dashR, 0xffffb627, '대시', 19, touch.down[Btn.DASH], INK);

  const held = e.items[0];
  const [cx, cy] = L.item;
  if (held) {
    const pulse = 1 + 0.08 * Math.sin(e.time * 7);
    glow(ctx, cx, cy, L.itemR * 1.6 * pulse, 'rgba(255,246,160,0.87)');
  }
  circle(ctx, cx, cy + 6, L.itemR + 4); ctx.fillStyle = css(INK); ctx.fill();
  circle(ctx, cx, cy + (touch.down[Btn.ITEM] ? 4 : 0), L.itemR); ctx.fillStyle = held ? '#fff' : 'rgba(255,255,255,0.55)'; ctx.fill();
  circle(ctx, cx, cy, L.itemR); ctx.strokeStyle = css(held ? 0xffffb627 : INK); ctx.lineWidth = 5; ctx.stroke();
  circle(ctx, cx, cy, L.itemR + 4); ctx.strokeStyle = css(INK); ctx.lineWidth = 3; ctx.stroke();
  if (held) label(ctx, held.emoji, cx, cy, 38);
  else if (e.armedFire[0]) label(ctx, '🔥', cx, cy, 30, WHITE, 0, INK, 'center', 0.6);
  else if (e.armedCurve[0]) label(ctx, '🌀', cx, cy, 30, WHITE, 0, INK, 'center', 0.6);
  else label(ctx, '?', cx, cy, 34, withAlpha(INK, 0.35));
  const itemLabel = held ? held.title : e.armedFire[0] || e.armedCurve[0] ? '장전 완료!' : '아이템';
  label(ctx, itemLabel, cx, cy - L.itemR - 16, 15, WHITE, 4);

  // 큰 글씨
  const b = e.banner;
  if (b) {
    const age = e.bannerDur - e.bannerT;
    const pop = age < 0.18 ? 0.4 + (age / 0.18) * 0.75 : age < 0.3 ? 1.15 - ((age - 0.18) / 0.12) * 0.15 : 1;
    const a = Math.min(1, e.bannerT / 0.3);
    const big = b === 'GOAL!!';
    const fill = big && e.bannerTeam === 0 ? YELLOW : big ? 0xff9fd8ff : b.startsWith('🔥') ? 0xffff6b3a : WHITE;
    ctx.save();
    ctx.translate(vw / 2, 260); ctx.scale(pop, pop); ctx.translate(-vw / 2, -260);
    label(ctx, b, vw / 2, 260, big ? 96 : 56, fill, big ? 14 : 10, INK, 'center', a);
    ctx.restore();
  }
}

function roundButton(ctx, [x, y], r, color, text, size, pressed, textColor = WHITE) {
  const dy = pressed ? 5 : 0;
  circle(ctx, x, y + 6, r); ctx.fillStyle = css(INK); ctx.fill();
  const cy = y + dy;
  circle(ctx, x, cy, r); ctx.fillStyle = css(color); ctx.fill();
  oval(ctx, x, cy - r * 0.51, r * 0.55, r * 0.31); ctx.fillStyle = 'rgba(255,255,255,0.32)'; ctx.fill();
  circle(ctx, x, cy, r); ctx.strokeStyle = css(INK); ctx.lineWidth = 4; ctx.stroke();
  label(ctx, text, x, cy, size, textColor, 5, textColor === INK ? WHITE : INK);
}
