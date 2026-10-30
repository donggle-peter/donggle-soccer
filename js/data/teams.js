import { COUNTRIES_TSV, LEAGUES_TSV } from './raw.js';

/* 머리 장식 */
function hat(name, label, price, shop = true) { return { name, label, price, shop }; }
export const Hat = {
  NONE: hat('NONE', '없음', 0),
  BAND: hat('BAND', '머리띠', 0),
  SPROUT: hat('SPROUT', '새싹', 0),
  BOW: hat('BOW', '리본', 200),
  FLOWER: hat('FLOWER', '꽃', 200),
  STAR: hat('STAR', '별 핀', 300),
  ANTENNA: hat('ANTENNA', '더듬이', 300),
  PARTY: hat('PARTY', '고깔모자', 500),
  CROWN: hat('CROWN', '왕관', 1000),
  /** 전설의 신 레전드 전용 후광 */
  HALO: hat('HALO', '후광', 0, false),
  // 새 머리 장식 (저장된 구매 기록이 안 꼬이게 맨 뒤에 붙인다)
  TANGERINE: hat('TANGERINE', '귤 헬멧', 400),
  AVOCADO: hat('AVOCADO', '아보카도 모자', 400),
  BALLBAND: hat('BALLBAND', '축구공 머리띠', 300),
  COLA: hat('COLA', '콜라 병', 600),
  /** 클래스 '마지막 힘' 선수 전용 번개 */
  BOLT: hat('BOLT', '번개', 0, false),
};
export const Hats = Object.values(Hat);
Hats.forEach((h, i) => (h.ordinal = i));
export const hatByName = (n) => Hat[n] ?? Hat.NONE;

/** 경기 선수 한 명 */
export function SquadMember(num, gk, o = {}) {
  return { num, gk, name: o.name ?? '', hat: o.hat ?? Hat.NONE, legend: o.legend ?? 0, glow: o.glow ?? false, golden: o.golden ?? false, green: o.green ?? false, lightning: o.lightning ?? false };
}

export const Roster = {
  NAME_MAX: 6,
  defaults: [
    { slot: 0, name: '철벽이', num: 1, hat: Hat.NONE },
    { slot: 1, name: '콩글이', num: 4, hat: Hat.NONE },
    { slot: 2, name: '방글이', num: 9, hat: Hat.NONE },
    { slot: 3, name: '동글이', num: 7, hat: Hat.BAND },
    { slot: 4, name: '몽글이', num: 10, hat: Hat.SPROUT },
  ],
  /** 기본 동글이들의 오버롤 (브론즈 선수도 사면 바로 팀이 세지도록 브론즈 최저 50 보다 낮다) */
  BASE_OVR: 45,
  /** 화면에 보여 주는 순서: 공격수 → 수비수 → 골키퍼 */
  displayOrder: [3, 4, 2, 1, 0],
  randomNames: ['동글이', '몽글이', '방글이', '콩글이', '송글이', '탱글이', '보들이', '말랑이', '뭉치',
    '콩떡이', '찹쌀이', '두부', '호빵이', '토실이', '꼬물이', '몽실이', '구름이', '솜사탕'],
  /** n 번째 경기(1부터)의 참가 보상: 50 에서 시작해 10경기마다 50씩 늘어남 */
  participation: (n) => 50 * (1 + Math.floor(n / 10)),
  position: (slot) => (slot === 0 ? '골키퍼' : slot <= 2 ? '수비수' : '공격수'),
  toMember: (p) => SquadMember(p.num, p.slot === 0, { name: p.name, hat: p.hat }),
};

/* 나라·리그 */
function team(f) {
  return { id: f[0], name: f[1], short: f[2], emoji: f[3], color: parseInt(f[4], 16) >>> 0, color2: parseInt(f[5], 16) >>> 0, rating: +f[6] };
}

const countries = COUNTRIES_TSV.split('\n').map((l) => team(l.split('\t')));
const leagues = LEAGUES_TSV.split('\n').map((l) => {
  const f = l.split('\t');
  return { id: f[0], name: f[1], flag: f[2], color: parseInt(f[3], 16) >>> 0, stars: +f[4], clubs: f.slice(5).map((c) => team(c.split(';'))) };
});
const byId = new Map([...countries, ...leagues.flatMap((l) => l.clubs)].map((t) => [t.id, t]));

const fallbackKits = [0xff2b2150, 0xff5fd068, 0xffffd23f, 0xffb18cff, 0xffff8a1f, 0xff4f8cff, 0xffff4f64, 0xff7cc8ff];

export const Teams = {
  countries,
  leagues,
  get: (id) => byId.get(id),
  league: (id) => leagues.find((l) => l.id === id),
  /** 팀 선수단 (GK + 필드 4명) */
  squad: () => [SquadMember(1, true), ...[4, 7, 9, 10].map((n) => SquadMember(n, false))],
  /** 사람 눈 기준 색 차이 (0 ~ 1, redmean 근사) */
  colorDistance(a, b) {
    const ar = ((a >>> 16) & 255) / 255, ag = ((a >>> 8) & 255) / 255, ab = (a & 255) / 255;
    const br = ((b >>> 16) & 255) / 255, bg = ((b >>> 8) & 255) / 255, bb = (b & 255) / 255;
    const rm = (ar + br) / 2, dr = ar - br, dg = ag - bg, db = ab - bb;
    return Math.sqrt((2 + rm) * dr * dr + 4 * dg * dg + (3 - rm) * db * db) / 3;
  },
  MIN_KIT_DISTANCE: 0.42,
  /** 원정팀 유니폼은 홈팀과 확실히 다른 색으로 (보조 유니폼 → 예비 색 순서) */
  kits(home, away) {
    const options = [away.color, away.color2, ...fallbackKits];
    let pick = options.find((c) => this.colorDistance(home.color, c) >= this.MIN_KIT_DISTANCE);
    if (pick == null) pick = options.reduce((b, c) => (this.colorDistance(home.color, c) > this.colorDistance(home.color, b) ? c : b));
    return [home.color, pick];
  },
};
