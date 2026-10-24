import { h, div, row, col, space, Txt, OTxt, TextButton, CircleButton, Panel, Stars, TopBar, Canvas, NightBackground, GoldG, Gold } from './kit.js';
import { CountryTile, grid } from './play.js';
import { label, drawTrophy } from '../game/draw.js';
import { Teams } from '../data/teams.js';
import { WorldCup } from '../data/tournament.js';
import { css, INK, WHITE } from '../core.js';
import { matchSetup, startMatch } from '../app.js';

const fade = (a) => css(INK, a);
const Purple = 0xff6a45d6;

export function WorldCupScreen(app, st) {
  const store = app.store;
  app.onBack = () => app.go('play');
  const wc = store.worldCup;
  return wc ? Hub(app, st, wc) : Select(app, st);
}

function Select(app, st) {
  st.sel ??= 'KOR';
  const t = Teams.get(st.sel);
  return div({ class: 'screen' },
    NightBackground(),
    col({ position: 'absolute', inset: 0 },
      TopBar('🏆 출전할 나라를 골라요', Purple, () => app.go('play')),
      div({ class: 'scroll', 'data-scroll': 'wcsel', style: { flex: 1, padding: '12px 16px 8px' } },
        grid(118, 10, 6, Teams.countries.map((c) => CountryTile(c, c.id === st.sel, null, () => { st.sel = c.id; app.render(); })))),
      row({ background: css(INK, 0.75), padding: '8px 24px' },
        Txt(t.emoji, 40), space(12),
        col({}, Txt(t.name, 26, WHITE), Stars(t.rating)),
        div({ style: { flex: 1 } }),
        Txt('조별리그 3경기 → 16강 → 8강 → 4강 → 결승', 16, 'rgba(255,255,255,0.85)'),
        space(16),
        TextButton('▶ 월드컵 출전!', () => app.store.setWorldCup(WorldCup.create(st.sel, app.store.random)), GoldG, 230, 54, 22))));
}

export function TabChip(text, on, onClick, size = 17, pad = 16) {
  return div({ style: { position: 'relative', paddingBottom: 4, cursor: 'pointer', flex: 'none' }, onClick },
    div({ class: 'abs', style: { left: 0, right: 0, top: 4, bottom: 0, background: css(INK), borderRadius: 999 } }),
    div({ class: 'center', style: { position: 'relative', height: 38, background: css(on ? Gold : WHITE), border: `3px solid ${css(INK)}`, borderRadius: 999, padding: `0 ${pad}px` } }, Txt(text, size)));
}

function Hub(app, st, wc) {
  st.tab ??= wc.stage >= 3 ? 1 : 0;
  const w = app.vw;
  const ribbon = div({ class: 'abs center', style: { left: w / 2 - 180, top: 10, width: 360, height: 50 } },
    Canvas(360, 50, (ctx, t, vw, vh) => {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(vw, 0); ctx.lineTo(vw - 20, vh / 2); ctx.lineTo(vw, vh); ctx.lineTo(0, vh); ctx.lineTo(20, vh / 2); ctx.closePath();
      ctx.fillStyle = css(Gold); ctx.fill(); ctx.strokeStyle = css(INK); ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();
    }, { class: 'fill' }),
    div({ style: { position: 'relative' } }, OTxt('🏆 동글 월드컵', 28, WHITE, { strokeWidth: 6 })));
  return div({ class: 'screen' },
    NightBackground(),
    st.tab === 0 ? GroupsView(wc) : BracketView(wc, w),
    CircleButton('◀', () => app.go('play'), 48, 20, { style: { position: 'absolute', left: 16, top: 10 } }),
    ribbon,
    row({ position: 'absolute', right: 16, top: 12, gap: 8 },
      TabChip('조별리그', st.tab === 0, () => { st.tab = 0; app.render(); }),
      TabChip('토너먼트', st.tab === 1, () => { st.tab = 1; app.render(); })),
    st.tab === 0
      ? div({ class: 'abs', style: { left: 0, right: 0, bottom: 10, display: 'flex', justifyContent: 'center' } }, MatchCard(app, wc, true))
      : div({ class: 'abs', style: { left: 0, right: 0, top: 372, display: 'flex', justifyContent: 'center' } }, MatchCard(app, wc, false)));
}

