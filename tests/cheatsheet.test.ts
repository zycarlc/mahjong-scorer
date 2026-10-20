import { describe, expect, it } from 'vitest';
import { FAN } from '../src/engine/fanTable';
import { parseTiles } from '../src/engine/tiles';
import { CHEATSHEET } from '../src/ui/fanGuide';

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
});
