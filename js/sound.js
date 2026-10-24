/** 배경 음악(마지막 휘슬)과 효과음. 브라우저는 처음 터치한 뒤부터 소리를 낼 수 있다 */
export const Sound = {
  store: null,
  bgm: null,
  fx: null,
  unlocked: false,

  init(store) {
    this.store = store;
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
    if (!this.unlocked || !this.musicOn || document.hidden) return;
    this.bgm.play().catch(() => {});
  },
  pause() { this.bgm?.pause(); },

  toggleMusic() {
    this.store.setMusic(!this.store.music);
    if (this.store.music) this.resume(); else this.pause();
  },

  /** 행운 상자·선수 뽑기 "빠빰!" */
  babam() {
    if (!this.unlocked) return;
    try {
      const a = this.fx.cloneNode();
      a.play().catch(() => {});
    } catch { /* 소리를 못 내도 게임은 계속 */ }
  },
};
