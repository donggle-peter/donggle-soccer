import { div, row, col, space, Txt, OTxt, TextButton, CandyButton, Panel, TopBar, Canvas, DotsBackground, showToast, GoldG, WhiteG, Gold } from './kit.js';
import { ProgramEmblem, ProgramCard, ProgramGold, ProgramYellow, PROGRAM_BG } from './programArt.js';
import { drawMongi, label, glow, sparkle, Face } from '../game/draw.js';
import { Grade, Pos } from '../data/legends.js';
import { Hat } from '../data/teams.js';
import { activeEvents, remainText, endText } from '../data/events.js';
import { css, INK, WHITE } from '../core.js';
import { Sound } from '../sound.js';

const fade = (a) => css(INK, a);
const LegendRed = 0xffff4f64;
const GkGreen = 0xff5fd068;

/* ───────────────────── 이벤트 센터 ───────────────────── */

export function EventsScreen(app, st) {
  const store = app.store;
  app.onBack = () => app.go('menu');
  // 남은 시간은 1분마다 다시 그린다 (끝나면 저절로 "이벤트 없음")
  st.minute = Math.floor(Date.now() / 60000);
  app.onFrame = () => { if (Math.floor(Date.now() / 60000) !== st.minute) app.render(); };

  const now = Date.now();
  const events = activeEvents(now);
  // 왼쪽에서 고른 이벤트 (끝난 이벤트를 고르고 있었으면 첫 번째로)
  if (!events.some((e) => e.id === st.selId)) st.selId = events[0]?.id;
  const ev = events.find((e) => e.id === st.selId);
  const body = events.length === 0
    ? col({ alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8 },
      Canvas(200, 150, (ctx, t, vw, vh) => drawMongi(ctx, vw / 2, vh - 8, 1.4, LegendRed, { face: Face.SAD, hat: Hat.BAND }), { anim: true }),
      OTxt('이벤트 없음', 40, WHITE, { strokeWidth: 8 }),
      Txt('새 이벤트가 열리면 여기에 나와요', 17, fade(0.6)))
    : row({ flex: 1, minHeight: 0, alignItems: 'center', gap: 20 },
      col({ gap: 12, paddingLeft: 24, flex: 'none' }, events.map((e) => EventTab(app, st, e, e === ev))),
      div({ class: 'center', style: { flex: 1, minWidth: 0 } }, ev.kind === 'program' ? ProgramEventCard(app, st, ev, now) : EventCard(app, ev, now)));

  const root = div({ class: 'screen' },
    DotsBackground(0xffffe9f2),
    col({ position: 'absolute', inset: 0 }, TopBar('🎁 이벤트 센터', 0xffff7eb0, () => app.go('menu'), store.coins), body));
  if (st.toast) { showToast(root, st.toast); st.toast = null; }
  return root;
}

/** 왼쪽 이벤트 버튼 */
function EventTab(app, st, ev, on) {
  const store = app.store;
  const state = store.eventState(ev);
  const program = ev.kind === 'program';
  const icon = program ? ProgramEmblem(ev.program, 46) : Txt('🎁', 28);
  const sub = program ? `${ev.needMatches}경기 · 프로그램 선수` : `경기 ${ev.needMatches}번 · ${ev.legend.short} ${ev.evo}진`;
  const badge = state === 'ready' ? '받기!' : state === 'progress' ? 'NEW' : null;
  return div({ style: { position: 'relative' } },
    CandyButton(() => { st.selId = ev.id; st.pick = null; app.render(); }, on ? GoldG : WhiteG, { w: 230, h: 92, radius: 22 },
      row({ width: '100%', height: '100%', padding: '0 12px', gap: 10 },
        div({ class: 'center', style: { width: 50, height: 50, background: '#fff', borderRadius: '50%', border: `3px solid ${css(INK)}`, flex: 'none', overflow: 'hidden' } }, icon),
        col({ flex: 1 }, Txt(ev.title, ev.title.length > 6 ? 17 : 20), Txt(sub, 12, fade(0.65))))),
    badge ? div({ class: 'badge' }, badge) : null);
}

