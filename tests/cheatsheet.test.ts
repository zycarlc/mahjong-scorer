import { describe, expect, it } from 'vitest';
import { FAN } from '../src/engine/fanTable';
import { parseTiles } from '../src/engine/tiles';
import { CHEATSHEET, searchFans } from '../src/ui/fanGuide';

describe('番種表', () => {
  const names = CHEATSHEET.flatMap((s) => s.entries.flatMap((e) => e.names));

  it('包括每一個番種，而且不重複', () => {
    expect([...names].sort()).toEqual(Object.keys(FAN).sort());
  });

  it('例子都是合法的牌', () => {
    for (const s of CHEATSHEET) {
      for (const e of s.entries) {
        if (e.ex) for (const g of e.ex.split(' ')) expect(() => parseTiles(g), `${e.names[0]}：${g}`).not.toThrow();
      }
    }
  });

  it('簡體、繁體及異寫都搜尋得到', () => {
    const names = (q: string) => searchFans(q).flatMap((e) => e.names);
    expect(names('對對糊')).toContain('對對糊');
    expect(names('对对胡')).toContain('對對糊');
    expect(names('杠上自摸')).toContain('槓上自摸');
    expect(names('清龙')).toEqual(['明清龍', '暗清龍']);
    expect(names('幺')).toContain('斷么');
    expect(names('四只内')).toContain('四隻內');
    expect(names('只有一门')).toContain('混一色');
    expect(searchFans('')).toHaveLength(CHEATSHEET.flatMap((s) => s.entries).length);
  });
});
