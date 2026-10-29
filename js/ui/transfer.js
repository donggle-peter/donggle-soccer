import { h, div, row, col, space, Txt, OTxt, TextButton, CandyButton, Panel, TopBar, Canvas, NightBackground, showToast,
  GoldG, GreenG, PinkG, WhiteG, Gold } from './kit.js';
import { TabChip } from './worldcup.js';
import { drawMongi, label, sparkle, glow } from '../game/draw.js';
import { Legends, Grade, Grades, Pos, Evolution, powerOf, SELL_COOLDOWN_MS, Programs, programOf } from '../data/legends.js';
import { ProgramCard, ProgramEmblem, ProgramBackground, ProgramGold, ProgramYellow, PROGRAM_BG } from './programArt.js';
import { Roster } from '../data/teams.js';
import { css, coins, comma, darken, INK, WHITE } from '../core.js';
import { Sound } from '../sound.js';

const fade = (a) => css(INK, a);
const LegendRed = 0xffff4f64;
const GkGreen = 0xff5fd068;
const BaseGray = 0xffd6d0ea;
const PAGE = 60;

/** 정렬 */
const SORTS = [
  ['ovrHigh', '오버롤 높은 순'], ['ovrLow', '오버롤 낮은 순'], ['priceHigh', '가격 높은 순'],
  ['priceLow', '가격 낮은 순'], ['value', '가성비 좋은 순'],
];
const sortLabel = (k) => SORTS.find((x) => x[0] === k)[1];

/** 남은 시간 "2일 5시간" */
function waitText(ms) {
  const hrs = Math.ceil(ms / 3600000);
  const d = Math.floor(hrs / 24), hh = hrs % 24;
  return d > 0 ? `${d}일${hh ? ` ${hh}시간` : ''}` : `${hh}시간`;
}

