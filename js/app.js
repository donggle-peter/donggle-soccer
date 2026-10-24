import { Store } from './data/store.js';
import { Roster } from './data/teams.js';
import { MatchSetup, MatchOutcome } from './game/engine.js';
import { setScale, paintCanvases, h } from './ui/kit.js';
import { css } from './core.js';
import { Sound } from './sound.js';
import { MenuScreen } from './ui/menu.js';
import { PlayScreen, QuickScreen, ResultScreen } from './ui/play.js';
import { TutorialScreen, GuideScreen } from './ui/tutorialScreens.js';
import { MatchScreen, TutorialPlayScreen } from './ui/match.js';
import { WorldCupScreen } from './ui/worldcup.js';
import { LeagueScreen } from './ui/league.js';
import { ShopScreen } from './ui/shop.js';
import { TransferScreen } from './ui/transfer.js';
import { MyTeamScreen } from './ui/myteam.js';

/* ───────── 앱: 화면 전환 · 화면 크기 맞춤 · 매 프레임 그리기 ───────── */

const store = new Store();
Sound.init(store);

/** 경기 시작 준비: 내 라인업 · 아이템 레벨 · 시작 아이템 · 포메이션 */
export function matchSetup(home, away, title, knockout) {
  return new MatchSetup(home, away, title, knockout, store.levelsMap(), {
    roster: store.lineupMembers(), startItem: store.equipped, formation: store.formation,
  });
}

const VIEWS = {
  menu: MenuScreen, play: PlayScreen, quick: QuickScreen, result: ResultScreen,
  tutorial: TutorialScreen, guide: GuideScreen, tutorialPlay: TutorialPlayScreen,
  match: MatchScreen, worldcup: WorldCupScreen, league: LeagueScreen,
  shop: ShopScreen, transfer: TransferScreen, team: MyTeamScreen,
};

/** 화면마다 뒤쪽 바탕색 (노치·여백에 보이는 색) */
const BG = {
  menu: 0xff6ec3ff, play: 0xffd8f6cf, quick: 0xffddf6cf, result: 0xff2b2150, tutorial: 0xffe9f7ff, guide: 0xffffe9f2,
  tutorialPlay: 0xff5fb553, match: 0xff5fb553, worldcup: 0xff1c1347, league: 0xffc9f4e4, shop: 0xffffe9f2,
  transfer: 0xff1c1347, team: 0xffdff0ff,
};

const stage = document.getElementById('stage');

export const app = {
  store,
  route: { name: 'menu', params: {}, st: {} },
  vw: 1024,
  /** 지금 화면이 매 프레임 할 일 (경기 진행 등) */
  onFrame: null,
  /** 지금 화면의 뒤로 가기 */
  onBack: null,

  go(name, params = {}) {
    this.onFrame = null;
    this.onBack = null;
    this.route = { name, params, st: {} };
    this.render();
  },

  render() {
    const r = this.route;
    const view = VIEWS[r.name];
    // 스크롤 위치는 다시 그려도 그대로
    stage.querySelectorAll('[data-scroll]').forEach((el) => { (r.st.scroll ??= {})[el.dataset.scroll] = el.scrollTop; });
    const el = view(this, r.st, r.params);
    if (el !== stage.firstChild) {
      stage.replaceChildren(el);
      stage.querySelectorAll('[data-scroll]').forEach((s) => { s.scrollTop = r.st.scroll?.[s.dataset.scroll] ?? 0; });
    }
    document.body.style.background = css(BG[r.name] ?? 0xff6ec3ff);
    paintCanvases(stage);
  },
};

let pending = false;
store.subscribe(() => {
  if (pending) return;
  pending = true;
  queueMicrotask(() => { pending = false; app.render(); });
});

