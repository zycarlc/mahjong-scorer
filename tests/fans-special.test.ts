import { describe, expect, it } from 'vitest';
import { fanMap, score } from './helpers';

describe('十三么', () => {
  it('十三么獨獨（不計門清）', () => {
    const r = score({ hand: '19m1p19s12345677z456p', win: '9p' });
    expect(r.valid).toBe(true);
    expect(r.form).toBe('十三么');
    expect(fanMap(r)).toEqual({ 十三么: 130, 獨獨: 2, 無花: 1 });
  });

  it('十三扉十三么', () => {
    const r = score({ hand: '19m19p19s1234567z456p', win: '7z' });
    expect(fanMap(r)).toEqual({ 十三么: 130, 十三扉: 20, 無花: 1 });
  });

  it('十三么可以複合門叮及門摸', () => {
    const r = score({ hand: '19m19p19s1234567z456p', win: '7z', how: 'self', flags: { ting: true } });
    expect(fanMap(r)).toEqual({ 十三么: 130, 十三扉: 20, 門叮: 15, 門摸: 5, 無花: 1 });
  });
});

describe('十六不搭', () => {
  it('十六扉不搭', () => {
    const r = score({ hand: '159m148p269s1234567z', win: '1z' });
    expect(r.form).toBe('十六不搭');
    expect(fanMap(r)).toEqual({ 十六不搭: 50, 十六扉不搭: 20, 無花: 1 });
  });

  it('十六不搭（叫少於十六扉）', () => {
    const r = score({ hand: '159m14p269s12345671z', win: '8p' });
    expect(fanMap(r)).toEqual({ 十六不搭: 50, 無花: 1 });
  });

  it('不搭三相：三門數字相同', () => {
    expect(fanMap(score({ hand: '147m147p147s1234567z', win: '1z' }))).toMatchObject({ 不搭三相: 20 });
  });

  it('不搭雜龍：三門分別為147、258、369', () => {
    expect(fanMap(score({ hand: '147m258p369s1234567z', win: '1z' }))).toMatchObject({ 不搭雜龍: 30 });
  });
});

describe('嚦咕嚦咕', () => {
  it('八對嚦咕（不計門清）', () => {
    const r = score({ hand: '11m55m99m33p66p22s77s44z', win: '4z' });
    expect(r.form).toBe('嚦咕嚦咕');
    expect(fanMap(r)).toEqual({ 嚦咕嚦咕: 40, 八對嚦咕: 10, 無花: 1 });
  });

  it('食單張成對：不是八對嚦咕', () => {
    const r = score({ hand: '11m55m99m33p66p22s7s444z', win: '7s' });
    expect(fanMap(r)).toEqual({ 嚦咕嚦咕: 40, 獨獨: 2, 無花: 1 });
  });

  it('三元嚦咕', () => {
    expect(fanMap(score({ hand: '55z66z77z11m99m33p66p22s', win: '2s' }))).toMatchObject({ 三元嚦咕: 20 });
  });

  it('四喜嚦咕', () => {
    expect(fanMap(score({ hand: '11z22z33z44z11m99m33p66p', win: '6p' }))).toMatchObject({ 四喜嚦咕: 40 });
  });

  it('三色同對', () => {
    expect(fanMap(score({ hand: '33m33p33s11z22z99m66p77s', win: '7s' }))).toMatchObject({ 三色同對: 10 });
  });

  it('四連對', () => {
    expect(fanMap(score({ hand: '11223344m55z66z99p77s', win: '7s' }))).toMatchObject({ 四連對: 15 });
  });

  it('四張相同作兩對：四歸二', () => {
    expect(fanMap(score({ hand: '1111m55m99m33p66p22s44z', win: '4z' }))).toMatchObject({ 暗四歸二: 10 });
  });

  it('嚦咕兩食：基本形與嚦咕形番數相加', () => {
    const r = score({ hand: '112233m445566p77s88s', win: '8s' });
    expect(r.form).toBe('嚦咕兩食');
    expect(fanMap(r)).toEqual({
      門清: 5,
      雙般高: 20,
      對碰: 1,
      無字花: 5,
      嚦咕嚦咕: 40,
      八對嚦咕: 10,
      三連對: 10,
    });
    expect(r.handFan).toBe(91);
  });
});