/** 이적시장: 선수 영입 · 뽑기 · 진화 · 출전 */
export function TransferScreen(app, st, params = {}) {
  const store = app.store;
  app.onBack = () => app.go('menu');
  if (st.init == null) {
    st.init = true;
    st.grade = null; st.ownedOnly = params.startOwned ?? false; st.pos = null; st.sel = 0; st.limit = PAGE;
    /** 몇 진으로 살지 (0 = 진화 안 된 선수) */
    st.evoF = 0;
    st.sort = 'ovrHigh';
    /** 프로그램 (null 이면 기본 선수) · 이름 검색 */
    st.programF = null;
    st.name = '';
  }
  // 보유 선수는 실제 진화 단계, 아니면 필터에서 고른 단계로 보여 준다
  const evo = (l) => (store.ownedLegends.has(l.id) ? store.evoOf(l) : st.evoF);
  // 정렬은 보유 목록에서만 내 진화 단계로. 전체·등급 목록은 내가 산(진화한) 선수도 원래 자리에
  const sortEvo = (l) => (st.ownedOnly ? evo(l) : st.evoF);
  const key = {
    ovrHigh: (l) => -l.ovrAt(sortEvo(l)),
    ovrLow: (l) => l.ovrAt(sortEvo(l)),
    value: (l) => -powerOf(l.ovrAt(sortEvo(l))) / l.priceAt(sortEvo(l)),
    priceLow: (l) => l.priceAt(sortEvo(l)),
    priceHigh: (l) => -l.priceAt(sortEvo(l)),
  }[st.sort];
  // 프로그램을 고르면 그 프로그램 선수, 보유 목록은 기본 + 프로그램 선수, 나머지는 기본 선수
  const pool = st.programF ? programOf(st.programF).players : st.ownedOnly ? [...Legends.all, ...Legends.programs] : Legends.all;
  const q = st.name.replace(/\s+/g, '');
  const list = pool
    .filter((l) => (st.grade == null || l.grade === st.grade) && (!st.ownedOnly || store.ownedLegends.has(l.id)) && (st.pos == null || l.pos === st.pos)
      && (!q || l.name.replace(/\s+/g, '').includes(q) || l.short.includes(q)))
    .map((l) => [key(l), l])
    .sort((a, b) => a[0] - b[0] || b[1].ovrAt(sortEvo(b[1])) - a[1].ovrAt(sortEvo(a[1])) || a[1].id - b[1].id)
    .map((x) => x[1]);
  // 프로그램 목록을 보는데 오른쪽이 다른 선수면 첫 프로그램 선수로
  if (st.programF && !Legends.get(st.sel)?.program && list.length) st.sel = list[0].id;
  const defaultsFirst = st.sort === 'ovrLow' || st.sort === 'priceLow';
  // 보유 목록에는 기본 동글이들도 (sel 이 음수면 기본 선수: -(자리 + 1))
  const mine = st.ownedOnly && !q ? store.roster.filter((p) => st.pos == null || store.formation.roles[p.slot] === st.pos) : [];
  const setFilter = (f) => { f(); st.limit = PAGE; if (st.scroll) st.scroll.cards = 0; app.render(); };
  const root = div({ class: 'screen' });
  const msg = (m) => showToast(root, m);

  const counts = new Map(Grades.map((g) => [g, Legends.byGrade.get(g).length]));
  // 왼쪽 목록 (전체 아래에 ⚡ 프로그램. 버튼이 많아서 조금 낮게)
  const BH = 27;
  const plain = !st.programF && !st.ownedOnly;
  const left = col({ width: 210, gap: 3 },
    TextButton(`전체 ${comma(Legends.TOTAL)}`, () => setFilter(() => { st.grade = null; st.ownedOnly = false; st.programF = null; }), plain && st.grade == null ? GoldG : WhiteG, 210, BH, 15),
    TextButton(`⚡ 프로그램 ${Legends.programs.length}`, () => setFilter(() => { st.grade = null; st.ownedOnly = false; st.programF = Programs[0].id; }), st.programF && !st.ownedOnly ? GoldG : [0xffffd9b0, 0xffff9a4a], 210, BH, 15),
    [...Grades].reverse().map((g) => TextButton(`${g.label} ${comma(counts.get(g))}`, () => setFilter(() => { st.grade = g; st.ownedOnly = false; st.programF = null; }), plain && st.grade === g ? GoldG : WhiteG, 210, BH, 15)),
    TextButton(`✅ 보유 ${store.ownedLegends.size + store.roster.length}`, () => setFilter(() => { st.ownedOnly = true; st.grade = null; st.programF = null; }), st.ownedOnly ? GoldG : WhiteG, 210, BH, 15),
    space(5),
    // 검색: 이름 · 프로그램 · 포지션 · 진 · 정렬 (누르면 검색 창)
    CandyButton(() => { st.draft = { name: st.name, programF: st.programF, pos: st.pos, evoF: st.evoF, sort: st.sort }; app.render(); },
      st.name || st.evoF > 0 || st.sort !== 'ovrHigh' ? GoldG : WhiteG, { w: '100%', h: 50, radius: 18 },
      col({ alignItems: 'center' }, Txt('🔍 검색', 17), Txt(searchSummary(st), 12, fade(0.75)))),
    div({ style: { flex: 1 } }),
    CandyButton(() => {
      const r = store.drawLegend();
      if (!r) { msg(`코인이 부족해요! (${coins(Legends.GACHA_PRICE)})`); return; }
      Sound.babam();
      st.sel = r[0].id;
      st.drawn = r;
    }, PinkG, { w: '100%', h: 54 },
    col({ alignItems: 'center' }, Txt(`🎴 선수 뽑기 ${coins(Legends.GACHA_PRICE)}`, 17), Txt('전설의 신 0.3% · 슈퍼 1.7% · 레전드 6%', 11, fade(0.7)))));

  const all = [];
  const defaults = mine.map((p) => DefaultCard(app, p, st.sel === -(p.slot + 1), () => { st.sel = -(p.slot + 1); app.render(); }));
  if (defaultsFirst) all.push(...defaults);
  list.slice(0, st.limit).forEach((l) => {
    const pick = () => { st.sel = l.id; app.render(); };
    all.push(l.program ? ProgramPlayerCard(app, l, l.id === st.sel, pick) : PlayerCard(app, l, l.id === st.sel, pick, evo(l)));
  });
  if (!defaultsFirst && st.limit >= list.length) all.push(...defaults);

  const cards = div({ class: 'scroll', 'data-scroll': 'cards', style: { flex: 1 } },
    list.length === 0 && mine.length === 0 ? div({ class: 'center', style: { height: '100%' } }, Txt(q ? `"${st.name}" 선수가 없어요` : '아직 선수가 없어요', 22, WHITE)) : null,
    div({ style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(146px, 1fr))', columnGap: 8, rowGap: 2, paddingBottom: 10 } }, all));
  // 아래로 내리면 더 보여 준다
  cards.addEventListener('scroll', () => {
    if (st.limit < list.length && cards.scrollTop + cards.clientHeight > cards.scrollHeight - 300) { st.limit += PAGE; (st.scroll ??= {}).cards = cards.scrollTop; app.render(); }
  });

  const center = col({ flex: 1, minWidth: 0 },
    row({ gap: 5 },
      TabChip('전체', st.pos == null, () => setFilter(() => (st.pos = null)), 15, 12),
      TabChip('⚔️ 공격', st.pos === Pos.FW, () => setFilter(() => (st.pos = Pos.FW)), 15, 12),
      TabChip('🎯 미드', st.pos === Pos.MF, () => setFilter(() => (st.pos = Pos.MF)), 15, 12),
      TabChip('🛡️ 수비', st.pos === Pos.DF, () => setFilter(() => (st.pos = Pos.DF)), 15, 12),
      TabChip('🧤 골키퍼', st.pos === Pos.GK, () => setFilter(() => (st.pos = Pos.GK)), 15, 12)),
    space(6),
    cards);

  const selL = st.sel >= 0 ? Legends.get(st.sel) : null;
  const detail = st.sel < 0 ? DefaultDetail(app, store.player(-st.sel - 1), msg) : selL.program ? ProgramDetail(app, st, selL, msg) : PlayerDetail(app, st, selL, msg);

  root.append(
    NightBackground(),
    col({ position: 'absolute', inset: 0 },
      TopBar(`🔄 이적시장 · 선수 ${comma(Legends.TOTAL)}명`, 0xffffb627, () => app.go('menu'), store.coins),
      row({ flex: 1, minHeight: 0, padding: 12, gap: 12, alignItems: 'stretch' }, left, center, detail)));

  if (st.draft) root.append(SearchPanel(app, st, setFilter));
  if (st.draft && st.pickOpen) root.append(ProgramPick(app, st));
  if (st.evoResult) root.append(EvolveResult(app, st));
  if (st.confirmSell != null) root.append(SellConfirm(app, st, msg));

  if (st.drawn) {
    const [l, fresh] = st.drawn;
    const pop = div({ class: 'dim', onClick: () => { st.drawn = null; app.render(); } },
      col({ alignItems: 'center' },
        OTxt('빠빰!', 84, Gold, { strokeWidth: 14 }),
        div({ style: { width: 190, height: 214 } }, PlayerCard(app, l, true, () => {}, 0)),
        space(6),
        OTxt(fresh ? `NEW! ${l.grade.label} 영입!` : `이미 있는 선수 · ${coins(Legends.DUPLICATE_REFUND)} 돌려받음`, 28, WHITE, { strokeWidth: 6 }),
        Txt('화면을 누르면 닫혀요', 15, 'rgba(255,255,255,0.8)')));
    if (!st.drawnShown) {
      st.drawnShown = true;
      pop.firstChild.animate([{ transform: 'scale(0.2)' }, { transform: 'scale(1.12)', offset: 0.55 }, { transform: 'scale(0.96)', offset: 0.8 }, { transform: 'scale(1)' }], { duration: 520, easing: 'ease-out' });
    }
    root.append(pop);
  } else st.drawnShown = false;
  return root;
}

function PlayerFigure(l, scale, height, big = false) {
  const god = l.grade === Grade.GOD;
  return Canvas('100%', height, (ctx, t, vw, vh) => {
    const cx = vw / 2, base = vh - 6;
    if (l.grade.glow) glow(ctx, cx, base - 34 * scale, 52 * scale, 'rgba(255,246,176,0.67)');
    const hop = big ? Math.abs(Math.sin(t * 2.5)) * 3 * scale : 0;
    drawMongi(ctx, cx, base, scale, l.pos === Pos.GK ? GkGreen : LegendRed, { gloves: l.pos === Pos.GK, hop: hop / scale, hat: l.grade.hat, golden: god });
    label(ctx, String(l.num), cx, base - 8 * scale - hop, 11 * scale, WHITE, 2.4 * scale);
    if (god) sparkle(ctx, cx + 40 * scale, base - 60 * scale, 0.5 * scale + Math.sin(t * 3) * 0.1, 0xfffff6a0);
  }, { anim: god || big, style: { flex: 'none' } });
}

function PlayerCard(app, l, selected, onClick, evo) {
  const store = app.store;
  const c = l.grade.color;
  const owned = store.ownedLegends.has(l.id);
  const playing = store.slotOf(l.id) != null;
  return div({ style: { position: 'relative', height: 196, cursor: 'pointer' }, onClick },
    Panel({ radius: 20, border: selected ? Gold : INK, style: { height: '100%' }, bodyStyle: { background: `linear-gradient(${css(c, 0.5)}, rgba(255,255,255,0) 300px), #fff` } },
      col({ height: '100%', alignItems: 'center' },
        space(18),
        PlayerFigure(l, 0.95, 92),
        Txt(l.name, l.name.length > 7 ? 14 : 18, INK, { align: 'center' }),
        Txt(l.grade.label, 12, darken(c, 0.75)),
        playing ? Txt('출전 중', 13, LegendRed) : owned ? Txt(`보유 · 가치 ${coins(l.priceAt(evo))}`, 12, 0xff2bb24c) : Txt(coins(l.priceAt(evo)), 14, 0xffe08a00)),
      col({ position: 'absolute', left: 9, top: 4 }, Txt(String(l.ovrAt(evo)), 25), Txt(l.pos.name, 12)),
      col({ position: 'absolute', right: 8, top: 5, alignItems: 'flex-end' },
        Txt(l.flag, 17),
        evo > 0 ? div({ style: { background: css(LegendRed), borderRadius: 8, border: `2px solid ${css(INK)}`, padding: '0 5px' } }, Txt(`+${evo}진`, 12, WHITE)) : null)),
    selected ? div({ class: 'abs', style: { left: 0, right: 0, top: 0, bottom: 7, border: `4px solid ${css(Gold)}`, borderRadius: 20, pointerEvents: 'none' } }) : null);
}

function PlayerDetail(app, st, l, msg) {
  const store = app.store;
  const owned = store.ownedLegends.has(l.id);
  const slot = store.slotOf(l.id);
  // 아직 없는 선수는 필터에서 고른 단계로 산다 (여기서도 바꿀 수 있음)
  const evo = owned ? store.evoOf(l) : st.evoF;
  const ovr = l.ovrAt(evo);
  let actions;
  if (!owned) {
    const price = l.priceAt(evo);
    const step = (d) => () => { st.evoF = Math.min(Evolution.MAX, Math.max(0, st.evoF + d)); app.render(); };
    actions = [
      row({ gap: 8, marginBottom: 4 },
        Txt('몇 진으로 살까요?', 14, fade(0.6)),
        TextButton('-', step(-1), WhiteG, 36, 30, 18),
        div({ class: 'center', style: { width: 60, height: 30, background: css(evo > 0 ? 0xfffff3a6 : WHITE), borderRadius: 12, border: `3px solid ${css(INK)}` } }, Txt(`${evo}진`, 17)),
        TextButton('+', step(1), WhiteG, 36, 30, 18)),
      TextButton(`${coins(price)} ${evo > 0 ? `${evo}진으로 ` : ''}영입하기`, () => {
        if (store.buyLegend(l, evo)) msg(`🎉 ${l.name}${evo > 0 ? ` ${evo}진` : ''} 영입! 진화시키거나 출전시켜 봐요`);
        else msg(`코인이 부족해요! (${coins(price)})`);
      }, store.coins >= price ? GoldG : WhiteG, 290, 44, 18),
    ];
  } else {
    const cost = Evolution.cost(l, evo);
    const slots = store.slotsFor(l).slice(0, 2);
    const wait = store.sellWait();
    actions = [
      evo < Evolution.MAX ? TextButton(`✨ ${evo + 1}진 도전 · ${coins(cost)} · 성공 ${Math.round(Evolution.chance(evo) * 100)}%`, () => {
        const r = store.evolve(l);
        if (!r) { msg(`코인이 부족해요! (${coins(cost)})`); return; }
        if (r.ok) Sound.babam();
        st.evoShown = false;
        st.evoResult = { id: l.id, ...r };
      }, store.coins >= cost ? PinkG : WhiteG, 290, 42, 15) : null,
      space(2),
      slot != null
        ? row({ gap: 8 }, Txt(`✓ ${store.player(slot).name} 자리 출전 중`, 14, LegendRed),
          TextButton('벤치로', () => { store.benchLegend(l); msg(`${l.short} 벤치로`); }, WhiteG, 96, 34, 15))
        : row({ gap: 6 }, slots.map((s) => {
          const who = store.legendIn(s)?.short ?? store.player(s).name;
          return TextButton(`⚽ ${who} 자리`, () => { store.assignLegend(l, s); msg(`⭐ ${l.short} 출전! (${who} 자리)`); }, GreenG, slots.length > 1 ? 142 : 290, 38, 15);
        })),
      space(2),
      wait > 0
        ? TextButton(`💰 팔기 · ${waitText(wait)} 뒤에 가능`, null, WhiteG, 290, 32, 13, { enabled: false })
        : TextButton(`💰 팔기 · ${coins(l.sellPrice(evo))} 받기`, () => { st.confirmSell = l.id; app.render(); }, [0xfffff3a6, 0xffffd23f], 290, 32, 14),
    ];
  }
  return Panel({ w: 318, style: { height: '100%' } },
    col({ height: '100%', alignItems: 'center' },
      div({ class: 'center', style: { width: '100%', height: 38, flex: 'none', position: 'relative', background: css(l.grade.color) } },
        div({ class: 'abs', style: { left: 0, right: 0, bottom: 0, height: 4, background: css(INK) } }),
        OTxt(l.grade.label + (owned ? ' · ✅ 보유' : ''), 18, WHITE, { strokeWidth: 4 })),
      PlayerFigure(l, 1.25, 100, true),
      row({}, Txt(`${l.flag} ${l.name}`, l.name.length > 8 ? 19 : 23), evo > 0 ? Txt(` +${evo}진`, 20, LegendRed) : null),
      Txt(`${l.pos.label} · #${l.num} · ${l.country}`, 13, fade(0.6)),
      row({}, Txt('오버롤 ', 15, fade(0.6)), Txt(String(ovr), 34),
        evo < Evolution.MAX ? Txt(`  (기본 ${l.ovr} → 다음 +${Evolution.steps[evo]})`, 14, 0xff2bb24c) : Txt('  (최고 진화!)', 14, LegendRed)),
      // 1진 ~ 10진
      row({ alignSelf: 'stretch', padding: '0 12px', gap: 3 },
        [...Array(Evolution.MAX)].map((_, i) => col({ flex: 1, alignItems: 'center' },
          div({ style: { alignSelf: 'stretch', height: 14, borderRadius: 5, border: `2px solid ${css(INK)}`, background: css(i < evo ? 0xffffb627 : 0xffeee8fa) } }),
          Txt(`${i + 1}진`, 10), Txt(`${Math.round(Evolution.chances[i] * 100)}%`, 9, fade(0.55))))),
      Txt(`가치 ${coins(l.priceAt(evo))}` + (owned ? ` · 팔면 ${coins(l.sellPrice(evo))}` : ''), 13, fade(0.65)),
      Txt(l.skill(evo), 12, 0xff6b4bd6),
      div({ style: { flex: 1 } }),
      actions,
      space(6)));
}

/** 검색 버튼 아래 한 줄 요약 */
function searchSummary(st) {
  const parts = [];
  if (st.name) parts.push(`"${st.name}"`);
  if (st.programF) parts.push(`⚡ ${programOf(st.programF).name}`);
  else parts.push(`${st.evoF}진`);
  parts.push(sortLabel(st.sort));
  return parts.join(' · ');
}

const POS_CHOICES = [[null, '전체'], [Pos.FW, '⚔️ 공격수'], [Pos.MF, '🎯 미드필더'], [Pos.DF, '🛡️ 수비수'], [Pos.GK, '🧤 골키퍼']];

/** 검색 창: 이름 · 프로그램 · 포지션 · 진 · 정렬. 고르기만 하면 그대로, 아래 [검색] 을 눌러야 한꺼번에 적용 */
function SearchPanel(app, st, setFilter) {
  const d = st.draft;
  const close = () => { st.draft = null; st.pickOpen = false; app.render(); };
  const set = (f) => () => { f(); app.render(); };
  const chip = (text, on, onClick, w = 'auto') => div({ class: 'center', style: { width: w, height: 36, cursor: 'pointer', borderRadius: 13, background: css(on ? Gold : WHITE), border: `3px solid ${css(INK)}`, padding: '0 6px' }, onClick }, Txt(text, 15));
  const head = (t) => Txt(t, 14, fade(0.6));
  const input = h('input', {
    type: 'text', value: d.name, placeholder: '선수 이름 (예: 손흥미)', maxLength: 12,
    style: { flex: 1, height: 42, border: `3px solid ${css(INK)}`, borderRadius: 14, padding: '0 12px', fontFamily: 'Jua, sans-serif', fontSize: 17, color: css(INK), outline: 'none', minWidth: 0 },
  });
  input.addEventListener('input', () => { d.name = input.value; });
  const apply = () => {
    setFilter(() => {
      st.name = d.name.trim(); st.programF = d.programF; st.pos = d.pos; st.evoF = d.evoF; st.sort = d.sort;
      if (st.programF) { st.grade = null; st.ownedOnly = false; }
      st.draft = null; st.pickOpen = false;
    });
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });
  const prog = d.programF ? programOf(d.programF) : null;
  return div({ class: 'dim', style: { background: css(INK, 0.5) }, onClick: close },
    div({ onClick: (e) => e.stopPropagation() },
      Panel({ w: 720, h: 510 },
        col({ height: '100%', padding: '12px 20px', gap: 6 },
          row({}, Txt('🔍 선수 검색', 24), div({ style: { flex: 1 } }), TextButton('✕', close, WhiteG, 44, 34, 17)),
          row({ gap: 10 }, input,
            CandyButton(set(() => { st.pickOpen = true; st.pickSel = d.programF; }), prog ? GoldG : WhiteG, { w: 210, h: 42, radius: 14 },
              row({ gap: 6 }, prog ? ProgramEmblem(prog, 30) : Txt('🏷️', 18), Txt(prog ? prog.name : '프로그램 고르기', 16), Txt('▼', 12)))),
          head('📍 포지션'),
          row({ gap: 6 }, POS_CHOICES.map(([p, t]) => chip(t, d.pos === p, set(() => { d.pos = p; }), p == null ? 70 : 118))),
          head(prog ? '🛒 몇 진? (프로그램 선수는 진화가 없어요)' : '🛒 몇 진으로 볼까요? (진화된 선수는 그만큼 비싸요)'),
          div({ style: { display: 'grid', gridTemplateColumns: 'repeat(11, 1fr)', gap: 5, opacity: prog ? 0.4 : 1 } },
            [...Array(Evolution.MAX + 1)].map((_, e) => chip(`${e}진`, d.evoF === e, set(() => { d.evoF = e; })))),
          head('↕️ 정렬'),
          div({ style: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 } },
            SORTS.map(([k, lab]) => chip(lab, d.sort === k, set(() => { d.sort = k; })))),
          div({ style: { flex: 1 } }),
          Txt('고르기만 하면 그대로예요. 아래 [검색]을 눌러야 한꺼번에 찾아요', 13, 0xff6b4bd6, { align: 'center' }),
          row({ gap: 12, justifyContent: 'center' },
            TextButton('↺ 초기화', set(() => { Object.assign(d, { name: '', programF: null, pos: null, evoF: 0, sort: 'ovrHigh' }); }), WhiteG, 180, 50, 19),
            TextButton('🔍 검색', apply, GreenG, 300, 50, 22))))));
}

