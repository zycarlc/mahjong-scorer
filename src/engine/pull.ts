/**
 * 拉賬：A 食 B 後，分數不即時結算而「拉」落下一局。
 * 只記一筆（一對食糊者／付款者）；結算後拉賬清空，重新開始。
 */
export interface Pull {
  /** 每一口的本局分數：第一口為記賬時的分數，之後每拉一次加一口 */
  scores: number[];
}

export type Settle = 'collect' | 'kick' | 'cut';

/** 每一口完結後的累計分數：第一口為本局分數；之後為上一口 × 1.5（向上取整）＋ 本局分數 */
export function runningTotals(scores: number[]): number[] {
  const out: number[] = [];
  for (const s of scores) out.push(out.length === 0 ? s : Math.ceil(out[out.length - 1] * 1.5) + s);
  return out;
}

export function pullAmount(p: Pull): number {
  return runningTotals(p.scores).at(-1) ?? 0;
}

/** A 再食 B 或 A 自摸：加一口；未有拉賬則開始記賬 */
export function pull(p: Pull | undefined, score: number): Pull {
  return { scores: [...(p?.scores ?? []), score] };
}

/**
 * 結算應付的分數：
 * collect 其他人食糊，或 B 食另外兩家 → 全數；
 * kick 踢半：B 食 A 或 B 自摸 → 一半（向下取整）；
 * cut 斬拉：被拉三口或以上 → 全數。
 */
export function settleAmount(p: Pull, how: Settle): number {
  if (how === 'cut' && p.scores.length < 3) throw new Error('被拉三口或以上才可斬拉');
  const amount = pullAmount(p);
  return how === 'kick' ? Math.floor(amount / 2) : amount;
}
