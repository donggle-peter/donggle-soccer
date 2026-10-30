import { h, div, row, col, space, Txt, TextButton, CandyButton, Panel, TopBar, Canvas, DotsBackground, showToast, GoldG, WhiteG, Gold } from './kit.js';
import { drawMongi, label, glow } from '../game/draw.js';
import { Formation, Formations, Grade, Legends, Pos } from '../data/legends.js';
import { Roster } from '../data/teams.js';
import { CAPTAIN_BONUS } from '../data/store.js';
import { css, INK, WHITE } from '../core.js';

const fade = (a) => css(INK, a);
const TeamBlue = 0xff55a8ff;
const TeamRed = 0xffff4f64;
const TeamGk = 0xff5fd068;
const BaseGray = 0xffd6d0ea;
const GRASS_A = 0xff7bd36b;
const GRASS_B = 0xff6cc65e;

const posColor = (p) => ({ GK: 0xffffc93c, DF: 0xff6ab8ff, MF: 0xff6ee7a8, FW: 0xffff7eb0 })[p.name];
const nameIn = (store, slot) => store.legendIn(slot)?.short ?? store.player(slot).name;

/**
 * 화면에 보여 줄 자리 위치 (경기장 가로 비율, 세로 0~1). 경기 속 위치와 모양은 같지만
 * 선수 칸(이름표·오버롤)이 서로 겹치지 않게 더 넓게 벌려 놓는다.
 */
const boardPos = {
  F22: [[0.09, 0.5], [0.37, 0.22], [0.37, 0.78], [0.76, 0.22], [0.76, 0.78]],
  F31: [[0.09, 0.5], [0.3, 0.18], [0.3, 0.82], [0.82, 0.5], [0.53, 0.5]],
  F13: [[0.09, 0.5], [0.4, 0.5], [0.8, 0.1], [0.8, 0.5], [0.8, 0.9]],
  F121: [[0.09, 0.5], [0.3, 0.5], [0.55, 0.14], [0.86, 0.5], [0.55, 0.86]],
};

/** 나의 팀: 포메이션 · 라인업 · 주장 */
export function MyTeamScreen(app, st) {
  const store = app.store;
  app.onBack = () => app.go('menu');
  st.sel ??= 3;
  const sel = st.sel;
  const form = store.formation;
  const root = div({ class: 'screen' });
  const msg = (m) => showToast(root, m);
  const name = nameIn(store, sel);

  const formRow = row({ gap: 8 },
    Formations.map((f) => CandyButton(() => {
      if (f !== form) {
        const benched = store.changeFormation(f);
        msg(`${f.label} ${f.sub} 포메이션!` + (benched > 0 ? ` ${benched}명은 설 자리가 없어 벤치로` : ''));
      }
    }, f === form ? GoldG : WhiteG, { flex: 1, h: 60, radius: 18 },
    col({ alignItems: 'center' }, Txt(f.label, 21), Txt(f.sub, 12, fade(0.6))))),
    Panel({ w: 112, h: 60, radius: 18 },
      col({ height: '100%', alignItems: 'center', justifyContent: 'center' }, Txt('팀 오버롤', 12, fade(0.6)), Txt(String(store.teamOvr), 26))));

  root.append(
    DotsBackground(0xffdff0ff),
    col({ position: 'absolute', inset: 0 },
      TopBar('👥 나의 팀 · 동글 FC', TeamBlue, () => app.go('menu'), store.coins),
      row({ flex: 1, minHeight: 0, padding: 12, gap: 12, alignItems: 'stretch' },
        col({ flex: 1, minWidth: 0 },
          formRow,
          space(4),
          Pitch(app, st),
          div({ style: { paddingLeft: 6 } }, Txt(`선수를 누르고 오른쪽에서 골라 넣어요 · 주장이 있으면 팀 전체 오버롤 +${CAPTAIN_BONUS}`, 13, fade(0.6)))),
        col({ width: 430 },
          Candidates(app, st, msg),
          row({ gap: 8 },
            TextButton('✨ 자동 배치', () => {
              const before = store.teamOvr;
              store.autoLineup();
              msg(store.teamOvr > before ? `✨ 가장 센 선수들로! 팀 오버롤 ${before} → ${store.teamOvr}` : '✨ 지금이 가장 센 라인업이에요');
            }, WhiteG, 150, 40, 16),
            TextButton(store.captain === sel ? `🎖️ ${name} 주장` : `🎖️ ${name} 주장으로`, () => { store.makeCaptain(sel); msg(`🎖️ ${name} 주장! 팀 전체 오버롤 +${CAPTAIN_BONUS}`); }, GoldG, 272, 40, 16))))));
  return root;
}

