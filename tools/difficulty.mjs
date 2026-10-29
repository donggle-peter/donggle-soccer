// 난이도 확인: 사람처럼 조종하는 봇으로 경기를 돌려 평균 점수를 본다.  node tools/difficulty.mjs [경기 수]
import { MatchEngine, MatchSetup, Btn, FL, FW } from '../js/game/engine.js';
import { Teams, SquadMember } from '../js/data/teams.js';
import { powerOf } from '../js/data/legends.js';

const N = +(process.argv[2] || 24);
/** DRIBBLE=1 : 슛 없이 골대 안까지 그냥 몰고 달려가는 사람 */
const DRIBBLE = !!process.env.DRIBBLE;
const base = [SquadMember(1, true, { name: '철벽이' }), ...[4, 9, 7, 10].map((n) => SquadMember(n, false, { name: 'x' }))].map((m) => ({ ...m, legend: powerOf(46) }));

/** 잘하는 사람처럼: 공 있으면 골대로 몰고 가서 가까우면 구석으로 슛, 없으면 공으로 달려가 태클 */
function bot(e) {
  const h = e.human, b = e.ball;
  const has = b.owner === h;
  let tx, ty;
  if (has) {
    tx = FL; ty = FW / 2 + (h.y < FW / 2 ? -3 : 3);
    const d = Math.hypot(FL - h.x, FW / 2 - h.y);
    const [opp, od] = e.nearestOpp(h);
    if (opp && od < 4 && (opp.x - h.x) > -0.5) ty = h.y + (h.y >= opp.y ? 8 : -8);
    if (DRIBBLE) { tx = FL + 2; ty = FW / 2; }
    else if (d < 15) { e.joyY = h.y < FW / 2 ? 0.9 : -0.9; e.press(Btn.SHOOT); }
    else if (opp && od < 2.2 && Math.random() < 0.15) e.press(Btn.PASS);
    else if (Math.random() < 0.01) e.press(Btn.DASH);
  } else {
    const o = b.owner;
    tx = (o ? o.x : b.x) + b.vx * 0.2; ty = (o ? o.y : b.y) + b.vy * 0.2;
    if (o && o.team === 1 && !o.gk && Math.hypot(o.x - h.x, o.y - h.y) < 3.2) e.press(Btn.SHOOT);
  }
  if (DRIBBLE || !(has && Math.hypot(FL - h.x, FW / 2 - h.y) < 15)) {
    const dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy) || 1;
    e.joyX = dx / d; e.joyY = dy / d;
  }
}

for (const opp of ['JPN', 'GER', 'BRA']) {
  let gf = 0, ga = 0;
  for (let i = 0; i < N; i++) {
    const e = new MatchEngine(new MatchSetup(Teams.get('KOR'), Teams.get(opp), 't', false, {}, { roster: base }), 1000 + i);
    let k = 0;
    while (!e.done && k < 60 * 400) { if (e.phase === 1) bot(e); e.update(1 / 60); k++; }
    gf += e.score[0]; ga += e.score[1];
  }
  console.log(`${opp}(실력 ${Teams.get(opp).rating}) 평균 ${(gf / N).toFixed(1)} : ${(ga / N).toFixed(1)}`);
}
