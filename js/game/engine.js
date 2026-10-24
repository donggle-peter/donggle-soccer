import { Teams } from '../data/teams.js';
import { ItemType, Items } from '../data/items.js';
import { Formation } from '../data/legends.js';
import { Rng, clamp, hypot, minBy, maxBy, WHITE } from '../core.js';

/* 경기장 크기 (단위: m 비슷한 게임 단위). 팀 0 은 오른쪽(x=FL) 골대를 공격 */
export const FL = 84;
export const FW = 52;
export const GOAL_HALF = 4.4;
export const GOAL_H = 2.6;
const GRAV = 30;

export const Btn = { SHOOT: 0, PASS: 1, DASH: 2, ITEM: 3 };

/** 난이도: 상대(컴퓨터) 팀이 얼마나 잘하나. 숫자를 바꾸면 경기 전체 난이도가 바뀐다 */
export const AI = {
  // 맨 처음(쉬운) 난이도
  speedBase: 8.3, speedPerRating: 0.3,        // 달리기 (내 팀은 10.2 + 0.2 × 실력)
  tackleRate: 0.55, tackleRatePerRating: 0.15, // 공 가진 상대에게 얼마나 자주 태클
  tackleWin: 0.22, tackleWinPerRating: 0.04,  // 태클 성공 확률
  gkSave: 0.4, gkSavePerRating: 0.05,         // 상대 골키퍼 선방
  shotError: 2.1,                             // 상대 슛 빗나감 (작을수록 정확)
  humanTackleWin: 0.78,                       // 내 태클 성공 확률
  humanShotSkill: 3.6,                        // 내 슛 정확도 (클수록 정확)
};
export const Phase = { READY: 0, PLAY: 1, GOAL: 2, END: 3 };
export const Stun = { NONE: 0, SLIP: 1, ICE: 2, KNOCK: 3, WHIFF: 4, DIVE: 5 };
export const Fx = { STAR: 0, FLAME: 1, CONFETTI: 2, DUST: 3, ICE: 4 };

export class MatchSetup {
  constructor(home, away, title, knockout, levels, o = {}) {
    this.home = home;
    this.away = away;
    this.title = title;
    this.knockout = knockout;
    /** 아이템 이름 → 레벨 */
    this.levels = levels;
    this.duration = o.duration ?? 150;
    /** 시작할 때 들고 나가는 아이템 */
    this.startItem = o.startItem ?? null;
    /** 내 팀 포메이션 (상대는 늘 2-2) */
    this.formation = o.formation ?? Formation.F22;
    this.kits = Teams.kits(home, away);
    this.squads = [o.roster ?? Teams.squad(home), Teams.squad(away)];
  }
  formationOf(t) { return t === 0 ? this.formation : Formation.F22; }
  team(t) { return t === 0 ? this.home : this.away; }
  kit(t) { return this.kits[t]; }
}

export class MatchOutcome {
  constructor(home, away, pkHome = -1, pkAway = -1) { this.home = home; this.away = away; this.pkHome = pkHome; this.pkAway = pkAway; }
  get hadPk() { return this.pkHome >= 0; }
  /** 사용자(홈) 기준 승부차기 승리 여부 */
  get homeWonPk() { return this.hadPk ? this.pkHome > this.pkAway : null; }
  /** 1 승, 0 무, -1 패 (승부차기 포함) */
  get homeResult() {
    if (this.home > this.away) return 1;
    if (this.home < this.away) return -1;
    if (this.hadPk) return this.pkHome > this.pkAway ? 1 : -1;
    return 0;
  }
}

export class Player {
  constructor(team, slot, m, baseSpeed) {
    this.team = team; this.slot = slot; this.m = m; this.baseSpeed = baseSpeed;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.wantX = 0; this.wantY = 0;
    this.dirX = team === 0 ? 1 : -1; this.dirY = 0; this.faceRight = team === 0;
    this.stun = 0; this.stunKind = Stun.NONE;
    this.speedT = 0; this.giantT = 0;
    this.tackleCd = 0; this.dashT = 0; this.dashX = 0; this.dashY = 0; this.tackling = false;
    this.kickAnim = 0; this.phase = 0; this.think = 0; this.holdT = 0; this.blockFlight = -1;
    /** 튜토리얼: 경기장에서 빼기 / 제자리에 서 있기 / 느리게 */
    this.hidden = false; this.frozen = false; this.slow = 1;
  }
  get gk() { return this.m.gk; }
  /** 레전드 힘 (0 보통, 1~2 레전드) */
  get power() { return this.m.legend; }
  get size() { return this.giantT > 0 ? 1.6 : 1; }
  get moving() { return hypot(this.vx, this.vy) > 0.8; }
}

class Ball {
  constructor() {
    this.x = FL / 2; this.y = FW / 2; this.z = 0; this.vx = 0; this.vy = 0; this.vz = 0;
    this.owner = null; this.lastKicker = null; this.kickCd = 0; this.passTarget = null;
    this.shotTeam = -1; this.gkTried = false; this.fire = false; this.curve = false;
    this.curveT = 0; this.curveRate = 0; this.spin = 0; this.flight = 0;
  }
  speed() { return hypot(this.vx, this.vy); }
}

export class ItemBox { constructor(x, y) { this.x = x; this.y = y; this.t = 0; } }
export class Banana { constructor(x, y, team, life, level) { this.x = x; this.y = y; this.team = team; this.life = life; this.level = level; } }

function particle(x, y, z, vx, vy, vz, life, maxLife, color, size, kind, rot) {
  return { x, y, z, vx, vy, vz, life, maxLife, color, size, kind, rot };
}

