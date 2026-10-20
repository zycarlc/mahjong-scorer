import { describe, expect, it } from 'vitest';
import { fanCount, fanMap, score } from './helpers';

describe('同順類', () => {
  it('一般高（一色同順）', () => {
    const f = fanMap(score({ hand: '234m234m67p789s345s11z', win: '5p' }));
    expect(f).toMatchObject({ 一般高: 5 });
    expect(f).not.toHaveProperty('雙般高');
  });

  it('雙般高（不計一般高）', () => {
    const f = fanMap(score({ hand: '234m234m567p56p789s11z', win: '7p' }));
    expect(f).toMatchObject({ 雙般高: 20 });
    expect(f).not.toHaveProperty('一般高');
  });

  it('暗一色三同順（高點法：順子解讀高於三連刻）', () => {
    const f = fanMap(score({ hand: '234m234m234m789s56p11z', win: '7p' }));
    expect(f).toMatchObject({ 暗一色三同順: 60 });
    expect(f).not.toHaveProperty('一般高');
    expect(f).not.toHaveProperty('大三連刻');
  });

  it('明一色三同順：其中一組為上牌', () => {
    const f = fanMap(score({ hand: '234m234m789s56p11z', win: '7p', melds: 'c2m' }));
    expect(f).toMatchObject({ 明一色三同順: 30 });
  });

  it('暗一色四同順，必然加計四同順；三組四歸四、十二歸另計', () => {
    const f = fanMap(score({ hand: '22223333444m789s11z', win: '4m', how: 'self' }));
    expect(f).toMatchObject({ 暗一色四同順: 360, 四同順: 20, 暗四歸四: 360, 十二歸: 80 });
    expect(f).not.toHaveProperty('八歸');
    expect(f).not.toHaveProperty('一般高');
    expect(f).not.toHaveProperty('暗一色三同順');
  });

  it('相逢（兩色同順）', () => {
    expect(fanMap(score({ hand: '345m345p789s678m23s66z', win: '1s' }))).toMatchObject({ 相逢: 3 });
  });

  it('三相逢：食出銃完成其中一組為明，自摸為暗；不計相逢', () => {
    const open = fanMap(score({ hand: '345m345p34s789m678p11z', win: '5s' }));
    expect(open).toMatchObject({ 明三相逢: 10 });
    expect(open).not.toHaveProperty('相逢');
    const hidden = fanMap(score({ hand: '345m345p34s789m678p11z', win: '5s', how: 'self' }));
    expect(hidden).toMatchObject({ 暗三相逢: 20 });
  });

  it('雙同順（兩組獨立相逢，不計相逢）', () => {
    const f = fanMap(score({ hand: '345m345p678m67s123p11z', win: '8s' }));
    expect(f).toMatchObject({ 雙同順: 10 });
    expect(f).not.toHaveProperty('相逢');
  });

  it('四同順：必然加計雙般高、雙同順', () => {
    const f = fanMap(score({ hand: '345m345m345p34p789s11z', win: '5p', how: 'self' }));
    expect(f).toMatchObject({ 四同順: 20, 雙般高: 20, 雙同順: 10 });
  });

  it('五同順（不計平糊、四同順）', () => {
    const f = fanMap(score({ hand: '345m345m345p345p34s99s', win: '5s', how: 'self' }));
    expect(f).toMatchObject({ 五同順: 60, 無字花: 5 });
    for (const k of ['平糊', '大平糊', '四同順']) expect(f).not.toHaveProperty(k);
  });

  it('單式結算例1：567萬 567筒 567筒 只算一個相逢和一副般高', () => {
    const r = score({ hand: '567m567p567p111z99s23s', win: '1s' });
    expect(fanCount(r, '相逢')).toBe(1);
    expect(fanCount(r, '一般高')).toBe(1);
  });
});

describe('龍、老少', () => {
  it('明雜龍 / 暗雜龍', () => {
    expect(fanMap(score({ hand: '123m456p78s111z666z99m', win: '9s' }))).toMatchObject({ 明雜龍: 10 });
    expect(fanMap(score({ hand: '123m456p78s111z666z99m', win: '9s', how: 'self' }))).toMatchObject({ 暗雜龍: 20 });
  });

  it('暗清龍（不計老少順）：食出銃完成的是龍以外的面子', () => {
    const f = fanMap(score({ hand: '123m456m789m34p111z99s', win: '5p' }));
    expect(f).toMatchObject({ 暗清龍: 30 });
    expect(f).not.toHaveProperty('老少順');
  });

  it('單式結算例3：一二三一二三四五六四五六七八九萬 算兩條清龍', () => {
    const r = score({ hand: '123m123m456m456m78m11z', win: '9m', how: 'self' });
    expect(fanCount(r, '暗清龍')).toBe(2);
  });

  it('老少順', () => {
    expect(fanMap(score({ hand: '123p789p456m67s111z99m', win: '8s' }))).toMatchObject({ 老少順: 3 });
  });

  it('暗雙老少順（自摸）', () => {
    expect(fanMap(score({ hand: '123m789m123p78p456s11z', win: '9p', how: 'self' }))).toMatchObject({ 暗雙老少順: 30 });
  });

  it('明雙老少順（不計老少順）', () => {
    const f = fanMap(score({ hand: '123m123m789m78m456s11z', win: '9m' }));
    expect(f).toMatchObject({ 明雙老少順: 15, 雙般高: 20 });
    expect(f).not.toHaveProperty('老少順');
  });

  it('兩門的明雙老少順只得 15，高點法改計老少順 ×2 + 雙同順（16）', () => {
    const f = fanMap(score({ hand: '123m789m123p78p456s11z', win: '9p' }));
    expect(f).toMatchObject({ 老少順: 6, 雙同順: 10 });
    expect(f).not.toHaveProperty('明雙老少順');
  });
});

describe('步高、連環套、金門橋', () => {
  it('明雜三步高 / 暗雜三步高', () => {
    expect(fanMap(score({ hand: '123m234p34s789m111z55p', win: '5s' }))).toMatchObject({ 明雜三步高: 5 });
    expect(fanMap(score({ hand: '123m234p34s789m111z55p', win: '5s', how: 'self' }))).toMatchObject({
      暗雜三步高: 10,
    });
  });

  it('暗清三步高', () => {
    expect(fanMap(score({ hand: '123m234m34m789p111z55s', win: '5m', how: 'self' }))).toMatchObject({
      暗清三步高: 40,
    });
  });

  it('暗清四步高（不計三步高）', () => {
    const f = fanMap(score({ hand: '123m234m345m45m111z99p', win: '6m', how: 'self' }));
    expect(f).toMatchObject({ 暗清四步高: 120 });
    expect(f).not.toHaveProperty('暗清三步高');
  });

  it('暗雜四步高：第四組與第一組同門', () => {
    const f = fanMap(score({ hand: '123m234p345s45m111z99p', win: '6m', how: 'self' }));
    expect(f).toMatchObject({ 暗雜四步高: 30 });
    expect(f).not.toHaveProperty('暗雜三步高');
  });

  it('暗連環套', () => {
    expect(fanMap(score({ hand: '123m345m56m789p111z44s', win: '7m', how: 'self' }))).toMatchObject({
      暗連環套: 30,
    });
  });

  it('暗金門橋（不計連環套、老少順）', () => {
    const f = fanMap(score({ hand: '123m345m567m78m111z44s', win: '9m', how: 'self' }));
    expect(f).toMatchObject({ 暗金門橋: 100 });
    expect(f).not.toHaveProperty('暗連環套');
    expect(f).not.toHaveProperty('老少順');
  });
});
