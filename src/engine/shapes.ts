import { indexTile, isHonor, numOf, tileIndex, toCounts } from './tiles';
import type { Meld } from './types';

/** 暗手拆出的牌組（未區分明暗） */
export interface RawGroup {
  kind: 'chow' | 'pung' | 'pair' | 'single';
  /** 順子為最細一張 */
  tile: number;
}

export const ORPHANS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

const total = (c: number[]) => c.reduce((a, b) => a + b, 0);

/** 列出把暗手拆成 meldsNeeded 個面子加一對眼的所有拆法 */
export function basicDecompositions(counts: number[], meldsNeeded: number): RawGroup[][] {
  if (total(counts) !== meldsNeeded * 3 + 2) return [];
  const results: RawGroup[][] = [];
  const c = [...counts];
  const acc: RawGroup[] = [];

  const walk = (hasPair: boolean) => {
    let i = 0;
    while (i < 34 && c[i] === 0) i++;
    if (i === 34) {
      if (hasPair) results.push([...acc]);
      return;
    }
    if (c[i] >= 3) {
      c[i] -= 3;
      acc.push({ kind: 'pung', tile: i });
      walk(hasPair);
      acc.pop();
      c[i] += 3;
    }
    if (!isHonor(i) && numOf(i) <= 7 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--, c[i + 1]--, c[i + 2]--;
      acc.push({ kind: 'chow', tile: i });
      walk(hasPair);
      acc.pop();
      c[i]++, c[i + 1]++, c[i + 2]++;
    }
    if (!hasPair && c[i] >= 2) {
      c[i] -= 2;
      acc.push({ kind: 'pair', tile: i });
      walk(true);
      acc.pop();
      c[i] += 2;
    }
  };
  walk(false);
  return results;
}

/** 嚦咕嚦咕：八對加一張與所持對子重複的牌（即七對加一刻），四張相同作兩對 */
export function isLigu(counts: number[]): boolean {
  if (total(counts) !== 17) return false;
  let threes = 0;
  for (const n of counts) {
    if (n === 1) return false;
    if (n === 3) threes++;
  }
  return threes === 1;
}

/** 嚦咕形牌組：每對一組，三張者另加一張單張 */
export function liguGroups(counts: number[]): RawGroup[] {
  const groups: RawGroup[] = [];
  counts.forEach((n, i) => {
    for (let k = 0; k < Math.floor(n / 2); k++) groups.push({ kind: 'pair', tile: i });
    if (n % 2) groups.push({ kind: 'single', tile: i });
  });
  return groups;
}

/**
 * 十三么：十三款么九各一，其中一款成對，再加一組面子；須門清。
 * extMelds 為已開的槓（只容許作為那一組面子）。回傳所有可能排法。
 */
export function thirteenOrphansArrangements(counts: number[], extMelds: number): RawGroup[][] {
  if (extMelds > 1 || total(counts) !== 14 + 3 * (1 - extMelds)) return [];
  const c = [...counts];
  for (const o of ORPHANS) {
    if (c[o] < 1) return [];
    c[o]--;
  }
  const singles = ORPHANS.map((o) => ({ kind: 'single' as const, tile: o }));
  const out: RawGroup[][] = [];
  for (const o of ORPHANS) {
    if (c[o] < 1) continue;
    const rest = [...c];
    rest[o]--;
    const pairGroup: RawGroup = { kind: 'pair', tile: o };
    const others = singles.filter((s) => s.tile !== o);
    if (extMelds === 1) {
      if (total(rest) === 0) out.push([...others, pairGroup]);
      continue;
    }
    for (const meld of singleMeld(rest)) out.push([...others, pairGroup, meld]);
  }
  return out;
}

export function isThirteenOrphans(counts: number[], extMelds: number): boolean {
  return thirteenOrphansArrangements(counts, extMelds).length > 0;
}

function singleMeld(c: number[]): RawGroup[] {
  if (total(c) !== 3) return [];
  const i = c.findIndex((n) => n > 0);
  if (c[i] === 3) return [{ kind: 'pung', tile: i }];
  if (!isHonor(i) && numOf(i) <= 7 && c[i] === 1 && c[i + 1] === 1 && c[i + 2] === 1) {
    return [{ kind: 'chow', tile: i }];
  }
  return [];
}

/** 十六不搭：七款字牌、每門三張互不相搭（至少相隔三個數字），再加當中一張成眼 */
export function isSixteenUnrelated(counts: number[]): boolean {
  if (total(counts) !== 17) return false;
  let pairs = 0;
  for (let i = 0; i < 34; i++) {
    if (counts[i] > 2) return false;
    if (counts[i] === 2) pairs++;
  }
  if (pairs !== 1) return false;
  for (let i = 27; i < 34; i++) if (counts[i] < 1) return false;
  for (let s = 0; s < 3; s++) {
    const nums = [];
    for (let n = 0; n < 9; n++) if (counts[s * 9 + n] > 0) nums.push(n + 1);
    if (nums.length !== 3) return false;
    if (nums[1] - nums[0] < 3 || nums[2] - nums[1] < 3) return false;
  }
  return true;
}

/** 十六不搭三門所用的數字（例如 [[1,5,9],[1,4,8],[2,6,9]]） */
export function sixteenSuitNumbers(counts: number[]): number[][] {
  return [0, 1, 2].map((s) => {
    const nums = [];
    for (let n = 0; n < 9; n++) if (counts[s * 9 + n] > 0) nums.push(n + 1);
    return nums;
  });
}

export function meldTiles(m: Meld): string[] {
  const i = tileIndex(m.tile);
  if (m.kind === 'chow') return [indexTile(i), indexTile(i + 1), indexTile(i + 2)];
  const n = m.kind === 'pung' ? 3 : 4;
  return new Array<string>(n).fill(m.tile);
}

export function isKong(m: Meld): boolean {
  return m.kind === 'kong' || m.kind === 'addedKong' || m.kind === 'concealedKong';
}

/** 這副牌（暗手連食糊牌 + 明章）能否食糊 */
export function isWinningShape(counts: number[], melds: Meld[]): boolean {
  if (basicDecompositions(counts, 5 - melds.length).length > 0) return true;
  if (melds.length === 0 && (isLigu(counts) || isSixteenUnrelated(counts))) return true;
  const kongsOnly = melds.every((m) => m.kind === 'concealedKong' || m.kind === 'kong');
  return kongsOnly && isThirteenOrphans(counts, melds.length);
}

/** 叫糊：加入哪些牌可以食糊（自己已持有四張的牌除外） */
export function computeWaits(preWin: string[], melds: Meld[]): string[] {
  const counts = toCounts(preWin);
  const owned = toCounts([...preWin, ...melds.flatMap(meldTiles)]);
  const waits: string[] = [];
  for (let i = 0; i < 34; i++) {
    if (owned[i] >= 4) continue;
    counts[i]++;
    if (isWinningShape(counts, melds)) waits.push(indexTile(i));
    counts[i]--;
  }
  return waits;
}