export class MatchEngine {
  constructor(setup, seed) {
    this.setup = setup;
    this.rnd = new Rng(seed);
    this.ratings = [setup.home.rating, setup.away.rating];
    this.players = [0, 1].flatMap((t) => setup.squads[t].map((m, i) => {
      const base = t === 0 ? 10.2 + this.ratings[0] * 0.2 : AI.speedBase + this.ratings[1] * AI.speedPerRating;
      return new Player(t, i, m, m.gk ? base * 0.95 : base);
    }));
    this.ball = new Ball();
    this.score = [0, 0];
    this.clock = 0;
    this.endTime = setup.duration;
    this.extra = false;
    this.phase = Phase.READY;
    this.phaseT = 0;
    this.outcome = null;
    this.lastGoalTeam = -1;
    this.items = [null, null];
    this.armedFire = [false, false];
    this.armedCurve = [false, false];
    this.wallT = [0, 0];
    this.boxes = [];
    this.bananas = [];
    this.particles = [];
    this.toasts = [];
    this.banner = null; this.bannerT = 0; this.bannerDur = 1; this.bannerTeam = -1;
    this.human = null;
    /** true 면 사용자 팀도 AI 가 조종 (테스트·데모용) */
    this.autopilot = false;
    /** 튜토리얼 모드: 시간이 흐르지 않고, 상자가 저절로 생기지 않음 */
    this.tutorial = false;
    this.ballHidden = false;
    this.forcedItem = null;
    /** 튜토리얼 목표 별 위치 (경기장 좌표) */
    this.targets = [];
    /** 골 세리머니가 끝난 뒤 킥오프 대신 부를 함수 */
    this.onGoalEnd = null;
    this.camX = FL / 2;
    this.time = 0;
    this.shake = 0;
    this.joyX = 0; this.joyY = 0;
    this.pressed = [false, false, false, false];
    this.chasers = [null, null];
    this.covers = [null, null];
    this.aiItemT = [1, 1];
    this.spawnT = 4;
    this.switchCd = 0;
    this.hintShown = false;
    /** 밸런스 확인용 통계 */
    this.stats = {};

    this.kickoff(0);
    const legends = this.players.filter((p) => p.team === 0 && p.m.glow).length;
    if (legends > 0) this.toast(`⭐ 레전드 ${legends}명 출전!`);
    const si = setup.startItem;
    if (si) { this.items[0] = si; this.toast(`${si.emoji} ${si.title} Lv.${this.level(0, si)} 들고 시작!`); }
  }

  stat(k) { this.stats[k] = (this.stats[k] ?? 0) + 1; }
  get done() { return this.phase === Phase.END && this.phaseT <= 0; }
  get minute() {
    return !this.extra ? Math.min(90, Math.trunc(this.clock / this.setup.duration * 90)) : 90 + Math.min(30, Math.trunc((this.clock - this.setup.duration) / 45 * 30));
  }
  press(b) { this.pressed[b] = true; }

  /* ───────────── 튜토리얼용 배치 ───────────── */

  place(p, x, y) {
    p.x = x; p.y = y; p.vx = 0; p.vy = 0; p.wantX = 0; p.wantY = 0;
    p.stun = 0; p.stunKind = Stun.NONE; p.dashT = 0; p.tackling = false; p.tackleCd = 0;
    p.speedT = 0; p.giantT = 0; p.holdT = 0; p.think = 0.6;
    p.dirX = p.team === 0 ? 1 : -1; p.dirY = 0; p.faceRight = p.team === 0;
  }
  control(p) { this.human = p; }
  giveBall(p) { this.resetBallState(); this.ball.owner = p; this.placeOwnedBall(0); }
  ballAt(x, y) { this.resetBallState(); this.ball.owner = null; this.ball.x = x; this.ball.y = y; this.ball.z = 0; }
  resetBallState() {
    const b = this.ball;
    b.vx = 0; b.vy = 0; b.vz = 0; b.z = 0;
    b.fire = false; b.curve = false; b.curveT = 0;
    b.passTarget = null; b.shotTeam = -1; b.lastKicker = null; b.kickCd = 0;
  }
  /** 장면을 비우고 바로 경기 진행 상태로 */
  startScene() {
    this.phase = Phase.PLAY;
    this.banner = null; this.bannerT = 0;
    this.toasts.length = 0; this.particles.length = 0; this.boxes.length = 0; this.bananas.length = 0; this.targets.length = 0;
    this.items = [null, null]; this.armedFire = [false, false]; this.armedCurve = [false, false]; this.wallT = [0, 0];
    this.joyX = 0; this.joyY = 0;
    this.camX = this.human.x;
  }
  addBox(x, y) { this.boxes.push(new ItemBox(x, y)); }
  level(t, it) { return t === 0 ? this.setup.levels[it.name] ?? 1 : 1 + (this.ratings[1] >= 4 ? 1 : 0); }

  /* ───────────── 진행 ───────────── */

  kickoff(team) {
    for (const p of this.players) {
      const kicking = p.team === team;
      const form = this.setup.formationOf(p.team);
      let f;
      if (p.slot === 0) f = [0.025, 0.5];
      else if (p.slot === 3 && kicking) f = [0.485, 0.5];
      else if (form === Formation.F22) {
        f = p.slot === 1 ? [0.2, 0.3] : p.slot === 2 ? [0.2, 0.7] : p.slot === 3 ? [0.37, 0.42] : kicking ? [0.44, 0.68] : [0.37, 0.64];
      } else {
        // 다른 포메이션: 자기 자리에서 하프라인 안쪽으로
        const [hx, hy] = form.home[p.slot];
        f = [Math.min(hx - 0.04, kicking ? 0.44 : 0.37), 0.5 + (hy - 0.5) * 0.8];
      }
      p.x = p.team === 0 ? f[0] * FL : FL - f[0] * FL;
      p.y = f[1] * FW;
      p.vx = 0; p.vy = 0; p.wantX = 0; p.wantY = 0;
      p.dirX = p.team === 0 ? 1 : -1; p.dirY = 0; p.faceRight = p.team === 0;
      p.stun = 0; p.stunKind = Stun.NONE; p.dashT = 0; p.holdT = 0;
    }
    const b = this.ball;
    b.vx = 0; b.vy = 0; b.vz = 0; b.z = 0; b.fire = false; b.curve = false; b.curveT = 0;
    b.passTarget = null; b.shotTeam = -1; b.lastKicker = null;
    const taker = this.players.find((p) => p.team === team && p.slot === 3);
    b.owner = taker;
    this.human = team === 0 ? taker : this.players.find((p) => p.team === 0 && p.slot === 3);
    this.phase = Phase.READY;
    this.phaseT = 1.5;
    this.showBanner('준비~', 1.4);
    this.camX = FL / 2;
  }