/** 프로그램 이벤트: 이벤트가 열린 뒤 needMatches 경기마다 프로그램 선수 1명 골라 받기 */
function ProgramEventCard(app, st, ev, now) {
  const store = app.store;
  const need = ev.needMatches;
  const count = store.eventCount(ev);
  const left = store.programPicksLeft(ev);
  const players = ev.program.players;
  const allOwned = players.every((l) => store.ownedLegends.has(l.id));
  const shown = left > 0 ? need : count % need; // 받을 게 남았으면 막대를 꽉 채워 보여 준다
  const picked = players.find((l) => l.id === st.pick && !store.ownedLegends.has(l.id));
  const claim = () => {
    if (!picked || !store.claimProgram(ev, picked)) return;
    Sound.babam();
    st.pick = null;
    app.route.st.toast = `🎉 ${ev.program.name} ${picked.name} 영입! 나의 팀에서 넣어 보세요`;
  };
  const head = left > 0 ? `경기 ${need} / ${need} ✓ 달성! 선수 ${left}명을 골라요` : allOwned ? '8명을 모두 받았어요!' : `경기 ${shown} / ${need}`;
  const btn = allOwned ? TextButton('✓ 모두 받음', null, WhiteG, 230, 54, 20, { enabled: false })
    : left <= 0 ? TextButton('🔒 받기', null, WhiteG, 200, 54, 20, { enabled: false })
      : picked ? TextButton(`🎁 ${picked.short} 받기`, claim, GoldG, 230, 54, 19)
        : TextButton('👆 위에서 선수 고르기', null, WhiteG, 230, 54, 17, { enabled: false });
  return Panel({ w: 760, h: 410, style: { flex: 'none' }, bodyStyle: { background: PROGRAM_BG } },
    col({ height: '100%', padding: '14px 20px', position: 'relative', gap: 6 },
      div({ class: 'abs', style: { right: 16, top: 14, background: css(ProgramGold), borderRadius: 14, padding: '3px 12px', border: `2.5px solid ${css(INK)}` } },
        Txt(`⏰ 남은 시간 ${remainText(ev.end - now)}`, 15, INK)),
      row({ gap: 12 }, ProgramEmblem(ev.program, 64),
        col({}, OTxt(ev.title, 32, ProgramYellow, { strokeWidth: 6 }),
          Txt(`이벤트가 열린 뒤 ${need}경기를 할 때마다 프로그램 선수 1명을 골라 받아요!`, 15, 'rgba(255,255,255,0.85)'),
          Txt(`오버롤 ${ev.program.ovr} · 진화 없음 · ${endText(ev.end)}까지 · 끝나면 이적시장에서 판매`, 13, 'rgba(255,255,255,0.6)'))),
      div({ style: { display: 'grid', gridTemplateColumns: `repeat(${players.length}, 1fr)`, gap: 6, marginTop: 4 } },
        players.map((l) => {
          const owned = store.ownedLegends.has(l.id);
          return ProgramCard(l, {
            mini: true, h: 132, selected: picked === l, dim: owned, check: owned ? '✅' : null,
            onClick: owned || left <= 0 ? null : () => { st.pick = l.id; app.render(); },
          });
        })),
      div({ style: { flex: 1 } }),
      row({ gap: 14 },
        col({ flex: 1 },
          Txt(head, 16, left > 0 || allOwned ? 0xff7dff8a : 'rgba(255,255,255,0.85)'),
          div({ style: { height: 16, marginTop: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 8, border: `2.5px solid ${css(ProgramGold)}`, overflow: 'hidden' } },
            div({ style: { width: `${(allOwned ? 1 : shown / need) * 100}%`, height: '100%', background: 'linear-gradient(90deg,#ffe066,#ff5a1f)' } }))),
        btn)));
}

