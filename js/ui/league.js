import { div, row, col, space, Txt, OTxt, TextButton, Panel, Stars, TopBar, DotsBackground, GreenG, WhiteG, Gold } from './kit.js';
import { Teams } from '../data/teams.js';
import { LeagueSeason } from '../data/tournament.js';
import { css, INK, WHITE } from '../core.js';
import { matchSetup, startMatch } from '../app.js';

const fade = (a) => css(INK, a);
const Mint = 0xffc9f4e4;
const Sky = 0xff55a8ff;

export function LeagueScreen(app, st) {
  app.onBack = () => app.go('play');
  const s = app.store.league;
  return s ? Hub(app, s) : Select(app, st);
}

export function Emblem(team, size, fontSize) {
  return div({ class: 'center', style: { width: size, height: size, flex: 'none', background: '#fff', borderRadius: '50%', border: `3px solid ${css(team.color)}`, boxShadow: `inset 0 0 0 2px #fff, inset 0 0 0 4px ${css(INK)}` } },
    Txt(team.emoji, fontSize));
}

function Select(app, st) {
  const store = app.store;
  st.lg ??= 'KOR';
  const league = Teams.league(st.lg);
  const card = (l) => {
    const on = l.id === st.lg;
    return div({ style: { flex: 1, cursor: 'pointer', height: '100%' }, onClick: () => { st.lg = l.id; st.club = null; app.render(); } },
      Panel({ radius: 20, color: on ? 0xfffff8d0 : 0xffffffff, border: on ? 0xffffb627 : INK, style: { height: '100%' } },
        col({ height: '100%', alignItems: 'center' },
          div({ class: 'center', style: { width: '100%', flex: 0.42, position: 'relative', background: css(l.color) } },
            div({ class: 'abs', style: { left: 0, right: 0, bottom: 0, height: 4, background: css(INK) } }), Txt(l.flag, 44)),
          col({ flex: 0.58, alignItems: 'center', justifyContent: 'center' },
            Txt(l.name, 18, INK, { align: 'center' }), Txt('10팀 · 18라운드', 12, fade(0.6)), Stars(l.stars, 13)))));
  };
  return div({ class: 'screen' },
    DotsBackground(Mint),
    col({ position: 'absolute', inset: 0 },
      TopBar('🏟️ 리그 모드', Sky, () => app.go('play'), store.coins),
      row({ flex: 1, minHeight: 0, padding: 16, gap: 16, alignItems: 'stretch' },
        col({ flex: 0.56, gap: 10, minWidth: 0 },
          Txt('1. 리그를 골라요', 19),
          [0, 1].map((r) => row({ flex: 1, gap: 12, alignItems: 'stretch', minHeight: 0 }, [0, 1, 2, 3].map((c) => card(Teams.leagues[r * 4 + c]))))),
        Panel({ flex: 0.44, style: { height: '100%' } },
          col({ height: '100%' },
            row({ height: 54, background: css(league.color), padding: '0 16px', flex: 'none' },
              Txt(league.flag, 28), space(8), OTxt(league.name, 22, WHITE, { strokeWidth: 5 }), div({ style: { flex: 1 } }), Txt('2. 내 구단을 골라요', 15, WHITE)),
            div({ style: { height: 4, background: css(INK), flex: 'none' } }),
            div({ class: 'scroll', 'data-scroll': 'clubs', style: { flex: 1, padding: '6px 10px' } },
              league.clubs.map((t) => {
                const on = t.id === st.club;
                return row({ height: 36, borderRadius: 12, padding: '0 8px', cursor: 'pointer', background: on ? css(0xfffff3a6) : 'transparent', border: on ? `3px solid ${css(INK)}` : '3px solid transparent' },
                  Emblem(t, 28, 15), space(10), div({ style: { flex: 1 } }, Txt(t.name, 17)), Stars(t.rating, 12));
              }).map((el, i) => { el.addEventListener('click', () => { st.club = league.clubs[i].id; app.render(); }); return el; })),
            row({ padding: '4px 14px' },
              div({ style: { flex: 1 } }, Txt(st.club ? Teams.get(st.club).name : '구단을 선택하세요', 18)),
              TextButton('▶ 시즌 시작', () => { if (st.club) store.setLeague(LeagueSeason.create(st.lg, st.club, store.random)); }, GreenG, 170, 48, 20, { enabled: !!st.club })))))));
}

