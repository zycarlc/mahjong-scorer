import { FLOWER_NAMES, HONOR_NAMES, isFlower, tileName } from '../engine/tiles';

const NUMS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const SUIT = { m: '萬', p: '筒', s: '索' } as Record<string, string>;

interface Props {
  t: string;
  size?: 'sm' | 'md';
  highlight?: boolean;
  dim?: boolean;
}

/** 以文字砌出的麻雀牌 */
export function Tile({ t, size = 'md', highlight, dim }: Props) {
  const cls = ['tile', `tile-${size}`, highlight && 'tile-hl', dim && 'tile-dim'].filter(Boolean).join(' ');
  if (isFlower(t)) {
    const n = Number(t[0]);
    return (
      <span class={`${cls} tile-flower ${n <= 4 ? 'tile-season' : 'tile-plant'}`} aria-label={tileName(t)}>
        <b>{FLOWER_NAMES[n - 1]}</b>
        <i>{((n - 1) % 4) + 1}</i>
      </span>
    );
  }
  if (t[1] === 'z') {
    const n = Number(t[0]);
    const kind = n <= 4 ? 'wind' : n === 5 ? 'red' : n === 6 ? 'green' : 'white';
    return (
      <span class={`${cls} tile-honor tile-${kind}`} aria-label={tileName(t)}>
        {n === 7 ? <span class="white-frame" /> : <b>{HONOR_NAMES[n - 1]}</b>}
      </span>
    );
  }
  return (
    <span class={`${cls} tile-${t[1]}`} aria-label={tileName(t)}>
      <b>{NUMS[Number(t[0]) - 1]}</b>
      <i>{SUIT[t[1]]}</i>
    </span>
  );
}
