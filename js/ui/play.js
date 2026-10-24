import { h, div, row, col, space, Txt, OTxt, TextButton, Panel, Stars, TopBar, Canvas, DotsBackground, NightBackground,
  GoldG, BlueG, GreenG, WhiteG, Gold } from './kit.js';
import { drawMongi, label, Face } from '../game/draw.js';
import { Teams } from '../data/teams.js';
import { css, INK, WHITE } from '../core.js';
import { matchSetup, startMatch } from '../app.js';

const fade = (a) => css(INK, a);

/* ───────────────────── 매치 & 플레이 ───────────────────── */

export function PlayScreen(app) {
  const store = app.store;
  app.onBack = () => app.go('menu');
  const wc = store.worldCup, lg = store.league;
  const wcState = !wc ? '나라를 골라 출전해요' : wc.finished ? '대회 종료 · 새 월드컵에 도전!' : `진행 중 ${Teams.get(wc.myTeam).emoji} ${wc.stageName()}`;
  const lgState = !lg ? '리그와 구단을 골라요' : lg.finished ? `시즌 종료 · ${lg.myRank()}위`
    : `${Teams.get(lg.myClub).emoji} ${Teams.get(lg.myClub).name} · ${lg.round + 1}R · ${lg.myRank()}위`;
  const card = (icon, title, sub, state, band, button, onClick) => Panel({ flex: 1, style: { height: '100%' } },
    col({ height: '100%', alignItems: 'center' },
      div({ class: 'center', style: { width: '100%', height: 170, flex: 'none', position: 'relative', background: `linear-gradient(${band.map((c) => css(c)).join(',')})` } },
        div({ class: 'abs', style: { left: 0, right: 0, bottom: 0, height: 4, background: css(INK) } }),
        Txt(icon, 92)),
      space(10),
      Txt(title, 34),
      Txt(sub, 15, fade(0.6), { align: 'center' }),
      space(12),
      div({ class: 'center', style: { alignSelf: 'stretch', margin: '0 24px', background: css(0xfffff8d6), borderRadius: 14, border: `2.5px solid ${css(0xffffb627)}`, padding: '6px 0' } }, Txt(state, 16)),
      div({ style: { flex: 1 } }),
      TextButton('▶ 시작', onClick, button, 240, 56, 24),
      space(14)));
  return div({ class: 'screen' },
    DotsBackground(0xffd8f6cf),
    col({ position: 'absolute', inset: 0 },
      TopBar('⚽ 매치 & 플레이', 0xff5fd068, () => app.go('menu'), store.coins),
      row({ flex: 1, padding: 20, gap: 20, alignItems: 'stretch' },
        card('🏆', '월드컵 모드', '32개국 · 조별리그 → 토너먼트 → 결승', wcState, [0xfffff3a0, 0xffffc93c], GoldG, () => app.go('worldcup')),
        card('🏟️', '리그 모드', '8개국 리그 · 10팀 · 18라운드 시즌', lgState, [0xffcfe9ff, 0xff55a8ff], BlueG, () => app.go('league')),
        card('⚽', '빠른 경기', '바로 한 판! · 2분 30초 친선 경기', '아무 나라나 골라서 바로!', [0xffdff7d4, 0xff5fd068], GreenG, () => app.go('quick')))));
}

/* ───────────────────── 나라 타일 (월드컵/빠른 경기 공용) ───────────────────── */

export function CountryTile(team, selected, tag, onClick) {
  return div({ style: { position: 'relative', cursor: 'pointer' }, onClick },
    Panel({ h: 116, radius: 20, color: selected ? 0xfffff3a6 : 0xffffffff, border: selected ? 0xffffb627 : INK },
      col({ height: '100%', paddingTop: 8, alignItems: 'center' }, Txt(team.emoji, 36), Txt(team.name, 17), Stars(team.rating, 12))),
    tag ? div({ class: 'abs', style: { right: 6, top: 6, background: css(tag === '나' ? 0xffff4f64 : 0xff4f8cff), borderRadius: 10, border: `2.5px solid ${css(INK)}`, padding: '1px 8px' } },
      Txt(tag, 13, WHITE)) : null);
}

export function grid(min, gap, rgap, items, style = {}) {
  return div({ style: { display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, columnGap: gap, rowGap: rgap, ...style } }, items);
}

/* ───────────────────── 빠른 경기 ───────────────────── */