  update(dtIn) {
    const dt = clamp(dtIn, 0, 1 / 30);
    this.time += dt;
    this.updateFx(dt);
    switch (this.phase) {
      case Phase.READY:
        this.phaseT -= dt;
        this.placeOwnedBall(dt);
        if (this.phaseT <= 0) { this.phase = Phase.PLAY; this.showBanner('시작!', 0.7); }
        this.clearPress(); return;
      case Phase.GOAL:
        this.phaseT -= dt;
        for (const p of this.players) { p.wantX = 0; p.wantY = 0; }
        this.integrate(dt);
        this.ballPhysics(dt, false);
        this.follow(dt);
        if (this.phaseT <= 0) {
          if (this.onGoalEnd) this.onGoalEnd();
          else if (this.extra || this.clock >= this.endTime) this.finish();
          else this.kickoff(1 - this.lastGoalTeam);
        }
        this.clearPress(); return;
      case Phase.END:
        this.phaseT -= dt;
        for (const p of this.players) { p.wantX = 0; p.wantY = 0; }
        this.integrate(dt);
        this.ballPhysics(dt, false);
        this.clearPress(); return;
    }

    if (!this.tutorial) this.clock += dt;
    if (!this.tutorial && this.clock >= this.endTime) {
      if (this.setup.knockout && this.score[0] === this.score[1] && !this.extra) {
        this.extra = true;
        this.endTime += 45;
        this.showBanner('연장전! 골든골', 1.8);
      } else { this.finish(); return; }
    }

    for (const p of this.players) {
      if (p.stun > 0) { p.stun -= dt; if (p.stun <= 0) { p.stun = 0; p.stunKind = Stun.NONE; } }
      if (p.speedT > 0) p.speedT -= dt;
      if (p.giantT > 0) p.giantT -= dt;
      if (p.tackleCd > 0) p.tackleCd -= dt;
      if (p.dashT > 0) { p.dashT -= dt; if (p.dashT <= 0) p.tackling = false; }
      if (p.kickAnim > 0) p.kickAnim -= dt;
    }
    for (let t = 0; t < 2; t++) if (this.wallT[t] > 0) this.wallT[t] -= dt;
    if (this.switchCd > 0) this.switchCd -= dt;
    if (this.ball.kickCd > 0) this.ball.kickCd -= dt;

    const o = this.ball.owner;
    if (o && o.stun > 0 && !o.gk) this.loose(o);

    this.computeRoles();
    if (!this.autopilot) this.humanControl();
    for (const p of this.players) if ((this.autopilot || p !== this.human) && !p.hidden) this.ai(p, dt);
    this.aiItems(dt);
    this.integrate(dt);
    this.resolveTackles();
    this.ballPhysics(dt, true);
    if (this.phase !== Phase.PLAY) { this.clearPress(); return; }
    this.pickups();
    this.updateBoxes(dt);
    this.updateBananas(dt);
    this.autoSwitch();
    this.follow(dt);
    this.clearPress();
  }

  clearPress() { this.pressed.fill(false); }

  follow(dt) {
    const b = this.ball;
    const target = b.x + (b.owner ? b.owner.dirX * 4 : b.vx * 0.25);
    this.camX += (target - this.camX) * Math.min(1, 2.6 * dt);
  }

  finish() {
    let ph = -1, pa = -1;
    if (this.setup.knockout && this.score[0] === this.score[1]) {
      ph = 0; pa = 0;
      const pH = clamp(0.74 + 0.03 * (this.ratings[0] - this.ratings[1]), 0.55, 0.9);
      const pA = clamp(0.74 + 0.03 * (this.ratings[1] - this.ratings[0]), 0.55, 0.9);
      for (let i = 0; i < 5; i++) { if (this.rnd.float() < pH) ph++; if (this.rnd.float() < pA) pa++; }
      while (ph === pa) { if (this.rnd.float() < pH) ph++; if (this.rnd.float() < pA) pa++; }
    }
    this.outcome = new MatchOutcome(this.score[0], this.score[1], ph, pa);
    this.phase = Phase.END;
    this.phaseT = 3.2;
    this.ball.owner = null;
    this.showBanner(ph >= 0 ? `승부차기 ${ph} : ${pa}` : '경기 종료!', 3);
  }

  showBanner(text, dur, team = -1) { this.banner = text; this.bannerT = dur; this.bannerDur = dur; this.bannerTeam = team; }

  toast(text) {
    this.toasts.unshift({ text, life: 2.6 });
    while (this.toasts.length > 3) this.toasts.pop();
  }

  /* ───────────── 사용자 조작 ───────────── */

  humanControl() {
    const h = this.human;
    const mag = hypot(this.joyX, this.joyY);
    if (h.stun > 0) { h.wantX = 0; h.wantY = 0; }
    else if (mag > 0.22) {
      const m = Math.min(1, mag), sp = this.speedOf(h);
      h.wantX = this.joyX / mag * m * sp;
      h.wantY = this.joyY / mag * m * sp;
    } else if (this.ball.owner == null && this.ball.passTarget === h) {
      const [ix, iy] = this.intercept(h);
      this.moveTo(h, ix, iy);
    } else { h.wantX = 0; h.wantY = 0; }
    const has = this.ball.owner === h;
    const hx = mag > 0.3 ? this.joyX / mag : null;
    const hy = mag > 0.3 ? this.joyY / mag : null;
    if (this.pressed[Btn.SHOOT]) { if (has) this.shoot(h, hy); else this.tackle(h); }
    if (this.pressed[Btn.PASS]) { if (has) this.pass(h, hx, hy); else this.switchHuman(); }
    if (this.pressed[Btn.DASH]) this.dash(h, hx, hy);
    if (this.pressed[Btn.ITEM]) this.useItem(0, h);
  }

  switchHuman() {
    const c = minBy(this.players.filter((p) => p.team === 0 && !p.gk && p !== this.human && !p.hidden), (p) => this.dist(p, this.ball.x, this.ball.y));
    if (!c) return;
    this.human = c;
    this.switchCd = 1;
  }

  autoSwitch() {
    if (this.autopilot) return;
    const o = this.ball.owner;
    if (o && o.team === 0) { if (!o.gk) this.human = o; return; }
    if (this.switchCd > 0 || this.ball.passTarget?.team === 0) return;
    const c = minBy(this.players.filter((p) => p.team === 0 && !p.gk && p.stun <= 0 && !p.hidden), (p) => this.dist(p, this.ball.x, this.ball.y));
    if (!c || c === this.human) return;
    const diff = this.dist(this.human, this.ball.x, this.ball.y) - this.dist(c, this.ball.x, this.ball.y);
    const idle = hypot(this.joyX, this.joyY) < 0.2;
    if ((idle && diff > 4) || diff > 11) { this.human = c; this.switchCd = 0.8; }
  }

  /* ───────────── 동작 ───────────── */

  speedOf(p) {
    let s = p.baseSpeed * p.slow * clamp(1 + 0.18 * p.power, 0.85, 1.5);
    if (p.speedT > 0) s *= 1.65;
    if (p.giantT > 0) s *= 1.1;
    if (this.ball.owner === p) s *= 0.9;
    return s;
  }

  moveTo(p, tx, ty, mul = 1) {
    const dx = tx - p.x, dy = ty - p.y;
    const d = hypot(dx, dy);
    if (d < 0.25) { p.wantX = 0; p.wantY = 0; return; }
    const sp = Math.min(this.speedOf(p) * mul, d * 4);
    p.wantX = dx / d * sp; p.wantY = dy / d * sp;
  }

  release(p) {
    const b = this.ball;
    b.owner = null; b.lastKicker = p; b.kickCd = 0.3; b.flight++;
    b.gkTried = false; b.fire = false; b.curve = false; b.curveT = 0;
    p.kickAnim = 0.4;
  }