/** 프로그램 선택 (엠블럼 칸) */
function ProgramPick(app, st) {
  const d = st.draft;
  const close = () => { st.pickOpen = false; st.pickSel = undefined; app.render(); };
  const cell = (p) => {
    const on = st.pickSel === p.id;
    return col({ alignItems: 'center', justifyContent: 'center', gap: 4, height: 170, cursor: 'pointer', borderRadius: 16,
      background: on ? 'rgba(255,195,64,0.18)' : 'rgba(255,255,255,0.04)', border: `3px solid ${on ? '#ffc340' : 'rgba(255,255,255,0.12)'}` },
    ProgramEmblem(p, 110), Txt(p.name, 17, WHITE), Txt(`프로그램 선수 ${p.players.length}명`, 12, 'rgba(255,255,255,0.6)'));
  };
  return div({ class: 'dim', style: { background: 'rgba(10,6,20,0.7)' }, onClick: close },
    div({ onClick: (e) => e.stopPropagation(), style: { width: 760, height: 470, borderRadius: 22, border: '3px solid #b88cff', background: 'linear-gradient(#1d1a3a, #0e0c22)', boxShadow: '0 0 30px rgba(180,120,255,0.4)', display: 'flex', flexDirection: 'column', overflow: 'hidden' } },
      row({ height: 62, padding: '0 20px', background: 'linear-gradient(90deg,#14304a,#1d1a3a)', borderBottom: '2px solid rgba(255,255,255,0.15)' },
        div({ style: { cursor: 'pointer' }, onClick: close }, Txt('‹', 30, WHITE)), space(10), Txt('프로그램 선택', 24, WHITE), div({ style: { flex: 1 } }),
        div({ style: { cursor: 'pointer' }, onClick: close }, Txt('✕', 26, WHITE))),
      div({ style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, padding: 16 } },
        Programs.map((p) => div({ onClick: () => { st.pickSel = st.pickSel === p.id ? null : p.id; app.render(); } }, cell(p)))),
      div({ style: { flex: 1 } }),
      row({ gap: 12, padding: '0 20px 16px' },
        div({ class: 'center', style: { flex: 1, height: 50, borderRadius: 25, border: '2px solid #4f8cff', background: '#16224a', cursor: 'pointer' }, onClick: () => { st.pickSel = null; app.render(); } }, Txt('초기화', 19, WHITE)),
        div({ class: 'center', style: { flex: 1.3, height: 50, borderRadius: 25, background: 'linear-gradient(#5fffd0,#18d7a0)', cursor: 'pointer' },
          onClick: () => { d.programF = st.pickSel ?? null; close(); } }, Txt('선택', 20, INK)))));
}

