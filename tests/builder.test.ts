import { describe, expect, it } from 'vitest';
import { addTile, initialState, removeConcealed, removeMeld, toInput, concealedTarget, usedCount } from '../src/ui/builder';
import { evaluate } from '../src/engine/score';
import { parseTiles } from '../src/engine/tiles';

const fill = (tiles: string) =>
  parseTiles(tiles).reduce((s, t) => {
    const r = addTile(s, 'concealed', t);
    if (typeof r === 'string') throw new Error(r);
    return r;
  }, initialState());

describe('砌牌器', () => {
  it('暗手目標張數 = 16 − 3 × 明章數', () => {
    const s = initialState();
    expect(concealedTarget(s)).toBe(16);
    const r = addTile(s, 'pung', '5z');
    expect(typeof r).not.toBe('string');
    expect(concealedTarget(r as typeof s)).toBe(13);
  });

  it('同一款牌不能多於四張', () => {
    const s = fill('1111m');
    expect(usedCount(s, '1m')).toBe(4);
    expect(addTile(s, 'concealed', '1m')).toMatch(/四張/);
    expect(addTile(s, 'win', '1m')).toMatch(/四張/);
    expect(addTile(s, 'chow', '1m')).toMatch(/四張/);
  });

  it('暗手滿了不能再加', () => {
    const s = fill('123m456m789m123p456p9s');
    expect(s.concealed).toHaveLength(16);
    expect(addTile(s, 'concealed', '9s')).toMatch(/已滿/);
  });

  it('上牌只能是同色數牌，最細一張為一至七', () => {
    expect(addTile(initialState(), 'chow', '8m')).toMatch(/上/);
    expect(addTile(initialState(), 'chow', '1z')).toMatch(/上/);
    const s = addTile(initialState(), 'chow', '7s');
    expect(typeof s === 'string' ? s : s.melds).toEqual([{ kind: 'chow', tile: '7s' }]);
  });

  it('碰要有三張、槓要有四張可用', () => {
    const s = fill('55z');
    expect(addTile(s, 'pung', '5z')).toMatch(/四張/);
    expect(addTile(s, 'concealedKong', '5z')).toMatch(/四張/);
    expect(typeof addTile(fill('5z'), 'pung', '5z')).not.toBe('string');
  });

  it('明章最多五組', () => {
    let s = initialState();
    for (const t of ['1m', '2p', '3s', '4m', '5p']) s = addTile(s, 'pung', t) as typeof s;
    expect(addTile(s, 'pung', '6s')).toMatch(/五組/);
  });

  it('花：再點一次即取消', () => {
    const s = addTile(initialState(), 'flower', '3f') as ReturnType<typeof initialState>;
    expect(s.flowers).toEqual(['3f']);
    const t = addTile(s, 'flower', '3f') as ReturnType<typeof initialState>;
    expect(t.flowers).toEqual([]);
  });

  it('移除暗手牌及明章', () => {
    const s = fill('123m');
    expect(removeConcealed(s, 1).concealed).toEqual(['1m', '3m']);
    const m = addTile(s, 'pung', '9p') as typeof s;
    expect(removeMeld(m, 0).melds).toEqual([]);
  });

  it('輸出給計番引擎的資料可直接計番', () => {
    let s = fill('123p345p234m678m67s99s');
    s = { ...(addTile(s, 'win', '5s') as typeof s), discarder: 'W' };
    const r = evaluate(toInput(s));
    expect(r.valid).toBe(true);
    expect(r.handFan).toBe(20);
  });

  it('自摸時不帶出銃者', () => {
    const s = { ...initialState(), winType: 'selfDraw' as const, discarder: 'N' as const };
    expect(toInput(s).discarder).toBeUndefined();
  });
});