export function QuickScreen(app, st) {
  const store = app.store;
  app.onBack = () => app.go('play');
  const pickRandom = (not) => { const c = Teams.countries.filter((t) => t.id !== not); return c[Math.floor(Math.random() * c.length)].id; };
  st.mine ??= 'KOR';
  st.opp ??= pickRandom('KOR');
  st.picking ??= 1;
  const set = (f) => { f(); app.render(); };
  const pick = (title, team, active, onClick) => div({ style: { width: '100%', cursor: 'pointer' }, onClick },
    Panel({ h: 130, color: active ? 0xfffff3a6 : 0xffffffff, border: active ? 0xffffb627 : INK },
      row({ height: '100%', padding: '0 18px' }, Txt(team.emoji, 52), space(14), col({}, Txt(title, 15, fade(0.6)), Txt(team.name, 26), Stars(team.rating)))));
  const tiles = Teams.countries.map((t) => CountryTile(t, t.id === (st.picking === 0 ? st.mine : st.opp), t.id === st.mine ? '나' : t.id === st.opp ? '상대' : null, () => set(() => {
    if (st.picking === 0) { st.mine = t.id; if (st.opp === st.mine) st.opp = Teams.countries.find((c) => c.id !== st.mine).id; }
    else if (t.id !== st.mine) st.opp = t.id;
  })));
  return div({ class: 'screen' },
    DotsBackground(0xffddf6cf),
    col({ position: 'absolute', inset: 0 },
      TopBar('⚽ 빠른 경기', 0xff5fd068, () => app.go('play'), store.coins),
      row({ flex: 1, minHeight: 0, padding: 16, gap: 16, alignItems: 'stretch' },
        col({ width: 300, alignItems: 'center' },
          pick('우리 팀', Teams.get(st.mine), st.picking === 0, () => set(() => (st.picking = 0))),
          OTxt('VS', 34, 0xffff4f64, { strokeWidth: 6 }),
          pick('상대 팀', Teams.get(st.opp), st.picking === 1, () => set(() => (st.picking = 1))),
          div({ style: { flex: 1 } }),
          row({ gap: 10 },
            TextButton('🎲 랜덤', () => set(() => (st.opp = pickRandom(st.mine))), WhiteG, 110, 52, 18),
            TextButton('▶ 경기 시작', () => startMatch(matchSetup(Teams.get(st.mine), Teams.get(st.opp), '친선 경기', false), 'quick'), GreenG, 180, 52, 22))),
        col({ flex: 1, minWidth: 0 },
          Txt(st.picking === 0 ? '👉 우리 팀을 골라요' : '👉 상대 팀을 골라요', 20),
          space(8),
          div({ class: 'scroll', 'data-scroll': 'grid', style: { flex: 1 } }, grid(112, 10, 6, tiles, { paddingBottom: 12 }))))));
}

/* ───────────────────── 결과 ───────────────────── */

export function ResultScreen(app, st, { info, kind }) {
  const back = () => app.go(kind === 'worldcup' ? 'worldcup' : kind === 'league' ? 'league' : 'quick');
  app.onBack = back;
  const o = info.outcome;
  const r = o.homeResult;
  const setup = info.setup;
  const figures = Canvas('100%', '100%', (ctx, t, vw, vh) => {
    const squad = setup.squads[0];
    [0.09, 0.2, 0.8, 0.91].forEach((x, i) => {
      const m = squad[i + 1];
      const hop = r > 0 ? Math.abs(Math.sin(t * 8 + i)) * 30 : 0;
      const face = r > 0 ? Face.SHOUT : r < 0 ? Face.SAD : Face.HAPPY;
      drawMongi(ctx, vw * x, vh - 40, 1.9, setup.kit(0), { face, flip: i >= 2, hop: hop / 1.9, hat: m.hat, golden: m.golden });
      label(ctx, String(m.num), vw * x, vh - 40 - 8 * 1.9 - hop, 22, WHITE, 5);
    });
  }, { class: 'fill', anim: true });
  const title = info.forfeit ? '기권패' : r > 0 ? '승리!' : r === 0 ? '무승부' : '패배...';
  const side = (t) => col({ width: 170, alignItems: 'center' }, Txt(t.emoji, 40), Txt(t.name, 20));
  return div({ class: 'screen' },
    r > 0 ? NightBackground() : DotsBackground(r === 0 ? 0xffd6f2ff : 0xffe3def2),
    figures,
    div({ class: 'fill center' },
      Panel({ w: 600, h: 430 },
        col({ height: '100%', padding: 18, alignItems: 'center' },
          OTxt(title, 64, r > 0 ? Gold : r === 0 ? 0xff9fd8ff : 0xffd9d3ee, { strokeWidth: 10 }),
          Txt(setup.title, 16, fade(0.6)),
          space(8),
          row({}, side(setup.home),
            div({ style: { background: css(INK), borderRadius: 18, padding: '4px 22px' } }, Txt(`${o.home} : ${o.away}`, 44, WHITE)),
            side(setup.away)),
          o.hadPk ? [space(4), Txt(`승부차기 ${o.pkHome} : ${o.pkAway}`, 20, 0xffff4f64)] : null,
          space(8),
          info.lines.map((l) => Txt(l, 22, 0xff6b4bd6)),
          div({ style: { flex: 1 } }),
          info.coins > 0 ? Txt(`🪙 +${info.coins} 코인`, 24, 0xffe08a00) : null,
          info.detail ? Txt(info.detail, 14, fade(0.6)) : null,
          space(6),
          TextButton('계속 ▶', back, GreenG, 240, 56, 24)))));
}