function MatchCard(app, wc, wide) {
  const store = app.store;
  const me = Teams.get(wc.myTeam);
  const [w, hh] = wide ? [620, 118] : [340, 160];
  let body;
  if (wc.finished) {
    const champ = wc.champion ? Teams.get(wc.champion) : null;
    body = col({ height: '100%', padding: 10, alignItems: 'center', justifyContent: 'space-evenly' },
      wc.champion === wc.myTeam ? OTxt(`🏆 ${me.name} 우승!!`, 28, Gold, { strokeWidth: 6 })
        : Txt(`${me.emoji} ${me.name} ${wc.eliminated ? '탈락...' : '🥈 준우승!'} · 우승 ${champ?.emoji ?? ''} ${champ?.name ?? ''}`, 19, INK, { align: 'center' }),
      TextButton('🔄 새 월드컵 시작', () => store.setWorldCup(null), GoldG, 250, 48, 20));
  } else {
    const f = wc.myFixture();
    if (f) {
      const opp = Teams.get(f.home === wc.myTeam ? f.away : f.home);
      const play = () => startMatch(matchSetup(me, opp, `월드컵 ${wc.stageName()}`, wc.stage >= 3), 'worldcup');
      body = wide
        ? row({ height: '100%', padding: '0 22px' },
          col({}, Txt(`${wc.stageName()} · 다음 경기`, 15, fade(0.6)),
            row({}, Txt(`${me.emoji} ${me.name}`, 26), Txt('  VS  ', 24, 0xffff4f64), Txt(`${opp.name} ${opp.emoji}`, 26))),
          div({ style: { flex: 1 } }),
          TextButton('▶ 경기 시작', play, GoldG, 200, 54, 23))
        : col({ height: '100%', padding: 10, alignItems: 'center', justifyContent: 'space-evenly' },
          Txt(`${wc.stageName()} · 다음 경기`, 14, fade(0.6)),
          row({}, Txt(`${me.emoji} ${me.short}`, 22), Txt('  VS  ', 22, 0xffff4f64), Txt(`${opp.short} ${opp.emoji}`, 22)),
          TextButton('▶ 경기 시작', play, GoldG, 210, 50, 22));
    }
  }
  return Panel({ w, h: hh + 7 }, body);
}

/* ───────────── 조별리그 표 ───────────── */

function GroupsView(wc) {
  return col({ position: 'absolute', left: 16, right: 16, top: 76, gap: 8 },
    [0, 1].map((r) => row({ gap: 12 }, [0, 1, 2, 3].map((c) => GroupPanel(wc, r * 4 + c)))));
}

function GroupPanel(wc, g) {
  const table = wc.groupTable(g);
  const done = wc.stage >= 3;
  const cell = (text, size, color, width) => div({ style: { width, textAlign: 'center', flex: 'none' } }, Txt(text, size, color));
  return Panel({ flex: 1, h: 165, radius: 18 },
    col({ height: '100%', padding: '6px 8px' },
      row({ padding: '0 4px' }, Txt(`${String.fromCharCode(65 + g)}조`, 18, Purple), div({ style: { flex: 1 } }),
        cell('경기', 11, fade(0.5), 26), cell('득실', 11, fade(0.5), 30), cell('승점', 11, fade(0.5), 30)),
      table.map((s, i) => {
        const t = Teams.get(s.id);
        const mine = s.id === wc.myTeam;
        return row({ height: 26, padding: '0 4px', borderRadius: 8, background: mine ? css(0xfffff3a6) : 'transparent' },
          div({ style: { width: 14, flex: 'none' } }, Txt(String(i + 1), 13, done && i < 2 ? 0xff2bb24c : INK)),
          Txt(t.emoji, 15), space(4),
          div({ style: { flex: 1, minWidth: 0 } }, Txt(t.short, 15)),
          cell(String(s.p), 13, fade(0.7), 26), cell(s.gd > 0 ? `+${s.gd}` : String(s.gd), 13, fade(0.7), 30), cell(String(s.pts), 15, INK, 30));
      })));
}

/* ───────────── 토너먼트 대진표 ───────────── */

function slotsOf(wc, f) {
  if (!f) return [{ flag: '', code: '?', score: '', state: 3 }, { flag: '', code: '?', score: '', state: 3 }];
  const one = (id, goals) => {
    const t = Teams.get(id);
    const w = f.winner();
    const state = id === wc.myTeam && (w == null || w === id) ? 1 : w != null && w !== id ? 2 : 0;
    const sc = !f.played ? '-' : f.pk === id ? `${goals}*` : String(goals);
    return { flag: t.emoji, code: t.short, score: sc, state };
  };
  return [one(f.home, f.hg), one(f.away, f.ag)];
}

const placeholders = ['A1', 'B2', 'C1', 'D2', 'E1', 'F2', 'G1', 'H2', 'B1', 'A2', 'D1', 'C2', 'F1', 'E2', 'H1', 'G2'];

