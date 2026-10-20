import { describe, expect, it } from 'vitest';
import { fanMap, score } from './helpers';

describe('對對糊、暗刻、坎坎糊、槓', () => {
  // 碰8m；222m 444p 999s 暗刻；66s / 11p 對碰
  const PONGS = { hand: '222m444p999s66s11p', win: '6s', melds: 'p8m' };

  it('自摸對碰：對對糊 + 四暗刻 + 缺五', () => {
    const r = score({ ...PONGS, how: 'self' });
    expect(fanMap(r)).toEqual({ 對對糊: 40, 四暗刻: 60, 對碰: 1, 自摸: 1, 無字花: 5, 缺五: 10 });
    expect(r.handFan).toBe(117);
  });

  it('食出銃對碰：完成的刻子是明刻，只有三暗刻', () => {
    expect(fanMap(score(PONGS))).toEqual({ 對對糊: 40, 三暗刻: 20, 對碰: 1, 無字花: 5, 缺五: 10 });
  });

  it('坎坎糊：五暗刻無槓，單釣食出銃（不計門清、對對糊、五暗刻）', () => {
    const r = score({ hand: '222m666m444p888p999s1s', win: '1s' });
    expect(fanMap(r)).toEqual({ 坎坎糊: 240, 獨獨: 2, 無字花: 5, 缺五: 10 });
  });

  it('五暗刻（有暗槓，不計對對糊）', () => {
    const f = fanMap(score({ hand: '666m444p888p999s1s', win: '1s', melds: 'h2m' }));
    expect(f).toMatchObject({ 五暗刻: 180, 槓: 2 });
    expect(f).not.toHaveProperty('對對糊');
    expect(f).not.toHaveProperty('坎坎糊');
  });

  it('每個槓 2 番；暗槓算暗刻', () => {
    const f = fanMap(score({ hand: '567s789m11z12p', win: '3p', melds: 'h2m h4p' }));
    expect(f).toMatchObject({ 槓: 4, 二暗刻: 5 });
  });

  it('大明槓不算暗刻', () => {
    const f = fanMap(score({ hand: '567s789m11z12p', win: '3p', melds: 'k2m h4p' }));
    expect(f).toMatchObject({ 槓: 4 });
    expect(f).not.toHaveProperty('二暗刻');
  });
});

describe('三元、風', () => {
  it('小三元（不計字牌、正字）', () => {
    const f = fanMap(score({ hand: '555z666z77z234m678p34s', win: '5s' }));
    expect(f).toMatchObject({ 小三元: 40 });
    expect(f).not.toHaveProperty('字牌');
    expect(f).not.toHaveProperty('正字');
  });

  it('大三元', () => {
    const f = fanMap(score({ hand: '555z666z777z234m67p99s', win: '8p' }));
    expect(f).toMatchObject({ 大三元: 80 });
    expect(f).not.toHaveProperty('字牌');
    expect(f).not.toHaveProperty('小三元');
  });

  it('小三風：錯位風不算番，正位風算番', () => {
    const f = fanMap(score({ hand: '111z222z33z234m678p34s', win: '5s' }));
    expect(f).toMatchObject({ 小三風: 30, 正字: 2 });
    expect(f).not.toHaveProperty('字牌');
  });

  it('大三風', () => {
    const f = fanMap(score({ hand: '111z222z333z234m67p99s', win: '8p' }));
    expect(f).toMatchObject({ 大三風: 60, 正字: 2 });
    expect(f).not.toHaveProperty('小三風');
  });

  it('小四喜（不計大三風、小三風）', () => {
    const f = fanMap(score({ hand: '111z222z333z44z234m67p', win: '8p' }));
    expect(f).toMatchObject({ 小四喜: 120, 正字: 2 });
    expect(f).not.toHaveProperty('大三風');
    expect(f).not.toHaveProperty('小三風');
  });

  it('大四喜（不計字牌、正字）', () => {
    const f = fanMap(score({ hand: '111z222z333z444z67p99s', win: '8p' }));
    expect(f).toMatchObject({ 大四喜: 160 });
    expect(f).not.toHaveProperty('小四喜');
    expect(f).not.toHaveProperty('字牌');
    expect(f).not.toHaveProperty('正字');
  });

  it('三元牌刻子以外的風刻照計字牌', () => {
    const f = fanMap(score({ hand: '555z666z77z444z234m67p', win: '8p' }));
    expect(f).toMatchObject({ 小三元: 40, 字牌: 1 });
  });
});

