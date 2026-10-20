import { FAN, type FanName } from './fanTable';
import { isHonor, numOf, suitOf } from './tiles';
import type { MeldKind } from './types';

/** 已定明暗的牌組 */
export interface Group {
  kind: 'chow' | 'pung' | 'kong' | 'pair' | 'single';
  /** 順子為最細一張 */
  tile: number;
  /** 暗：手中自成或自摸完成；明：上／碰／槓或食出銃完成 */
  concealed: boolean;
  meld?: MeldKind;
  winning: boolean;
}

/** 一個組合番種的實例：用了哪幾組牌 */
interface Instance {
  type: string;
  name: FanName;
  groups: number[];
  /** 「雙X」類由兩個子實例組成 */
  compType?: string;
  components?: number[][];
}

/** 選取左邊番種時，不計作為其子集的右邊番種（及以右邊番種組成的「雙X」） */
const SUBSET_EXCLUDES: Record<string, string[]> = {
  雙般高: ['一般高'],
  一色三同順: ['一般高'],
  一色四同順: ['一般高', '一色三同順', '四同順'],
  三相逢: ['相逢'],
  雙同順: ['相逢'],
  五同順: ['四同順'],
  清龍: ['老少順'],
  雙老少順: ['老少順', '雙同順', '相逢'],
  金門橋: ['連環套', '老少順'],
  清五步高: ['連環套'],
  小三連刻: ['兩連刻'],
  大三連刻: ['兩連刻', '小三連刻'],
  小四連刻: ['兩連刻', '小三連刻', '大三連刻'],
  大四連刻: ['兩連刻', '小三連刻', '大三連刻', '小四連刻'],
  小五連刻: ['兩連刻', '小三連刻', '大三連刻', '小四連刻', '大四連刻'],
  大五連刻: ['兩連刻', '小三連刻', '大三連刻', '小四連刻', '大四連刻', '小五連刻'],
  小六連刻: ['兩連刻', '小三連刻', '大三連刻', '小四連刻', '大四連刻', '小五連刻', '大五連刻'],
  雙連刻: ['兩連刻'],
  小三同刻: ['兩同刻'],
  大三同刻: ['兩同刻', '小三同刻'],
  雙同刻: ['兩同刻'],
  雙老少刻: ['老少刻', '雙同刻', '兩同刻'],
  三色連刻: ['小三色連刻'],
  小三色四連刻: ['小三色連刻', '三色連刻'],
  三色四連刻: ['小三色連刻', '三色連刻', '小三色四連刻'],
  小三色五連刻: ['小三色連刻', '三色連刻', '小三色四連刻', '三色四連刻'],
  三色五連刻: ['小三色連刻', '三色連刻', '小三色四連刻', '三色四連刻', '小三色五連刻'],
  小三色六連刻: ['小三色連刻', '三色連刻', '小三色四連刻', '三色四連刻', '小三色五連刻', '三色五連刻'],
};

/** 步高只計算最高達成的步高數（即使並非必然並存）；金門橋同理 */
const GLOBAL_EXCLUDES: Record<string, string[]> = {
  雜四步高: ['雜三步高', '清三步高'],
  清四步高: ['雜三步高', '清三步高'],
  雜五步高: ['雜三步高', '清三步高', '雜四步高', '清四步高'],
  清五步高: ['雜三步高', '清三步高', '雜四步高', '清四步高'],
  金門橋: ['連環套'],
};

/**
 * 四同順、五同順成立時，不再計單獨的般高（一般高）和相逢（見 README C.3）；
 * 雙般高、三相逢、雙同順不在此列。
 */
const SAME_NUMBER_EXCLUDES = ['一般高', '相逢'];

/** 有明／暗之分的番種 */
const OPEN_HIDDEN = new Set([
  '雙老少順',
  '雜龍',
  '清龍',
  '一色三同順',
  '一色四同順',
  '三相逢',
  '雜三步高',
  '雜四步高',
  '雜五步高',
  '清三步高',
  '清四步高',
  '清五步高',
  '連環套',
  '金門橋',
]);