  shoot(p, aim) {
    const b = this.ball, r = this.rnd;
    if (b.owner !== p) return;
    const t = p.team;
    const gx = t === 0 ? FL + 1.5 : -1.5;
    const a = clamp(aim ?? r.float() * 2 - 1, -1, 1);
    let ty = FW / 2 + a * (GOAL_HALF - 0.7);
    const d0 = hypot(gx - p.x, ty - p.y);
    const skill = t === 0 && !this.autopilot ? AI.humanShotSkill : this.ratings[t];
    // 레전드는 훨씬 정확하고 세게 찬다
    const err = (0.5 + d0 / 17) * ((t === 1 ? AI.shotError : 1.7) - skill * 0.22) * clamp(1 - 0.35 * p.power, 0.1, 1.3);
    const fire = this.armedFire[t];
    const curve = this.armedCurve[t];
    // 전설의 신(★5)은 가끔 아무도 못 막는 황금 슛
    const golden = !fire && !curve && p.power >= 2 && r.float() < 0.35;
    let speed = 29 + r.float() * 4 + 3 * p.power;
    if (fire) speed = 44 + this.level(t, ItemType.FIRE) * 2;
    if (golden) speed = 47;
    if (curve) ty = FW / 2 + (a >= 0 ? 1 : -1) * (GOAL_HALF - 0.9);
    else if (!fire && !golden) ty += (r.float() * 2 - 1) * err;
    this.release(p);
    this.stat('shot');
    let dx = gx - p.x, dy = ty - p.y;
    const d = hypot(dx, dy);
    dx /= d; dy /= d;
    if (curve) {
      this.armedCurve[t] = false;
      b.curve = true;
      const side = dy >= 0 ? -1 : 1;
      const th = 0.42 * side;
      const c = Math.cos(th), s = Math.sin(th);
      const ndx = dx * c - dy * s, ndy = dx * s + dy * c;
      dx = ndx; dy = ndy;
      b.curveT = d / speed;
      b.curveRate = -2 * th / b.curveT;
    }
    b.vx = dx * speed; b.vy = dy * speed;
    b.vz = 2 + r.float() * 2.5;
    b.shotTeam = t;
    b.passTarget = null;
    if (fire) {
      this.armedFire[t] = false;
      b.fire = true;
      this.shake = 0.5;
      this.showBanner('🔥 파이어 슛!!', 1.2, t);
    } else if (golden) {
      b.fire = true;
      this.shake = 0.5;
      this.stat('golden');
      this.showBanner(`✨ ${p.m.name}의 황금 슛!`, 1.3, t);
    } else if (curve) {
      this.showBanner('🌀 회오리 슛!', 1.1, t);
    }
  }

  pass(p, hx, hy) {
    if (this.ball.owner !== p) return;
    const mates = this.players.filter((m) => m.team === p.team && m !== p && !m.gk && m.stun <= 0 && !m.hidden);
    if (mates.length === 0) return;
    const fwd = p.team === 0 ? 1 : -1;
    const best = maxBy(mates, (m) => {
      const dx = m.x - p.x, dy = m.y - p.y;
      const d = Math.max(hypot(dx, dy), 0.1);
      const open = this.nearestOpp(m)[1];
      if (hx != null && hy != null) return ((dx * hx + dy * hy) / d) * 3 - d / 40 + open / 14;
      return dx * fwd / 12 + open / 5 - d / 30 + this.rnd.float();
    });
    this.passTo(p, best);
  }

  passTo(p, m) {
    const b = this.ball;
    const tx = clamp(m.x + m.vx * 0.35, 1, FL - 1);
    const ty = clamp(m.y + m.vy * 0.35, 1, FW - 1);
    const d = Math.max(hypot(tx - p.x, ty - p.y), 0.5);
    const blocked = this.players.some((o) => o.team !== p.team && !o.gk && segDist(o.x, o.y, p.x, p.y, tx, ty) < 1.4);
    const lofted = d > 24 || (blocked && d > 7);
    let speed = clamp(11 + d * 0.75, 13, 25);
    this.release(p);
    this.stat('pass');
    if (lofted) {
      speed *= 0.82;
      const tFlight = d / speed;
      b.vz = GRAV * tFlight * 0.5 * 0.9;
    } else b.vz = 0.6;
    b.vx = (tx - p.x) / d * speed;
    b.vy = (ty - p.y) / d * speed;
    b.passTarget = m;
    b.shotTeam = -1;
    if (m.team === 0 && !this.autopilot) this.human = m;
  }

  tackle(p) {
    if (p.tackleCd > 0 || p.stun > 0) return;
    const o = this.ball.owner;
    let dx, dy;
    if (o && o.team !== p.team && this.dist(o, p.x, p.y) < 5) { dx = o.x - p.x; dy = o.y - p.y; }
    else if (!o && this.dist(p, this.ball.x, this.ball.y) < 5) { dx = this.ball.x - p.x; dy = this.ball.y - p.y; }
    else { dx = p.dirX; dy = p.dirY; }
    const d = Math.max(hypot(dx, dy), 0.01);
    p.dashX = dx / d; p.dashY = dy / d;
    p.dashT = 0.24;
    p.tackling = true;
    p.tackleCd = 0.85;
    p.kickAnim = 0.3;
    this.dust(p.x, p.y, 4);
  }

  dash(p, hx, hy) {
    if (p.tackleCd > 0 || p.stun > 0) return;
    const dx = hx ?? p.dirX, dy = hy ?? p.dirY;
    const d = Math.max(hypot(dx, dy), 0.01);
    p.dashX = dx / d; p.dashY = dy / d;
    p.dashT = 0.3;
    this.stat('dash');
    p.tackling = this.ball.owner !== p;
    p.tackleCd = 1.1;
    this.dust(p.x, p.y, 5);
  }

  loose(o) {
    const b = this.ball, r = this.rnd;
    if (b.owner !== o) return;
    b.owner = null;
    b.vx = o.vx * 0.4 + (r.float() - 0.5) * 6;
    b.vy = o.vy * 0.4 + (r.float() - 0.5) * 6;
    b.vz = 3;
    b.lastKicker = o;
    b.kickCd = 0.5;
    b.shotTeam = -1;
    b.passTarget = null;
    b.flight++;
  }

  take(p) {
    const b = this.ball;
    b.owner = p; b.passTarget = null; b.shotTeam = -1; b.fire = false; b.curve = false; b.curveT = 0;
    p.holdT = 0;
    if (p.team === 0 && !p.gk && !this.autopilot) this.human = p;
  }