/* ───────── 프로그램 선수 ───────── */

function ProgramPlayerCard(app, l, selected, onClick) {
  const store = app.store;
  const owned = store.ownedLegends.has(l.id);
  const playing = store.slotOf(l.id) != null;
  const onSale = Date.now() >= l.program.saleFrom;
  const footer = playing ? '출전 중' : owned ? '✅ 보유' : onSale ? coins(l.price) : '🔒 이벤트 끝나고 판매';
  return ProgramCard(l, { selected, onClick, footer, footerColor: playing ? 0xffff7a8a : owned ? 0xff7dff8a : ProgramYellow });
}

function ProgramDetail(app, st, l, msg) {
  const store = app.store;
  const owned = store.ownedLegends.has(l.id);
  const slot = store.slotOf(l.id);
  const onSale = Date.now() >= l.program.saleFrom;
  const dim = 'rgba(255,255,255,0.65)';
  let actions;
  if (!owned) {
    actions = onSale
      ? TextButton(`${coins(l.price)} 영입하기`, () => {
        if (store.buyLegend(l)) msg(`🎉 ${l.program.name} ${l.name} 영입! 출전시켜 봐요`);
        else msg(`코인이 부족해요! (${coins(l.price)})`);
      }, store.coins >= l.price ? GoldG : WhiteG, 290, 44, 18)
      : TextButton(`🔒 이벤트가 끝나면 ${coins(l.price)}에 판매`, null, WhiteG, 290, 44, 14, { enabled: false });
  } else {
    const slots = store.slotsFor(l).slice(0, 2);
    const wait = store.sellWait();
    actions = [
      slot != null
        ? row({ gap: 8 }, Txt(`✓ ${store.player(slot).name} 자리 출전 중`, 14, 0xffff7a8a),
          TextButton('벤치로', () => { store.benchLegend(l); msg(`${l.short} 벤치로`); }, WhiteG, 96, 34, 15))
        : row({ gap: 6 }, slots.map((s) => {
          const who = store.legendIn(s)?.short ?? store.player(s).name;
          return TextButton(`⚽ ${who} 자리`, () => { store.assignLegend(l, s); msg(`⭐ ${l.short} 출전! (${who} 자리)`); }, GreenG, slots.length > 1 ? 142 : 290, 38, 15);
        })),
      space(4),
      wait > 0
        ? TextButton(`💰 팔기 · ${waitText(wait)} 뒤에 가능`, null, WhiteG, 290, 32, 13, { enabled: false })
        : TextButton(`💰 팔기 · ${coins(l.sellPrice(0))} 받기`, () => { st.confirmSell = l.id; app.render(); }, [0xfffff3a6, 0xffffd23f], 290, 32, 14),
    ];
  }
  return Panel({ w: 318, style: { height: '100%' }, bodyStyle: { background: PROGRAM_BG } },
    col({ height: '100%', alignItems: 'center' },
      div({ class: 'center', style: { width: '100%', height: 38, flex: 'none', position: 'relative', overflow: 'hidden' } },
        ProgramBackground(9),
        div({ class: 'abs', style: { left: 0, right: 0, bottom: 0, height: 3, background: css(ProgramGold) } }),
        OTxt(`⚡ ${l.program.name} 프로그램${owned ? ' · ✅ 보유' : ''}`, 17, ProgramYellow, { strokeWidth: 4 })),
      div({ style: { width: 150, marginTop: 8 } }, ProgramCard(l, { h: 172 })),
      OTxt(`${l.flag} ${l.name}`, l.name.length > 8 ? 19 : 23, WHITE, { strokeWidth: 4 }),
      Txt(`${l.pos.label} · #${l.num} · ${l.country}`, 13, dim),
      row({}, Txt('오버롤 ', 15, dim), OTxt(String(l.ovr), 34, ProgramYellow, { strokeWidth: 5 }), Txt('  (진화 없음)', 14, ProgramGold)),
      Txt(`가치 ${coins(l.price)}` + (owned ? ` · 팔면 ${coins(l.sellPrice(0))}` : ''), 13, dim),
      div({ style: { flex: 1 } }),
      actions,
      space(8)));
}