function combos<T>(arr: T[], k: number): T[][] {
  const out: T[][] = [];
  const pick = (start: number, acc: T[]) => {
    if (acc.length === k) {
      out.push([...acc]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      acc.push(arr[i]);
      pick(i + 1, acc);
      acc.pop();
    }
  };
  pick(0, []);
  return out;
}

const distinct = (xs: number[]) => new Set(xs).size === xs.length;
const allSame = (xs: number[]) => xs.every((x) => x === xs[0]);
const isConsecutive = (xs: number[], step = 1) => xs.every((x, i) => i === 0 || x - xs[i - 1] === step);
const sameSet = (xs: number[], ys: number[]) =>
  xs.length === ys.length && [...xs].sort().every((x, i) => x === [...ys].sort()[i]);

export function findPatterns(groups: Group[]): Instance[] {
  const out: Instance[] = [];
  const add = (type: string, idx: number[], extra: Partial<Instance> = {}) => {
    let name = type;
    if (OPEN_HIDDEN.has(type)) name = (idx.every((i) => groups[i].concealed) ? '暗' : '明') + type;
    out.push({ type, name: name as FanName, groups: [...idx].sort((a, b) => a - b), ...extra });
  };
  const chows = groups.map((g, i) => (g.kind === 'chow' ? i : -1)).filter((i) => i >= 0);
  const suit = (i: number) => suitOf(groups[i].tile);
  const num = (i: number) => numOf(groups[i].tile);
  const byStart = (idx: number[]) => [...idx].sort((a, b) => num(a) - num(b));

  // ---- 順子 ----
  for (const c of combos(chows, 2)) {
    const [a, b] = c;
    if (groups[a].tile === groups[b].tile) add('一般高', c);
    else if (num(a) === num(b)) add('相逢', c);
    if (suit(a) === suit(b) && sameSet([num(a), num(b)], [1, 7])) add('老少順', c);
  }
  for (const c of combos(chows, 3)) {
    const s = c.map(suit);
    const n = byStart(c).map(num);
    if (allSame(c.map((i) => groups[i].tile))) add('一色三同順', c);
    if (allSame(n) && distinct(s)) add('三相逢', c);
    if (sameSet(n, [1, 4, 7])) {
      if (distinct(s)) add('雜龍', c);
      if (allSame(s)) add('清龍', c);
    }
    if (isConsecutive(n)) {
      if (distinct(s)) add('雜三步高', c);
      if (allSame(s)) add('清三步高', c);
    }
    if (allSame(s) && isConsecutive(n, 2)) add('連環套', c);
  }
  for (const c of combos(chows, 4)) {
    const sorted = byStart(c);
    const s = sorted.map(suit);
    const n = sorted.map(num);
    if (allSame(c.map((i) => groups[i].tile))) add('一色四同順', c);
    if (allSame(n)) add('四同順', c);
    if (isConsecutive(n)) {
      if (distinct(s.slice(0, 3)) && s[3] === s[0]) add('雜四步高', c);
      if (allSame(s)) add('清四步高', c);
    }
    if (allSame(s) && sameSet(n, [1, 3, 5, 7])) add('金門橋', c);
  }
  for (const c of combos(chows, 5)) {
    const sorted = byStart(c);
    const s = sorted.map(suit);
    const n = sorted.map(num);
    if (allSame(n)) add('五同順', c);
    if (isConsecutive(n)) {
      if (distinct(s.slice(0, 3)) && s[3] === s[0] && s[4] === s[1]) add('雜五步高', c);
      if (allSame(s)) add('清五步高', c);
    }
  }

  // ---- 刻子（數牌）與眼 ----
  const pungs = groups.map((g, i) => ((g.kind === 'pung' || g.kind === 'kong') && !isHonor(g.tile) ? i : -1));
  const pairs = groups.map((g, i) => (g.kind === 'pair' && !isHonor(g.tile) ? i : -1));
  const cands = [...pungs, ...pairs].filter((i) => i >= 0);
  for (let k = 2; k <= Math.min(6, cands.length); k++) {
    for (const c of combos(cands, k)) {
      const pairCount = c.filter((i) => groups[i].kind === 'pair').length;
      if (pairCount > 1) continue;
      const small = pairCount === 1;
      const sorted = byStart(c);
      const n = sorted.map(num);
      const s = sorted.map(suit);
      // 同刻
      if (allSame(n) && distinct(s)) {
        if (k === 2 && !small) add('兩同刻', c);
        if (k === 3) add(small ? '小三同刻' : '大三同刻', c);
      }
      // 老少刻
      if (k === 2 && !small && allSame(s) && sameSet(n, [1, 9])) add('老少刻', c);
      // 連刻
      if (!isConsecutive(n)) continue;
      if (allSame(s)) {
        if (k === 2 && !small) add('兩連刻', c);
        const label = ['', '', '', '三', '四', '五', '六'][k];
        if (k >= 3 && small) add(`小${label}連刻`, c);
        if (k >= 3 && k <= 5 && !small) add(`大${label}連刻`, c);
      } else if (k >= 3 && new Set(s).size === 3 && (k > 3 || distinct(s))) {
        const label = ['', '', '', '', '四', '五', '六'][k];
        if (small) add(`小三色${label}連刻`, c);
        else if (k <= 5) add(`三色${label}連刻`, c);
      }
    }
  }

  // ---- 雙X：兩個獨立（不共用牌組）的實例 ----
  const doubles: [string, string][] = [
    ['一般高', '雙般高'],
    ['相逢', '雙同順'],
    ['老少順', '雙老少順'],
    ['兩連刻', '雙連刻'],
    ['兩同刻', '雙同刻'],
    ['老少刻', '雙老少刻'],
  ];
  for (const [single, double] of doubles) {
    const singles = out.filter((x) => x.type === single);
    for (const [x, y] of combos(singles, 2)) {
      if (x.groups.some((g) => y.groups.includes(g))) continue;
      add(double, [...x.groups, ...y.groups], { compType: single, components: [x.groups, y.groups] });
    }
  }
  return out;
}

const subset = (a: number[], b: number[]) => a.every((x) => b.includes(x));

function conflicts(a: Instance, b: Instance): boolean {
  if (a.type === b.type) {
    const shared = a.groups.filter((g) => b.groups.includes(g)).length;
    // 單式結算：同類番種的面子共用率低於 50% 才可重複計算
    return shared / Math.min(a.groups.length, b.groups.length) >= 0.5;
  }
  return excludes(a, b) || excludes(b, a);
}

function excludes(a: Instance, b: Instance): boolean {
  if (GLOBAL_EXCLUDES[a.type]?.includes(b.type)) return true;
  const ex = SUBSET_EXCLUDES[a.type];
  if (!ex) return false;
  if (ex.includes(b.type) && subset(b.groups, a.groups)) return true;
  if (b.compType && ex.includes(b.compType) && b.components!.some((c) => subset(c, a.groups))) return true;
  return false;
}

/** 在所有組合番種實例中，選出互不衝突、番數最高的一組 */
export function bestPatterns(groups: Group[]): { name: FanName; fan: number }[] {
  let found = findPatterns(groups);
  if (found.some((x) => x.type === '四同順' || x.type === '五同順')) {
    found = found.filter((x) => !SAME_NUMBER_EXCLUDES.includes(x.type));
  }
  const all = found.sort((x, y) => FAN[y.name] - FAN[x.name]);
  const suffix: number[] = new Array(all.length + 1).fill(0);
  for (let i = all.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + FAN[all[i].name];

  let best: Instance[] = [];
  let bestSum = -1;
  const chosen: Instance[] = [];
  const dfs = (i: number, sum: number) => {
    if (sum + suffix[i] <= bestSum) return;
    if (i === all.length) {
      bestSum = sum;
      best = [...chosen];
      return;
    }
    const inst = all[i];
    if (chosen.every((c) => !conflicts(c, inst))) {
      chosen.push(inst);
      dfs(i + 1, sum + FAN[inst.name]);
      chosen.pop();
    }
    dfs(i + 1, sum);
  };
  dfs(0, 0);
  return best.map((x) => ({ name: x.name, fan: FAN[x.name] }));
}