  resolveTackles() {
    const o = this.ball.owner;
    if (!o) return;
    for (const p of this.players) {
      if (p.hidden) continue;
      if (p.dashT <= 0 || !p.tackling || p.team === o.team || p.stun > 0) continue;
      if (this.dist(p, o.x, o.y) > 1.5 * Math.max(p.size, o.size)) continue;
      // 골키퍼가 잡고 있는 공은 뺏을 수 없음
      if (o.gk) { p.dashT = 0; p.tackling = false; return; }
      let chance = p.team === 0 && !this.autopilot ? AI.humanTackleWin : p.team === 1 ? AI.tackleWin + this.ratings[1] * AI.tackleWinPerRating : 0.22 + this.ratings[0] * 0.04;
      if (p.giantT > 0) chance = 1;
      chance = clamp((chance + 0.12 * p.power) * Math.max(1 - 0.25 * o.power, 0.1), 0.05, 1);
      if (o.giantT > 0) chance = 0.05;
      p.dashT = 0; p.tackling = false;
      if (this.rnd.float() < chance) {
        o.stun = 0.55; o.stunKind = Stun.KNOCK;
        this.take(p);
        this.stat('steal');
        this.stars(o.x, o.y, 5);
      } else {
        p.stun = 0.45; p.stunKind = Stun.WHIFF;
        this.stat('whiff');
      }
      return;
    }
  }

  /* ───────────── AI ───────────── */

  computeRoles() {
    const b = this.ball;
    for (let t = 0; t < 2; t++) {
      const cand = this.players
        .filter((p) => p.team === t && !p.gk && p.stun <= 0 && !p.hidden && (this.autopilot || t === 1 || p !== this.human))
        .sort((p, q) => this.dist(p, b.x + b.vx * 0.2, b.y + b.vy * 0.2) - this.dist(q, b.x + b.vx * 0.2, b.y + b.vy * 0.2));
      let ch = cand[0] ?? null;
      let cv = cand[1] ?? null;
      if (t === 0 && !this.autopilot) {
        const hd = this.dist(this.human, b.x, b.y);
        if (ch && !(b.owner == null && this.dist(ch, b.x, b.y) + 4 < hd)) { cv = ch; ch = null; }
      }
      this.chasers[t] = ch;
      this.covers[t] = cv;
    }
  }

  homePos(p) {
    const b = this.ball;
    const form = this.setup.formationOf(p.team);
    const base = form.home[p.slot];
    const ballFrac = p.team === 0 ? b.x / FL : 1 - b.x / FL;
    const attack = b.owner?.team === p.team;
    const fx = clamp(base[0] + (ballFrac - 0.5) * 0.5 + (attack ? 0.12 : -0.04) + form.push, 0.08, 0.92);
    const fy = clamp(base[1] + (b.y / FW - 0.5) * 0.35, 0.08, 0.92);
    return [p.team === 0 ? fx * FL : FL - fx * FL, fy * FW];
  }

  intercept(p) {
    const b = this.ball;
    const t = Math.min(this.dist(p, b.x, b.y) / this.speedOf(p), 1.2) * 0.7;
    return [clamp(b.x + b.vx * t, 0.5, FL - 0.5), clamp(b.y + b.vy * t, 0.5, FW - 0.5)];
  }

  ai(p, dt) {
    if (p.stun > 0) { p.wantX = 0; p.wantY = 0; return; }
    if (p.dashT > 0) return;
    if (p.gk) { this.gkAI(p, dt); return; }
    const b = this.ball;
    const o = b.owner;
    if (o === p) { this.carrierAI(p, dt); return; }
    if (p.frozen) {
      if (!o && b.passTarget === p) { const [ix, iy] = this.intercept(p); this.moveTo(p, ix, iy); }
      else { p.wantX = 0; p.wantY = 0; }
      return;
    }
    if (!o && b.passTarget === p) { const [ix, iy] = this.intercept(p); this.moveTo(p, ix, iy); return; }
    if (o && o.gk && o.team !== p.team) { const [hx, hy] = this.homePos(p); this.moveTo(p, hx, hy, 0.85); return; }
    if (!o || o.team !== p.team) {
      if (this.chasers[p.team] === p) {
        if (o) {
          this.moveTo(p, o.x + o.vx * 0.2, o.y + o.vy * 0.2);
          if (this.dist(p, o.x, o.y) < 2.6 && p.tackleCd <= 0 && this.rnd.float() < dt * (p.team === 1 ? AI.tackleRate + this.ratings[1] * AI.tackleRatePerRating : 0.55 + this.ratings[0] * 0.15)) this.tackle(p);
        } else { const [ix, iy] = this.intercept(p); this.moveTo(p, ix, iy); }
        return;
      }
      if (this.covers[p.team] === p && o) {
        const gx = p.team === 0 ? 0 : FL;
        this.moveTo(p, gx + (b.x - gx) * 0.6, FW / 2 + (b.y - FW / 2) * 0.7, 0.95);
        return;
      }
    }
    const [hx, hy] = this.homePos(p);
    this.moveTo(p, hx, hy, 0.85);
  }

  carrierAI(p, dt) {
    const t = p.team, r = this.rnd;
    const gx = t === 0 ? FL : 0;
    const fwd = t === 0 ? 1 : -1;
    const dGoal = hypot(gx - p.x, FW / 2 - p.y);
    const [opp, od] = this.nearestOpp(p);
    let ty = FW / 2;
    if (opp && od < 6 && (opp.x - p.x) * fwd > -0.5) ty = p.y + (p.y >= opp.y ? 7 : -7);
    this.moveTo(p, gx, clamp(ty, 3, FW - 3));
    p.think -= dt;
    if (p.think > 0) return;
    p.think = 0.25 + r.float() * 0.3;
    const range = 17 + this.ratings[t] * 1.2 + (this.armedFire[t] || this.armedCurve[t] ? 6 : 0);
    if (dGoal < range && r.float() < (dGoal < 11 ? 0.85 : 0.45)) { this.shoot(p, null); return; }
    if (od < 3.2 && r.float() < 0.55) { this.pass(p, null, null); return; }
    if (r.float() < 0.06) this.pass(p, null, null);
  }

  gkAI(p, dt) {
    const t = p.team, b = this.ball, r = this.rnd;
    const lineX = t === 0 ? 0 : FL;
    const inX = t === 0 ? 1 : -1;
    if (b.owner === p) {
      p.holdT += dt;
      this.moveTo(p, lineX + inX * 2.5, FW / 2, 0.5);
      if (p.holdT > 0.9) {
        const target = maxBy(this.players.filter((m) => m.team === t && !m.gk && !m.hidden), (m) => this.nearestOpp(m)[1] + r.float() * 4);
        if (target) this.passTo(p, target);
        else {
          // 받을 친구가 없으면 앞으로 길게 차기
          this.release(p);
          b.vx = inX * 20; b.vy = (r.float() - 0.5) * 8; b.vz = 8;
          b.shotTeam = -1;
        }
      }
      return;
    }
    let tx = lineX + inX * 1.6;
    let ty = FW / 2 + (b.y - FW / 2) * 0.45;
    let mul = 1;
    const incoming = b.owner == null && b.shotTeam === 1 - t && b.vx * inX < -3;
    if (incoming) {
      const tt = (lineX - b.x) / b.vx;
      if (tt > 0) ty = b.y + b.vy * tt;
      mul = 1.3;
    }
    ty = clamp(ty, FW / 2 - GOAL_HALF - 0.3, FW / 2 + GOAL_HALF + 0.3);
    const dBall = hypot(b.x - lineX, b.y - FW / 2);
    if (b.owner == null && !incoming && dBall < 10 && b.speed() < 14) { tx = b.x; ty = b.y; }
    this.moveTo(p, tx, ty, mul);
  }

