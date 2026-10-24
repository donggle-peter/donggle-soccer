import { h, div, row, col, space, Txt, OTxt, TextButton, Panel, TopBar, Canvas, DotsBackground, showToast,
  GoldG, BlueG, GreenG, WhiteG, Gold } from './kit.js';
import { TabChip } from './worldcup.js';
import { drawMongi, label, sparkle, glow, oval } from '../game/draw.js';
import { ItemTypes, Items } from '../data/items.js';
import { Hat, Hats, Roster } from '../data/teams.js';
import { css, INK, WHITE } from '../core.js';
import { Sound } from '../sound.js';

const fade = (a) => css(INK, a);
const MyRed = 0xffff4f64;
const GkGreen = 0xff5fd068;
const jerseyOf = (p) => (p.slot === 0 ? GkGreen : MyRed);
const bounce = (t, k = 5) => Math.abs(Math.sin(t * 2.5)) * k;

/** 상점: 아이템 강화 · 머리 장식 · 가방 */
export function ShopScreen(app, st) {
  const store = app.store;
  app.onBack = () => app.go('menu');
  st.tab ??= 0;
  const root = div({ class: 'screen' });
  const msg = (m) => showToast(root, m);
  const body = st.tab === 0 ? ItemsTab(app, msg, () => lucky(app, root, msg)) : st.tab === 1 ? HatShopTab(app, st, msg) : BagTab(app, st, msg);
  root.append(
    DotsBackground(0xffffe1ee),
    col({ position: 'absolute', inset: 0 },
      TopBar('🛒 상점', 0xffff7eb0, () => app.go('menu'), store.coins),
      row({ padding: '10px 16px 0', gap: 10 },
        TabChip('⬆️ 아이템 강화', st.tab === 0, () => { st.tab = 0; app.render(); }),
        TabChip('🧢 머리 장식', st.tab === 1, () => { st.tab = 1; app.render(); }),
        TabChip('🎒 가방', st.tab === 2, () => { st.tab = 2; app.render(); })),
      div({ style: { flex: 1, minHeight: 0, padding: '8px 16px 12px', display: 'flex' } }, body)));
  return root;
}

/** 행운 상자 "빠빰!" 연출 */
function lucky(app, root, msg) {
  const store = app.store;
  const r = store.openLuckyBox();
  if (!r) { msg('코인이 부족해요!'); return; }
  const [t, up] = r;
  Sound.babam();
  // 다시 그려진 화면 위에 올린다
  queueMicrotask(() => {
    const screen = document.querySelector('#stage > .screen');
    const pop = div({ class: 'dim', style: { background: css(INK, 0.45) }, onClick: () => pop.remove() },
      col({ alignItems: 'center', style: '' },
        OTxt('빠빰!', 96, Gold, { strokeWidth: 14 }),
        div({ class: 'center', style: { width: 140, height: 140, background: '#fff', borderRadius: '50%', border: `5px solid ${css(INK)}` } }, Txt(t.emoji, 76)),
        space(8),
        OTxt(`${t.title}  Lv.${store.level(t)}`, 32, WHITE, { strokeWidth: 7 })));
    pop.firstChild.animate([{ transform: 'scale(0.2)' }, { transform: 'scale(1.12)', offset: 0.55 }, { transform: 'scale(0.96)', offset: 0.8 }, { transform: 'scale(1)' }], { duration: 520, easing: 'ease-out' });
    screen?.append(pop);
    setTimeout(() => pop.remove(), 1900);
    showToast(screen ?? root, up ? `${t.emoji} ${t.title} 레벨 UP! (Lv.${store.level(t)})` : `${t.emoji} ${t.title}은 이미 MAX! 🪙${Items.BOX_PRICE / 2} 돌려받았어요`);
  });
}

/* ───────────── 아이템 강화 탭 ───────────── */

