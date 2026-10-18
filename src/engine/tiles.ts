import type { Wind } from './types';

/**
 * 牌以字串表示：'1m'–'9m' 萬、'1p'–'9p' 筒、'1s'–'9s' 索、
 * '1z'–'7z' 東南西北中發白、'1f'–'8f' 春夏秋冬梅蘭菊竹。
 * 引擎內部以 0–33 的索引計數：萬 0–8、筒 9–17、索 18–26、字 27–33。
 */

export const SUIT_CHARS = ['m', 'p', 's', 'z'] as const;

export const ALL_TILES: string[] = [
  ...['m', 'p', 's'].flatMap((s) => [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `${n}${s}`)),
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => `${n}z`),
];

export const FLOWERS: string[] = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `${n}f`);

const NUM_NAMES = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const SUIT_NAMES: Record<string, string> = { m: '萬', p: '筒', s: '索' };
export const HONOR_NAMES = ['東', '南', '西', '北', '中', '發', '白'];
export const FLOWER_NAMES = ['春', '夏', '秋', '冬', '梅', '蘭', '菊', '竹'];
export const WIND_NAMES: Record<Wind, string> = { E: '東', S: '南', W: '西', N: '北' };
export const WINDS: Wind[] = ['E', 'S', 'W', 'N'];

export function isFlower(t: string): boolean {
  return /^[1-8]f$/.test(t);
}

export function isValidTile(t: string): boolean {
  return /^[1-9][mps]$/.test(t) || /^[1-7]z$/.test(t);
}

/** '123m 5z' → ['1m','2m','3m','5z']（數字在前，花色字母在後） */
export function parseTiles(s: string): string[] {
  const out: string[] = [];
  let digits: string[] = [];
  for (const ch of s.replace(/\s+/g, '')) {
    if (/[0-9]/.test(ch)) {
      digits.push(ch);
    } else if ('mpszf'.includes(ch)) {
      if (digits.length === 0) throw new Error(`花色「${ch}」前沒有數字`);
      for (const d of digits) {
        const t = `${d}${ch}`;
        if (!isValidTile(t) && !isFlower(t)) throw new Error(`非法牌：${t}`);
        out.push(t);
      }
      digits = [];
    } else {
      throw new Error(`無法解析：${ch}`);
    }
  }
  if (digits.length) throw new Error(`數字「${digits.join('')}」後沒有花色`);
  return out;
}

export function tileIndex(t: string): number {
  const n = Number(t[0]);
  const s = SUIT_CHARS.indexOf(t[1] as (typeof SUIT_CHARS)[number]);
  if (s < 0 || !isValidTile(t)) throw new Error(`非法牌：${t}`);
  return s * 9 + (n - 1);
}

export function indexTile(i: number): string {
  return ALL_TILES[i];
}

/** 0 萬、1 筒、2 索、3 字 */
export function suitOf(i: number): number {
  return Math.floor(i / 9);
}

/** 數牌 1–9；字牌 1–7 */
export function numOf(i: number): number {
  return (i % 9) + 1;
}

export function isHonor(i: number): boolean {
  return i >= 27;
}

export function isTerminal(i: number): boolean {
  return !isHonor(i) && (numOf(i) === 1 || numOf(i) === 9);
}

export function isTerminalOrHonor(i: number): boolean {
  return isHonor(i) || isTerminal(i);
}

export function isDragon(i: number): boolean {
  return i >= 31;
}

export function isWind(i: number): boolean {
  return i >= 27 && i <= 30;
}

export function windIndex(w: Wind): number {
  return 27 + WINDS.indexOf(w);
}

export function toCounts(tiles: string[]): number[] {
  const c = new Array<number>(34).fill(0);
  for (const t of tiles) c[tileIndex(t)]++;
  return c;
}

export function tileName(t: string): string {
  if (isFlower(t)) return FLOWER_NAMES[Number(t[0]) - 1];
  if (t[1] === 'z') return HONOR_NAMES[Number(t[0]) - 1];
  return NUM_NAMES[Number(t[0]) - 1] + SUIT_NAMES[t[1]];
}

function sortKey(t: string): number {
  return isFlower(t) ? 100 + Number(t[0]) : tileIndex(t);
}

export function sortTiles(tiles: string[]): string[] {
  return [...tiles].sort((a, b) => sortKey(a) - sortKey(b));
}

/** 春夏秋冬梅蘭菊竹 1–8；東家為春梅、南家夏蘭、西家秋菊、北家冬竹 */
export function isSeatFlower(flower: string, seat: Wind): boolean {
  const n = Number(flower[0]);
  const s = WINDS.indexOf(seat) + 1;
  return n === s || n === s + 4;
}