/** 위에서 본 경기장 (오른쪽이 상대 골대) 위에 자리 5개 */
function Pitch(app, st) {
  const store = app.store;
  const form = store.formation;
  const field = Canvas('100%', '100%', (ctx, t, vw, vh) => {
    ctx.fillStyle = css(GRASS_A); ctx.fillRect(0, 0, vw, vh);
    ctx.fillStyle = css(GRASS_B);
    for (let i = 1; i < 10; i += 2) ctx.fillRect((vw * i) / 10, 0, vw / 10, vh);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3.5;
    const m = 12;
    ctx.strokeRect(m, m, vw - 2 * m, vh - 2 * m);
    ctx.beginPath(); ctx.moveTo(vw / 2, m); ctx.lineTo(vw / 2, vh - m); ctx.stroke();
    ctx.beginPath(); ctx.arc(vw / 2, vh / 2, vh * 0.14, 0, Math.PI * 2); ctx.stroke();
    const bw = vw * 0.12, bh = vh * 0.46;
    ctx.strokeRect(m, (vh - bh) / 2, bw, bh);
    ctx.strokeRect(vw - m - bw, (vh - bh) / 2, bw, bh);
    label(ctx, '→', vw - 34, vh / 2, 24, 0xccffffff);
  }, { class: 'fill' });
  const slots = [0, 1, 2, 3, 4].map((slot) => {
    const [fx, fy] = boardPos[form.name][slot];
    return div({ class: 'abs', style: { left: `calc(${fx * 100}% - 58px)`, top: `calc(${0.1 + fy * 0.8} * (100% - 7px) - 62px)`, width: 116, height: 124 } },
      SlotView(app, slot, slot === st.sel, () => { st.sel = slot; app.render(); }));
  });
  return div({ style: { position: 'relative', flex: 1, minHeight: 0 } },
    Panel({ color: GRASS_A, radius: 22, style: { position: 'absolute', inset: 0 } }, field),
    slots);
}

