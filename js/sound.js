/** 배경 음악(마지막 휘슬)과 효과음. 브라우저는 처음 터치한 뒤부터 소리를 낼 수 있다 */
export const Sound = {
  store: null,
  bgm: null,
  fx: null,
  unlocked: false,

  init(store) {
    this.store = store;
    // 안드로이드 앱 안에서는 앱이 소리를 낸다 (배경 음악·빠빰!)
    this.native = globalThis.AndroidSound ?? null;
    if (this.native) { this.native.setMusic(store.music); return; }
    this.bgm = new Audio('assets/bgm.m4a');
    this.bgm.loop = true;
    this.bgm.volume = 0.55;
    this.bgm.preload = 'auto';
    this.fx = new Audio('assets/babam.wav');
    this.fx.preload = 'auto';
    const unlock = () => {
      if (this.unlocked) return;
      this.unlocked = true;
      this.resume();
      // iOS: 효과음도 한 번 깨워 둔다
      this.fx.muted = true;
      this.fx.play().then(() => { this.fx.pause(); this.fx.currentTime = 0; this.fx.muted = false; }).catch(() => { this.fx.muted = false; });
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    document.addEventListener('visibilitychange', () => (document.hidden ? this.pause() : this.resume()));
  },

  get musicOn() { return this.store?.music ?? true; },

  resume() {
    if (this.native) return;
    if (!this.unlocked || !this.musicOn || document.hidden) return;
    this.bgm.play().catch(() => {});
  },
  pause() { if (!this.native) this.bgm?.pause(); },

  toggleMusic() {
    this.store.setMusic(!this.store.music);
    if (this.native) { this.native.setMusic(this.store.music); return; }
    if (this.store.music) this.resume(); else this.pause();
  },

  /** 번개 슛 "우르릉 쾅쾅" — 소리 파일 없이 낮은 잡음으로 만든 천둥 (번쩍 + 두 번 쾅) */
  thunder() {
    try {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return;
      const ac = (this.ac ??= new AC());
      if (ac.state === 'suspended') ac.resume();
      const len = 2.4, n = Math.floor(ac.sampleRate * len);
      const buf = ac.createBuffer(1, n, ac.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < n; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
      const src = ac.createBufferSource(); src.buffer = buf;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
      const g = ac.createGain();
      const t = ac.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(1.2, t + 0.03);   // 번쩍 (쾅)
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.3);
      g.gain.exponentialRampToValueAtTime(1.4, t + 0.45);   // 두 번째 쾅
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);  // 우르릉…
      src.connect(lp); lp.connect(g); g.connect(ac.destination);
      src.start(t); src.stop(t + len);
    } catch { /* 소리를 못 내도 게임은 계속 */ }
  },

  /** 행운 상자·선수 뽑기 "빠빰!" */
  babam() {
    if (this.native) { this.native.babam(); return; }
    if (!this.unlocked) return;
    try {
      const a = this.fx.cloneNode();
      a.play().catch(() => {});
    } catch { /* 소리를 못 내도 게임은 계속 */ }
  },
};
