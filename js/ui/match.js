import { div, Canvas, PauseOverlay } from './kit.js';
import { TutorialDoneOverlay } from './tutorialScreens.js';
import { MatchEngine, Btn } from '../game/engine.js';
import { drawMatch, ControlLayout, TouchState } from '../game/render.js';
import { TutorialRun, drawTutorialOverlay } from '../game/tutorial.js';
import { finishMatch, quitMatch } from '../app.js';
import { Sound } from '../sound.js';

/** 터치: 왼쪽 아래는 조이스틱, 오른쪽 아래는 버튼 (여러 손가락 동시에) */
function attachTouches(canvas, app, getEngine, touch, onPause, intercept) {
  const owners = new Map();
  const toVirtual = (ev) => {
    const r = canvas.getBoundingClientRect();
    return [((ev.clientX - r.left) / r.width) * canvas.clientWidth, ((ev.clientY - r.top) / r.height) * canvas.clientHeight];
  };
  canvas.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    const e = getEngine();
    const vw = canvas.clientWidth;
    const L = new ControlLayout(vw);
    const p = toVirtual(ev);
    try { canvas.setPointerCapture(ev.pointerId); } catch { /* 일부 브라우저 */ }
    const b = L.hit(p);
    if (intercept?.(p, vw)) owners.set(ev.pointerId, 9);
    else if (L.isPause(p)) { onPause(); owners.set(ev.pointerId, 9); }
    else if (b != null) {
      // 슛·패스는 누르는 동안 힘을 모으고 손을 떼면 찬다
      if (b === Btn.SHOOT || b === Btn.PASS) e.startCharge(b); else e.press(b);
      touch.down[b] = true; owners.set(ev.pointerId, b);
    }
    else if (p[0] < vw * 0.55 && p[1] > 120) {
      // 조이스틱 자리에 새로 누르면 언제나 새 조이스틱 (손 뗀 신호를 놓쳐 굳은 조이스틱이 있어도 덮어쓴다)
      for (const [id, o] of [...owners]) if (o === -1) owners.delete(id);
      touch.joyActive = true; touch.joyBase = p; touch.joyKnob = p;
      e.joyX = 0; e.joyY = 0;
      owners.set(ev.pointerId, -1);
    } else owners.set(ev.pointerId, 9);
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (owners.get(ev.pointerId) !== -1) return;
    ev.preventDefault();
    const e = getEngine();
    const L = new ControlLayout(canvas.clientWidth);
    const p = toVirtual(ev);
    const dx = p[0] - touch.joyBase[0], dy = p[1] - touch.joyBase[1];
    const len = Math.hypot(dx, dy);
    const k = len > L.joyR ? L.joyR / len : 1;
    touch.joyKnob = [touch.joyBase[0] + dx * k, touch.joyBase[1] + dy * k];
    e.joyX = (dx * k) / L.joyR;
    e.joyY = (dy * k) / L.joyR;
  });
  const up = (ev) => {
    const o = owners.get(ev.pointerId);
    owners.delete(ev.pointerId);
    if (o === -1) { touch.joyActive = false; const e = getEngine(); e.joyX = 0; e.joyY = 0; }
    else if (o != null && o !== 9) {
      touch.down[o] = false;
      if (o === Btn.SHOOT || o === Btn.PASS) getEngine().releaseCharge(o);
    }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  // 아이폰이 손 뗀 신호 대신 '붙잡기 놓침'만 보내는 경우도 있다
  canvas.addEventListener('lostpointercapture', up);
  // 앱을 내렸다 오거나 다른 창으로 가면 조이스틱·버튼을 놓은 것으로
  const releaseAll = () => {
    owners.clear();
    touch.joyActive = false; touch.down.fill(false);
    const e = getEngine(); e.joyX = 0; e.joyY = 0; e.cancelCharge();
  };
  const onHidden = () => { if (document.hidden) releaseAll(); };
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', onHidden);
  return () => { window.removeEventListener('blur', releaseAll); document.removeEventListener('visibilitychange', onHidden); };
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
}

function resetTouch(e, t) {
  t.joyActive = false;
  t.down.fill(false);
  e.joyX = 0; e.joyY = 0;
  e.cancelCharge();
}

