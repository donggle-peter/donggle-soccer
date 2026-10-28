import { div, row, col, space, Txt, OTxt, TextButton, Panel, TopBar, Canvas, DotsBackground, GreenG, WhiteG, Gold } from './kit.js';
import { drawMongi, label } from '../game/draw.js';
import { Lessons } from '../game/tutorial.js';
import { ItemType, ItemTypes } from '../data/items.js';
import { TUTORIAL_LESSONS, TUTORIAL_REWARD } from '../data/store.js';
import { css, INK, WHITE } from '../core.js';

const fade = (a) => css(INK, a);
const Sky = 0xff55a8ff;

/** 튜토리얼: 동글 축구 학교 (수업 목록) */
export function TutorialScreen(app) {
  const store = app.store;
  app.onBack = () => app.go('menu');
  let firstTodo = null;
  for (let i = 0; i < TUTORIAL_LESSONS; i++) if (!store.lessonDone(i)) { firstTodo = i; break; }
  const card = (i) => {
    const l = Lessons[i], done = store.lessonDone(i), next = i === firstTodo;
    return div({ style: { flex: 1, cursor: 'pointer', height: '100%' }, onClick: () => app.go('tutorialPlay', { start: i }) },
      Panel({ radius: 22, color: next ? 0xfffff3a6 : 0xffffffff, border: next ? 0xffffb627 : INK, style: { height: '100%' } },
        div({ class: 'center abs', style: { left: 10, top: 10, width: 32, height: 32, borderRadius: '50%', border: `3px solid ${css(INK)}`,
          background: css(done ? 0xff5fd068 : next ? Gold : 0xffeee8fa) } }, Txt(done ? '✓' : String(i + 1), 16, done ? WHITE : INK)),
        col({ height: '100%', alignItems: 'center', justifyContent: 'center' }, Txt(l.emoji, 44), Txt(l.title, 23), Txt(l.sub, 14, fade(0.6)))));
  };
  const rowOf = (r) => row({ flex: 1, gap: 12, alignItems: 'stretch', minHeight: 0 },
    [0, 1, 2, 3].map((c) => { const i = r * 4 + c; return i < TUTORIAL_LESSONS ? card(i) : div({ style: { flex: 1 } }); }));
  return div({ class: 'screen' },
    DotsBackground(0xffe9f7ff),
    col({ position: 'absolute', inset: 0 },
      TopBar('🎓 튜토리얼 · 동글 축구 학교', Sky, () => app.go('menu'), store.coins),
      row({ flex: 1, minHeight: 0, padding: 16, gap: 16, alignItems: 'stretch' },
        col({ flex: 1, minWidth: 0 },
          row({}, Txt(store.tutorialRewarded ? '🎉 졸업 완료! 언제든 다시 연습할 수 있어요' : `${TUTORIAL_LESSONS}개 수업을 끝내면 🪙${TUTORIAL_REWARD} 코인 선물!`, 21),
            div({ style: { flex: 1 } }), Txt(`${store.lessonsDone} / ${TUTORIAL_LESSONS}`, 20, 0xff6b4bd6)),
          space(6),
          div({ style: { height: 16, background: '#fff', borderRadius: 8, border: `3px solid ${css(INK)}`, overflow: 'hidden', flex: 'none' } },
            div({ style: { width: `${(store.lessonsDone / TUTORIAL_LESSONS) * 100}%`, height: '100%', background: css(0xff5fd068) } })),
          space(12),
          rowOf(0), space(10), rowOf(1)),
        Panel({ w: 300, style: { height: '100%' } },
          col({ height: '100%', padding: 14, alignItems: 'center' },
            Canvas('100%', 170, (ctx, t, vw, vh) => {
              const hop = Math.abs(Math.sin(t * 2.5)) * 6;
              drawMongi(ctx, vw / 2, vh - 10, 2, 0xffff4f64, { hop: hop / 2 });
              label(ctx, '7', vw / 2, vh - 10 - 16 - hop, 24, WHITE, 5);
              label(ctx, '🎓', vw / 2 + 2, vh - 136 - hop, 36);
            }, { anim: true, style: { flex: 'none' } }),
            Txt('동글이 코치', 24),
            Txt('"하나씩 따라 해 보면\n금방 축구 왕이 될 거야!"', 16, fade(0.65), { multi: true, align: 'center' }),
            div({ style: { flex: 1 } }),
            TextButton(firstTodo != null ? `▶ ${firstTodo + 1}번 수업 하기` : '▶ 처음부터 다시', () => app.go('tutorialPlay', { start: firstTodo ?? 0 }), GreenG, 250, 56, 22),
            space(6),
            TextButton('📖 조작법 · 스킬 도감', () => app.go('guide'), WhiteG, 250, 46, 18))))));
}