function Hub(app, s) {
  const store = app.store;
  const league = s.league;
  const me = Teams.get(s.myClub);
  const table = s.table();
  const mine = table.find((x) => x.id === s.myClub);
  let next;
  if (!s.finished) {
    const f = s.myFixture();
    const home = f.home === s.myClub;
    const opp = Teams.get(home ? f.away : f.home);
    const side = (t) => col({ width: 130, alignItems: 'center' }, Emblem(t, 58, 30), Txt(t.name, 16));
    next = col({ height: '100%', padding: 14, alignItems: 'center', justifyContent: 'space-evenly' },
      Txt(`${s.round + 1}라운드 · ${home ? '홈 경기' : '원정 경기'}`, 16, fade(0.6)),
      row({}, side(me), OTxt('VS', 30, 0xffff4f64, { strokeWidth: 6 }), side(opp)),
      TextButton('▶ 경기 시작', () => startMatch(matchSetup(me, opp, `${league.name} ${s.round + 1}R`, false), 'league'), GreenG, 220, 54, 23));
  } else {
    const rank = s.myRank();
    next = col({ height: '100%', padding: 14, alignItems: 'center', justifyContent: 'space-evenly' },
      OTxt(rank === 1 ? '🏆 리그 우승!!' : `시즌 종료 · ${rank}위`, 30, rank === 1 ? Gold : 0xff9fd8ff, { strokeWidth: 6 }),
      Txt(rank === 1 ? '최고의 시즌이었어요!' : '다음 시즌엔 더 높이!', 18),
      row({ gap: 10 },
        TextButton('🔄 새 시즌', () => store.setLeague(LeagueSeason.create(s.leagueId, s.myClub, store.random)), GreenG, 150, 50, 19),
        TextButton('다른 리그', () => store.setLeague(null), WhiteG, 150, 50, 19)));
  }
  const hc = fade(0.5);
  const cell = (text, size, color, width) => div({ style: { width, textAlign: 'center', flex: 'none' } }, Txt(text, size, color));
  return div({ class: 'screen' },
    DotsBackground(Mint),
    col({ position: 'absolute', inset: 0 },
      TopBar(`${league.flag} ${league.name}`, league.color, () => app.go('play'), store.coins),
      row({ flex: 1, minHeight: 0, padding: 16, gap: 16, alignItems: 'stretch' },
        col({ flex: 0.42, gap: 10, minWidth: 0 },
          Panel({ h: 153 },
            row({ height: '100%', padding: '0 18px' },
              Emblem(me, 76, 42), space(16),
              col({ flex: 1 },
                Txt('내 구단', 13, fade(0.6)), Txt(me.name, 26),
                Txt(`${s.myRank()}위 · ${mine.w}승 ${mine.d}무 ${mine.l}패`, 17, 0xff6b4bd6),
                space(4),
                row({},
                  div({ style: { flex: 1, height: 12, background: css(0xffe6e1f5), borderRadius: 6, border: `2px solid ${css(INK)}`, overflow: 'hidden' } },
                    div({ style: { width: `${(s.round / s.rounds.length) * 100}%`, height: '100%', background: css(Sky) } })),
                  space(8), Txt(`${s.round} / ${s.rounds.length}R`, 13))))),
          Panel({ flex: 1 }, next)),
        Panel({ flex: 0.58, style: { height: '100%' } },
          col({ height: '100%' },
            row({ height: 46, background: css(league.color), padding: '0 16px', flex: 'none' },
              OTxt('순위표', 22, WHITE, { strokeWidth: 5 }), div({ style: { flex: 1 } }), Txt(s.finished ? '최종' : `${s.round}라운드 종료`, 15, WHITE)),
            div({ style: { height: 4, background: css(INK), flex: 'none' } }),
            row({ padding: '6px 20px 0' },
              div({ style: { width: 24 } }, Txt('#', 12, hc)), div({ style: { flex: 1 } }, Txt('팀', 12, hc)),
              ['경기', '승', '무', '패', '득실'].map((x) => cell(x, 12, hc, 38)), cell('승점', 12, hc, 44)),
            table.map((t2, i) => {
              const t = Teams.get(t2.id);
              const my = t2.id === s.myClub;
              return row({ margin: '0 10px', height: 34, padding: '0 10px', borderRadius: 10, flex: 'none', background: my ? css(0xfffff3a6) : 'transparent', border: my ? `3px solid ${css(INK)}` : '3px solid transparent' },
                div({ style: { width: 24, flex: 'none' } }, Txt(String(i + 1), 16, i < 3 ? 0xffff9f1c : INK)),
                Emblem(t, 26, 14), space(8),
                div({ style: { flex: 1, minWidth: 0 } }, Txt(t.name, 16)),
                [t2.p, t2.w, t2.d, t2.l].map((v) => cell(String(v), 15, fade(0.7), 38)),
                cell(t2.gd > 0 ? `+${t2.gd}` : String(t2.gd), 15, fade(0.7), 38),
                cell(String(t2.pts), 18, INK, 44));
            }))))));
}