/** 진화 도전 결과 */
function EvolveResult(app, st) {
  const r = st.evoResult;
  const l = Legends.get(r.id);
  const close = () => { st.evoResult = null; st.evoShown = false; app.render(); };
  const box = div({ class: 'dim', onClick: close },
    col({ alignItems: 'center' },
      OTxt(r.ok ? '진화 성공!' : '진화 실패...', 72, r.ok ? Gold : 0xff9fd8ff, { strokeWidth: 12 }),
      div({ style: { width: 190, height: 214 } }, PlayerCard(app, l, r.ok, () => {}, r.to)),
      space(6),
      OTxt(r.from === r.to ? '0진이라 더 내려가지 않아요' : `${r.ok ? '⬆️' : '⬇️'} ${r.from}진 → ${r.to}진 · 오버롤 ${l.ovrAt(r.from)} → ${l.ovrAt(r.to)}`, 26, WHITE, { strokeWidth: 6 }),
      Txt(`가치 ${coins(l.priceAt(r.from))} → ${coins(l.priceAt(r.to))} · 화면을 누르면 닫혀요`, 15, 'rgba(255,255,255,0.85)')));
  if (!st.evoShown) {
    st.evoShown = true;
    box.firstChild.animate(r.ok
      ? [{ transform: 'scale(0.2)' }, { transform: 'scale(1.12)', offset: 0.55 }, { transform: 'scale(0.96)', offset: 0.8 }, { transform: 'scale(1)' }]
      : [{ transform: 'translateX(0)' }, { transform: 'translateX(-18px)' }, { transform: 'translateX(14px)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(0)' }], { duration: 520, easing: 'ease-out' });
  }
  return box;
}

