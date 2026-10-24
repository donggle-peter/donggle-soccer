import { MatchEngine, MatchSetup, Phase, FL, FW } from './engine.js';
import { ControlLayout } from './render.js';
import { drawMongi, label, textWidth, circle, Face } from './draw.js';
import { ItemType } from '../data/items.js';
import { css, INK, WHITE } from '../core.js';

/** 튜토리얼에서 강조할 조작 */
export const Focus = { JOY: 'JOY', SHOOT: 'SHOOT', PASS: 'PASS', DASH: 'DASH', ITEM: 'ITEM', NONE: 'NONE' };

const lesson = (emoji, title, sub, intro, focus) => ({ emoji, title, sub, intro, focus });
export const Lessons = [
  lesson('🕹️', '움직이기', '조이스틱으로 이리저리', '왼쪽 조이스틱을 밀면 동글이가 움직여요!\n⭐ 별까지 달려가 볼까요?', Focus.JOY),
  lesson('⚽', '드리블', '공에 닿으면 내 공!', '공에 닿기만 하면 내 공이 돼요!\n공을 가지고 ⭐ 별까지 달려가 봐요.', Focus.JOY),
  lesson('🥅', '슛', '골대 앞에서 슛 버튼', '골대 앞에서 빨간 슛 버튼을 누르면 뻥!\n조이스틱을 위·아래로 기울이면 그쪽 구석으로 차요.', Focus.SHOOT),
  lesson('🤝', '패스', '친구에게 패스', '파란 패스 버튼을 누르면 친구에게 공을 줘요.\n공을 받은 친구를 이제 내가 조종해요!', Focus.PASS),
  lesson('🛡️', '태클 · 교체', '상대 공 뺏기', "상대가 공을 가지면 빨간 버튼이 '태클'이 돼요.\n가까이 가서 태클로 공을 뺏어요! (파란 버튼은 '교체')", Focus.SHOOT),
  lesson('💨', '대시', '순간 스피드 UP', '노란 대시 버튼을 누르면 잠깐 엄청 빨라져요!\n대시를 써서 ⭐ 별까지 슝~', Focus.DASH),
  lesson('🎁', '아이템 · 스킬', '❓상자 먹고 스킬 쓰기', '❓상자에 닿으면 스킬 아이템이 생겨요!\n아이템 버튼을 누르고 🔥 파이어 슛으로 골인!', Focus.ITEM),
];

/**
 * 튜토리얼 진행: 수업마다 경기장을 꾸미고, 해냈는지 확인한다.
 * 실제 경기 엔진을 그대로 쓰므로 조작감이 진짜 경기와 같다.
 */
export class TutorialRun {
  constructor(levels, start, roster, onLessonDone) {
    const me = { id: 'ME', name: '동글이', short: '동글', emoji: '⚽', color: 0xffff4f64, color2: WHITE, rating: 3 };
    const bot = { id: 'BOT', name: '연습상대', short: '연습상대', emoji: '🤖', color: 0xff4f8cff, color2: 0xffb18cff, rating: 1 };
    this.engine = new MatchEngine(new MatchSetup(me, bot, '튜토리얼', false, levels, { roster }), 7);
    this.engine.tutorial = true;
    this.onLessonDone = onLessonDone;
    this.lesson = start;
    /** 설명 화면(어둡게)이 떠 있는 중 */
    this.intro = true;
    this.finished = false;
    /** 설명 화면에서도 움직이는 애니메이션용 시계 */
    this.clock = 0;
    this.successT = 0; this.sub = 0; this.base = 0; this.note = null; this.noteT = 0;
    this.engine.onGoalEnd = () => this.afterGoal();
    this.setup(start);
  }

  get info() { return Lessons[this.lesson]; }
  player(team, slot) { return this.engine.players.find((p) => p.team === team && p.slot === slot); }
  stat(k) { return this.engine.stats[k] ?? 0; }

