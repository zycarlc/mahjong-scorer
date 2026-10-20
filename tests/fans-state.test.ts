import { describe, expect, it } from 'vitest';
import { fanMap, score, type HandSpec } from './helpers';

/**
 * 平糊手：123p 345p 234m 678m 567s(食5s) 99s，門清、無字、無花。
 * 叫 5s / 8s 兩頭，沒有任何順子組合番。
 */
const PING: HandSpec = { hand: '123p345p234m678m67s99s', win: '5s' };

/**
 * 雞糊手：碰7m，234p 567p 345m(食5m) 678s，東東做眼，一隻爛花（春，南家）。
 */
const CHICKEN: HandSpec = { hand: '234p567p34m678s11z', win: '5m', melds: 'p7m', flowers: '1f' };

/** 全求人手：五組明章，單釣中。 */
const BEGGAR: HandSpec = { hand: '5z', win: '5z', melds: 'c2m c5p p7s c3s p9m' };

describe('平糊、門清、自摸', () => {
  it('門清平糊食出銃：門清 5 + 大平糊 15', () => {
    const r = score(PING);
    expect(r.valid).toBe(true);
    expect(fanMap(r)).toEqual({ 門清: 5, 大平糊: 15 });
    expect(r.handFan).toBe(20);
    expect(r.payments).toEqual([{ seat: 'W', fan: 20, amount: 20 }]);
  });

  it('有花便不是大平糊：門清 + 平糊 + 無字 + 花 + 正花', () => {
    const r = score({ ...PING, flowers: '2f' });
    expect(fanMap(r)).toEqual({ 門清: 5, 平糊: 5, 無字: 1, 花牌: 1, 正花: 1 });
  });

  it('門清自摸：門清 + 門摸（不計自摸），三家付，莊家加一番', () => {
    const r = score({ ...PING, how: 'self' });
    expect(fanMap(r)).toEqual({ 門清: 5, 門摸: 5, 大平糊: 15 });
    expect(r.payments).toEqual([
      { seat: 'W', fan: 25, amount: 25 },
      { seat: 'N', fan: 25, amount: 25 },
      { seat: 'E', fan: 26, amount: 26 },
    ]);
    expect(r.totalAmount).toBe(76);
  });

  it('大明槓仍算門清，加槓（碰過）不算', () => {
    const base = { hand: '123p234m678m67s99s', win: '5s' };
    expect(fanMap(score({ ...base, melds: 'k5p' }))).toMatchObject({ 門清: 5, 槓: 2 });
    expect(fanMap(score({ ...base, melds: 'h5p' }))).toMatchObject({ 門清: 5, 槓: 2 });
    expect(fanMap(score({ ...base, melds: 'a5p' }))).not.toHaveProperty('門清');
  });
});

describe('大雞 / 大鴨', () => {
  it('只有一隻爛花的一番：大雞', () => {
    const r = score(CHICKEN);
    expect(fanMap(r)).toEqual({ 花牌: 1, 大雞: 40 });
    expect(r.handFan).toBe(41);
  });

  it('自摸：大鴨', () => {
    expect(fanMap(score({ ...CHICKEN, how: 'self' }))).toEqual({ 自摸: 1, 花牌: 1, 大鴨: 30 });
  });

  it('正花會破壞大雞', () => {
    expect(fanMap(score({ ...CHICKEN, flowers: '2f' }))).toEqual({ 花牌: 1, 正花: 1 });
  });

  it('叮會破壞大雞', () => {
    expect(fanMap(score({ ...CHICKEN, flags: { ting: true } }))).toEqual({ 叮: 5, 花牌: 1 });
  });

  it('花上自摸會破壞大鴨', () => {
    expect(fanMap(score({ ...CHICKEN, how: 'self', flags: { flowerDraw: true } }))).toEqual({
      花牌: 1,
      花上自摸: 1,
    });
  });

  it('莊家番不影響大雞', () => {
    const r = score({ ...CHICKEN, seat: 'E', flowers: '3f' });
    expect(fanMap(r)).toEqual({ 花牌: 1, 大雞: 40 });
    expect(r.dealerFans).toEqual([{ name: '莊家', fan: 1 }]);
    expect(r.payments).toEqual([{ seat: 'W', fan: 42, amount: 42 }]);
  });
});