function ItemsTab(app, msg, onLucky) {
  const store = app.store;
  const star = store.player(3);
  const eq = store.equipped;
  const dashed = { border: `3px dashed ${css(0xffffb627)}` };
  return row({ flex: 1, gap: 16, alignItems: 'stretch' },
    col({ width: 320 },
      Panel({ flex: 1 },
        col({ height: '100%', alignItems: 'center' },
          Canvas('100%', 170, (ctx, t, vw, vh) => {
            const hop = bounce(t);
            drawMongi(ctx, vw / 2, vh - 8, 1.75, MyRed, { hop: hop / 1.75, hat: star.hat });
            label(ctx, String(star.num), vw / 2, vh - 8 - 14 - hop, 21, WHITE, 4.5);
          }, { anim: true, style: { flex: 'none' } }),
          Txt('경기 시작할 때 들고 나가요', 17, fade(0.65)),
          space(6),
          div({ class: 'center', style: { alignSelf: 'stretch', margin: '0 22px', height: 96, background: css(0xfffff8d6), borderRadius: 18, ...dashed } },
            eq ? col({ alignItems: 'center' }, Txt(eq.emoji, 38), row({}, Txt(eq.title, 21), Txt(`  Lv.${store.level(eq)}`, 21, MyRed)))
              : Txt('장착한 아이템 없음', 18, fade(0.5))),
          space(6),
          Txt('❓상자 아이템은 경기 중에 그대로 주워요', 13, fade(0.55)))),
      space(6),
      TextButton(`🎁 행운상자  🪙${Items.BOX_PRICE}`, onLucky, GoldG, 320, 52, 20)),
    col({ flex: 1, gap: 10, minWidth: 0 },
      [0, 1].map((r) => row({ flex: 1, gap: 12, alignItems: 'stretch', minHeight: 0 }, [0, 1, 2, 3].map((c) => ItemCard(app, ItemTypes[r * 4 + c], msg))))));
}

function ItemCard(app, item, msg) {
  const store = app.store;
  const lv = store.level(item);
  const c = item.rarity.color;
  const on = store.equipped === item;
  const darker = ((c & 0xff000000) | (Math.round(((c >>> 16) & 255) * 0.7) << 16) | (Math.round(((c >>> 8) & 255) * 0.7) << 8) | Math.round((c & 255) * 0.7)) >>> 0;
  const tag = (text, style, color) => div({ class: 'abs center', style: { height: 22, borderRadius: 10, padding: '0 8px', ...style } }, Txt(text, 13, color));
  const cost = Items.upgradeCost(lv);
  return Panel({ flex: 1, border: on ? 0xffffb627 : INK, style: { height: '100%' } },
    col({ height: '100%', alignItems: 'center' },
      div({ class: 'center', style: { width: '100%', height: 70, flex: 'none', position: 'relative', background: `linear-gradient(${css(c)}, ${css(c, 0.75)})` } },
        div({ class: 'abs', style: { left: 0, right: 0, bottom: 0, height: 4, background: css(INK) } }),
        div({ class: 'center', style: { width: 54, height: 54, background: '#fff', borderRadius: '50%', border: `3.5px solid ${css(INK)}` } }, Txt(item.emoji, 28)),
        tag(item.rarity.label, { left: 7, top: 7, background: '#fff', border: `2.5px solid ${css(INK)}` }, darker),
        tag(`Lv.${lv}`, { right: 7, top: 7, background: css(INK) }, WHITE),
        on ? tag('✓ 장착 중', { left: 6, bottom: 8, background: css(GkGreen), border: `2.5px solid ${css(INK)}` }, WHITE) : null),
      space(4),
      Txt(item.title, 19),
      Txt(item.effect(lv), 12.5, fade(0.65), { align: 'center' }),
      div({ style: { flex: 1 } }),
      div({ style: { alignSelf: 'stretch', margin: '0 14px', height: 9, background: css(0xffeee8fa), borderRadius: 5, border: `2px solid ${css(INK)}`, overflow: 'hidden' } },
        div({ style: { width: `${(lv / Items.MAX_LEVEL) * 100}%`, height: '100%', background: css(c) } })),
      space(6),
      lv >= Items.MAX_LEVEL ? TextButton('MAX ★', null, GoldG, 170, 36, 15, { enabled: false })
        : TextButton(`⬆️ 강화 🪙${cost}`, () => {
          if (store.upgrade(item)) msg(`⬆️ ${item.emoji} ${item.title} Lv.${store.level(item)} 강화! 바로 장착했어요 (가방에서 바꿀 수 있어요)`);
          else msg('코인이 부족해요!');
        }, store.coins >= cost ? GreenG : WhiteG, 170, 36, 15),
      space(4)));
}

/* ───────────── 머리 장식 사기 탭 ───────────── */