  setup(i) {
    this.lesson = i; this.intro = true; this.successT = 0; this.sub = 0;
    const e = this.engine;
    e.players.forEach((p) => { p.hidden = true; p.frozen = false; p.slow = 1; });
    const h = this.player(0, 3);
    h.hidden = false;
    e.control(h);
    e.ballHidden = false;
    e.forcedItem = null;
    e.score = [0, 0];
    switch (i) {
      case 0: e.place(h, 26, 30); e.ballHidden = true; e.ballAt(2, 2); e.startScene(); e.targets.push([44, 20]); break;
      case 1: e.place(h, 24, 28); e.ballAt(31, 28); e.startScene(); e.targets.push([54, 22]); break;
      case 2: e.place(h, 60, 26); e.giveBall(h); e.startScene(); break;
      case 3: {
        const mate = this.player(0, 4);
        mate.hidden = false; mate.frozen = true;
        e.place(mate, 56, 17);
        e.place(h, 38, 30); e.giveBall(h); e.startScene();
        this.base = this.stat('pass');
        break;
      }
      case 4: {
        const opp = this.player(1, 3);
        opp.hidden = false; opp.slow = 0.45;
        e.place(opp, 54, 26); e.giveBall(opp);
        e.place(h, 38, 30); e.startScene();
        this.base = this.stat('steal');
        break;
      }
      case 5: e.place(h, 18, 26); e.ballHidden = true; e.ballAt(2, 2); e.startScene(); e.targets.push([60, 26]); this.base = this.stat('dash'); break;
      default: {
        const gk = this.player(1, 0);
        gk.hidden = false;
        e.place(gk, FL - 1.6, FW / 2);
        e.place(h, 36, 26); e.giveBall(h);
        e.forcedItem = ItemType.FIRE;
        e.startScene();
        e.addBox(45, 26);
        this.base = this.stat('use_FIRE');
      }
    }
  }

  dismissIntro() { this.intro = false; }
  /** 이번 수업 건너뛰기 */
  skip() { this.next(); }
  next() { if (this.lesson + 1 < Lessons.length) this.setup(this.lesson + 1); else this.finished = true; }
  complete() { this.onLessonDone(this.lesson); }
  success() {
    if (this.successT > 0) return;
    this.complete();
    this.successT = 1.7;
    this.engine.showBanner(['잘했어요! ⭐', '최고예요! ⭐', '완벽해요! ⭐'][this.lesson % 3], 1.6, 0);
  }
  fail(msg) { this.note = msg; this.noteT = 3; }

  afterGoal() {
    const mine = this.engine.lastGoalTeam === 0;
    if (this.lesson === 2 && mine) { this.complete(); this.next(); }
    else if (this.lesson === 6 && mine && this.stat('use_FIRE') > this.base) { this.complete(); this.next(); }
    else if (this.lesson === 6 && mine) { this.setup(6); this.intro = false; this.fail('아이템 버튼을 먼저 눌러 파이어 슛을 써 봐요!'); }
    else if (this.lesson === 4) { this.setup(4); this.intro = false; this.fail('앗, 골을 먹었어요! 상대에게 다가가서 태클!'); }
    else { this.setup(this.lesson); this.intro = false; }
  }

  update(dt) {
    this.clock += dt;
    if (this.finished || this.intro) return;
    this.engine.update(dt);
    if (this.noteT > 0) { this.noteT -= dt; if (this.noteT <= 0) this.note = null; }
    if (this.successT > 0) {
      this.successT -= dt;
      if (this.successT <= 0) this.next();
      return;
    }
    if (this.engine.phase !== Phase.PLAY) return;
    this.check();
  }

  near(t, r) { const h = this.engine.human; return t != null && Math.hypot(h.x - t[0], h.y - t[1]) < r; }

