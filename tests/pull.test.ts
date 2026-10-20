import { describe, expect, it } from 'vitest';
import { pull, pullAmount, runningTotals, settleAmount } from '../src/engine/pull';

describe('拉賬', () => {
  it('第一次記賬為一口', () => {
    expect(pull(undefined, 20)).toEqual({ scores: [20] });
    expect(pullAmount({ scores: [20] })).toBe(20);
  });

  it('拉：上一口 × 1.5 向上取整，再加本局分數', () => {
    const p = pull(pull(pull(undefined, 25), 10), 5);
    expect(p.scores).toEqual([25, 10, 5]);
    expect(runningTotals(p.scores)).toEqual([25, 38 + 10, 72 + 5]);
    expect(pullAmount(p)).toBe(77);
  });

  it('修改其中一口會重算之後各口', () => {
    expect(runningTotals([25, 20, 5])).toEqual([25, 58, 92]);
  });

  it('收取全數', () => {
    expect(settleAmount({ scores: [25, 10] }, 'collect')).toBe(48);
  });

  it('踢半向下取整', () => {
    expect(settleAmount({ scores: [25, 10, 5] }, 'kick')).toBe(38);
  });

  it('斬拉須三口或以上，付全數', () => {
    expect(() => settleAmount({ scores: [25, 10] }, 'cut')).toThrow();
    expect(settleAmount({ scores: [25, 10, 5] }, 'cut')).toBe(77);
  });
});