function SlotView(app, slot, selected, onClick) {
  const store = app.store;
  const l = store.legendIn(slot);
  const p = store.player(slot);
  const role = store.formation.roles[slot];
  const ovr = store.ovrIn(slot);
  const fig = Canvas('100%', 92, (ctx, t, vw, vh) => {
    const cx = vw / 2, base = vh - 4;
    if (l && l.grade.glow) glow(ctx, cx, base - 32, 46, 'rgba(255,246,176,0.67)');
    drawMongi(ctx, cx, base, 0.86, slot === 0 ? TeamGk : TeamRed, { gloves: slot === 0, ...(l ? l.look : { hat: p.hat }) });
    label(ctx, String(l ? l.num : p.num), cx, base - 7, 10, WHITE, 2.2);
  }, { style: { position: 'absolute', left: 0, top: 8, width: '100%' } });
  return div({ style: { position: 'relative', width: '100%', height: '100%', cursor: 'pointer' }, onClick },
    selected ? div({ class: 'abs', style: { left: 2, right: 2, top: 2, height: 104, background: 'rgba(255,255,255,0.35)', borderRadius: 22, border: `4px solid ${css(TeamRed)}` } }) : null,
    fig,
    div({ class: 'abs', style: { left: 2, top: 4, background: css(l ? l.grade.color : BaseGray), borderRadius: 12, border: `3px solid ${css(INK)}`, padding: '0 6px' } }, Txt(String(ovr), 16)),
    div({ class: 'abs', style: { right: 2, top: 4, background: css(posColor(role)), borderRadius: 10, border: `2.5px solid ${css(INK)}`, padding: '0 5px' } }, Txt(role.name, 14)),
    div({ class: 'abs', style: { left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center' } },
      row({ background: '#fff', borderRadius: 14, border: `2.5px solid ${css(INK)}`, padding: '0 7px' },
        Txt((l && l.grade.glow ? '⭐' : '') + (l ? l.short : p.name), 14),
        store.captain === slot ? [space(4), div({ class: 'center', style: { width: 18, height: 18, background: css(Gold), borderRadius: '50%', border: `2px solid ${css(INK)}` } }, Txt('C', 12))] : null)));
}

/** 오른쪽: 고른 자리에 넣을 수 있는 선수 목록 */
function Candidates(app, st, msg) {
  const store = app.store;
  const slot = st.sel;
  const role = store.formation.roles[slot];
  const cur = store.ovrIn(slot);
  const current = store.legendIn(slot);
  if (st.filterSlot !== slot) { st.filterSlot = slot; st.filter = null; }
  const legends = [...store.ownedLegends].map((id) => Legends.get(id))
    .filter((l) => store.formation.accepts(slot, l.pos) && (st.filter == null || l.pos === st.filter))
    .sort((a, b) => b.ovrAt(store.evoOf(b)) - a.ovrAt(store.evoOf(a)));
  const chip = (text, on, f) => div({ class: 'center', style: { height: 32, padding: '0 10px', borderRadius: 999, cursor: 'pointer', background: css(on ? Gold : WHITE), border: `3px solid ${css(INK)}` },
    onClick: () => { st.filter = f; app.render(); } }, Txt(text, 14));
  const p = store.player(slot);
  const rows = [
    CandidateRow({ hat: p.hat, gk: slot === 0, ovr: Roster.BASE_OVR, gradeColor: BaseGray, name: p.name, sub: '기본 선수', playing: current == null, delta: Roster.BASE_OVR - cur },
      () => { store.clearSlot(slot); msg(`${p.name} 출전!`); }),
    ...legends.map((l) => {
      const ovr = l.ovrAt(store.evoOf(l));
      const other = store.slotOf(l.id);
      return CandidateRow({
        ...l.look, glow: l.grade.glow, gk: l.pos === Pos.GK, ovr, gradeColor: l.grade.color, name: l.short,
        sub: l.pos.name + (l.program ? ` · ⚡ ${l.program.name}` : '') + (other != null && other !== slot ? ` · ${nameIn(store, other)} 자리에서 이동` : ''), playing: other === slot, delta: ovr - cur,
      }, () => { store.assignLegend(l, slot); msg(`⭐ ${l.short} 출전!`); });
    }),
  ];
  if (store.ownedLegends.size === 0) {
    rows.push(col({ alignItems: 'center', paddingTop: 10 }, Txt('아직 영입한 선수가 없어요', 16, fade(0.6)), space(6), TextButton('🔄 이적시장 가기', () => app.go('transfer'), GoldG, 220, 44, 18)));
  } else if (legends.length === 0) rows.push(div({ style: { paddingTop: 10 } }, Txt('이 자리에 설 수 있는 선수가 없어요', 15, fade(0.6))));
  return Panel({ flex: 1 },
    col({ height: '100%', padding: '10px 12px' },
      row({}, Txt('🔁 ', 18), Txt(`${nameIn(store, slot)} (${role.name} · ${current ? current.num : p.num}번)`, 18, TeamRed), Txt(' 자리에 넣을 선수', 18)),
      space(6),
      role !== Pos.GK ? row({ gap: 5 }, chip('전체', st.filter == null, null), chip('⚔️ 공격', st.filter === Pos.FW, Pos.FW), chip('🎯 미드', st.filter === Pos.MF, Pos.MF), chip('🛡️ 수비', st.filter === Pos.DF, Pos.DF)) : null,
      space(6),
      div({ class: 'scroll', 'data-scroll': `cand${slot}`, style: { flex: 1 } }, col({ gap: 6, paddingBottom: 6 }, rows))));
}

function CandidateRow(o, onPick) {
  const fig = Canvas(44, 50, (ctx, t, vw, vh) => drawMongi(ctx, vw / 2, vh - 2, 0.5, o.gk ? TeamGk : TeamRed, { gloves: o.gk, hat: o.hat, golden: o.golden, green: o.green, shadow: false }), { style: { flex: 'none' } });
  return row({ height: 58, flex: 'none', borderRadius: 16, border: `3px solid ${css(INK)}`, padding: '0 8px', background: css(o.playing ? 0xfffff8d6 : WHITE) },
    fig, space(6),
    div({ class: 'center', style: { width: 42, flex: 'none', background: css(o.gradeColor), borderRadius: 10, border: `2.5px solid ${css(INK)}` } }, Txt(String(o.ovr), 17)),
    space(8),
    col({ flex: 1, minWidth: 0 }, Txt((o.glow ? '⭐' : '') + o.name, 18), Txt(o.sub, 11, fade(0.55))),
    o.playing ? Txt('출전 중', 14, fade(0.6))
      : TextButton(o.delta > 0 ? `▲ ${o.delta} 넣기` : o.delta < 0 ? `▼ ${-o.delta} 넣기` : '넣기', onPick, o.delta > 0 ? [0xffb8f59c, 0xff5fd068] : WhiteG, 112, 36, 15));
}

export { h, Formation };