  check() {
    const e = this.engine, h = e.human;
    switch (this.lesson) {
      case 0:
        if (this.near(e.targets[0], 2.8)) {
          if (this.sub === 0) { this.sub = 1; e.targets.length = 0; e.targets.push([36, 42]); e.showBanner('좋아요! 하나 더!', 1, 0); }
          else this.success();
        }
        break;
      case 1: if (e.ball.owner === h && this.near(e.targets[0], 3.2)) this.success(); break;
      case 3: if (e.ball.owner === this.player(0, 4) && this.stat('pass') > this.base) this.success(); break;
      case 4: if (this.stat('steal') > this.base) this.success(); break;
      case 5:
        if (this.near(e.targets[0], 3.2)) {
          if (this.stat('dash') > this.base) this.success();
          else {
            const t = e.targets[0];
            e.targets.length = 0; e.targets.push([t[0] > 40 ? 18 : 62, 26]);
            this.fail('대시 버튼도 꼭 눌러 봐요! 반대쪽 ⭐까지!');
          }
        }
        break;
      case 6:
        // 아이템을 쓰고 놓쳤으면 상자를 다시 놓아 준다
        if (e.items[0] == null && !e.armedFire[0] && e.boxes.length === 0 && e.ball.owner === h) e.addBox(Math.min(h.x + 7, FL - 12), h.y);
        break;
    }
  }

  /** 경기 중 위쪽에 보이는 짧은 안내와 강조할 버튼 */
  hint() {
    if (this.note) return [this.note, this.info.focus];
    const e = this.engine, has = e.ball.owner === e.human;
    switch (this.lesson) {
      case 0: return [`⭐ 별까지 달려가요! (${this.sub + 1}/2)`, Focus.JOY];
      case 1: return has ? ['공을 가지고 ⭐ 별까지!', Focus.JOY] : ['공으로 달려가서 잡아요!', Focus.JOY];
      case 2: return has ? ['슛 버튼으로 골인!', Focus.SHOOT] : ['공을 다시 잡아요!', Focus.JOY];
      case 3: return has ? ['패스 버튼으로 친구에게!', Focus.PASS] : ['친구가 공을 받는 중~', Focus.NONE];
      case 4: return e.ball.owner?.team === 1 ? ['다가가서 태클 버튼!', Focus.SHOOT] : ['공을 다시 뺏어요!', Focus.SHOOT];
      case 5: return ['대시 버튼을 누르며 ⭐ 별까지!', Focus.DASH];
      default:
        if (e.items[0]) return ['아이템 버튼을 눌러요!', Focus.ITEM];
        if (e.armedFire[0]) return ['이제 슛! 🔥 불꽃 슛!', Focus.SHOOT];
        if (e.boxes.length) return ['❓ 상자로 달려가요!', Focus.JOY];
        return ['공을 잡고 골대로!', Focus.JOY];
    }
  }

  /** 건너뛰기 버튼 영역 (가상 좌표) [left, top, right, bottom] */
  skipRect(vw) { return [vw - 190, 12, vw - 16, 58]; }
}

/* ───────────── 그리기 ───────────── */

const YEL = 0xffffd23f;

function focusCircle(f, L) {
  switch (f) {
    case Focus.JOY: return [L.joyHome, L.joyR + 18];
    case Focus.SHOOT: return [L.shoot, L.shootR + 16];
    case Focus.PASS: return [L.pass, L.passR + 14];
    case Focus.DASH: return [L.dash, L.dashR + 14];
    case Focus.ITEM: return [L.item, L.itemR + 16];
    default: return null;
  }
}

function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

function bubble(ctx, x, y, lines, footer) {
  const w = Math.max(...lines.map(([t, s]) => textWidth(ctx, t, s)), footer ? textWidth(ctx, footer, 17) : 0) + 44;
  const h = lines.reduce((a, [, s]) => a + s * 1.45, 0) + (footer ? 30 : 0) + 26;
  rr(ctx, x, y + 6, w, h, 24); ctx.fillStyle = css(INK); ctx.fill();
  rr(ctx, x, y, w, h, 24); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = css(INK); ctx.lineWidth = 4; ctx.stroke();
  let yy = y + 14;
  for (const [t, s] of lines) { label(ctx, t, x + 22, yy + s * 0.72, s, INK, 0, INK, 'left'); yy += s * 1.45; }
  if (footer) label(ctx, footer, x + 22, yy + 12, 17, 0xff6b4bd6, 0, INK, 'left');
}

function dashedCircle(ctx, [x, y], r, t) {
  ctx.save();
  ctx.setLineDash([14, 9]); ctx.lineDashOffset = -t * 30;
  circle(ctx, x, y, r); ctx.strokeStyle = css(YEL); ctx.lineWidth = 5; ctx.stroke();
  ctx.restore();
}

