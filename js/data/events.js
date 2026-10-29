import { Legends, Programs } from './legends.js';

/* ───────── 이벤트 센터 ─────────
 * 끝나는 시각이 지나면 목록에서 사라지고, 다 끝나면 "이벤트 없음".
 * 모든 휴대폰에서 같은 시각에 끝나도록 한국 시간으로 정해 둔다.
 */
export const EVENTS = [
  {
    id: 'first-player-2026-11',
    kind: 'legend',
    title: '첫 플레이어 이벤트',
    /** 경기를 이만큼 하면 받을 수 있다 (어떤 경기든) */
    needMatches: 1,
    legendId: 17, // 킬리안 음바빠
    evo: 10,
    end: Date.parse('2026-11-04T18:51:00+09:00'),
  },
  {
    id: Programs[0].eventId,
    kind: 'program',
    title: Programs[0].name,
    /** 이벤트가 열린 뒤에 한 경기만 센다. 이만큼 할 때마다 프로그램 선수 1명을 골라 받는다 */
    needMatches: 80,
    program: Programs[0],
    end: Programs[0].saleFrom,
  },
];
EVENTS.forEach((e) => { if (e.legendId != null) e.legend = Legends.get(e.legendId); });

export const activeEvents = (now = Date.now()) => EVENTS.filter((e) => now < e.end);

/** "6일 23시간 59분" (하루 안 남으면 "5시간 3분", 1분 안 남으면 "1분 미만") */
export function remainText(ms) {
  const min = Math.floor(ms / 60000);
  if (min < 1) return '1분 미만';
  const d = Math.floor(min / 1440), hh = Math.floor((min % 1440) / 60), mm = min % 60;
  return `${d ? `${d}일 ` : ''}${d || hh ? `${hh}시간 ` : ''}${mm}분`;
}

/** "11월 4일(수) 오후 6시 51분" (한국 시간) */
export function endText(t) {
  const k = new Date(t + 9 * 3600000);
  const h = k.getUTCHours(), m = k.getUTCMinutes();
  const day = '일월화수목금토'[k.getUTCDay()];
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일(${day}) ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}시${m ? ` ${m}분` : ''}`;
}