/* 키보드로도 할 수 있게 (컴퓨터에서 해 볼 때): 방향키/WASD 이동, J 슛, K 패스, L 대시, I 아이템 */
function attachKeys(getEngine, onPause) {
  const held = new Set();
  const map = { KeyJ: 0, KeyK: 1, KeyL: 2, KeyI: 3, Space: 0 };
  const apply = () => {
    const e = getEngine();
    const x = (held.has('ArrowRight') || held.has('KeyD') ? 1 : 0) - (held.has('ArrowLeft') || held.has('KeyA') ? 1 : 0);
    const y = (held.has('ArrowDown') || held.has('KeyS') ? 1 : 0) - (held.has('ArrowUp') || held.has('KeyW') ? 1 : 0);
    const m = Math.hypot(x, y) || 1;
    e.joyX = x / m; e.joyY = y / m;
  };
  const down = (ev) => {
    if (ev.repeat) return;
    if (ev.code === 'KeyP') { onPause(); return; }
    if (ev.code in map) {
      const b = map[ev.code];
      if (b === Btn.SHOOT || b === Btn.PASS) getEngine().startCharge(b); else getEngine().press(b);
      ev.preventDefault(); return;
    }
    held.add(ev.code); apply();
  };
  const upk = (ev) => {
    const b = map[ev.code];
    if (b === Btn.SHOOT || b === Btn.PASS) getEngine().releaseCharge(b);
    held.delete(ev.code); apply();
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', upk);
  return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', upk); };
}

/* ───────────── 경기 ───────────── */

export function MatchScreen(app, st, { setup, kind }) {
  if (st.el) return st.el;
  const engine = new MatchEngine(setup);
  const touch = new TouchState();
  st.paused = false;
  let reported = false;
  const root = div({ class: 'screen', style: { background: '#5fb553' } });
  let overlay = null;
  const pause = () => {
    if (st.paused || reported) return;
    st.paused = true;
    overlay = PauseOverlay(kind === 'quick' ? null : '포기하면 0:3 패배로 기록돼요',
      () => { st.paused = false; overlay.remove(); overlay = null; resetTouch(engine, touch); },
      () => { cleanup(); quitMatch(setup, kind); });
    root.append(overlay);
  };
  const canvas = Canvas('100%', '100%', (ctx, t, vw, vh) => drawMatch(ctx, engine, touch, vw, vh), { class: 'fill', anim: true });
  canvas.style.touchAction = 'none';
  root.append(canvas);
  const untouch = attachTouches(canvas, app, () => engine, touch, pause, null);
  const unkeys = attachKeys(() => engine, pause);
  const onHide = () => { if (document.hidden) pause(); };
  document.addEventListener('visibilitychange', onHide);
  const cleanup = () => { unkeys(); untouch(); document.removeEventListener('visibilitychange', onHide); };
  app.onBack = pause;
  let thunders = 0;
  app.onFrame = (dt) => {
    if (!st.paused) engine.update(dt);
    // 번개 슛 소리
    if (engine.thunderCount !== thunders) { thunders = engine.thunderCount; Sound.thunder(); }
    if (engine.done && !reported) {
      reported = true;
      cleanup();
      finishMatch(setup, kind, engine.outcome, false);
    }
  };
  st.engine = engine;
  st.el = root;
  return root;
}

/* ───────────── 튜토리얼 (실제 경기 엔진 위에 안내를 얹는다) ───────────── */

export function TutorialPlayScreen(app, st, { start }) {
  if (st.el) return st.el;
  const store = app.store;
  const run = new TutorialRun(store.levelsMap(), start, store.lineupMembers(), (i) => store.markLesson(i));
  const touch = new TouchState();
  st.paused = false;
  let reward = null;
  const root = div({ class: 'screen', style: { background: '#5fb553' } });
  let overlay = null;
  const exit = () => { cleanup(); app.go('tutorial'); };
  const pause = () => {
    if (st.paused || run.finished) return;
    st.paused = true;
    overlay = PauseOverlay(null, () => { st.paused = false; overlay.remove(); overlay = null; resetTouch(run.engine, touch); }, exit, '튜토리얼 나가기');
    root.append(overlay);
  };
  const canvas = Canvas('100%', '100%', (ctx, t, vw, vh) => {
    drawMatch(ctx, run.engine, touch, vw, vh);
    if (!run.finished) drawTutorialOverlay(ctx, run, vw, vh);
  }, { class: 'fill', anim: true });
  canvas.style.touchAction = 'none';
  root.append(canvas);
  const untouch = attachTouches(canvas, app, () => run.engine, touch, pause, (p, vw) => {
    if (run.finished) return true;
    const [l, tp, r, b] = run.skipRect(vw);
    if (p[0] >= l && p[0] <= r && p[1] >= tp && p[1] <= b) { run.skip(); resetTouch(run.engine, touch); return true; }
    if (run.intro) { run.dismissIntro(); return true; }
    return false;
  });
  const unkeys = attachKeys(() => run.engine, pause);
  const onHide = () => { if (document.hidden) pause(); };
  document.addEventListener('visibilitychange', onHide);
  const cleanup = () => { unkeys(); untouch(); document.removeEventListener('visibilitychange', onHide); };
  app.onBack = pause;
  app.onFrame = (dt) => {
    if (!st.paused && !run.finished) run.update(dt);
    if (run.finished && reward == null) {
      reward = store.claimTutorialReward();
      root.append(TutorialDoneOverlay(reward, () => { cleanup(); app.go('guide'); }, exit));
    }
  };
  st.el = root;
  return root;
}
