import { describe, expect, it } from 'vitest';
import { fanMap, score } from './helpers';

describe('數字類', () => {
  it('斷么（不計無字）', () => {
    const f = fanMap(score({ hand: '234m678m567p34s888s22p', win: '5s' }));
    expect(f).toMatchObject({ 斷么: 10, 將眼: 2 });
    expect(f).not.toHaveProperty('無字');
  });

  it('全帶么（不計無字、缺五、混帶么）', () => {
    const f = fanMap(score({ hand: '123m789m123p78s111s99p', win: '9s' }));
    expect(f).toMatchObject({ 全帶么: 80 });
    for (const k of ['混帶么', '無字', '缺五']) expect(f).not.toHaveProperty(k);
  });

  it('混帶么', () => {
    const f = fanMap(score({ hand: '123m789m123p78s111z99p', win: '9s' }));
    expect(f).toMatchObject({ 混帶么: 40 });
    expect(f).not.toHaveProperty('全帶么');
  });

  it('混么（必然加計對對糊，不計混帶么）', () => {
    const f = fanMap(score({ hand: '111m999p111z222z999s1s', win: '1s' }));
    expect(f).toMatchObject({ 混么: 80 });
    expect(f).not.toHaveProperty('混帶么');
  });

  it('清么（不計混么、全帶么、混帶么、缺五、無字）', () => {
    const f = fanMap(score({ hand: '999p999s1s', win: '1s', melds: 'p1m p9m p1p' }));
    expect(f).toMatchObject({ 清么: 420, 對對糊: 40 });
    for (const k of ['混么', '全帶么', '混帶么', '缺五', '無字']) expect(f).not.toHaveProperty(k);
  });

  it('缺五：有字牌便不算', () => {
    const f = fanMap(score({ hand: '234m678m123p34s888s99p', win: '2s' }));
    expect(f).toMatchObject({ 缺五: 10 });
    const g = fanMap(score({ hand: '234m678m123p34s888s11z', win: '2s' }));
    expect(g).not.toHaveProperty('缺五');
  });

  it('混滿庭芳', () => {
    const f = fanMap(score({ hand: '444m444p35s111z222z44s', win: '4s' }));
    expect(f).toMatchObject({ 混滿庭芳: 40 });
  });

  it('純滿庭芳（不計混滿庭芳、無字）', () => {
    const f = fanMap(score({ hand: '444m444p345s456s44s34m', win: '5m' }));
    expect(f).toMatchObject({ 純滿庭芳: 120 });
    expect(f).not.toHaveProperty('混滿庭芳');
    expect(f).not.toHaveProperty('無字');
  });
});

describe('花色類', () => {
  it('清一色（不計混一色、缺一門、無字）', () => {
    const f = fanMap(score({ hand: '111m234m567m999m34m88m', win: '5m' }));
    expect(f).toMatchObject({ 清一色: 120 });
    for (const k of ['混一色', '缺一門', '無字']) expect(f).not.toHaveProperty(k);
  });

  it('混一色', () => {
    const f = fanMap(score({ hand: '123m456m111z222z78m55z', win: '9m' }));
    expect(f).toMatchObject({ 混一色: 40 });
  });

  it('缺一門（不計無字）', () => {
    const f = fanMap(score({ hand: '234m678m123p34p888m99p', win: '5p' }));
    expect(f).toMatchObject({ 缺一門: 10 });
    expect(f).not.toHaveProperty('無字');
  });

  it('大五門：五門皆有面子', () => {
    expect(fanMap(score({ hand: '234m567p78s111z555z99m', win: '9s' }))).toMatchObject({ 大五門: 20 });
  });

  it('小五門：其中一門只有眼', () => {
    const f = fanMap(score({ hand: '234m567p78s111z888m55z', win: '9s' }));
    expect(f).toMatchObject({ 小五門: 10 });
    expect(f).not.toHaveProperty('大五門');
  });

  it('大七門：大五門 + 四季 + 花牌', () => {
    const f = fanMap(score({ hand: '234m567p78s111z555z99m', win: '9s', flowers: '15f' }));
    expect(f).toMatchObject({ 大七門: 30 });
    expect(f).not.toHaveProperty('大五門');
  });

  it('小七門', () => {
    const f = fanMap(score({ hand: '234m567p78s111z888m55z', win: '9s', flowers: '37f' }));
    expect(f).toMatchObject({ 小七門: 15 });
    expect(f).not.toHaveProperty('小五門');
  });

  it('只有四季沒有花牌不算七門', () => {
    const f = fanMap(score({ hand: '234m567p78s111z555z99m', win: '9s', flowers: '13f' }));
    expect(f).toMatchObject({ 大五門: 20 });
    expect(f).not.toHaveProperty('大七門');
  });
});

describe('字牌類', () => {
  it('字一色（必然加計對對糊；不計混么、混帶么）', () => {
    const f = fanMap(score({ hand: '222z333z555z666z7z', win: '7z', melds: 'p1z' }));
    expect(f).toMatchObject({ 字一色: 180, 對對糊: 40, 大三風: 60 });
    expect(f).not.toHaveProperty('混么');
    expect(f).not.toHaveProperty('混帶么');
    expect(f).not.toHaveProperty('混一色');
  });
});