describe('全求人 / 半求人', () => {
  it('全求人（不計獨獨）', () => {
    expect(fanMap(score(BEGGAR))).toEqual({ 全求人: 40, 無花: 1 });
  });

  it('半求人（不計獨獨、自摸）', () => {
    expect(fanMap(score({ ...BEGGAR, how: 'self' }))).toEqual({ 半求人: 20, 無花: 1 });
  });

  it('有槓不算全求人', () => {
    const r = score({ ...BEGGAR, melds: 'c2m c5p k7s c3s p9m' });
    expect(fanMap(r)).not.toHaveProperty('全求人');
  });
});

describe('對碰、假獨、獨獨、將眼', () => {
  it('對碰 + 將眼', () => {
    const r = score({ hand: '234m678m567p345s99m88p', win: '9m' });
    expect(fanMap(r)).toEqual({ 門清: 5, 對碰: 1, 將眼: 2, 無字花: 5 });
  });

  it('對碰自摸：對碰刻子算暗刻但只有一個暗刻', () => {
    const r = score({ hand: '234m678m567p345s99m88p', win: '9m', how: 'self' });
    expect(fanMap(r)).toEqual({ 門清: 5, 門摸: 5, 對碰: 1, 將眼: 2, 無字花: 5 });
  });

  it('假獨：12345萬食三萬', () => {
    const r = score({ hand: '12345m678p456s88s', win: '3m', melds: 'p2p' });
    expect(fanMap(r)).toEqual({ 假獨: 1, 將眼: 2, 無字花: 5 });
  });

  it('12345萬食六萬不是假獨', () => {
    const r = score({ hand: '12345m678p456s88s', win: '6m', melds: 'p2p' });
    expect(fanMap(r)).not.toHaveProperty('假獨');
    expect(fanMap(r)).toHaveProperty('相逢', 3);
  });

  it('獨獨：只叫一扉（卡窿）', () => {
    const r = score({ hand: '13m567m345p789s99m', win: '2m', melds: 'p2p' });
    expect(fanMap(r)).toEqual({ 獨獨: 2, 無字花: 5 });
    expect(r.waits).toEqual(['2m']);
  });
});

describe('字牌、正字', () => {
  const honor = (z: string, extra: Partial<HandSpec> = {}) =>
    fanMap(score({ hand: `123p345p234m${z}${z}${z}z67s99s`, win: '5s', ...extra }));

  it('圈風刻子（南家，東圈）', () => {
    expect(honor('1')).toEqual({ 門清: 5, 字牌: 1, 正字: 1, 無花: 1 });
  });
  it('門風刻子', () => {
    expect(honor('2')).toEqual({ 門清: 5, 字牌: 1, 正字: 1, 無花: 1 });
  });
  it('錯位風刻子只有字牌', () => {
    expect(honor('4')).toEqual({ 門清: 5, 字牌: 1, 無花: 1 });
  });
  it('三元牌刻子', () => {
    expect(honor('6')).toEqual({ 門清: 5, 字牌: 1, 正字: 1, 無花: 1 });
  });
  it('東圈東家的東刻：正字兩番', () => {
    expect(honor('1', { seat: 'E' })).toEqual({ 門清: 5, 字牌: 1, 正字: 2, 無花: 1 });
  });
});

describe('花', () => {
  it('一台花：不計該四張的花及正花', () => {
    expect(fanMap(score({ ...PING, flowers: '1234f' }))).toEqual({ 門清: 5, 平糊: 5, 無字: 1, 一台花: 10 });
  });

  it('一台花之外的花照計花及正花', () => {
    expect(fanMap(score({ ...PING, flowers: '12346f' }))).toEqual({
      門清: 5,
      平糊: 5,
      無字: 1,
      一台花: 10,
      花牌: 1,
      正花: 1,
    });
  });

  it('七隻花照常食糊：一台花 + 正爛花', () => {
    expect(fanMap(score({ ...PING, flowers: '1234567f' }))).toEqual({
      門清: 5,
      平糊: 5,
      無字: 1,
      一台花: 10,
      花牌: 3,
      正花: 1,
    });
  });

  it('八隻花照常食糊：直接計 40 番', () => {
    expect(fanMap(score({ ...PING, flowers: '12345678f' }))).toEqual({ 門清: 5, 平糊: 5, 無字: 1, 八仙過海: 40 });
  });

  it('兩隻正花（東家春梅）', () => {
    expect(fanMap(score({ ...PING, seat: 'E', flowers: '15f' }))).toMatchObject({ 花牌: 2, 正花: 2 });
  });
});

