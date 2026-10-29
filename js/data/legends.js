import { PLAYERS_TSV } from './raw.js';
import { Hat, Roster } from './teams.js';
import { clamp } from '../core.js';

export const Pos = {
  FW: { name: 'FW', label: '공격수', emoji: '⚔️' },
  MF: { name: 'MF', label: '미드필더', emoji: '🎯' },
  DF: { name: 'DF', label: '수비수', emoji: '🛡️' },
  GK: { name: 'GK', label: '골키퍼', emoji: '🧤' },
};

/**
 * 선수 등급. 오버롤 범위가 서로 겹치지 않아서
 * 높은 등급의 가장 약한 선수도 낮은 등급의 가장 센 선수보다 항상 오버롤·가격이 높다.
 */
function grade(name, label, color, min, max, hat, glow) { return { name, label, color, min, max, hat, glow }; }
export const Grade = {
  BRONZE: grade('BRONZE', '브론즈', 0xffd89b6a, 50, 59, Hat.NONE, false),
  SILVER: grade('SILVER', '실버', 0xffa9b3cc, 60, 69, Hat.NONE, false),
  GOLD: grade('GOLD', '골드', 0xffffc93c, 70, 79, Hat.BAND, false),
  LEGEND: grade('LEGEND', '레전드', 0xff6ab8ff, 80, 87, Hat.STAR, true),
  SUPER: grade('SUPER', '슈퍼 레전드', 0xffb18cff, 88, 94, Hat.CROWN, true),
  GOD: grade('GOD', '전설의 신', 0xffffb627, 95, 100, Hat.HALO, true),
};
export const Grades = Object.values(Grade);

/**
 * 진화: 1진 ~ 10진. 1·2진 +2, 3·4진 +4, 5·6진 +6, 7·8진 +8, 9·10진 +10.
 * 진화는 도전이다: 성공하면 한 단계 오르고, 실패하면 한 단계 내려간다 (0진 아래로는 안 내려감).
 */
export const Evolution = {
  MAX: 10,
  steps: [2, 2, 4, 4, 6, 6, 8, 8, 10, 10],
  /** evo 단계에서 다음 단계로 성공할 확률 (높은 단계일수록 어려움) */
  chances: [0.9, 0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.28, 0.2, 0.12],
  bonus(evo) { return this.steps.slice(0, clamp(evo, 0, this.MAX)).reduce((s, x) => s + x, 0); },
  chance(evo) { return this.chances[clamp(evo, 0, this.MAX - 1)]; },
  /** evo 단계에서 다음 단계로 진화에 도전하는 비용 (단계가 오를수록 비싸짐) */
  cost(l, evo) { return Legends.round10(l.price * 0.12 * (evo + 1)); },
  /** 선수 가치 배수: 진화할수록 값이 오른다 (10진 = 13배) */
  valueMul(evo) { return 1 + 0.6 * evo + 0.06 * evo * evo; },
};

/** 선수 팔 때 받는 몫 (가치의 절반) */
export const SELL_RATE = 0.5;
/** 선수는 3일에 한 번 팔 수 있다 */
export const SELL_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

/** 오버롤 → 경기 힘. 기본 동글이(45) = 0 (상대 팀과 같은 힘), 100 = 2, 그 위는 진화로 천천히 */
export function powerOf(ovr) {
  return ovr <= 100 ? (ovr - Roster.BASE_OVR) / 27.5 : 2 + (ovr - 100) / 40;
}

class Legend {
  constructor(f) {
    this.id = +f[0]; this.name = f[1]; this.short = f[2]; this.flag = f[3]; this.country = f[4];
    this.pos = Pos[f[5]]; this.num = +f[6]; this.grade = Grade[f[7]]; this.ovr = +f[8];
  }
  /** 진화 단계까지 반영한 오버롤 */
  ovrAt(evo) { return this.ovr + Evolution.bonus(evo); }
  /** 기본 가격: 오버롤이 높을수록 비싸다 */
  get price() { return Legends.price(this.ovr); }
  /** 선수 가치 (진화 단계까지): 이 값으로 진화된 선수를 사고, 팔 때는 절반 */
  priceAt(evo) { return evo <= 0 ? this.price : Legends.round10(this.price * Evolution.valueMul(evo)); }
  sellPrice(evo) { return Legends.round10(this.priceAt(evo) * SELL_RATE); }
  skill(evo) {
    if (this.ovrAt(evo) >= 100 && this.pos === Pos.GK) return '🧤 신의 손 · 불꽃 슛도 막아요';
    if (this.grade === Grade.GOD) return '✨ 황금 슛 · 경기마다 한 번, 날개가 돋으면 못 막는 슛!';
    if (this.pos === Pos.GK) return '🧤 선방 · 오버롤이 높을수록 잘 막아요';
    if (this.pos === Pos.DF) return '🛡️ 태클 · 오버롤이 높을수록 잘 뺏어요';
    return '⚡ 몸놀림 · 오버롤이 높을수록 빠르고 정확해요';
  }
}

const all = PLAYERS_TSV.split('\n').map((l) => new Legend(l.split('\t')));
const byGrade = new Map(Grades.map((g) => [g, all.filter((l) => l.grade === g)]));

/**
 * 프로그램: 같은 선수의 특별 카드(테두리·무늬가 다름). 기본 선수와 따로 가질 수 있다.
 * 프로그램 선수는 진화가 없고 오버롤이 고정. 이벤트로 받고, 이벤트가 끝나면 이적시장에서 판다.
 */
