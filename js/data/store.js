import { Hat, hatByName, Roster, SquadMember } from './teams.js';
import { ItemTypes, Items, itemByName } from './items.js';
import { Legends, Evolution, Grade, Formation, powerOf, SELL_COOLDOWN_MS } from './legends.js';
import { WorldCup, LeagueSeason } from './tournament.js';
import { Rng } from '../core.js';

export const TUTORIAL_LESSONS = 7;
export const TUTORIAL_REWARD = 500;
/** 주장이 있으면 팀 전체 오버롤 +1 */
export const CAPTAIN_BONUS = 1;

const KEY = 'donggle-soccer-save';

/**
 * 저장 데이터 (코인, 아이템 레벨, 월드컵/리그 진행, 튜토리얼, 선수 꾸미기, 이적시장, 나의 팀).
 * 브라우저(localStorage)에 저장되고, 바뀌면 화면이 다시 그려진다.
 */
export class Store {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.random = new Rng();
    this.listeners = new Set();
    let s = {};
    try { s = JSON.parse(storage?.getItem(KEY) ?? '{}') ?? {}; } catch { s = {}; }
    this.coins = s.coins ?? 1500;
    this.matches = s.matches ?? 0;
    this.wins = s.wins ?? 0;
    this.trophies = s.trophies ?? 0;
    this.draws = s.draws ?? 0;
    this.goalsFor = s.gf ?? 0;
    this.goalsAgainst = s.ga ?? 0;
    this.streak = s.streak ?? 0;
    this.bestStreak = s.bestStreak ?? 0;
    /** 최근 경기 결과 (W 승, D 무, L 패) 오래된 것 → 최근, 최대 5개 */
    this.recent = s.recent ?? '';
    this.wcTitles = s.wcTitles ?? 0;
    this.leagueTitles = s.leagueTitles ?? 0;
    this.levels = Object.fromEntries(ItemTypes.map((t) => [t.name, s.levels?.[t.name] ?? 1]));
    this.worldCup = s.wc ? safe(() => WorldCup.fromJSON(s.wc)) : null;
    this.league = s.league ? safe(() => LeagueSeason.fromJSON(s.league)) : null;
    /* 튜토리얼 진행 (수업별 완료 비트) */
    this.tutorialMask = s.tutMask ?? 0;
    this.tutorialRewarded = s.tutReward ?? false;
    this.tutorialAsked = s.tutAsked ?? false;
    /* 내 선수 꾸미기 */
    this.roster = Roster.defaults.map((d) => {
      const r = s.roster?.[d.slot];
      return { slot: d.slot, name: r?.name ?? d.name, num: r?.num ?? d.num, hat: r ? hatByName(r.hat) : d.hat };
    });
    this.hatMask = s.hats ?? 0;
    /** 경기 시작할 때 들고 나가는 아이템 */
    this.equipped = s.equip ? itemByName(s.equip) : null;
    /* 레전드 선수 */
    this.ownedLegends = new Set(s.legends ?? []);
    /** 자리(슬롯) → 출전 중인 선수 id */
    this.lineup = new Map(Object.entries(s.lineup ?? {}).map(([k, v]) => [+k, v]));
    /** 선수 → 진화 단계 (0 ~ 10) */
    this.evolutions = new Map(Object.entries(s.evo ?? {}).map(([k, v]) => [+k, v]));
    /* 나의 팀 */
    this.formation = Formation[s.formation] ?? Formation.F22;
    /** 주장 자리 (주장이 있으면 팀 전체 오버롤 +1) */
    this.captain = s.captain ?? 3;
    this.music = s.music ?? true;
    /** 감독 닉네임 (비어 있으면 그냥 "감독") */
    this.nickname = s.nickname ?? '';
    /** 마지막으로 선수를 판 시각 (3일에 한 번) */
    this.lastSellAt = s.lastSellAt ?? 0;
  }

  /* ───── 저장 · 알림 ───── */

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  save() {
    const s = {
      coins: this.coins, matches: this.matches, wins: this.wins, trophies: this.trophies, draws: this.draws,
      gf: this.goalsFor, ga: this.goalsAgainst, streak: this.streak, bestStreak: this.bestStreak, recent: this.recent,
      wcTitles: this.wcTitles, leagueTitles: this.leagueTitles, levels: this.levels,
      wc: this.worldCup, league: this.league,
      tutMask: this.tutorialMask, tutReward: this.tutorialRewarded, tutAsked: this.tutorialAsked,
      roster: Object.fromEntries(this.roster.map((p) => [p.slot, { name: p.name, num: p.num, hat: p.hat.name }])),
      hats: this.hatMask, equip: this.equipped?.name ?? null,
      legends: [...this.ownedLegends], lineup: Object.fromEntries(this.lineup), evo: Object.fromEntries(this.evolutions),
      formation: this.formation.name, captain: this.captain, music: this.music,
      nickname: this.nickname, lastSellAt: this.lastSellAt,
    };
    try { this.storage?.setItem(KEY, JSON.stringify(s)); } catch { /* 저장 공간이 없으면 이번 판만 */ }
    this.listeners.forEach((fn) => fn());
  }

  /* ───── 감독 전적 ───── */

  get losses() { return Math.max(0, this.matches - this.wins - this.draws); }
  get winRate() { return this.matches === 0 ? 0 : Math.floor((this.wins * 100 + Math.floor(this.matches / 2)) / this.matches); }
  get profileLevel() { return 1 + Math.floor(this.matches / 3); }
  get profileProgress() { return (this.matches % 3) / 3; }
  get matchesToNextLevel() { return 3 - (this.matches % 3); }
  get nextParticipation() { return Roster.participation(this.matches + 1); }

  /* ───── 튜토리얼 ───── */

  lessonDone(i) { return (this.tutorialMask & (1 << i)) !== 0; }
  get lessonsDone() { let n = 0; for (let i = 0; i < TUTORIAL_LESSONS; i++) if (this.lessonDone(i)) n++; return n; }
  get tutorialComplete() { return this.lessonsDone === TUTORIAL_LESSONS; }
  markLesson(i) { this.tutorialMask |= 1 << i; this.save(); }
  /** 7개 수업을 다 끝냈을 때 한 번만 코인 선물 */
  claimTutorialReward() {
    if (this.tutorialRewarded || !this.tutorialComplete) return false;
    this.tutorialRewarded = true;
    this.coins += TUTORIAL_REWARD;
    this.save();
    return true;
  }
  markTutorialAsked() { this.tutorialAsked = true; this.save(); }

  /* ───── 선수 꾸미기 ───── */

  player(slot) { return this.roster.find((p) => p.slot === slot); }
  ownsHat(h) { return h.price === 0 || (this.hatMask & (1 << h.ordinal)) !== 0; }
  updatePlayer(p) { this.roster = this.roster.map((x) => (x.slot === p.slot ? p : x)); this.save(); }
  rename(slot, name) { this.updatePlayer({ ...this.player(slot), name: [...name].slice(0, Roster.NAME_MAX).join('') }); }
  /** 등번호 바꾸기: 친구와 겹치는 번호는 건너뛴다 */
  stepNumber(slot, dir) {
    const used = new Set(this.roster.filter((p) => p.slot !== slot).map((p) => p.num));
    let n = this.player(slot).num;
    do { n = ((n - 1 + dir + 99) % 99) + 1; } while (used.has(n));
    this.updatePlayer({ ...this.player(slot), num: n });
  }
  /** 상점에서 머리 장식 사기 (가방에 들어감). 실패하면 false */
  buyHat(h) {
    if (this.ownsHat(h) || this.coins < h.price) return false;
    this.coins -= h.price;
    this.hatMask |= 1 << h.ordinal;
    this.save();
    return true;
  }
  /** 머리 장식 고르기 (안 산 것은 코인으로 산다). 실패하면 false */
  wearHat(slot, h) {
    if (!this.ownsHat(h)) {
      if (this.coins < h.price) return false;
      this.coins -= h.price;
      this.hatMask |= 1 << h.ordinal;
    }
    this.updatePlayer({ ...this.player(slot), hat: h });
    return true;
  }
  equip(t) { this.equipped = t; this.save(); }

  /* ───── 이적시장 ───── */

  evoOf(l) { return this.evolutions.get(l.id) ?? 0; }
  /**
   * 진화 도전 (1진 ~ 10진). 코인을 내고 도전해서 성공하면 한 단계 오르고, 실패하면 한 단계 내려간다.
   * 결과: { ok: 성공했나, from, to } — 코인이 모자라거나 더 못 오르면 null
   */
  evolve(l, roll = this.random.float()) {
    const e = this.evoOf(l);
    const cost = Evolution.cost(l, e);
    if (!this.ownedLegends.has(l.id) || e >= Evolution.MAX || this.coins < cost) return null;
    this.coins -= cost;
    const ok = roll < Evolution.chance(e);
    const to = ok ? e + 1 : Math.max(0, e - 1);
    if (to === 0) this.evolutions.delete(l.id); else this.evolutions.set(l.id, to);
    this.save();
    return { ok, from: e, to };
  }
  legendIn(slot) { const id = this.lineup.get(slot); return id == null ? null : Legends.get(id); }
  slotOf(id) { for (const [s, v] of this.lineup) if (v === id) return s; return null; }
  /** 선수 영입. evo 를 주면 그만큼 진화된 선수를 그 가치로 산다 */
  buyLegend(l, evo = 0) {
    const cost = l.priceAt(evo);
    if (this.ownedLegends.has(l.id) || this.coins < cost) return false;
    this.coins -= cost;
    this.ownedLegends.add(l.id);
    if (evo > 0) this.evolutions.set(l.id, evo); else this.evolutions.delete(l.id);
    this.save();
    return true;
  }

  /** 다음에 선수를 팔 수 있는 시각까지 남은 시간 (ms, 0 이면 지금 가능) */
  sellWait(now = Date.now()) { return Math.max(0, this.lastSellAt + SELL_COOLDOWN_MS - now); }

  /** 보유 선수 팔기 (진화된 선수도 가능, 3일에 한 번). 받은 코인, 못 팔면 0 */
  sellLegend(l, now = Date.now()) {
    if (!this.ownedLegends.has(l.id) || this.sellWait(now) > 0) return 0;
    const got = l.sellPrice(this.evoOf(l));
    this.coins += got;
    this.ownedLegends.delete(l.id);
    this.evolutions.delete(l.id);
    for (const [s2, v] of [...this.lineup]) if (v === l.id) this.lineup.delete(s2);
    this.lastSellAt = now;
    this.save();
    return got;
  }

  setNickname(n) { this.nickname = [...n.trim()].slice(0, 8).join(''); this.save(); }
  /** "Lv.9 동글이 감독" */
  get managerTitle() { return `Lv.${this.profileLevel} ${this.nickname ? this.nickname + ' ' : ''}감독`; }
  /** 선수 뽑기. [뽑힌 선수, 새로 얻었는지] — 이미 있으면 코인 일부 환급 */
  drawLegend() {
    if (this.coins < Legends.GACHA_PRICE) return null;
    this.coins -= Legends.GACHA_PRICE;
    const l = Legends.roll(this.random);
    const fresh = !this.ownedLegends.has(l.id);
    if (fresh) this.ownedLegends.add(l.id); else this.coins += Legends.DUPLICATE_REFUND;
    this.save();
    return [l, fresh];
  }

  /* ───── 나의 팀: 포메이션 · 라인업 · 주장 ───── */

  /** 이 선수가 지금 포메이션에서 설 수 있는 자리 */
  slotsFor(l) { return this.formation.slotsFor(l.pos); }
  /** 자리의 선수 오버롤 (주장 보너스 빼고). 기본 동글이는 Roster.BASE_OVR */
  ovrIn(slot) { const l = this.legendIn(slot); return l ? l.ovrAt(this.evoOf(l)) : Roster.BASE_OVR; }
  /** 팀 오버롤 = 5명 평균 + 주장 보너스 */
  get teamOvr() { let s = 0; for (let i = 0; i < 5; i++) s += this.ovrIn(i); return Math.floor((s + 2) / 5) + CAPTAIN_BONUS; }
  /** 선수를 자리에 출전시키기 (그 자리에 있던 선수는 내려옴) */
  assignLegend(l, slot) {
    if (!this.ownedLegends.has(l.id) || !this.slotsFor(l).includes(slot)) return;
    for (const [s, v] of [...this.lineup]) if (v === l.id) this.lineup.delete(s);
    this.lineup.set(slot, l.id);
    this.save();
  }
  benchLegend(l) { for (const [s, v] of [...this.lineup]) if (v === l.id) this.lineup.delete(s); this.save(); }
  /** 자리를 기본 동글이로 되돌리기 */
  clearSlot(slot) { this.lineup.delete(slot); this.save(); }
  /** 포메이션 바꾸기: 새 자리에 못 서는 선수는 빈 자리로 옮기고, 자리가 없으면 벤치로. 벤치로 간 수를 돌려준다 */
  changeFormation(f) {
    const lu = new Map([...this.lineup].filter(([s, id]) => f.accepts(s, Legends.get(id).pos)));
    let benched = 0;
    [...this.lineup].filter(([s]) => !lu.has(s)).map(([, id]) => Legends.get(id))
      .sort((a, b) => b.ovrAt(this.evoOf(b)) - a.ovrAt(this.evoOf(a)))
      .forEach((l) => {
        const free = f.slotsFor(l.pos).find((s) => !lu.has(s));
        if (free != null) lu.set(free, l.id); else benched++;
      });
    this.formation = f;
    this.lineup = lu;
    this.save();
    return benched;
  }
  /** 자동 배치: 오버롤이 높은 선수부터 설 수 있는 자리에 (딱 맞는 자리 먼저) */
  autoLineup() {
    const lu = new Map();
    [...this.ownedLegends].map((id) => Legends.get(id)).sort((a, b) => b.ovrAt(this.evoOf(b)) - a.ovrAt(this.evoOf(a))).forEach((l) => {
      const free = this.slotsFor(l).find((s) => !lu.has(s));
      if (free != null && l.ovrAt(this.evoOf(l)) > Roster.BASE_OVR) lu.set(free, l.id);
    });
    this.lineup = lu;
    this.save();
  }
  makeCaptain(slot) { this.captain = slot; this.save(); }

  /** 경기에 나가는 내 선수 5명 (레전드가 출전 중이면 그 자리는 레전드). 주장 보너스만큼 모두 조금 세진다 */
  lineupMembers() {
    return [...this.roster].sort((a, b) => a.slot - b.slot).map((p) => {
      const l = this.legendIn(p.slot);
      if (l) {
        return SquadMember(l.num, p.slot === 0, {
          name: l.short, hat: l.grade.hat, legend: powerOf(l.ovrAt(this.evoOf(l)) + CAPTAIN_BONUS), glow: l.grade.glow, golden: l.grade === Grade.GOD,
        });
      }
      return { ...Roster.toMember(p), legend: powerOf(Roster.BASE_OVR + CAPTAIN_BONUS) };
    });
  }

  /* ───── 아이템 · 코인 · 기록 ───── */

  level(t) { return this.levels[t.name] ?? 1; }
  levelsMap() { return { ...this.levels }; }
  addCoins(n) { this.coins += n; this.save(); }

  /** result: 1 승, 0 무, -1 패 (승부차기 포함) */
  recordMatch(result, gf, ga) {
    this.matches++;
    if (result === 1) { this.wins++; this.streak++; } else if (result === 0) { this.draws++; this.streak = 0; } else this.streak = 0;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    this.goalsFor += gf;
    this.goalsAgainst += ga;
    this.recent = (this.recent + (result === 1 ? 'W' : result === 0 ? 'D' : 'L')).slice(-5);
    this.save();
  }
  addTrophy(worldCup) {
    this.trophies++;
    if (worldCup) this.wcTitles++; else this.leagueTitles++;
    this.save();
  }
  /** 아이템 강화 (강화하면 바로 장착) */
  upgrade(t) {
    const lv = this.level(t);
    const cost = Items.upgradeCost(lv);
    if (lv >= Items.MAX_LEVEL || this.coins < cost) return false;
    this.coins -= cost;
    this.levels[t.name] = lv + 1;
    this.equipped = t;
    this.save();
    return true;
  }
  /** 행운 상자: 랜덤 아이템 레벨 +1 (이미 최대면 코인 일부 환급). [아이템, 올랐는지] */
  openLuckyBox() {
    if (this.coins < Items.BOX_PRICE) return null;
    this.coins -= Items.BOX_PRICE;
    const t = Items.roll(this.random);
    const lv = this.level(t);
    const upgraded = lv < Items.MAX_LEVEL;
    if (upgraded) this.levels[t.name] = lv + 1; else this.coins += Items.BOX_PRICE / 2;
    this.save();
    return [t, upgraded];
  }
  setWorldCup(wc) { this.worldCup = wc; this.save(); }
  setLeague(s) { this.league = s; this.save(); }
  setMusic(on) { this.music = on; this.save(); }
}

function safe(f) { try { return f(); } catch { return null; } }
export { Hat };
