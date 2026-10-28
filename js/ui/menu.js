import { h, div, row, col, space, Txt, OTxt, CandyButton, TextButton, CircleButton, Panel, Chip, CoinChip, Badge, Canvas,
  drawMenuBackground, GoldG, BlueG, GreenG, PinkG, WhiteG, Gold, Ink } from './kit.js';
import { drawMongi, label, Face } from '../game/draw.js';
import { Grade, Legends } from '../data/legends.js';
import { ItemTypes, Items } from '../data/items.js';
import { TUTORIAL_LESSONS, TUTORIAL_REWARD } from '../data/store.js';
import { css, comma, INK, WHITE } from '../core.js';
import { Sound } from '../sound.js';
import { APP_VERSION } from '../version.js';
import { activeEvents } from '../data/events.js';

const fade = (a) => css(INK, a);

/* ───────────────────── 메인 메뉴 ───────────────────── */

export function MenuScreen(app, st) {
  const store = app.store;
  app.onBack = st.showRecord ? () => { st.showRecord = false; app.render(); } : null;
  // 출전 중인 선수는 그 선수 모습(머리 장식·번호)으로
  const cast = store.roster.map((p) => { const l = store.legendIn(p.slot); return l ? { slot: p.slot, name: l.short, num: l.num, hat: l.grade.hat, golden: l.grade === Grade.GOD } : p; });
  const wide = app.vw > 1150;
  const canUpgrade = ItemTypes.some((t) => store.level(t) < Items.MAX_LEVEL && store.coins >= Items.upgradeCost(store.level(t)));
  const playing = (store.worldCup && !store.worldCup.finished) || (store.league && !store.league.finished);

  const avatar = Canvas(34, 34, (ctx, t, vw, vh) => drawMongi(ctx, vw / 2 + 2, vh + 5, 0.56, 0xffff5a6e, { shadow: false }),
    { style: { borderRadius: '50%', background: css(0xff9fd8ff), border: `2.5px solid ${css(INK)}`, flex: 'none' } });

  const levelChip = Chip({ style: { position: 'absolute', left: 16, top: 16, cursor: 'pointer' }, onClick: () => { st.showRecord = true; app.render(); } },
    avatar,
    col({}, Txt(store.managerTitle, 15),
      div({ style: { width: 110, height: 9, background: css(0xffe6e1f5), border: `1.5px solid ${css(INK)}`, borderRadius: 5, overflow: 'hidden' } },
        div({ style: { width: `${(0.08 + store.profileProgress * 0.92) * 100}%`, height: '100%', background: css(0xff5fd068), borderRadius: 5 } }))),
    Txt('📊', 16));

  const topRight = row({ position: 'absolute', right: 16, top: 16, gap: 10 },
    Chip({ style: { cursor: 'pointer' }, onClick: () => { Sound.toggleMusic(); } }, Txt(store.music ? '🔊' : '🔇', 18), Txt(store.music ? '음악' : '음소거', 16)),
    Chip({}, Txt('🏆', 18), Txt(String(store.trophies), 20)),
    CoinChip(store.coins));

  const bigPlay = div({ style: { position: 'relative' } },
    CandyButton(() => app.go('play'), GreenG, { w: '100%', h: 128, radius: 30 },
      row({ width: '100%', height: '100%', padding: '0 20px' },
        div({ class: 'center', style: { width: 80, height: 80, background: '#fff', borderRadius: '50%', border: `3.5px solid ${css(INK)}`, flex: 'none' } }, Txt('⚽', 44)),
        space(16),
        col({ flex: 1 }, Txt('매치 & 플레이', 40), Txt('월드컵 · 리그 · 빠른 경기', 16, fade(0.72))),
        Txt('▶', 34))),
    playing ? Badge('진행 중') : null);

  const teamFig = Canvas(96, 66, (ctx, t, vw, vh) => {
    [4, 3].forEach((s, i) => {
      const l = store.legendIn(s);
      drawMongi(ctx, 30 + i * 36, vh - 4, 0.62, 0xffff5a6e, { flip: i === 1, shadow: false, hat: l ? l.grade.hat : store.player(s).hat, golden: l?.grade === Grade.GOD });
    });
  }, { style: { flex: 'none' } });

  const myTeam = CandyButton(() => app.go('team'), BlueG, { w: '100%', h: 92, radius: 26 },
    row({ width: '100%', height: '100%', padding: '0 16px' },
      teamFig, space(8),
      col({ flex: 1 }, Txt('👥 나의 팀', 30), Txt('포지션 · 라인업 · 포메이션', 14, fade(0.72))),
      col({ alignItems: 'center', background: '#fff', borderRadius: 16, border: `3px solid ${css(INK)}`, padding: '2px 12px' },
        Txt('팀 오버롤', 11, fade(0.6)), Txt(String(store.teamOvr), 26)),
      space(10), Txt('▶', 26)));

  const small = (icon, title, sub, colors, onClick, badge) => div({ style: { position: 'relative', flex: 1 } },
    CandyButton(onClick, colors, { w: '100%', h: 112 },
      col({ alignItems: 'center' }, Txt(icon, 34), Txt(title, 22), Txt(sub, 12, fade(0.7)))),
    badge ? Badge(badge) : null);

  const menu = col({ position: 'absolute', right: 32, top: 92, width: wide ? 456 : 420, gap: 10 },
    bigPlay,
    myTeam,
    row({ gap: 12, alignItems: 'stretch' },
      small('🎓', '튜토리얼', store.tutorialComplete ? '조작법 · 도감' : '조작법 배우기', WhiteG, () => app.go('tutorial'), !store.tutorialComplete ? `🪙${TUTORIAL_REWARD}` : null),
      small('🔄', '이적시장', `선수 ${comma(Legends.TOTAL)}명`, GoldG, () => app.go('transfer'), store.ownedLegends.size === 0 ? 'NEW' : null),
      small('🛒', '상점', '강화 · 장식 · 가방', PinkG, () => app.go('shop'), canUpgrade ? '강화!' : null)));

  // 이벤트 센터 (로고 아래, 왼쪽 여백은 오른쪽 메뉴와 같게)
  const events = activeEvents();
  const ready = events.some((e) => store.eventState(e) === 'ready');
  const fresh = events.some((e) => store.eventState(e) !== 'claimed');
  const eventBtn = div({ class: 'abs', style: { left: 32, top: 282, width: 330 } },
    CandyButton(() => app.go('events'), PinkG, { w: '100%', h: 84, radius: 26 },
      row({ width: '100%', height: '100%', padding: '0 16px', gap: 12 },
        div({ class: 'center', style: { width: 56, height: 56, background: '#fff', borderRadius: '50%', border: `3.5px solid ${css(INK)}`, flex: 'none' } }, Txt('🎁', 32)),
        col({ flex: 1 }, Txt('이벤트 센터', 26), Txt(events.length ? `진행 중 이벤트 ${events.length}개` : '진행 중 이벤트 없음', 13, fade(0.7))),
        Txt('▶', 24))),
    ready ? Badge('받기!') : fresh ? Badge('NEW') : null);

  return div({ class: 'screen' },
    Canvas('100%', '100%', (ctx, t, vw, vh) => drawMenuBackground(ctx, t, vw, vh, cast), { class: 'fill', anim: true }),
    levelChip,
    topRight,
    Logo({ position: 'absolute', left: 36, top: 112 }),
    eventBtn,
    menu,
    // 지금 열린 버전 (웹으로 열었는지 앱으로 열었는지도)
    div({ class: 'abs', style: { right: 14, bottom: 8 } }, OTxt(`v${APP_VERSION} · ${globalThis.AndroidSave ? '앱' : '웹'}`, 15, WHITE, { strokeWidth: 4 })),
    st.showRecord ? RecordDialog(store, () => { st.showRecord = false; app.render(); }) : null,
    !store.tutorialAsked ? TutorialAskDialog(
      () => { store.markTutorialAsked(); app.go('tutorial'); },
      () => store.markTutorialAsked()) : null);
}