function HatShopTab(app, st, msg) {
  const store = app.store;
  // 싼 것부터, 비싼 것은 뒤로
  const hats = Hats.filter((x) => x.shop && x !== Hat.NONE).sort((a, b) => a.price - b.price);
  st.pick ??= hats[0].name;
  const pick = Hat[st.pick];
  const owns = store.ownsHat(pick);
  return row({ flex: 1, gap: 14, alignItems: 'stretch' },
    Panel({ w: 320, style: { height: '100%' } },
      col({ height: '100%', alignItems: 'center' },
        Canvas('100%', '100%', (ctx, t, vw, vh) => drawMongi(ctx, vw / 2, vh - 20, 2.4, MyRed, { hop: bounce(t) / 2.4, hat: pick }), { anim: true, style: { flex: 1, minHeight: 0 } }),
        Txt(pick.label, 28),
        Txt(owns ? '✓ 가방에 있어요' : `🪙${pick.price}`, 18, owns ? 0xff2bb24c : 0xffe08a00),
        space(6),
        !owns ? TextButton(`🛒 사기 🪙${pick.price}`, () => {
          if (store.buyHat(pick)) msg(`🎉 ${pick.label} 구입! 가방에서 선수에게 씌워요`); else msg(`코인이 부족해요! (🪙${pick.price})`);
        }, store.coins >= pick.price ? GoldG : WhiteG, 240, 50, 20) : null,
        space(12))),
    col({ flex: 1, gap: 10, minWidth: 0 },
      [...Array(Math.ceil(hats.length / 4)).keys()].map((r) => row({ flex: 1, gap: 10, alignItems: 'stretch', minHeight: 0 }, [0, 1, 2, 3].map((c) => {
        const hh = hats[r * 4 + c];
        if (!hh) return div({ style: { flex: 1 } });
        const owned = store.ownsHat(hh);
        const sel = pick === hh;
        return div({ style: { flex: 1, cursor: 'pointer', height: '100%' }, onClick: () => { st.pick = hh.name; app.render(); } },
          Panel({ color: sel ? 0xfffff3a6 : 0xffffffff, border: sel ? 0xffffb627 : INK, style: { height: '100%' } },
            col({ height: '100%', alignItems: 'center' },
              Canvas('100%', '100%', (ctx, t, vw, vh) => drawMongi(ctx, vw / 2, vh - 16, Math.min(1.2, (vh - 22) / 95), MyRed, { hat: hh, shadow: false }), { style: { flex: 1, minHeight: 0 } }),
              Txt(hh.label, hh.label.length > 4 ? 16 : 18),
              Txt(owned ? (hh.price === 0 ? '기본 보유' : '✓ 보유') : `🪙${hh.price}`, 13, owned ? 0xff2bb24c : 0xffe08a00),
              space(5))));
      })))));
}

/* ───────────── 가방: 산 것 장착 · 이름 · 등번호 ───────────── */

