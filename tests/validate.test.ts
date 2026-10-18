import { describe, expect, it } from 'vitest';
import { score, type HandSpec } from './helpers';

const PING: HandSpec = { hand: '123p345p234m678m67s99s', win: '5s' };

function errorsOf(spec: HandSpec): string {
  const r = score(spec);
  expect(r.valid).toBe(false);
  expect(r.payments).toEqual([]);
  return r.errors.join('\n');
}

describe('輸入檢查', () => {
  it('合法手牌沒有錯誤', () => {
    const r = score(PING);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('張數不符（相公）', () => {
    expect(errorsOf({ hand: '123p345p234m678m6s99s', win: '5s' })).toMatch(/張數/);
    expect(errorsOf({ hand: '123p345p234m678m67s99s', win: '5s', melds: 'p1z' })).toMatch(/張數/);
  });

  it('同一款牌超過四張', () => {
    expect(errorsOf({ hand: '11111m345p234m678m6s', win: '1m' })).toMatch(/超過四張/);
  });

  it('同一隻花不能重複', () => {
    expect(errorsOf({ ...PING, flowers: '11f' })).toMatch(/花/);
  });

  it('上牌必須是同色三張相連', () => {
    expect(errorsOf({ hand: '123p234m678m67s99s', win: '5s', melds: 'c8m' })).toMatch(/上/);
    expect(errorsOf({ hand: '123p234m678m67s99s', win: '5s', melds: 'c1z' })).toMatch(/上/);
  });

  it('明章最多五組', () => {
    expect(errorsOf({ hand: '', win: '5z', melds: 'c2m c5p p7s c3s p9m p1z' })).toMatch(/五組/);
  });

  it('牌不成糊：詐糊', () => {
    expect(errorsOf({ hand: '123p345p234m678m68s99s', win: '5s' })).toMatch(/詐糊/);
  });

  it('沒有食糊牌', () => {
    expect(errorsOf({ hand: '123p345p234m678m67s99s5s' })).toMatch(/食糊牌/);
  });

  it('食出銃要指明出銃者，且不能是自己', () => {
    expect(errorsOf({ ...PING, from: 'S' })).toMatch(/出銃/);
  });
});

describe('番種條件檢查', () => {
  it('天糊只限莊家自摸', () => {
    expect(errorsOf({ ...PING, how: 'self', flags: { winKind: 'tian' } })).toMatch(/天糊/);
    expect(errorsOf({ ...PING, seat: 'E', flags: { winKind: 'tian' } })).toMatch(/天糊/);
  });

  it('地糊只限閒家食莊家', () => {
    expect(errorsOf({ ...PING, seat: 'E', flags: { winKind: 'di' } })).toMatch(/地糊/);
    expect(errorsOf({ ...PING, from: 'N', flags: { winKind: 'di' } })).toMatch(/地糊/);
  });

  it('天糊、地糊、人糊必須門清', () => {
    expect(
      errorsOf({ hand: '234p567p34m678s11z', win: '5m', melds: 'p7m', from: 'E', flags: { winKind: 'di' } }),
    ).toMatch(/門清/);
  });

  it('花上自摸、槓上自摸、尾牌連摸只限自摸', () => {
    expect(errorsOf({ ...PING, flags: { flowerDraw: true } })).toMatch(/自摸/);
    expect(errorsOf({ ...PING, flags: { tailDraws: 2 } })).toMatch(/自摸/);
  });

  it('槓上自摸要有槓', () => {
    expect(errorsOf({ ...PING, how: 'self', flags: { kongDraw: true } })).toMatch(/槓/);
  });

  it('尾牌連摸至少連摸兩張', () => {
    expect(errorsOf({ ...PING, how: 'self', flags: { flowerDraw: true, tailDraws: 1 } })).toMatch(/尾牌/);
  });

  it('雙響、三響只限食出銃', () => {
    expect(errorsOf({ ...PING, how: 'self', flags: { multiWin: 2 } })).toMatch(/響/);
  });

  it('即食要先叮牌', () => {
    expect(errorsOf({ ...PING, flags: { immediate: true } })).toMatch(/叮/);
  });

  it('天叮、地叮必須門清', () => {
    expect(
      errorsOf({ hand: '234p567p34m678s11z', win: '5m', melds: 'p7m', flags: { ting: true, tingKind: 'tian' } }),
    ).toMatch(/門清/);
  });
});