function Logo(style) {
  const ribbon = Canvas(480, 42, (ctx, t, vw, vh) => {
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(vw, 0); ctx.lineTo(vw - 16, vh / 2); ctx.lineTo(vw, vh); ctx.lineTo(0, vh); ctx.lineTo(16, vh / 2); ctx.closePath();
    ctx.fillStyle = css(0xffff7eb0); ctx.fill();
    ctx.strokeStyle = css(INK); ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();
  }, { class: 'fill' });
  return col({ ...style, alignItems: 'center' },
    div({ style: { position: 'relative' } },
      div({ style: { position: 'absolute', left: 0, top: 8 } }, OTxt('동글동글 사커', 86, INK, { strokeWidth: 16 })),
      div({ style: { position: 'relative' } }, OTxt('동글동글 사커', 86, WHITE, { strokeWidth: 12, gradient: [0xfffff6a0, 0xffffd23f, 0xffff9f1c] }))),
    div({ class: 'center', style: { position: 'relative', marginTop: -4, width: 480, height: 42 } },
      ribbon, div({ style: { position: 'relative' } }, OTxt('DONGGLE DONGGLE SOCCER ★ 아이템 축구', 18, WHITE, { strokeWidth: 4 }))));
}

/* ───────────────────── 감독 전적 ───────────────────── */