/** 정말 팔까요? */
function SellConfirm(app, st, msg) {
  const store = app.store;
  const l = Legends.get(st.confirmSell);
  const evo = store.evoOf(l);
  const close = () => { st.confirmSell = null; app.render(); };
  return div({ class: 'dim', onClick: close },
    div({ onClick: (e) => e.stopPropagation() },
      Panel({ w: 470, h: 300 },
        col({ height: '100%', padding: 18, alignItems: 'center' },
          OTxt('💰 선수 팔기', 34, Gold, { strokeWidth: 7 }),
          space(8),
          Txt(`${l.flag} ${l.name}${evo > 0 ? ` +${evo}진` : ''} · 오버롤 ${l.ovrAt(evo)}`, 21),
          space(4),
          Txt(`${coins(l.sellPrice(evo))} 을 받아요 (가치의 절반)`, 20, 0xffe08a00),
          space(4),
          Txt(`선수는 ${SELL_COOLDOWN_MS / 86400000}일에 한 번만 팔 수 있어요`, 15, fade(0.6)),
          div({ style: { flex: 1 } }),
          row({ gap: 10 },
            TextButton('취소', close, WhiteG, 150, 50, 19),
            TextButton('💰 팔기', () => {
              const got = store.sellLegend(l);
              st.confirmSell = null;
              if (got) msg(`💰 ${l.short} 판매! ${coins(got)} 받았어요`); else app.render();
            }, GoldG, 170, 50, 20))))));
}