function BagTab(app, st, msg) {
  const store = app.store;
  st.sel ??= 3;
  const sel = st.sel;
  const p = store.player(sel);
  const list = col({ width: 232, gap: 6 },
    Roster.displayOrder.map((slot) => {
      const rp = store.player(slot);
      const on = slot === sel;
      return div({ style: { flex: 1, cursor: 'pointer', minHeight: 0 }, onClick: () => { st.sel = slot; app.render(); } },
        Panel({ radius: 18, color: on ? 0xfffff3a6 : 0xffffffff, border: on ? 0xffffb627 : INK, style: { height: '100%' } },
          row({ height: '100%' },
            Canvas(72, '100%', (ctx, t, vw, vh) => drawMongi(ctx, vw / 2, vh - 4, 0.8, jerseyOf(rp), { gloves: rp.slot === 0, hat: rp.hat, shadow: false }), { style: { flex: 'none', height: '100%' } }),
            col({ flex: 1, minWidth: 0 }, Txt(rp.name || '(이름 없음)', 21), Txt(`${Roster.position(rp.slot)} · #${rp.num}`, 14, fade(0.6))),
            on ? div({ style: { paddingRight: 10 } }, Txt('✏️', 18)) : null)));
    }));

  const preview = Panel({ flex: 0.4, style: { height: '100%' } },
    col({ height: '100%', alignItems: 'center' },
      Canvas('100%', '100%', (ctx, t, vw, vh) => {
        const cx = vw / 2, base = vh - 30;
        glow(ctx, cx, base - 100, 150);
        oval(ctx, cx, base + 8, 110, 22); ctx.fillStyle = css(0xffffd23f); ctx.fill(); ctx.strokeStyle = css(INK); ctx.lineWidth = 4; ctx.stroke();
        oval(ctx, cx, base, 110, 22); ctx.fillStyle = css(0xfffff6a0); ctx.fill(); ctx.stroke();
        const sc = Math.min(2.8, (vh - 60) / 95);
        const hop = bounce(t, 6);
        drawMongi(ctx, cx, base, sc, jerseyOf(p), { gloves: p.slot === 0, hop: hop / sc, hat: p.hat });
        label(ctx, String(p.num), cx, base - 8 * sc - hop, 11 * sc, WHITE, 2.2 * sc);
        sparkle(ctx, cx - 120, base - 200, 1.2 + Math.sin(t * 3) * 0.2, 0xfffff6a0);
        sparkle(ctx, cx + 124, base - 140, 0.9);
      }, { anim: true, style: { flex: 1, minHeight: 0 } }),
      row({}, Txt(p.name || '이름 없음', 32), Txt(`  #${p.num}`, 32, MyRed)),
      Txt(Roster.position(p.slot), 15, fade(0.6)),
      space(10)));

  // 이름 칸: 다 쓰고 나서(완료·바깥 누르기) 저장해야 쓰는 도중에 글자가 끊기지 않는다
  const input = h('input', { class: 'name-input', value: p.name, maxlength: String(Roster.NAME_MAX), placeholder: '이름을 써요', enterkeyhint: 'done', style: { width: '100%', height: 48, fontSize: 26 } });
  input.value = p.name;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); e.stopPropagation(); });
  input.addEventListener('change', () => store.rename(sel, input.value.replace(/\n/g, '')));
  input.addEventListener('pointerdown', (e) => e.stopPropagation());

  const mine = Hats.filter((x) => x.shop && store.ownsHat(x));
  const hatRows = [];
  for (let i = 0; i < mine.length; i += 5) hatRows.push(mine.slice(i, i + 5));
  const eq = store.equipped;
  const slotBox = (on, onClick, ...c) => div({ class: 'center', style: { flex: 1, height: '100%', cursor: 'pointer', borderRadius: 14, background: css(on ? 0xfffff3a6 : WHITE), border: `3px solid ${css(on ? 0xffffb627 : INK)}` }, onClick }, ...c);

  const editor = col({ flex: 0.6, minWidth: 0 },
    Panel({ h: 133 },
      row({ height: '100%', padding: '10px 16px', alignItems: 'flex-start' },
        col({ flex: 1 },
          Txt('이름', 16, fade(0.6)), space(4), input, space(6),
          TextButton('🎲 랜덤 이름', () => {
            const used = new Set(store.roster.map((x) => x.name));
            const c = Roster.randomNames.filter((n) => !used.has(n));
            store.rename(sel, c[Math.floor(Math.random() * c.length)]);
          }, WhiteG, 130, 34, 15)),
        space(14),
        col({ alignItems: 'center' },
          Txt('등번호', 16, fade(0.6)), space(4),
          row({ gap: 8 },
            TextButton('-', () => store.stepNumber(sel, -1), BlueG, 46, 46, 26, { textColor: WHITE }),
            div({ class: 'center', style: { width: 70, height: 50, background: '#fff', borderRadius: 14, border: `3.5px solid ${css(INK)}` } }, Txt(String(p.num), 30)),
            TextButton('+', () => store.stepNumber(sel, 1), [0xffff9aa8, MyRed], 46, 46, 26, { textColor: WHITE })),
          Txt('친구와 같은 번호는 건너뛰어요', 12, fade(0.55))))),
    space(6),
    row({}, Txt('🧢 내 머리 장식', 18), space(8), Txt('상점에서 산 것만 나와요', 12, fade(0.6))),
    space(4),
    col({ flex: 1, gap: 6, minHeight: 0 },
      hatRows.map((rh) => row({ flex: 1, gap: 6, alignItems: 'stretch', minHeight: 0 },
        rh.map((hh) => HatCard(hh, p.hat === hh, () => { store.wearHat(sel, hh); msg(`${p.name}: ${hh.label}`); })),
        [...Array(5 - rh.length)].map(() => div({ style: { flex: 1 } })))),
      mine.length <= 5 ? div({ style: { flex: 1 } }) : null),
    space(4),
    row({}, Txt('🎒 시작 아이템', 18), space(8), Txt('경기 시작할 때 들고 나가요', 12, fade(0.6))),
    space(4),
    row({ height: 62, gap: 5, flex: 'none' },
      slotBox(eq == null, () => { store.equip(null); msg('시작 아이템 없음'); }, Txt('없음', 14)),
      ItemTypes.map((it) => slotBox(eq === it, () => { store.equip(it); msg(`${it.emoji} ${it.title} 장착! 다음 경기에서 들고 시작해요`); },
        col({ alignItems: 'center' }, Txt(it.emoji, 22), Txt(`Lv.${store.level(it)}`, 11))))));

  return row({ flex: 1, gap: 12, alignItems: 'stretch' }, list, preview, editor);
}

function HatCard(hh, wearing, onClick) {
  return div({ style: { flex: 1, cursor: 'pointer', height: '100%' }, onClick },
    Panel({ radius: 16, color: wearing ? 0xfffff3a6 : 0xffffffff, border: wearing ? 0xffffb627 : INK, style: { height: '100%' } },
      col({ height: '100%', alignItems: 'center' },
        Canvas('100%', '100%', (ctx, t, vw, vh) => drawMongi(ctx, vw / 2, vh - 8, Math.min(0.7, (vh - 12) / 95), MyRed, { hat: hh, shadow: false }), { style: { flex: 1, minHeight: 0 } }),
        Txt(hh.label, 15),
        Txt(wearing ? '✓ 착용 중' : '보유', 11, wearing ? 0xff2bb24c : fade(0.6)),
        space(3))));
}