describe('連刻', () => {
  it('兩連刻', () => {
    const f = fanMap(score({ hand: '777p888p234m11z56s', win: '7s', melds: 'p1m' }));
    expect(f).toMatchObject({ 兩連刻: 5 });
  });

  it('大三連刻（高點法：刻子解讀高於一色三同順）', () => {
    const f = fanMap(score({ hand: '111m222m33m55z', win: '3m', melds: 'p7p p9s', how: 'self' }));
    expect(f).toMatchObject({ 大三連刻: 30, 對對糊: 40, 三暗刻: 20 });
    expect(f).not.toHaveProperty('兩連刻');
    expect(f).not.toHaveProperty('小三連刻');
  });

  it('小三連刻', () => {
    const f = fanMap(score({ hand: '111m222m3m', win: '3m', melds: 'p7p c4s p9s' }));
    expect(f).toMatchObject({ 小三連刻: 15 });
    expect(f).not.toHaveProperty('兩連刻');
  });

  it('小四連刻（不計大三連刻）', () => {
    const f = fanMap(score({ hand: '111m222m333m4m', win: '4m', melds: 'p7p p9s', how: 'self' }));
    expect(f).toMatchObject({ 小四連刻: 60 });
    expect(f).not.toHaveProperty('大三連刻');
  });

  it('大四連刻', () => {
    const f = fanMap(score({ hand: '5s', win: '5s', melds: 'p1m p2m p3m p4m p9p' }));
    expect(f).toMatchObject({ 大四連刻: 90 });
    expect(f).not.toHaveProperty('大三連刻');
  });

  it('雙連刻（兩組獨立連刻，不計兩連刻）', () => {
    const f = fanMap(score({ hand: '45s33z', win: '6s', melds: 'p1m p2m p7p p8p' }));
    expect(f).toMatchObject({ 雙連刻: 20 });
    expect(f).not.toHaveProperty('兩連刻');
  });
});

describe('同刻', () => {
  it('兩同刻', () => {
    expect(fanMap(score({ hand: '567m678s12p99m', win: '3p', melds: 'p4m p4s' }))).toMatchObject({ 兩同刻: 5 });
  });

  it('小三同刻（不計兩同刻）', () => {
    const f = fanMap(score({ hand: '567m678s123p4p', win: '4p', melds: 'p4m p4s' }));
    expect(f).toMatchObject({ 小三同刻: 20 });
    expect(f).not.toHaveProperty('兩同刻');
  });

  it('大三同刻', () => {
    const f = fanMap(score({ hand: '567m12p99s', win: '3p', melds: 'p4m p4s p4p' }));
    expect(f).toMatchObject({ 大三同刻: 40 });
    expect(f).not.toHaveProperty('兩同刻');
    expect(f).not.toHaveProperty('小三同刻');
  });

  it('雙同刻', () => {
    const f = fanMap(score({ hand: '45s99p', win: '6s', melds: 'p2m p2p p7m p7s' }));
    expect(f).toMatchObject({ 雙同刻: 20 });
    expect(f).not.toHaveProperty('兩同刻');
  });
});

describe('老少刻', () => {
  it('老少刻', () => {
    expect(fanMap(score({ hand: '234p678s11z56s', win: '7s', melds: 'p1m p9m' }))).toMatchObject({ 老少刻: 5 });
  });

  it('雙老少刻（不計老少刻、雙同刻、兩同刻）', () => {
    const f = fanMap(score({ hand: '23s55z', win: '1s', melds: 'p1m p9m p1p p9p' }));
    expect(f).toMatchObject({ 雙老少刻: 30 });
    expect(f).not.toHaveProperty('老少刻');
    expect(f).not.toHaveProperty('雙同刻');
    expect(f).not.toHaveProperty('兩同刻');
  });
});

describe('三色連刻（簡表番種）', () => {
  it('三色連刻：三個不同花色、數字相連的刻子', () => {
    expect(fanMap(score({ hand: '789m11z56p', win: '7p', melds: 'p2m p3p p4s' }))).toMatchObject({ 三色連刻: 20 });
  });

  it('小三色連刻：兩刻一眼', () => {
    expect(fanMap(score({ hand: '789m567p111z4s', win: '4s', melds: 'p2m p3p' }))).toMatchObject({
      小三色連刻: 10,
    });
  });
});

describe('四歸', () => {
  it('明四歸二：碰一萬 + 123萬（食出銃）', () => {
    expect(fanMap(score({ hand: '13m567p345s222z99s', win: '2m', melds: 'p1m' }))).toMatchObject({ 明四歸二: 5 });
  });

  it('暗四歸二', () => {
    expect(fanMap(score({ hand: '111m13m567p345s99s', win: '2m', melds: 'p6z', how: 'self' }))).toMatchObject({ 暗四歸二: 10 });
  });

  it('暗四歸三：兩順一眼', () => {
    expect(fanMap(score({ hand: '123m123m11m56p345s222z', win: '7p', how: 'self' }))).toMatchObject({
      暗四歸三: 30,
    });
  });
});