/* ───────── 기본 동글이 (보유 목록) ───────── */

function DefaultFigure(p, scale, height) {
  return Canvas('100%', height, (ctx, t, vw, vh) => {
    const cx = vw / 2, base = vh - 6;
    drawMongi(ctx, cx, base, scale, p.slot === 0 ? GkGreen : LegendRed, { gloves: p.slot === 0, hat: p.hat });
    label(ctx, String(p.num), cx, base - 8 * scale, 11 * scale, WHITE, 2.4 * scale);
  }, { style: { flex: 'none' } });
}

function DefaultCard(app, p, selected, onClick) {
  const store = app.store;
  const playing = store.legendIn(p.slot) == null;
  return div({ style: { position: 'relative', height: 196, cursor: 'pointer' }, onClick },
    Panel({ radius: 20, border: selected ? Gold : INK, style: { height: '100%' }, bodyStyle: { background: `linear-gradient(${css(BaseGray, 0.6)}, rgba(255,255,255,0) 300px), #fff` } },
      col({ height: '100%', alignItems: 'center' },
        space(18),
        DefaultFigure(p, 0.95, 92),
        Txt(p.name, 18, INK, { align: 'center' }),
        Txt('기본 선수', 12, fade(0.55)),
        playing ? Txt('출전 중', 13, LegendRed) : Txt('벤치', 13, fade(0.5))),
      col({ position: 'absolute', left: 9, top: 4 }, Txt(String(Roster.BASE_OVR), 25), Txt(store.formation.roles[p.slot].name, 12))),
    selected ? div({ class: 'abs', style: { left: 0, right: 0, top: 0, bottom: 7, border: `4px solid ${css(Gold)}`, borderRadius: 20, pointerEvents: 'none' } }) : null);
}