function RewardFigure(l, evo) {
  const god = l.grade === Grade.GOD;
  return Canvas(150, 150, (ctx, t, vw, vh) => {
    const cx = vw / 2, base = vh - 10;
    glow(ctx, cx, base - 40, 70, 'rgba(255,246,176,0.85)');
    const hop = Math.abs(Math.sin(t * 2.5)) * 3;
    drawMongi(ctx, cx, base, 1.35, l.pos === Pos.GK ? GkGreen : LegendRed, { gloves: l.pos === Pos.GK, hat: l.grade.hat, golden: god, hop });
    label(ctx, String(l.num), cx, base - 11 - hop * 1.35, 15, WHITE, 3);
    sparkle(ctx, cx + 52, base - 86, 0.8 + Math.sin(t * 3) * 0.1, 0xfffff6a0);
    sparkle(ctx, cx - 56, base - 50, 0.55);
  }, { anim: true, style: { flex: 'none' } });
}

function EventCard(app, ev, now) {
  const store = app.store;
  const l = ev.legend;
  const state = store.eventState(ev);
  const done = state !== 'progress';
  const played = Math.min(store.matches, ev.needMatches);
  const claim = () => {
    if (!store.claimEvent(ev)) return;
    Sound.babam();
    app.route.st.toast = `🎉 ${l.name} ${ev.evo}진을 받았어요! 나의 팀에서 넣어 보세요`;
  };
  const btn = state === 'claimed'
    ? TextButton('✓ 수령 완료', null, WhiteG, 200, 54, 20, { enabled: false })
    : state === 'ready' ? TextButton('🎁 수령', claim, GoldG, 200, 54, 22)
      : TextButton('🔒 수령', null, WhiteG, 200, 54, 22, { enabled: false });
  return Panel({ w: 760, h: 250, style: { flex: 'none' } },
    row({ height: '100%', alignItems: 'stretch' },
      div({ class: 'center', style: { width: 200, background: `linear-gradient(${css(0xfffff3a0)}, ${css(0xffffc93c)})`, borderRight: `4px solid ${css(INK)}`, flexDirection: 'column' } },
        RewardFigure(l, ev.evo), OTxt(`+${ev.evo}진`, 26, Gold, { strokeWidth: 6 })),
      col({ flex: 1, padding: '16px 22px', position: 'relative' },
        div({ class: 'abs', style: { right: 16, top: 14, background: css(INK), borderRadius: 14, padding: '3px 12px' } }, Txt(`⏰ 남은 시간 ${remainText(ev.end - now)}`, 15, WHITE)),
        row({ gap: 8 },
          state !== 'claimed' ? div({ style: { background: css(0xffff4f64), borderRadius: 10, padding: '1px 8px' } }, Txt('NEW', 13, WHITE)) : null,
          Txt(ev.title, 28)),
        space(6),
        Txt(`경기를 딱 ${ev.needMatches}번만 해도`, 18, fade(0.75)),
        row({}, Txt(`⭐ ${l.name} `, 22, 0xff3d6cff), Txt(`${ev.evo}진`, 22, 0xffff4f64), Txt(' 을 드려요!', 22, fade(0.85))),
        Txt(`오버롤 ${l.ovrAt(ev.evo)} · ${l.grade.label} · ${l.pos.label} · ${endText(ev.end)}까지`, 14, fade(0.55)),
        div({ style: { flex: 1 } }),
        row({ gap: 14 },
          col({ flex: 1 },
            Txt(done ? `경기 ${ev.needMatches} / ${ev.needMatches} ✓ 달성!` : `경기 ${played} / ${ev.needMatches}`, 16, done ? 0xff2bb24c : fade(0.7)),
            div({ style: { height: 14, marginTop: 4, background: css(0xffeee8fa), borderRadius: 7, border: `2.5px solid ${css(INK)}`, overflow: 'hidden' } },
              div({ style: { width: `${(played / ev.needMatches) * 100}%`, height: '100%', background: css(0xff5fd068) } }))),
          btn))));
}