export function RecordDialog(store, onClose) {
  const star = store.player(3);
  const stat = (lab, value, color) => col({ alignItems: 'center' }, Txt(lab, 15, fade(0.6)), Txt(value, 30, color));
  const box = (lab, value) => row({ flex: 1, height: 44, background: '#fff', borderRadius: 16, border: `3px solid ${css(INK)}`, padding: '0 14px' },
    div({ style: { flex: 1 } }, Txt(lab, 18)), Txt(value, 20));
  const recent = [...store.recent].map((r) => {
    const [txt, c] = r === 'W' ? ['승', 0xff5fd068] : r === 'D' ? ['무', 0xff55a8ff] : ['패', 0xffff4f64];
    return div({ class: 'center', style: { margin: '0 2px', width: 34, height: 34, background: css(c), borderRadius: '50%', border: `3px solid ${css(INK)}` } }, OTxt(txt, 16, WHITE, { strokeWidth: 3.5 }));
  });
  return div({ class: 'dim', style: { background: css(INK, 0.55) }, onClick: onClose },
    div({ onClick: (e) => e.stopPropagation() },
      Panel({ w: 700, h: 410 },
        col({ height: '100%', padding: '14px 24px' },
          row({},
            Canvas(104, 104, (ctx, t, vw, vh) => {
              drawMongi(ctx, vw / 2, vh - 4, 1.4, 0xffff4f64, { hat: star.hat });
              label(ctx, String(star.num), vw / 2, vh - 4 - 8 * 1.4, 17, WHITE, 4);
            }),
            space(14),
            col({ flex: 1 },
              NicknameField(store),
              row({ alignItems: 'flex-end' }, Txt(store.managerTitle, 32), Txt(`  · 다음 레벨까지 ${store.matchesToNextLevel}경기`, 17, fade(0.6))),
              space(6),
              div({ style: { height: 14, background: css(0xffeee8fa), borderRadius: 7, border: `3px solid ${css(INK)}`, overflow: 'hidden' } },
                div({ style: { width: `${(0.04 + store.profileProgress * 0.96) * 100}%`, height: '100%', background: css(0xff5fd068) } }))),
            space(10),
            div({ style: { alignSelf: 'flex-start' } }, CircleButton('✕', onClose, 44, 20))),
          space(12),
          row({ justifyContent: 'space-around', background: css(0xfffff8d6), borderRadius: 20, border: `3.5px solid ${css(INK)}`, padding: '10px 0' },
            stat('경기', String(store.matches), INK), stat('승리', String(store.wins), 0xff2bb24c), stat('무승부', String(store.draws), 0xff55a8ff),
            stat('패배', String(store.losses), 0xffff4f64), stat('승률', `${store.winRate}%`, 0xffe08a00)),
          space(10),
          row({ gap: 10 }, box('⚽ 넣은 골', String(store.goalsFor)), box('🧤 먹은 골', String(store.goalsAgainst)), box('🔥 최다 연승', String(store.bestStreak))),
          space(8),
          row({ gap: 10 }, box('🏆 월드컵 우승', String(store.wcTitles)), box('🏟️ 리그 우승', String(store.leagueTitles)), box('🎓 튜토리얼', `${store.lessonsDone}/${TUTORIAL_LESSONS}`)),
          div({ style: { flex: 1 } }),
          row({ justifyContent: 'center' },
            Txt('최근 5경기  ', 17, fade(0.6)),
            store.recent ? recent : Txt('아직 경기가 없어요', 16, fade(0.45)),
            Txt(`   다음 경기 참가 보상 🪙${store.nextParticipation}`, 17, fade(0.6)))))));
}

/** 감독 닉네임: 쓰고 나서(완료·바깥 누르기) 저장한다 */
function NicknameField(store) {
  const input = h('input', { class: 'name-input', maxlength: '8', placeholder: '감독 이름(닉네임)을 써요', enterkeyhint: 'done',
    style: { width: 260, height: 36, fontSize: 18, padding: '2px 10px' } });
  input.value = store.nickname;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); e.stopPropagation(); });
  input.addEventListener('change', () => store.setNickname(input.value));
  input.addEventListener('click', (e) => e.stopPropagation());
  return row({ gap: 6, marginBottom: 2 }, Txt('✏️ 감독 이름', 15, fade(0.6)), input);
}

/** 처음 켰을 때 튜토리얼 권하기 */
function TutorialAskDialog(onYes, onLater) {
  return div({ class: 'dim', style: { background: css(INK, 0.55) } },
    Panel({ w: 520, h: 300 },
      col({ height: '100%', padding: 18, alignItems: 'center' },
        OTxt('동글동글 사커에 온 걸 환영해요!', 30, Gold, { strokeWidth: 7 }),
        space(10),
        Txt('처음이라면 튜토리얼로 조작법과\n스킬 쓰는 법을 배워 볼까요?', 21, INK, { multi: true, align: 'center' }),
        space(6),
        Txt(`다 끝내면 🪙${TUTORIAL_REWARD} 코인 선물!`, 18, 0xffe08a00),
        div({ style: { flex: 1 } }),
        row({ gap: 10 }, TextButton('나중에', onLater, WhiteG, 150, 52, 19), TextButton('🎓 튜토리얼 하기', onYes, GreenG, 230, 52, 21)))));
}

export { Ink, GoldG, Face };