export function drawTutorialOverlay(ctx, run, vw, vh) {
  const L = new ControlLayout(vw);
  const t = run.clock;
  if (run.intro) {
    // 어둡게 + 할 버튼만 밝게
    const fc = focusCircle(run.info.focus, L);
    ctx.beginPath();
    ctx.rect(0, 0, vw, vh);
    if (fc) { ctx.moveTo(fc[0][0] + fc[1], fc[0][1]); ctx.arc(fc[0][0], fc[0][1], fc[1], 0, Math.PI * 2, true); }
    ctx.fillStyle = css(INK, 0.58); ctx.fill('evenodd');
    if (fc) {
      dashedCircle(ctx, fc[0], fc[1], t);
      const bob = Math.sin(t * 6) * 6;
      label(ctx, '👆', fc[0][0] - 6, fc[0][1] + fc[1] * 0.35 + bob, 54);
    }
    // 조이스틱을 가리지 않게 코치 위치를 옮긴다
    const mx = run.info.focus === Focus.JOY ? 390 : 240;
    drawMongi(ctx, mx, vh - 34, 2.6, 0xffff4f64, { hop: Math.abs(Math.sin(t * 3)) * 4 });
    label(ctx, '7', mx, vh - 34 - 8 * 2.6, 26, WHITE, 5);
    bubble(ctx, mx + 90, vh - 236, run.info.intro.split('\n').map((l) => [l, 24]), '👆 화면을 누르면 시작!');
  } else {
    // 진행 중: 할 버튼에 깜빡이는 노란 고리 + 짧은 안내
    const [txt, focus] = run.hint();
    const fc = focusCircle(focus, L);
    if (fc) dashedCircle(ctx, fc[0], fc[1] * (1 + 0.06 * Math.sin(t * 7)), t);
    const w = textWidth(ctx, txt, 20) + 74;
    const x0 = vw / 2 - w / 2, hy = 150;
    rr(ctx, x0, hy + 5, w, 44, 22); ctx.fillStyle = css(INK); ctx.fill();
    rr(ctx, x0, hy, w, 44, 22); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = css(INK); ctx.lineWidth = 3.5; ctx.stroke();
    drawMongi(ctx, x0 + 26, hy + 36, 0.5, 0xffff4f64, { shadow: false });
    label(ctx, txt, x0 + 52, hy + 22, 20, INK, 0, INK, 'left');
  }

  // 진행도 (위쪽 가운데)
  const n = Lessons.length;
  const title = `🎓 튜토리얼 ${run.lesson + 1} / ${n} · ${run.info.title}`;
  const tw = textWidth(ctx, title, 19);
  const pw = tw + n * 20 + 20 + 40;
  const px = vw / 2 - pw / 2;
  rr(ctx, px, 75, pw, 38, 19); ctx.fillStyle = css(INK); ctx.fill();
  rr(ctx, px, 70, pw, 38, 19); ctx.fillStyle = css(YEL); ctx.fill(); ctx.strokeStyle = css(INK); ctx.lineWidth = 3.5; ctx.stroke();
  label(ctx, title, px + 18, 89, 19, INK, 0, INK, 'left');
  let dx = px + 18 + tw + 16;
  for (let i = 0; i < n; i++) {
    const cur = i === run.lesson;
    const wd = cur ? 30 : 14;
    rr(ctx, dx, 82, wd, 14, 7);
    ctx.fillStyle = i < run.lesson ? css(0xff5fd068) : cur ? '#fff' : 'rgba(255,255,255,0.6)'; ctx.fill();
    ctx.strokeStyle = css(INK); ctx.lineWidth = 2.5; ctx.stroke();
    dx += wd + 6;
  }

  // 건너뛰기
  const [l, tp, r, b] = run.skipRect(vw);
  rr(ctx, l, tp, r - l, b - tp, 18); ctx.fillStyle = css(INK, 0.85); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
  label(ctx, '건너뛰기 ▶▶', (l + r) / 2, (tp + b) / 2, 18, WHITE);
}

export { Face };
