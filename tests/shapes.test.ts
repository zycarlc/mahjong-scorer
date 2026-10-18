import { describe, expect, it } from 'vitest';
import { parseTiles, toCounts } from '../src/engine/tiles';
import {
  basicDecompositions,
  isLigu,
  isSixteenUnrelated,
  isThirteenOrphans,
  computeWaits,
} from '../src/engine/shapes';
import { parseMelds } from './helpers';

const counts = (s: string) => toCounts(parseTiles(s));

describe('基本形拆牌：五個面子加一對眼', () => {
  it('十七張全暗手可拆', () => {
    const d = basicDecompositions(counts('123m456m789m123p55s111z'), 5);
    // 123m 456m 789m 123p 111z + 55s
    expect(d.length).toBeGreaterThan(0);
  });

  it('有明章時，暗手只需拆餘下的面子', () => {
    // 已有三組明章，暗手 8 張 = 2 面子 + 1 眼
    expect(basicDecompositions(counts('234m567p99s'), 2)).toHaveLength(1);
  });

  it('列出所有拆法（高點法需要）：111222333m 可拆三刻或三順', () => {
    const d = basicDecompositions(counts('111222333m456p77s'), 4);
    expect(d.length).toBe(2);
  });

  it('不能拆則回傳空', () => {
    expect(basicDecompositions(counts('124m567p99s'), 2)).toHaveLength(0);
  });
});

describe('特殊形', () => {
  it('嚦咕嚦咕：八對加一張重複', () => {
    expect(isLigu(counts('11m55m99m33p66p22s77s444z'))).toBe(true);
    // 四張相同可作兩對
    expect(isLigu(counts('1111m55m99m33p66p22s444z'))).toBe(true);
    // 單張不行
    expect(isLigu(counts('11m55m99m33p66p22s7s8s444z'))).toBe(false);
  });

  it('十三么：十三款么九各一、其中一款成對、加一組面子', () => {
    expect(isThirteenOrphans(counts('19m19p19s1234567z7z456p'), 0)).toBe(true);
    expect(isThirteenOrphans(counts('19m19p19s1234567z7z457p'), 0)).toBe(false);
    // 面子可以是暗槓
    expect(isThirteenOrphans(counts('19m19p19s1234567z1z'), 1)).toBe(true);
  });

  it('十六不搭：七款字牌、每門三張不相搭、加一張成眼', () => {
    expect(isSixteenUnrelated(counts('159m148p269s12345671z'))).toBe(true);
    // 4p 與 6p 只相隔兩個數字，算搭上
    expect(isSixteenUnrelated(counts('159m146p269s12345671z'))).toBe(false);
    // 眼必須是當中一張
    expect(isSixteenUnrelated(counts('159m148p269s1234567z3m'))).toBe(false);
  });
});

describe('叫糊（聽牌）計算', () => {
  it('兩頭', () => {
    expect(computeWaits(parseTiles('123p345p234m678m67s99s'), [])).toEqual(['5s', '8s']);
  });

  it('單釣', () => {
    expect(computeWaits(parseTiles('5z'), parseMelds('c2m c5p p7s c3s p9m'))).toEqual(['5z']);
  });

  it('對碰', () => {
    expect(computeWaits(parseTiles('234m678m567p345s99m88p'), [])).toEqual(['9m', '8p']);
  });

  it('假獨例子：12345萬叫三萬、六萬', () => {
    expect(computeWaits(parseTiles('12345m678p456s88s'), parseMelds('p2p'))).toEqual(['3m', '6m']);
  });

  it('已持有四張的牌不算叫', () => {
    // 暗槓一萬已用了四張：23m 只叫 4m
    const w = computeWaits(parseTiles('23m55p'), parseMelds('h1m c4p p7s c3s'));
    expect(w).toEqual(['4m']);
  });

  it('十三么十三扉', () => {
    expect(computeWaits(parseTiles('19m19p19s1234567z456p'), [])).toHaveLength(13);
  });

  it('十六不搭十六扉', () => {
    expect(computeWaits(parseTiles('159m148p269s1234567z'), []).length).toBeGreaterThanOrEqual(16);
  });

  it('八對嚦咕叫八扉', () => {
    expect(computeWaits(parseTiles('11m55m99m33p66p22s77s44z'), [])).toHaveLength(8);
  });
});