/* 경기 결과를 대회 진행·코인에 반영 */
export function applyResult(setup, kind, o, forfeit) {
  const res = o.homeResult;
  // 참가 보상 (10경기마다 늘어남) + 결과 보너스 + 골 보너스
  const join = forfeit ? 0 : Roster.participation(store.matches + 1);
  const bonus = forfeit ? 0 : (res === 1 ? 100 : res === 0 ? 40 : 20) + o.home * 10;
  let coins = join + bonus;
  const lines = [];
  if (kind === 'worldcup') {
    const wc = store.worldCup;
    if (wc) {
      const before = wc.stage;
      wc.applyMyResult(o.home, o.away, o.homeWonPk, store.random);
      if (wc.finished && wc.champion === wc.myTeam) {
        coins += 1500;
        lines.push('🏆 월드컵 우승!! 보너스 🪙1500');
        store.addTrophy(true);
      } else if (wc.finished && before === 6) {
        coins += 500;
        lines.push('🥈 준우승! 보너스 🪙500');
      } else if (wc.eliminated) lines.push(before < 3 ? '아쉽게 조별리그 탈락...' : `${wc.stageName(before)}에서 탈락...`);
      else if (before === 2 && wc.stage === 3) lines.push('🎉 16강 진출!');
      else if (before >= 3) { lines.push(`🎉 ${wc.stageName(wc.stage)} 진출!`); coins += 100 * (before - 2); }
      else {
        const g = wc.groupOf(wc.myTeam);
        const rank = wc.groupTable(g).findIndex((s) => s.id === wc.myTeam) + 1;
        lines.push(`${String.fromCharCode(65 + g)}조 현재 ${rank}위`);
      }
      store.setWorldCup(wc);
    }
  } else if (kind === 'league') {
    const s = store.league;
    if (s) {
      s.applyMyResult(o.home, o.away, store.random);
      const rank = s.myRank();
      if (s.finished) {
        const b = rank === 1 ? 1500 : rank === 2 ? 700 : rank === 3 ? 400 : 150;
        coins += b;
        lines.push(rank === 1 ? `🏆 리그 우승!! 보너스 🪙${b}` : `시즌 종료 · 최종 ${rank}위 (보너스 🪙${b})`);
        if (rank === 1) store.addTrophy(false);
      } else lines.push(`현재 리그 ${rank}위`);
      store.setLeague(s);
    }
  }
  store.addCoins(coins);
  store.recordMatch(res, o.home, o.away);
  const detail = forfeit ? '' : `참가 🪙${join} + 결과·골 🪙${bonus}` + (coins > join + bonus ? ` + 보너스 🪙${coins - join - bonus}` : '');
  return { setup, outcome: o, coins, lines, forfeit, detail };
}

/** 경기 시작 (kind: worldcup | league | quick) */
export function startMatch(setup, kind) { app.go('match', { setup, kind }); }

export function finishMatch(setup, kind, outcome, forfeit) {
  const info = applyResult(setup, kind, outcome, forfeit);
  app.go('result', { info, kind });
}

export function quitMatch(setup, kind) {
  if (kind === 'quick') app.go('quick');
  else finishMatch(setup, kind, new MatchOutcome(0, 3), true);
}

/* ───────── 화면 크기: 세로 576 (가로 최소 1024) 가상 단위 ───────── */

const probe = h('div', { style: 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)' });
document.body.append(probe);

function layout() {
  const cs = getComputedStyle(probe);
  // 안드로이드 앱 안에서는 예전 앱처럼 카메라 구멍 자리까지 화면을 꽉 채운다
  const edge = !!globalThis.AndroidSave;
  const L = edge ? 0 : parseFloat(cs.paddingLeft) || 0, R = edge ? 0 : parseFloat(cs.paddingRight) || 0;
  const T = edge ? 0 : parseFloat(cs.paddingTop) || 0, B = edge ? 0 : parseFloat(cs.paddingBottom) || 0;
  const W = window.innerWidth - L - R, H = window.innerHeight - T - B;
  const u = Math.min(H / 576, W / 1024);
  app.vw = W / u;
  stage.style.width = `${app.vw}px`;
  stage.style.transform = `scale(${u})`;
  stage.style.left = `${L}px`;
  stage.style.top = `${T + (H - 576 * u) / 2}px`;
  setScale(u);
  paintCanvases(stage);
}
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => setTimeout(layout, 300));

/* 뒤로 가기 (키보드 Esc · 안드로이드 뒤로 버튼) */
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') app.onBack?.(); });

/* 매 프레임: 경기 진행 + 움직이는 그림 */
let last = 0;
function frame(now) {
  const dt = last ? (now - last) / 1000 : 0;
  last = now;
  app.onFrame?.(dt, now);
  paintCanvases(stage, now);
  requestAnimationFrame(frame);
}

// 개발할 때 콘솔에서 확인용
globalThis.__donggle = { app, store };

/* 글꼴을 다 받은 뒤 시작 (안 그러면 첫 화면 글씨가 다른 글꼴로 그려짐) */
async function boot() {
  try { await document.fonts.load('20px Jua'); } catch { /* 그래도 시작 */ }
  layout();
  app.go('menu');
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !globalThis.AndroidSave) navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