describe('叮牌', () => {
  it('門叮（不計門清、叮）', () => {
    expect(fanMap(score({ ...PING, flags: { ting: true } }))).toEqual({ 門叮: 15, 大平糊: 15 });
  });

  it('門叮可複合門摸', () => {
    expect(fanMap(score({ ...PING, how: 'self', flags: { ting: true } }))).toEqual({
      門叮: 15,
      門摸: 5,
      大平糊: 15,
    });
  });

  it('即食', () => {
    expect(fanMap(score({ ...PING, flags: { ting: true, immediate: true } }))).toMatchObject({ 即食: 5 });
  });

  it('天叮（不計門清、門叮、叮）', () => {
    expect(fanMap(score({ ...PING, flags: { ting: true, tingKind: 'tian' } }))).toEqual({ 天叮: 40, 大平糊: 15 });
  });

  it('地叮', () => {
    expect(fanMap(score({ ...PING, flags: { ting: true, tingKind: 'di' } }))).toEqual({ 地叮: 30, 大平糊: 15 });
  });

  it('人叮（不計叮）', () => {
    expect(fanMap(score({ ...CHICKEN, flags: { ting: true, tingKind: 'ren' } }))).toEqual({ 人叮: 20, 花牌: 1 });
  });
});

describe('時態類', () => {
  it('天糊（莊家，不計門清、自摸、門摸）', () => {
    const r = score({ ...PING, seat: 'E', how: 'self', flags: { winKind: 'tian' } });
    expect(fanMap(r)).toEqual({ 天糊: 120, 大平糊: 15 });
  });

  it('地糊（不計門清），食莊家，莊家付時加莊家番', () => {
    const r = score({ ...PING, from: 'E', flags: { winKind: 'di' } });
    expect(fanMap(r)).toEqual({ 地糊: 120, 大平糊: 15 });
    expect(r.payments).toEqual([{ seat: 'E', fan: 136, amount: 136 }]);
  });

  it('人糊', () => {
    expect(fanMap(score({ ...PING, flags: { winKind: 'ren' } }))).toEqual({ 人糊: 80, 大平糊: 15 });
  });

  it.each([
    [10, '十隻內', 10],
    [7, '七隻內', 20],
    [4, '四隻內', 40],
  ] as const)('地下 %i 隻內：%s %i 番', (n, name, fan) => {
    expect(fanMap(score({ ...PING, flags: { tilesLeft: n } }))).toEqual({ 門清: 5, 大平糊: 15, [name]: fan });
  });

  it('雙響 / 三響', () => {
    expect(fanMap(score({ ...PING, flags: { multiWin: 2 } }))).toMatchObject({ 雙響: 5 });
    const three = fanMap(score({ ...PING, flags: { multiWin: 3 } }));
    expect(three).toMatchObject({ 三響: 10 });
    expect(three).not.toHaveProperty('雙響');
  });

  it('海底撈月', () => {
    expect(fanMap(score({ ...PING, flags: { lastTile: true } }))).toMatchObject({ 海底撈月: 10 });
  });

  it('槓上自摸（不計自摸）', () => {
    const r = score({ ...CHICKEN, melds: 'a7m', how: 'self', flags: { kongDraw: true } });
    expect(fanMap(r)).toEqual({ 槓: 2, 花牌: 1, 槓上自摸: 5 });
  });

  it('尾牌連摸 n=2 → 10 番、n=3 → 20 番（不計自摸、花上、槓上）', () => {
    const two = score({ ...CHICKEN, melds: 'a7m', how: 'self', flags: { kongDraw: true, tailDraws: 2 } });
    expect(fanMap(two)).toEqual({ 槓: 2, 花牌: 1, 尾牌連摸: 10 });
    const three = score({ ...CHICKEN, melds: 'a7m', how: 'self', flags: { flowerDraw: true, tailDraws: 3 } });
    expect(fanMap(three)).toEqual({ 槓: 2, 花牌: 1, 尾牌連摸: 20 });
  });

  it('搶槓：被搶者付', () => {
    const r = score({ ...PING, how: 'robKong', from: 'N' });
    expect(fanMap(r)).toEqual({ 門清: 5, 大平糊: 15, 搶槓: 10 });
    expect(r.payments).toEqual([{ seat: 'N', fan: 30, amount: 30 }]);
  });
});