function BracketView(wc, w) {
  const colW = (w - 32 - 340) / 6;
  const slotW = colW - 14;
  const xl = [16, 16 + colW, 16 + colW * 2];
  const xr = [w - 16 - slotW, w - 16 - colW - slotW, w - 16 - colW * 2 - slotW];
  const r16Y = [...Array(8)].map((_, i) => 128 + i * 50);
  const qfY = [...Array(4)].map((_, i) => (r16Y[i * 2] + r16Y[i * 2 + 1]) / 2 + (i % 2 === 0 ? -6 : 6));
  const sfY = [...Array(2)].map((_, i) => (qfY[i * 2] + qfY[i * 2 + 1]) / 2 + (i % 2 === 0 ? -6 : 6));
  const fY = 318, fl = w / 2 - slotW - 8, fr = w / 2 + 8, hh = 34;

  const lines = Canvas('100%', '100%', (ctx) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    const elbow = (x1, y1, x2, y2) => { const mx = (x1 + x2) / 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(mx, y1); ctx.lineTo(mx, y2); ctx.lineTo(x2, y2); ctx.stroke(); };
    for (let i = 0; i < 8; i++) {
      elbow(xl[0] + slotW, r16Y[i] + hh / 2, xl[1], qfY[i >> 1] + hh / 2);
      elbow(xr[0], r16Y[i] + hh / 2, xr[1] + slotW, qfY[i >> 1] + hh / 2);
    }
    for (let i = 0; i < 4; i++) {
      elbow(xl[1] + slotW, qfY[i] + hh / 2, xl[2], sfY[i >> 1] + hh / 2);
      elbow(xr[1], qfY[i] + hh / 2, xr[2] + slotW, sfY[i >> 1] + hh / 2);
    }
    for (let i = 0; i < 2; i++) {
      elbow(xl[2] + slotW, sfY[i] + hh / 2, fl, fY + hh / 2);
      elbow(xr[2], sfY[i] + hh / 2, fr + slotW, fY + hh / 2);
    }
    drawTrophy(ctx, w / 2, 218, 0.82);
    label(ctx, '결승 · FINAL', w / 2, 298, 22, Gold, 5);
  }, { class: 'fill' });

  const out = [lines];
  ['16강', '8강', '4강'].forEach((txt, i) => {
    for (const x of [xl[i], xr[i]]) out.push(div({ class: 'abs', style: { left: x, top: 102, width: slotW, textAlign: 'center' } }, Txt(txt, 15, 'rgba(255,255,255,0.85)')));
  });
  const r16 = wc.ko[0];
  for (let i = 0; i < 8; i++) {
    const x = i < 4 ? xl[0] : xr[0];
    const yi = (i % 4) * 2;
    const f = r16?.[i];
    if (!f) {
      out.push(Slot(x, r16Y[yi], slotW, { code: `${placeholders[i * 2][0]}조 ${placeholders[i * 2][1]}위`, state: 3 }));
      out.push(Slot(x, r16Y[yi + 1], slotW, { code: `${placeholders[i * 2 + 1][0]}조 ${placeholders[i * 2 + 1][1]}위`, state: 3 }));
    } else {
      const [a, b] = slotsOf(wc, f);
      out.push(Slot(x, r16Y[yi], slotW, a), Slot(x, r16Y[yi + 1], slotW, b));
    }
  }
  for (let j = 0; j < 4; j++) {
    const [a, b] = slotsOf(wc, wc.ko[1]?.[j]);
    const x = j < 2 ? xl[1] : xr[1];
    const k = (j % 2) * 2;
    out.push(Slot(x, qfY[k], slotW, a), Slot(x, qfY[k + 1], slotW, b));
  }
  for (let j = 0; j < 2; j++) {
    const [a, b] = slotsOf(wc, wc.ko[2]?.[j]);
    const x = j === 0 ? xl[2] : xr[2];
    out.push(Slot(x, sfY[0], slotW, a), Slot(x, sfY[1], slotW, b));
  }
  const [fa, fb] = slotsOf(wc, wc.ko[3]?.[0]);
  out.push(Slot(fl, fY, slotW, fa), Slot(fr, fY, slotW, fb));
  return div({ class: 'fill' }, out);
}

function Slot(x, y, width, d) {
  const bg = d.state === 1 ? css(0xfffff3a6) : d.state === 2 ? css(0xffd9d3ee) : d.state === 3 ? 'rgba(255,255,255,0.2)' : '#fff';
  const border = d.state === 1 ? css(0xffffb627) : d.state === 3 ? 'rgba(255,255,255,0.7)' : css(INK);
  return div({ class: 'abs row', style: { left: x, top: y, width, height: 34, borderRadius: 999, background: bg, border: `3px solid ${border}`, padding: '0 4px 0 8px', opacity: d.state === 2 ? 0.75 : 1 } },
    d.state === 3 ? div({ style: { width: '100%', textAlign: 'center' } }, Txt(d.code, 14, WHITE))
      : [Txt(d.flag, 17), space(4), div({ style: { flex: 1, minWidth: 0 } }, Txt(d.code, 15)),
        div({ class: 'center', style: { width: 26, height: 24, background: css(INK), borderRadius: 12, flex: 'none' } }, Txt(d.score, 13, WHITE))]);
}

export { h };
