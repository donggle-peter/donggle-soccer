import { Teams } from './teams.js';
import { clamp, chunked } from '../core.js';

export class Fixture {
  constructor(home, away) { this.home = home; this.away = away; this.hg = -1; this.ag = -1; this.pk = null; }
  get played() { return this.hg >= 0; }
  has(id) { return this.home === id || this.away === id; }
  winner() {
    if (!this.played) return null;
    if (this.hg > this.ag) return this.home;
    if (this.ag > this.hg) return this.away;
    return this.pk;
  }
  toJSON() { return { h: this.home, a: this.away, hg: this.hg, ag: this.ag, pk: this.pk ?? '' }; }
  static fromJSON(o) { const f = new Fixture(o.h, o.a); f.hg = o.hg; f.ag = o.ag; f.pk = o.pk || null; return f; }

  /** 사용자 경기 결과를 고정 일정에 기록 (엔진에서 사용자는 항상 홈) */
  recordMine(my, myGoals, oppGoals, myPkWin) {
    if (this.home === my) { this.hg = myGoals; this.ag = oppGoals; } else { this.hg = oppGoals; this.ag = myGoals; }
    if (myGoals === oppGoals && myPkWin != null) this.pk = myPkWin ? my : this.home === my ? this.away : this.home;
  }
}

export const Sim = {
  poisson(lambda, r) {
    const l = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= r.double(); } while (p > l);
    return k - 1;
  },
  /** 컴퓨터끼리 경기 결과 계산 */
  play(f, knockout, r) {
    const a = Teams.get(f.home).rating, b = Teams.get(f.away).rating;
    f.hg = this.poisson(clamp(1.3 + 0.35 * (a - b), 0.3, 3.2), r);
    f.ag = this.poisson(clamp(1.3 + 0.35 * (b - a), 0.3, 3.2), r);
    if (knockout && f.hg === f.ag) f.pk = r.double() < 0.5 + 0.06 * (a - b) ? f.home : f.away;
  },
};

export function standings(ids, fixtures) {
  const map = new Map(ids.map((id) => [id, { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, get pts() { return this.w * 3 + this.d; }, get gd() { return this.gf - this.ga; } }]));
  for (const f of fixtures) {
    if (!f.played) continue;
    const h = map.get(f.home), a = map.get(f.away);
    if (!h || !a) continue;
    h.p++; a.p++;
    h.gf += f.hg; h.ga += f.ag; a.gf += f.ag; a.ga += f.hg;
    if (f.hg > f.ag) { h.w++; a.l++; } else if (f.hg < f.ag) { a.w++; h.l++; } else { h.d++; a.d++; }
  }
  return [...map.values()].sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || Teams.get(y.id).rating - Teams.get(x.id).rating);
}

/* ─────────────────────── 월드컵 ─────────────────────── */

export class WorldCup {
  constructor(myTeam, groups, groupRounds, ko, stage, eliminated, champion) {
    this.myTeam = myTeam;
    this.groups = groups;
    /** 조별리그 라운드(0..2)별 16경기 */
    this.groupRounds = groupRounds;
    /** 토너먼트 단계별 경기 (0=16강, 1=8강, 2=4강, 3=결승) */
    this.ko = ko;
    /** 0..2 조별리그, 3 16강, 4 8강, 5 4강, 6 결승, 7 끝 */
    this.stage = stage;
    this.eliminated = eliminated;
    this.champion = champion;
  }
  get finished() { return this.stage >= 7; }

  stageName(s = this.stage) {
    if (s <= 2) return `조별리그 ${s + 1}차전`;
    return ['16강', '8강', '4강', '결승'][s - 3] ?? '종료';
  }

  currentFixtures() {
    if (this.stage < 3) return this.groupRounds[this.stage];
    if (this.stage <= 6) return this.ko[this.stage - 3] ?? [];
    return [];
  }
  myFixture() { return this.eliminated || this.finished ? null : this.currentFixtures().find((f) => f.has(this.myTeam)) ?? null; }
  groupOf(id) { return this.groups.findIndex((g) => g.includes(id)); }
  groupFixtures(g) { return this.groupRounds.flat().filter((f) => this.groups[g].includes(f.home)); }
  groupTable(g) { return standings(this.groups[g], this.groupFixtures(g)); }

  applyMyResult(myGoals, oppGoals, myPkWin, r) {
    this.myFixture()?.recordMine(this.myTeam, myGoals, oppGoals, myPkWin);
    this.advance(r);
  }