export const Programs = [
  {
    id: 'LP', name: '마지막 힘', ovr: 175, price: 100000,
    /** 이 시각(이벤트가 끝날 때)부터 이적시장에서 판다 */
    saleFrom: Date.parse('2026-11-05T21:16:00+09:00'),
    /** 선수 번호 = idBase + 기본 선수 번호 (저장할 때 이 번호로) */
    idBase: 100000,
    eventId: 'last-power-2026-11',
    // 손흥미 · 에우제비유 · 마르코 판 바스텬 · 박지송 · 카퓨 · 버질 반다이쿠 · 필 포둔 · 훌리안 알바레수
    baseIds: [7, 10, 12, 52, 80, 109, 104, 183],
  },
];

class ProgramLegend extends Legend {
  constructor(base, program) {
    super([program.idBase + base.id, base.name, base.short, base.flag, base.country, base.pos.name, base.num, base.grade.name, program.ovr]);
    this.base = base;
    this.program = program;
  }
  ovrAt() { return this.ovr; }
  get price() { return this.program.price; }
  priceAt() { return this.program.price; }
  skill() { return `⚡ ${this.program.name} · 오버롤 ${this.ovr} · 진화 없음`; }
}

const programPlayers = Programs.flatMap((p) => (p.players = p.baseIds.map((id) => new ProgramLegend(all[id], p))));
const programById = new Map(programPlayers.map((l) => [l.id, l]));
export const programOf = (id) => Programs.find((p) => p.id === id) ?? null;

export const Legends = {
  all,
  TOTAL: all.length,
  get: (id) => all[id] ?? programById.get(id),
  /** 프로그램 선수 전부 */
  programs: programPlayers,
  byGrade,
  round10: (x) => Math.max(Math.round(x / 10) * 10, 10),
  /** 오버롤 → 가격. 오버롤이 1 높아질 때마다 8.5% 비싸짐 (50 → 100코인, 100 → 약 5,900코인) */
  price(ovr) { return this.round10(100 * Math.pow(1.085, ovr - 50)); },
  GACHA_PRICE: 500,
  DUPLICATE_REFUND: 250,
  /** 선수 뽑기: 전설의 신 0.3% · 슈퍼 1.7% · 레전드 6% · 골드 17% · 실버 30% · 브론즈 45% */
  roll(r) {
    const x = r.int(1000);
    const g = x < 3 ? Grade.GOD : x < 20 ? Grade.SUPER : x < 80 ? Grade.LEGEND : x < 250 ? Grade.GOLD : x < 550 ? Grade.SILVER : Grade.BRONZE;
    const pool = byGrade.get(g);
    return pool[r.int(pool.length)];
  },
};

/**
 * 나의 팀 포메이션. 자리(슬롯 0~4)마다 맡는 포지션과 경기장 기본 위치를 정한다.
 * 위치는 (내 골대 0 → 상대 골대 1, 위 0 → 아래 1). 3번 자리는 항상 킥오프하는 공격수.
 */
function formation(name, label, sub, roles, home, push = 0) {
  return {
    /** push: 팀 전체가 앞(+)·뒤(-)로 서는 정도. 공격 포메이션은 더 올라가고 수비 포메이션은 더 내려선다 */
    name, label, sub, roles: roles.map((r) => Pos[r]), home, push,
    /** 이 자리에 이 포지션 선수가 설 수 있나 (골키퍼는 골키퍼끼리, 미드필더 선수·미드 자리는 필드 어디든) */
    accepts(slot, pos) {
      const role = this.roles[slot];
      if (role === Pos.GK || pos === Pos.GK) return role === pos;
      if (role === Pos.MF || pos === Pos.MF) return true;
      return role === pos;
    },
    /** 이 포지션 선수가 설 수 있는 자리 (딱 맞는 자리 먼저) */
    slotsFor(pos) {
      return [0, 1, 2, 3, 4].filter((s) => this.accepts(s, pos)).sort((a, b) => (this.roles[a] === pos ? 0 : 1) - (this.roles[b] === pos ? 0 : 1));
    },
  };
}
export const Formation = {
  F22: formation('F22', '2-2', '기본', ['GK', 'DF', 'DF', 'FW', 'FW'], [[0.025, 0.5], [0.24, 0.3], [0.24, 0.7], [0.56, 0.28], [0.56, 0.72]]),
  F31: formation('F31', '3-1', '수비', ['GK', 'DF', 'DF', 'FW', 'DF'], [[0.025, 0.5], [0.22, 0.24], [0.22, 0.76], [0.56, 0.5], [0.3, 0.5]], -0.04),
  // 1-3 공격: 공격수 셋이 앞에서 일자로 넓게 서고, 팀 전체가 높이 올라간다
  F13: formation('F13', '1-3', '공격', ['GK', 'DF', 'FW', 'FW', 'FW'], [[0.025, 0.5], [0.32, 0.5], [0.62, 0.12], [0.64, 0.5], [0.62, 0.88]], 0.06),
  // 1-2-1 다이아: 미드필더 둘이 가운데에서 넓게 받치고, 공격수 하나만 맨 앞에
  F121: formation('F121', '1-2-1', '다이아', ['GK', 'DF', 'MF', 'FW', 'MF'], [[0.025, 0.5], [0.18, 0.5], [0.38, 0.2], [0.68, 0.5], [0.38, 0.8]]),
};
export const Formations = Object.values(Formation);