function DefaultDetail(app, p, msg) {
  const store = app.store;
  const legend = store.legendIn(p.slot);
  return Panel({ w: 318, style: { height: '100%' } },
    col({ height: '100%', alignItems: 'center' },
      div({ class: 'center', style: { width: '100%', height: 38, flex: 'none', position: 'relative', background: css(BaseGray) } },
        div({ class: 'abs', style: { left: 0, right: 0, bottom: 0, height: 4, background: css(INK) } }),
        OTxt('기본 선수 · ✅ 보유', 18, WHITE, { strokeWidth: 4 })),
      DefaultFigure(p, 1.35, 112),
      Txt(p.name, 23),
      Txt(`${store.formation.roles[p.slot].label} · #${p.num} · 동글 FC`, 13, fade(0.6)),
      row({}, Txt('오버롤 ', 15, fade(0.6)), Txt(String(Roster.BASE_OVR), 36)),
      space(4),
      Txt('처음부터 함께한 동글이예요.', 14, fade(0.7)),
      Txt('선수를 영입하면 바로 팀이 세져요!', 14, fade(0.7)),
      Txt('✏️ 이름·번호·머리 장식은 상점 > 가방에서', 13, 0xff6b4bd6),
      div({ style: { flex: 1 } }),
      legend
        ? TextButton(`⚽ ${p.name} 출전 (${legend.short} 벤치로)`, () => { store.clearSlot(p.slot); msg(`${p.name} 출전! ${legend.short} 벤치로`); }, GreenG, 290, 44, 15)
        : Txt(`✓ ${p.name} 출전 중`, 15, LegendRed),
      space(8)));
}

export { h };