  advance(r) {
    const knockout = this.stage >= 3;
    this.currentFixtures().filter((f) => !f.played).forEach((f) => Sim.play(f, knockout, r));
    this.stage++;
    if (this.stage === 3) {
      const t = this.groups.map((_, g) => this.groupTable(g));
      const w = (g) => t[g][0].id, ru = (g) => t[g][1].id;
      this.ko.push([
        new Fixture(w(0), ru(1)), new Fixture(w(2), ru(3)), new Fixture(w(4), ru(5)), new Fixture(w(6), ru(7)),
        new Fixture(w(1), ru(0)), new Fixture(w(3), ru(2)), new Fixture(w(5), ru(4)), new Fixture(w(7), ru(6)),
      ]);
    } else if (this.stage >= 4 && this.stage <= 6) {
      const prev = this.ko[this.stage - 4].map((f) => f.winner());
      this.ko.push(chunked(prev, 2).map((p) => new Fixture(p[0], p[1])));
    } else if (this.stage === 7) {
      this.champion = this.ko[3][0].winner();
    }
    if (!this.eliminated && !this.finished && !this.currentFixtures().some((f) => f.has(this.myTeam))) {
      this.eliminated = true;
      // 남은 대회는 자동 진행해서 우승팀 결정
      while (!this.finished) this.advance(r);
    }
  }

  toJSON() {
    return { my: this.myTeam, groups: this.groups, gr: this.groupRounds, ko: this.ko, stage: this.stage, elim: this.eliminated, champ: this.champion ?? '' };
  }
  static fromJSON(o) {
    return new WorldCup(o.my, o.groups, o.gr.map((r) => r.map(Fixture.fromJSON)), o.ko.map((r) => r.map(Fixture.fromJSON)), o.stage, o.elim, o.champ || null);
  }
  static create(myTeam, r) {
    const pots = chunked([...Teams.countries].sort((a, b) => b.rating - a.rating).map((t) => t.id), 8).map((p) => r.shuffled(p));
    const groups = [...Array(8)].map((_, g) => pots.map((p) => p[g]));
    const rounds = [0, 1, 2].map((round) => groups.flatMap(([a, b, c, d]) =>
      round === 0 ? [new Fixture(a, b), new Fixture(c, d)] : round === 1 ? [new Fixture(a, c), new Fixture(d, b)] : [new Fixture(d, a), new Fixture(b, c)]));
    return new WorldCup(myTeam, groups, rounds, [], 0, false, null);
  }
}

/* ─────────────────────── 리그 ─────────────────────── */

export class LeagueSeason {
  constructor(leagueId, myClub, rounds, round) { this.leagueId = leagueId; this.myClub = myClub; this.rounds = rounds; this.round = round; }
  get league() { return Teams.league(this.leagueId); }
  get finished() { return this.round >= this.rounds.length; }
  get clubIds() { return this.league.clubs.map((c) => c.id); }
  table() { return standings(this.clubIds, this.rounds.flat()); }
  myFixture() { return this.rounds[this.round]?.find((f) => f.has(this.myClub)) ?? null; }
  myRank() { return this.table().findIndex((s) => s.id === this.myClub) + 1; }

  applyMyResult(myGoals, oppGoals, r) {
    this.myFixture()?.recordMine(this.myClub, myGoals, oppGoals, null);
    this.rounds[this.round].filter((f) => !f.played).forEach((f) => Sim.play(f, false, r));
    this.round++;
  }

  toJSON() { return { lg: this.leagueId, my: this.myClub, round: this.round, rounds: this.rounds }; }
  static fromJSON(o) { return new LeagueSeason(o.lg, o.my, o.rounds.map((r) => r.map(Fixture.fromJSON)), o.round); }
  static create(leagueId, myClub, r) {
    const ids = r.shuffled(Teams.league(leagueId).clubs.map((c) => c.id));
    const n = ids.length;
    const first = [];
    for (let rd = 0; rd < n - 1; rd++) {
      first.push([...Array(n / 2)].map((_, i) => {
        const a = ids[i], b = ids[n - 1 - i];
        return (rd + i) % 2 === 0 ? new Fixture(a, b) : new Fixture(b, a);
      }));
      const last = ids.splice(n - 1, 1)[0];
      ids.splice(1, 0, last);
    }
    const second = first.map((rd) => rd.map((f) => new Fixture(f.away, f.home)));
    return new LeagueSeason(leagueId, myClub, [...first, ...second], 0);
  }
}