describe('計分與付款', () => {
  it('莊家連莊：莊家 1 + 拉莊 2N', () => {
    const r = score({ ...PING, seat: 'E', streak: 2 });
    expect(r.dealerFans).toEqual([
      { name: '莊家', fan: 1 },
      { name: '拉莊', fan: 4 },
    ]);
    expect(r.payments).toEqual([{ seat: 'W', fan: 25, amount: 25 }]);
  });

  it('閒家食莊家出銃：加計莊家及拉莊', () => {
    const r = score({ ...PING, from: 'E', streak: 1 });
    expect(r.payments).toEqual([{ seat: 'E', fan: 23, amount: 23 }]);
  });

  it('閒家食閒家：不計莊家', () => {
    const r = score({ ...PING, from: 'N', streak: 3 });
    expect(r.dealerFans).toEqual([]);
    expect(r.payments).toEqual([{ seat: 'N', fan: 20, amount: 20 }]);
  });

  it('閒家自摸：只有莊家多付', () => {
    const r = score({ ...PING, how: 'self', streak: 1 });
    expect(r.payments).toEqual([
      { seat: 'W', fan: 25, amount: 25 },
      { seat: 'N', fan: 25, amount: 25 },
      { seat: 'E', fan: 28, amount: 28 },
    ]);
  });

  it('莊家自摸：三家都加計莊家', () => {
    const r = score({ ...PING, seat: 'E', how: 'self', streak: 1 });
    expect(r.payments.map((p) => p.fan)).toEqual([28, 28, 28]);
    expect(r.payments.map((p) => p.seat)).toEqual(['S', 'W', 'N']);
  });

  it('底與番的金額：每家付 底 + 番數 × 每番', () => {
    const r = score({ ...PING, base: 10, perFan: 2 });
    expect(r.payments).toEqual([{ seat: 'W', fan: 20, amount: 50 }]);
    expect(r.totalAmount).toBe(50);
  });

  it('暗槓數（中途獎勵另計）', () => {
    const r = score({ hand: '567s789m11z12p', win: '3p', melds: 'h2m h4p' });
    expect(r.concealedKongs).toBe(2);
  });
});

describe('花糊', () => {
  it('七搶一：持一張花者付 30 番', () => {
    const r = score({ hand: '', how: 'flower', flowerWin: 'sevenRobOne', flowers: '1234567f', from: 'N' });
    expect(r.valid).toBe(true);
    expect(fanMap(r)).toEqual({ 七搶一: 30 });
    expect(r.payments).toEqual([{ seat: 'N', fan: 30, amount: 30 }]);
  });

  it('八仙過海自摸：每家付 40 番', () => {
    const r = score({ hand: '', how: 'flower', flowerWin: 'eightFlowers', flowers: '12345678f' });
    expect(fanMap(r)).toEqual({ 八仙過海: 40 });
    expect(r.payments).toEqual([
      { seat: 'W', fan: 40, amount: 40 },
      { seat: 'N', fan: 40, amount: 40 },
      { seat: 'E', fan: 41, amount: 41 },
    ]);
  });

  it('花數不符不能花糊', () => {
    const r = score({ hand: '', how: 'flower', flowerWin: 'sevenRobOne', flowers: '123456f', from: 'N' });
    expect(r.valid).toBe(false);
  });
});
