import { MatchEngine, MatchSetup } from '../js/game/engine.js';
import { Teams } from '../js/data/teams.js';
import { Legends } from '../js/data/legends.js';
import { WorldCup } from '../js/data/tournament.js';
import { Rng } from '../js/core.js';
let gf = 0, ga = 0, n = 0;
for (let i = 0; i < 20; i++) {
  const e = new MatchEngine(new MatchSetup(Teams.get('KOR'), Teams.countries[(i * 3 + 2) % 32], 't', false, {}), 100 + i);
  e.autopilot = true;
  let k = 0; while (!e.done && k < 60 * 600) { e.update(1 / 60); k++; }
  gf += e.score[0]; ga += e.score[1]; n++;
}
console.log('AI vs AI', gf, ga, 'per match', ((gf + ga) / n).toFixed(2));
console.log('players', Legends.TOTAL, Legends.get(2).name, Legends.get(2).price);
const wc = WorldCup.create('KOR', new Rng(1)); const r = new Rng(2);
while (!wc.finished) wc.applyMyResult(1, 0, null, r);
console.log('wc champ', wc.champion, JSON.stringify(wc).length);
