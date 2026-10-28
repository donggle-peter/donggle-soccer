import { div, row, col, space, Txt, OTxt, TextButton, Panel, TopBar, Canvas, DotsBackground, showToast, GoldG, WhiteG, Gold } from './kit.js';
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
  const body = events.length === 0
    ? col({ alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8 },
      Canvas(200, 150, (ctx, t, vw, vh) => drawMongi(ctx, vw / 2, vh - 8, 1.4, LegendRed, { face: Face.SAD, hat: Hat.BAND }), { anim: true }),
      OTxt('이벤트 없음', 40, WHITE, { strokeWidth: 8 }),
      Txt('새 이벤트가 열리면 여기에 나와요', 17, fade(0.6)))
    : col({ flex: 1, overflowY: 'auto', alignItems: 'center', justifyContent: events.length === 1 ? 'center' : 'flex-start', gap: 16, padding: '16px 0' },
      ...events.map((ev) => EventCard(app, ev, now)));

  const root = div({ class: 'screen' },
    DotsBackground(0xffffe9f2),
    col({ position: 'absolute', inset: 0 }, TopBar('🎁 이벤트 센터', 0xffff7eb0, () => app.go('menu'), store.coins), body));
  if (st.toast) { showToast(root, st.toast); st.toast = null; }
  return root;
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
  return Panel({ w: 860, h: 250, style: { flex: 'none' } },
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
