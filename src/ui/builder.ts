import { meldTiles } from '../engine/shapes';
import { indexTile, isHonor, numOf, sortTiles, tileIndex } from '../engine/tiles';
import type { Flags, FlowerWin, Meld, MeldKind, WinInput, WinType, Wind } from '../engine/types';

/** 砌牌器的輸入模式：點選牌時加到哪裡 */
export type Mode = 'concealed' | 'win' | MeldKind | 'flower';

export interface FormState {
  roundWind: Wind;
  seatWind: Wind;
  dealerStreak: number;
  winType: WinType;
  discarder?: Wind;
  flowerWin: FlowerWin;
  concealed: string[];
  winningTile?: string;
  melds: Meld[];
  flowers: string[];
  flags: Flags;
  base: number;
  perFan: number;
}

export function initialState(): FormState {
  return {
    roundWind: 'E',
    seatWind: 'E',
    dealerStreak: 0,
    winType: 'discard',
    flowerWin: 'sevenRobOne',
    concealed: [],
    melds: [],
    flowers: [],
    flags: {},
    base: 0,
    perFan: 1,
  };
}

/** 暗手（不含食糊牌）應有張數 */
export function concealedTarget(s: FormState): number {
  return 16 - 3 * s.melds.length;
}

/** 某款牌已用張數（暗手、食糊牌、明章） */
export function usedCount(s: FormState, tile: string): number {
  const all = [...s.concealed, ...(s.winningTile ? [s.winningTile] : []), ...s.melds.flatMap(meldTiles)];
  return all.filter((t) => t === tile).length;
}

/** 點選一張牌；成功回傳新狀態，失敗回傳錯誤訊息 */
export function addTile(s: FormState, mode: Mode, tile: string): FormState | string {
  if (mode === 'flower') {
    const flowers = s.flowers.includes(tile) ? s.flowers.filter((f) => f !== tile) : sortTiles([...s.flowers, tile]);
    return { ...s, flowers };
  }
  if (mode === 'concealed') {
    if (usedCount(s, tile) >= 4) return '這款牌已經用了四張';
    if (s.concealed.length >= concealedTarget(s)) return `暗手已滿（${concealedTarget(s)} 張），請改選食糊牌或明章`;
    return { ...s, concealed: sortTiles([...s.concealed, tile]) };
  }
  if (mode === 'win') {
    const current = s.winningTile === tile ? 1 : 0;
    if (usedCount(s, tile) - current >= 4) return '這款牌已經用了四張';
    return { ...s, winningTile: tile };
  }
  // 明章
  if (s.melds.length >= 5) return '明章最多五組';
  const meld: Meld = { kind: mode, tile };
  if (mode === 'chow') {
    const i = tileIndex(tile);
    if (isHonor(i) || numOf(i) > 7) return '上牌請點選順子最細的一張（一至七的數牌）';
  }
  const need = meldTiles(meld);
  for (const t of new Set(need)) {
    const n = need.filter((x) => x === t).length;
    if (usedCount(s, t) + n > 4) return mode === 'chow' ? '這款牌已經用了四張' : '剩下不夠張數（同一款牌最多四張）';
  }
  return { ...s, melds: [...s.melds, meld] };
}

/** 暗牌（暗手、食糊牌、暗槓）；其餘為明牌（上、碰、明槓、加槓） */
export function isConcealedMode(mode: Mode): boolean {
  return mode === 'concealed' || mode === 'win' || mode === 'concealedKong';
}

/**
 * 把辨識到的牌加入手牌。
 * 暗牌：全部加入暗手。
 * 明牌：自動砌成牌組（四張同款為槓、三張同款為碰、連續三張為上），砌不成的略過。
 */
export function addScanned(s: FormState, tiles: string[], exposed: boolean, kongKind: MeldKind = 'kong'): { state: FormState; added: number; skipped: number } {
  let cur = s;
  let added = 0;
  let skipped = 0;
  if (!exposed) {
    for (const t of tiles) {
      const next = addTile(cur, 'concealed', t);
      if (typeof next === 'string') skipped++;
      else {
        cur = next;
        added++;
      }
    }
    return { state: cur, added, skipped };
  }
  const counts = new Array<number>(34).fill(0);
  for (const t of tiles) counts[tileIndex(t)]++;
  const take = (kind: MeldKind, i: number, n: number) => {
    const next = addTile(cur, kind, indexTile(i));
    if (typeof next === 'string') skipped += n;
    else {
      cur = next;
      added += n;
    }
  };
  const kk: MeldKind = kongKind === 'chow' || kongKind === 'pung' ? 'kong' : kongKind;
  for (let i = 0; i < 34; i++) {
    if (counts[i] >= 4) {
      take(kk, i, 4);
      counts[i] -= 4;
    }
    if (counts[i] === 3) {
      take('pung', i, 3);
      counts[i] = 0;
    }
    while (counts[i] > 0 && !isHonor(i) && numOf(i) <= 7 && counts[i + 1] > 0 && counts[i + 2] > 0) {
      take('chow', i, 3);
      counts[i]--;
      counts[i + 1]--;
      counts[i + 2]--;
    }
    skipped += counts[i];
  }
  return { state: cur, added, skipped };
}

export function removeConcealed(s: FormState, index: number): FormState {
  return { ...s, concealed: s.concealed.filter((_, i) => i !== index) };
}

export function removeMeld(s: FormState, index: number): FormState {
  return { ...s, melds: s.melds.filter((_, i) => i !== index) };
}

export function toInput(s: FormState): WinInput {
  const needsDiscarder = s.winType === 'discard' || s.winType === 'robKong' || (s.winType === 'flower' && s.flowerWin === 'sevenRobOne');
  return {
    concealed: s.concealed,
    winningTile: s.winningTile,
    melds: s.melds,
    flowers: s.flowers,
    winType: s.winType,
    discarder: needsDiscarder ? s.discarder : undefined,
    flowerWin: s.winType === 'flower' ? s.flowerWin : undefined,
    roundWind: s.roundWind,
    seatWind: s.seatWind,
    dealerStreak: s.dealerStreak,
    flags: s.flags,
    settings: { base: s.base, perFan: s.perFan },
  };
}
