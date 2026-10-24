import { fmt1 } from '../core.js';

export const Rarity = {
  LEGEND: { label: '전설', color: 0xffff9f1c, weight: 6 },
  EPIC: { label: '영웅', color: 0xffb18cff, weight: 10 },
  RARE: { label: '희귀', color: 0xff55a8ff, weight: 16 },
  COMMON: { label: '일반', color: 0xff5fd068, weight: 26 },
};

export const Items = {
  MAX_LEVEL: 5,
  BOX_PRICE: 500,
  upgradeCost: (level) => 200 * level,
  giantTime: (l) => 5 + l,
  curveCatchCut: (l) => 0.45 + l * 0.07,
  wallTime: (l) => 5 + l * 1.5,
  speedTime: (l) => 3.5 + l * 0.7,
  magnetRange: (l) => 10 + l * 2.5,
  iceTime: (l) => 2 + l * 0.5,
  slipTime: (l) => 1.2 + l * 0.2,
  roll(r) {
    const total = ItemTypes.reduce((s, t) => s + t.rarity.weight, 0);
    let x = r.int(total);
    for (const t of ItemTypes) { x -= t.rarity.weight; if (x < 0) return t; }
    return ItemType.BANANA;
  },
};

function item(name, emoji, title, rarity, desc, effect) {
  return { name, emoji, title, rarity, desc, effect };
}

export const ItemType = {
  FIRE: item('FIRE', '🔥', '파이어 슛', Rarity.LEGEND, '다음 슛이 불꽃 슛! 골키퍼도 밀려나요', (l) => `슛 속도 ${44 + l * 2}`),
  GIANT: item('GIANT', '🍄', '거대화', Rarity.LEGEND, '몸이 커져서 몸싸움 무적', (l) => `${fmt1(Items.giantTime(l))}초 동안 거대화`),
  CURVE: item('CURVE', '🌀', '회오리 커브', Rarity.EPIC, '휘어져 들어가는 마법 슛', (l) => `골키퍼 선방률 -${Math.trunc(Items.curveCatchCut(l) * 100)}%`),
  WALL: item('WALL', '🧱', '철벽 골문', Rarity.EPIC, '우리 골문 앞에 벽이 생겨요', (l) => `${fmt1(Items.wallTime(l))}초 동안 벽`),
  SPEED: item('SPEED', '⚡', '번개 신발', Rarity.RARE, '잠깐 동안 달리기 속도 UP', (l) => `${fmt1(Items.speedTime(l))}초 동안 속도 x1.65`),
  MAGNET: item('MAGNET', '🧲', '자석 공', Rarity.RARE, '공이 내 발로 쏙!', (l) => `${Math.trunc(Items.magnetRange(l))}m 안의 공을 끌어와요`),
  ICE: item('ICE', '❄️', '얼음 태클', Rarity.RARE, '공 가진 상대를 꽁꽁', (l) => `${fmt1(Items.iceTime(l))}초 동안 꽁꽁`),
  BANANA: item('BANANA', '🍌', '바나나 함정', Rarity.COMMON, '밟으면 꽈당 미끄러져요',
    (l) => (l >= 4 ? `바나나 2개 · ${fmt1(Items.slipTime(l))}초 꽈당` : `${fmt1(Items.slipTime(l))}초 꽈당`)),
};
export const ItemTypes = Object.values(ItemType);
export const itemByName = (n) => ItemType[n] ?? null;
