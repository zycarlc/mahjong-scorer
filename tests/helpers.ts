import { evaluate } from '../src/engine/score';
import { parseTiles } from '../src/engine/tiles';
import type { Flags, Meld, MeldKind, ScoreResult, WinInput, Wind } from '../src/engine/types';

const MELD_CODES: Record<string, MeldKind> = {
  c: 'chow',
  p: 'pung',
  k: 'kong',
  a: 'addedKong',
  h: 'concealedKong',
};

/** 'c1m p5z h3p' → 上123萬、碰中、暗槓三筒 */
export function parseMelds(s: string): Meld[] {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((code) => ({ kind: MELD_CODES[code[0]], tile: code.slice(1) }));
}

export interface HandSpec {
  /** 暗手（不含食糊牌），例如 '123m456p11z' */
  hand: string;
  /** 食糊牌 */
  win?: string;
  melds?: string;
  flowers?: string;
  how?: 'self' | 'discard' | 'robKong' | 'flower';
  from?: Wind;
  seat?: Wind;
  round?: Wind;
  streak?: number;
  flags?: Flags;
  base?: number;
  perFan?: number;
  flowerWin?: WinInput['flowerWin'];
}

export function mk(spec: HandSpec): WinInput {
  const how = spec.how ?? 'discard';
  const winType = ({ self: 'selfDraw', discard: 'discard', robKong: 'robKong', flower: 'flower' } as const)[how];
  return {
    concealed: parseTiles(spec.hand),
    winningTile: spec.win,
    melds: parseMelds(spec.melds ?? ''),
    flowers: parseTiles(spec.flowers ?? ''),
    winType,
    discarder: winType === 'selfDraw' ? undefined : (spec.from ?? 'W'),
    flowerWin: spec.flowerWin,
    roundWind: spec.round ?? 'E',
    seatWind: spec.seat ?? 'S',
    dealerStreak: spec.streak ?? 0,
    flags: spec.flags ?? {},
    settings: { base: spec.base ?? 0, perFan: spec.perFan ?? 1 },
  };
}

export function score(spec: HandSpec): ScoreResult {
  return evaluate(mk(spec));
}

/** 番種 → 番數（同名番種相加） */
export function fanMap(r: ScoreResult): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of r.fans) out[f.name] = (out[f.name] ?? 0) + f.fan;
  return out;
}

export function fanCount(r: ScoreResult, name: string): number {
  return r.fans.filter((f) => f.name === name).length;
}