/** 조작법 · 스킬 도감 */
export function GuideScreen(app) {
  app.onBack = () => app.go('tutorial');
  const how = {
    FIRE: ['아이템 버튼 → 슛!', '불꽃 슛은 골키퍼도 못 막아요'],
    GIANT: ['누르면 바로 커져요', '몸싸움 무적 + 태클 100%'],
    CURVE: ['아이템 버튼 → 슛!', '휘어서 구석으로 쏙'],
    WALL: ['위험할 때 누르기', '우리 골대 앞에 벽'],
    SPEED: ['누르면 바로 빨라져요', '대시랑 같이 쓰면 최고'],
    MAGNET: ['공 가까이에서 누르기', '공이 내 발로 쏙!'],
    ICE: ['상대가 공 가졌을 때', '공 가진 상대를 꽁꽁'],
    BANANA: ['도망갈 때 누르기', '뒤에 바나나를 떨궈요'],
  };
  const controls = [
    [WHITE, '🕹️', '조이스틱', '움직이기 · 슛 방향 정하기'],
    [0xffff4f64, '슛', '슛 / 태클', '꾹 누를수록 센 슛 · 공 없으면 태클'],
    [0xff4f8cff, '패스', '패스 / 교체', '꾹 누르면 먼 패스 · 공 없으면 교체'],
    [0xffffb627, '대시', '대시', '잠깐 빠르게 달리기'],
    [WHITE, '❓', '아이템', '모은 스킬 쓰기'],
  ];
  const itemCard = (it) => {
    const [tip, desc] = how[it.name];
    return Panel({ flex: 1, style: { height: '100%' } },
      col({ height: '100%', padding: 8, alignItems: 'center', justifyContent: 'center' },
        div({ class: 'center', style: { width: 62, height: 62, background: '#fff', borderRadius: '50%', border: `3.5px solid ${css(INK)}` } }, Txt(it.emoji, 32)),
        space(4), Txt(it.title, 21), space(6),
        div({ class: 'center', style: { alignSelf: 'stretch', background: css(0xfffff3a6), borderRadius: 12, border: `2.5px solid ${css(INK)}`, padding: '3px 0' } }, Txt(`👉 ${tip}`, 14.5)),
        space(6), Txt(desc, 13.5, fade(0.65), { align: 'center' })));
  };
  return div({ class: 'screen' },
    DotsBackground(0xffffe9f2),
    col({ position: 'absolute', inset: 0 },
      TopBar('📖 조작법 · 스킬 도감', 0xffff7eb0, () => app.go('tutorial')),
      row({ flex: 1, minHeight: 0, padding: 16, gap: 14, alignItems: 'stretch' },
        Panel({ w: 330, style: { height: '100%' } },
          col({ height: '100%', padding: '12px 16px', gap: 10 },
            Txt('🎮 버튼 조작법', 23),
            controls.map(([c, sym, t1, t2]) => row({},
              div({ class: 'center', style: { width: 48, height: 48, borderRadius: '50%', background: css(c), border: `3.5px solid ${css(INK)}`, flex: 'none' } },
                c === WHITE ? Txt(sym, 22) : OTxt(sym, sym.length > 1 ? 16 : 20, WHITE, { strokeWidth: 4 })),
              space(12),
              col({}, Txt(t1, 19), Txt(t2, 14, fade(0.6))))))),
        col({ flex: 1, gap: 10, minWidth: 0 },
          [0, 1].map((r) => row({ flex: 1, gap: 12, alignItems: 'stretch', minHeight: 0 }, [0, 1, 2, 3].map((c) => itemCard(ItemTypes[r * 4 + c]))))))));
}

/** 튜토리얼을 끝까지 했을 때 */
export function TutorialDoneOverlay(gotReward, onGuide, onClose) {
  return div({ class: 'dim', onPointerdown: (e) => e.stopPropagation() },
    Panel({ w: 480, h: 330 },
      col({ height: '100%', padding: 18, alignItems: 'center' },
        OTxt('🎓 튜토리얼 끝!', 44, Gold, { strokeWidth: 8 }),
        space(6),
        Txt('이제 진짜 경기에서 실력을 보여 줘요!', 19),
        space(10),
        gotReward ? Txt(`🎁 졸업 선물 🪙${TUTORIAL_REWARD} 코인!`, 24, 0xffe08a00) : null,
        div({ style: { flex: 1 } }),
        row({ gap: 10 }, TextButton('📖 스킬 도감', onGuide, WhiteG, 190, 52, 19), TextButton('확인 ▶', onClose, GreenG, 170, 52, 21)))));
}

export { ItemType };