  aiItems(dt) {
    const b = this.ball;
    for (let t = 0; t < 2; t++) {
      if (t === 0 && !this.autopilot) continue;
      const it = this.items[t];
      if (!it) continue;
      this.aiItemT[t] -= dt;
      if (this.aiItemT[t] > 0) continue;
      this.aiItemT[t] = 0.5;
      const o = b.owner;
      const mine = o != null && o.team === t && !o.gk;
      const theirs = o != null && o.team !== t;
      const field = this.players.filter((p) => p.team === t && !p.gk && p.stun <= 0);
      const near = minBy(field, (p) => this.dist(p, b.x, b.y));
      if (!near) continue;
      let user = null;
      switch (it) {
        case ItemType.FIRE: case ItemType.CURVE:
          user = mine && hypot((t === 0 ? FL : 0) - o.x, FW / 2 - o.y) < 30 ? o : null; break;
        case ItemType.SPEED: case ItemType.GIANT:
          user = mine ? o : theirs ? near : null; break;
        case ItemType.WALL:
          user = theirs && (t === 0 ? b.x < FL * 0.4 : b.x > FL * 0.6) ? near : null; break;
        case ItemType.MAGNET: {
          const d = this.dist(near, b.x, b.y);
          user = !mine && o?.gk !== true && d < Items.magnetRange(this.level(t, it)) && d > 2 ? near : null; break;
        }
        case ItemType.ICE: case ItemType.BANANA:
          user = theirs && !o.gk ? near : null; break;
      }
      if (user) this.useItem(t, user);
    }
  }

  /* ───────────── 아이템 ───────────── */

  useItem(t, user) {
    const it = this.items[t];
    if (!it) return;
    const b = this.ball;
    const lv = this.level(t, it);
    const mine = t === 0;
    switch (it) {
      case ItemType.FIRE: this.armedFire[t] = true; if (mine) this.toast('🔥 파이어 슛 장전! 슛을 날려요'); break;
      case ItemType.CURVE: this.armedCurve[t] = true; if (mine) this.toast('🌀 회오리 커브 장전!'); break;
      case ItemType.GIANT: user.giantT = Items.giantTime(lv); this.stars(user.x, user.y, 8); break;
      case ItemType.WALL: this.wallT[t] = Items.wallTime(lv); break;
      case ItemType.SPEED: user.speedT = Items.speedTime(lv); break;
      case ItemType.MAGNET: {
        const d = this.dist(user, b.x, b.y);
        if (d > Items.magnetRange(lv) || b.owner === user || b.owner?.gk === true) {
          if (mine) this.toast('🧲 공이 너무 멀어요!');
          return;
        }
        if (b.owner) { b.owner.stun = 0.4; b.owner.stunKind = Stun.KNOCK; }
        b.owner = null;
        const dx = user.x - b.x, dy = user.y - b.y;
        const dd = Math.max(hypot(dx, dy), 0.1);
        b.vx = dx / dd * 20; b.vy = dy / dd * 20; b.vz = 2.5;
        b.passTarget = user; b.shotTeam = -1; b.lastKicker = null; b.flight++;
        this.stars(b.x, b.y, 6);
        break;
      }
      case ItemType.ICE: {
        const o = b.owner;
        const target = o && o.team !== t && !o.gk ? o : minBy(this.players.filter((p) => p.team !== t && !p.gk), (p) => this.dist(p, b.x, b.y));
        target.stun = Items.iceTime(lv); target.stunKind = Stun.ICE;
        for (let i = 0; i < 10; i++) this.burst(target.x, target.y, 1.5, Fx.ICE, 0xffbfe9ff);
        break;
      }
      case ItemType.BANANA: {
        const o = b.owner;
        const [bx, by] = o && o.team !== t ? [o.x + o.dirX * 3, o.y + o.dirY * 3] : [user.x - user.dirX * 1.6, user.y - user.dirY * 1.6];
        this.bananas.push(new Banana(clamp(bx, 1, FL - 1), clamp(by, 1, FW - 1), t, 14, lv));
        if (lv >= 4) this.bananas.push(new Banana(clamp(bx + 2.2, 1, FL - 1), clamp(by + 2.5, 1, FW - 1), t, 14, lv));
        break;
      }
    }
    this.items[t] = null;
    this.stat('use_' + it.name);
    this.stars(user.x, user.y, 4);
    if (!mine) this.toast(`상대가 ${it.emoji} ${it.title} 사용!`);
    else if (it !== ItemType.FIRE && it !== ItemType.CURVE) this.toast(`${it.emoji} ${it.title}!`);
  }

