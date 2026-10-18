import { describe, expect, it } from 'vitest';
import { parseTiles, sortTiles, tileName, isFlower, ALL_TILES, FLOWERS } from '../src/engine/tiles';

describe('牌的表示', () => {
  it('解析簡寫', () => {
    expect(parseTiles('123m')).toEqual(['1m', '2m', '3m']);
    expect(parseTiles('19p 5z')).toEqual(['1p', '9p', '5z']);
    expect(parseTiles('15f')).toEqual(['1f', '5f']);
    expect(parseTiles('')).toEqual([]);
  });

  it('拒絕非法牌', () => {
    expect(() => parseTiles('0m')).toThrow();
    expect(() => parseTiles('8z')).toThrow();
    expect(() => parseTiles('9f')).toThrow();
    expect(() => parseTiles('12')).toThrow();
  });

  it('中文牌名', () => {
    expect(tileName('1m')).toBe('一萬');
    expect(tileName('5p')).toBe('五筒');
    expect(tileName('9s')).toBe('九索');
    expect(tileName('1z')).toBe('東');
    expect(tileName('4z')).toBe('北');
    expect(tileName('5z')).toBe('中');
    expect(tileName('6z')).toBe('發');
    expect(tileName('7z')).toBe('白');
    expect(tileName('1f')).toBe('春');
    expect(tileName('4f')).toBe('冬');
    expect(tileName('5f')).toBe('梅');
    expect(tileName('8f')).toBe('竹');
  });

  it('牌數：34 款數牌字牌，8 款花', () => {
    expect(ALL_TILES).toHaveLength(34);
    expect(FLOWERS).toHaveLength(8);
    expect(isFlower('3f')).toBe(true);
    expect(isFlower('3m')).toBe(false);
  });

  it('排序：萬筒索字', () => {
    expect(sortTiles(['1z', '9s', '1m', '5p', '2m'])).toEqual(['1m', '2m', '5p', '9s', '1z']);
  });
});