  updateBoxes(dt) {
    const r = this.rnd;
    if (!this.tutorial) this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 6 + r.float() * 5;
      if (this.boxes.length < 3) this.boxes.push(new ItemBox(10 + r.float() * (FL - 20), 6 + r.float() * (FW - 12)));
    }
    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      b.t += dt;
      const p = this.players.find((q) => !q.gk && !q.hidden && q.stun <= 0 && this.items[q.team] == null && !this.armedFire[q.team] && !this.armedCurve[q.team] &&
        this.dist(q, b.x, b.y) < 1.6 * q.size);
      if (!p) continue;
      const got = this.forcedItem ?? Items.roll(r);
      this.stat('pick');
      this.items[p.team] = got;
      this.aiItemT[p.team] = p.team === 1 ? 2 + r.float() * 3 : 0.8 + r.float() * 2.5;
      this.stars(b.x, b.y, 10);
      if (p.team === 0) {
        this.toast(!this.hintShown ? `🎁 ${got.emoji} ${got.title} 획득! 아이템 버튼을 눌러요` : `🎁 ${got.emoji} ${got.title} 획득!`);
        this.hintShown = true;
      } else this.toast(`상대가 ${got.emoji} ${got.title} 획득!`);
      this.boxes.splice(i, 1); i--;
    }
  }

  updateBananas(dt) {
    for (const bn of this.bananas) {
      bn.life -= dt;
      if (bn.life <= 0) continue;
      for (const p of this.players) {
        if (p.team === bn.team || p.gk || p.hidden || p.stun > 0) continue;
        if (this.dist(p, bn.x, bn.y) < 1.1 * p.size) {
          p.stun = Items.slipTime(bn.level); p.stunKind = Stun.SLIP;
          this.stat('slip');
          bn.life = 0;
          this.stars(p.x, p.y, 5);
          this.toast(p.team === 1 ? '🍌 바나나 함정 발동! 상대가 꽈당~' : '🍌 앗, 바나나에 꽈당!');
          break;
        }
      }
    }
    this.bananas = this.bananas.filter((b) => b.life > 0);
  }

  /* ───────────── 물리 ───────────── */

  integrate(dt) {
    const ps = this.players;
    for (const p of ps) {
      if (p.hidden) continue;
      if (p.stun > 0) { p.wantX = 0; p.wantY = 0; }
      if (p.dashT > 0 && p.stun <= 0) {
        const sp = this.ball.owner === p ? 15 : 17;
        p.vx = p.dashX * sp; p.vy = p.dashY * sp;
      } else {
        const k = Math.min(1, (p.stunKind === Stun.SLIP ? 2 : 11) * dt);
        p.vx += (p.wantX - p.vx) * k;
        p.vy += (p.wantY - p.vy) * k;
      }
      if (p.stunKind === Stun.ICE) { p.vx = 0; p.vy = 0; }
      p.x = clamp(p.x + p.vx * dt, -0.5, FL + 0.5);
      p.y = clamp(p.y + p.vy * dt, 0.6, FW - 0.6);
      const sp = hypot(p.vx, p.vy);
      if (sp > 0.6) {
        p.dirX = p.vx / sp; p.dirY = p.vy / sp;
        if (Math.abs(p.vx) > 0.4) p.faceRight = p.vx > 0;
      }
      p.phase += sp * dt * 1.3;
    }
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j];
      if (a.hidden || b.hidden) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = hypot(dx, dy);
      const minD = 1.5 * (a.size + b.size) / 2;
      if (d < minD && d > 0.001) {
        const push = minD - d;
        const wa = a.giantT > 0 && b.giantT <= 0 ? 0 : b.giantT > 0 && a.giantT <= 0 ? 1 : 0.5;
        a.x -= dx / d * push * wa; a.y -= dy / d * push * wa;
        b.x += dx / d * push * (1 - wa); b.y += dy / d * push * (1 - wa);
      }
    }
  }

  placeOwnedBall(dt) {
    const b = this.ball, o = b.owner;
    if (!o) return;
    if (o.gk) {
      b.x = o.x + (o.team === 0 ? 0.9 : -0.9);
      b.y = o.y + 0.3;
      b.z = 1.1;
    } else {
      b.x = o.x + o.dirX * 1.9 * o.size;
      b.y = o.y + o.dirY * 1.2 * o.size + 0.35;
      b.z = 0;
    }
    b.vx = o.vx; b.vy = o.vy; b.vz = 0;
    b.spin += hypot(o.vx, o.vy) * dt * 1.5;
  }

  ballPhysics(dt, live) {
    const b = this.ball, r = this.rnd;
    if (b.owner) this.placeOwnedBall(dt);
    else {
      if (b.curveT > 0) {
        const a = b.curveRate * dt;
        const c = Math.cos(a), s = Math.sin(a);
        const nvx = b.vx * c - b.vy * s, nvy = b.vx * s + b.vy * c;
        b.vx = nvx; b.vy = nvy;
        b.curveT -= dt;
        if (r.float() < 0.6) this.particles.push(particle(b.x, b.y, b.z + 0.3, 0, 0, 0, 0.5, 0.5, 0xff9fd8ff, 0.5, Fx.STAR, r.float() * 90));
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.z > 0 || b.vz > 0) {
        b.vz -= GRAV * dt;
        b.z += b.vz * dt;
        const f = Math.exp(-0.15 * dt); b.vx *= f; b.vy *= f;
        if (b.z <= 0) {
          b.z = 0;
          if (b.vz < -3) { b.vz = -b.vz * 0.45; b.vx *= 0.88; b.vy *= 0.88; } else b.vz = 0;
        }
      } else {
        const f = Math.exp(-1.1 * dt); b.vx *= f; b.vy *= f;
      }
      b.spin += b.speed() * dt * 1.5;
      if (b.fire) for (let i = 0; i < 2; i++) {
        this.particles.push(particle(
          b.x, b.y, b.z + 0.3, (r.float() - 0.5) * 2, (r.float() - 0.5) * 2, 1 + r.float() * 2,
          0.45, 0.45, r.bool() ? 0xffff9f1c : 0xffffd23f, 0.9 + r.float() * 0.6, Fx.FLAME, 0));
      }
      if (live) this.gkSaves();
    }

    // 옆줄 펜스
    if (b.y < 0.4) { b.y = 0.4; b.vy = Math.abs(b.vy) * 0.7; }
    if (b.y > FW - 0.4) { b.y = FW - 0.4; b.vy = -Math.abs(b.vy) * 0.7; }

    const mouthY = Math.abs(b.y - FW / 2) < GOAL_HALF - 0.3;
    const inMouth = mouthY && b.z < GOAL_H;
    // 철벽 골문
    for (let t = 0; t < 2; t++) {
      if (this.wallT[t] <= 0 || !mouthY) continue;
      const wx = t === 0 ? 1.4 : FL - 1.4;
      const towards = t === 0 ? b.vx < 0 && b.x < wx : b.vx > 0 && b.x > wx;
      if (towards && Math.abs(b.x - wx) < 1.2) {
        if (b.owner) this.loose(b.owner);
        b.x = wx;
        b.vx = -b.vx * 0.6;
        b.shotTeam = -1; b.fire = false; b.curveT = 0;
        this.stars(b.x, b.y, 4);
      }
    }
    // 골라인
    if (b.x < 0.4) {
      if (inMouth || (b.x < 0 && mouthY)) {
        if (live && b.x < -0.6) this.goal(1);
        if (b.x < -3) { b.x = -3; b.vx = 0; }
        b.y = clamp(b.y, FW / 2 - GOAL_HALF + 0.4, FW / 2 + GOAL_HALF - 0.4);
        if (b.x < 0) b.z = Math.min(b.z, GOAL_H - 0.3);
      } else if (!b.owner) { b.x = 0.4; b.vx = Math.abs(b.vx) * 0.6; b.shotTeam = -1; }
    }
    if (b.x > FL - 0.4) {
      if (inMouth || (b.x > FL && mouthY)) {
        if (live && b.x > FL + 0.6) this.goal(0);
        if (b.x > FL + 3) { b.x = FL + 3; b.vx = 0; }
        b.y = clamp(b.y, FW / 2 - GOAL_HALF + 0.4, FW / 2 + GOAL_HALF - 0.4);
        if (b.x > FL) b.z = Math.min(b.z, GOAL_H - 0.3);
      } else if (!b.owner) { b.x = FL - 0.4; b.vx = -Math.abs(b.vx) * 0.6; b.shotTeam = -1; }
    }
  }

  gkSaves() {
    const b = this.ball, r = this.rnd;
    if (b.shotTeam < 0 || b.gkTried) return;
    for (const g of this.players) {
      if (!g.gk || g.hidden || g.team === b.shotTeam || g.stun > 0) continue;
      if (this.dist(g, b.x, b.y) > 1.9 * g.size || b.z > GOAL_H + 0.8) continue;
      b.gkTried = true;
      if (b.fire && g.power >= 2 && r.float() < 0.5) {
        // 전설의 신 골키퍼: 불꽃 슛도 가끔 잡는다
        this.take(g); this.stat('save');
        this.toast(`🧤 ${g.m.name}의 신의 손!`);
        return;
      }
      if (b.fire) {
        g.stun = 1.1; g.stunKind = Stun.KNOCK;
        b.vx *= 0.85; b.vy *= 0.85;
        this.stars(g.x, g.y, 6);
        return;
      }
      const sp = b.speed();
      const base = g.team === 1 && !this.autopilot ? AI.gkSave + this.ratings[1] * AI.gkSavePerRating : 0.55 + this.ratings[g.team] * 0.06;
      let pr = clamp(base + 0.15 * g.power - (sp - 26) * 0.02, 0.15, Math.min(0.9 + 0.025 * g.power, 0.97));
      if (b.curve) pr *= 1 - Items.curveCatchCut(this.level(b.shotTeam, ItemType.CURVE));
      if (r.float() < pr) {
        this.take(g);
        this.stat('save');
        g.kickAnim = 0.3;
        this.toast(g.team === 1 ? '🧤 상대 골키퍼 선방!' : '🧤 우리 골키퍼 선방!');
      } else if (r.float() < 0.4) {
        b.vx = -b.vx * 0.35;
        b.vy = b.vy * 0.4 + (r.float() - 0.5) * 12;
        b.vz = 4;
        b.shotTeam = -1; b.curveT = 0;
        g.stun = 0.4; g.stunKind = Stun.DIVE;
        b.flight++;
      } else { g.stun = 0.35; g.stunKind = Stun.DIVE; }
      return;
    }
  }

  pickups() {
    const b = this.ball, r = this.rnd;
    if (b.owner || b.z > 1.3) return;
    const sp = b.speed();
    let best = null, bd = 99;
    if (this.ballHidden) return;
    for (const p of this.players) {
      if (p.stun > 0 || p.hidden) continue;
      if (p === b.lastKicker && b.kickCd > 0) continue;
      const rr = (p.gk ? 1.7 : 1.25) * p.size;
      const d = this.dist(p, b.x, b.y);
      if (d > rr) continue;
      if (sp > 23 && b.passTarget !== p) {
        if (p.gk) continue;
        if (!b.fire && p.blockFlight !== b.flight) {
          p.blockFlight = b.flight;
          if (r.float() < 0.3) {
            b.vx = -b.vx * 0.3 + (r.float() - 0.5) * 6;
            b.vy = b.vy * 0.5 + (r.float() - 0.5) * 10;
            b.vz = 3;
            b.shotTeam = -1; b.curveT = 0;
            b.flight++;
            this.dust(b.x, b.y, 3);
            return;
          }
        }
        continue;
      }
      if (d < bd) { bd = d; best = p; }
    }
    if (best) this.take(best);
  }

  goal(team) {
    const r = this.rnd;
    this.score[team]++;
    this.stat('goal');
    const k = this.ball.lastKicker;
    if (k && k.team === team && k.m.name) this.toast(`⚽ ${k.m.name} 골!`);
    this.lastGoalTeam = team;
    this.phase = Phase.GOAL;
    this.phaseT = 2.8;
    this.ball.owner = null;
    this.ball.fire = false;
    this.shake = 0.6;
    this.showBanner('GOAL!!', 2.4, team);
    const gx = team === 0 ? FL : 0;
    const cols = [0xffff7eb0, 0xffffd23f, 0xff6ab8ff, 0xff6ee7a8, 0xffffffff, 0xffff9f1c];
    for (let i = 0; i < 60; i++) {
      this.particles.push(particle(
        gx + (r.float() - 0.5) * 6, FW / 2 + (r.float() - 0.5) * 12, 2 + r.float() * 2,
        (r.float() - 0.5) * 14, (r.float() - 0.5) * 14, 6 + r.float() * 10,
        2.2, 2.2, cols[i % cols.length], 0.6, Fx.CONFETTI, r.float() * 180));
    }
  }

  /* ───────────── 효과 ───────────── */

  updateFx(dt) {
    const ps = this.particles;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { ps.splice(i, 1); i--; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === Fx.CONFETTI) { p.vz -= 9 * dt; p.vx *= 0.98; p.vy *= 0.98; }
      if (p.kind === Fx.FLAME) p.vz += 2 * dt;
      p.z = Math.max(0, p.z + p.vz * dt);
    }
    this.toasts.forEach((t) => (t.life -= dt));
    this.toasts = this.toasts.filter((t) => t.life > 0);
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.banner = null; }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.5);
  }

  burst(x, y, z, kind, color) {
    const r = this.rnd;
    this.particles.push(particle(x, y, z, (r.float() - 0.5) * 8, (r.float() - 0.5) * 8, 2 + r.float() * 4, 0.7, 0.7, color, 0.5 + r.float() * 0.4, kind, r.float() * 90));
  }
  stars(x, y, n) { for (let i = 0; i < n; i++) this.burst(x, y, 2, Fx.STAR, i % 2 === 0 ? 0xffffe066 : WHITE); }
  dust(x, y, n) {
    const r = this.rnd;
    for (let i = 0; i < n; i++) {
      this.particles.push(particle(
        x + (r.float() - 0.5), y + (r.float() - 0.5) * 0.6, 0.1,
        (r.float() - 0.5) * 3, (r.float() - 0.5) * 2, 0.6,
        0.45, 0.45, WHITE, 0.5 + r.float() * 0.4, Fx.DUST, 0));
    }
  }

  /* ───────────── 유틸 ───────────── */

  dist(p, x, y) { return hypot(p.x - x, p.y - y); }
  nearestOpp(p) {
    let best = null, bd = 99;
    for (const o of this.players) {
      if (o.team === p.team || o.hidden) continue;
      const d = hypot(o.x - p.x, o.y - p.y);
      if (d < bd) { bd = d; best = o; }
    }
    return [best, bd];
  }
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-4) return hypot(px - ax, py - ay);
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return hypot(px - (ax + dx * t), py - (ay + dy * t));
}
