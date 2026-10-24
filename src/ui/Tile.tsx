import { FLOWER_NAMES, HONOR_NAMES, isFlower, tileName } from '../engine/tiles';

const NUMS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

interface Props {
  t: string;
  size?: 'sm' | 'md';
  highlight?: boolean;
  dim?: boolean;
}

const GREEN = '#1f7a3a';
const RED = '#c0392b';
const BLUE = '#1f5fa8';
const SOU_DARK = '#1d4a3a';

/** 筒子點位（viewBox 30×40）[cx, cy] */
const PIN_POS: Record<number, [number, number][]> = {
  1: [[15, 20]],
  2: [[15, 11], [15, 29]],
  3: [[8, 8], [15, 20], [22, 32]],
  4: [[9, 11], [21, 11], [9, 29], [21, 29]],
  5: [[9, 10], [21, 10], [15, 20], [9, 30], [21, 30]],
  6: [[9, 9], [21, 9], [9, 20], [21, 20], [9, 31], [21, 31]],
  7: [[7, 7], [15, 11], [23, 15], [9, 26], [21, 26], [9, 34], [21, 34]],
  8: [[9, 7], [21, 7], [9, 16], [21, 16], [9, 25], [21, 25], [9, 34], [21, 34]],
  9: [[7, 9], [15, 9], [23, 9], [7, 20], [15, 20], [23, 20], [7, 31], [15, 31], [23, 31]],
};

/** 索子三欄的 x 位置（欄距相等）；每行列出用到的欄 */
const SOU_COLS = [6.5, 15, 23.5];
const SOU_ROWS: Record<number, number[][]> = {
  2: [[1], [1]],
  3: [[1], [0, 2]],
  4: [[0, 2], [0, 2]],
  5: [[0, 2], [1], [0, 2]],
  6: [[0, 1, 2], [0, 1, 2]],
  7: [[1], [0, 1, 2], [0, 1, 2]],
  9: [[0, 1, 2], [0, 1, 2], [0, 1, 2]],
};

function pinColor(n: number, i: number, total: number): string {
  if (n === 1) return BLUE;
  if (n === 5 && i === 2) return RED;
  if (n === 9) return i < 3 ? BLUE : i < 6 ? RED : GREEN;
  return total % 2 && i === Math.floor(total / 2) ? RED : i % 2 ? GREEN : BLUE;
}

function Pin({ n }: { n: number }) {
  const pos = PIN_POS[n];
  const r = n === 1 ? 11 : n <= 3 ? 5.2 : 4.4;
  return (
    <svg viewBox="0 0 30 40" class="tile-art" aria-hidden="true">
      {pos.map(([x, y], i) => {
        const c = pinColor(n, i, pos.length);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={r} fill="none" stroke={c} stroke-width={n === 1 ? 2.4 : 1.6} />
            <circle cx={x} cy={y} r={r * 0.62} fill={c} opacity={n === 1 ? 0.25 : 0.9} />
            <circle cx={x} cy={y} r={r * 0.3} fill="#fffdf5" />
          </g>
        );
      })}
    </svg>
  );
}

/** 索條：深色外框、淺色內芯，中間一節（仿實體牌上的竹節） */
function Stick({ x, y, h, c }: { x: number; y: number; h: number; c: string }) {
  return (
    <g>
      <rect x={x - 2.1} y={y} width="4.2" height={h} rx="2" fill="#fffdf5" stroke={c} stroke-width="1.3" />
      <rect x={x - 0.7} y={y + 2} width="1.4" height={h - 4} rx="0.7" fill={c} opacity="0.55" />
      <rect x={x - 2.3} y={y + h / 2 - 0.6} width="4.6" height="1.2" fill={c} />
    </g>
  );
}

/** 八索：上 W、下 M 的折線條，左右兩邊垂直 */
function Zigzag({ y, up, c }: { y: number; up: boolean; c: string }) {
  const pts: [number, number][] = [[5, 0], [5, 14], [15, 5], [25, 14], [25, 0]];
  const d = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px} ${y + (up ? 14 - py : py)}`).join(' ');
  return (
    <g fill="none" stroke-linejoin="round" stroke-linecap="round">
      <path d={d} stroke={c} stroke-width="4.4" />
      <path d={d} stroke="#fffdf5" stroke-width="2.2" />
      <path d={d} stroke={c} stroke-width="0.9" opacity="0.55" />
    </g>
  );
}

function Sou({ n }: { n: number }) {
  if (n === 1) {
    return (
      <svg viewBox="0 0 30 40" class="tile-art" aria-hidden="true">
        <path d="M6 28c2-8 8-12 14-10 3-6 8-6 8-3-3 1-4 3-4 5 0 7-6 14-14 12z" fill={GREEN} />
        <circle cx="22" cy="12" r="3.2" fill={GREEN} />
        <path d="M24.5 12l3.5 1.2-3.5 1z" fill={RED} />
        <circle cx="22.6" cy="11.4" r="0.8" fill="#fffdf5" />
        <path d="M8 29c-3 3-3 6-2 8M13 30c-1 3 0 5 1 7" stroke={RED} stroke-width="1.6" fill="none" stroke-linecap="round" />
      </svg>
    );
  }
  if (n === 8) {
    return (
      <svg viewBox="0 0 30 40" class="tile-art" aria-hidden="true">
        <Zigzag y={4} up={false} c={SOU_DARK} />
        <Zigzag y={24} up c={SOU_DARK} />
      </svg>
    );
  }
  const rows = SOU_ROWS[n];
  const tall = rows.length === 2 || n === 5;
  const rowH = tall ? 14 : 9;
  const gapY = tall ? 16 : 11;
  const top = (40 - (gapY * (rows.length - 1) + rowH)) / 2;
  return (
    <svg viewBox="0 0 30 40" class="tile-art" aria-hidden="true">
      {rows.map((cols, ri) =>
        cols.map((ci) => {
          const c = (n === 5 && ri === 1) || (n === 7 && ri === 0) || (n === 9 && ri === 1) ? RED : SOU_DARK;
          return <Stick key={`${ri}-${ci}`} x={SOU_COLS[ci]} y={n === 5 ? (ri === 1 ? 13 : 5 + (ri / 2) * 16) : top + ri * gapY} h={rowH} c={c} />;
        }),
      )}
    </svg>
  );
}

/** 麻雀牌：筒、索用圖案，萬及字牌用牌面上的單字（萬子為「數字＋萬」） */
export function Tile({ t, size = 'md', highlight, dim }: Props) {
  const cls = ['tile', `tile-${size}`, highlight && 'tile-hl', dim && 'tile-dim'].filter(Boolean).join(' ');
  if (isFlower(t)) {
    const n = Number(t[0]);
    return (
      <span class={`${cls} tile-flower ${n <= 4 ? 'tile-season' : 'tile-plant'}`} aria-label={tileName(t)}>
        <b>{FLOWER_NAMES[n - 1]}</b>
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
  const n = Number(t[0]);
  return (
    <span class={`${cls} tile-${t[1]}`} aria-label={tileName(t)}>
      {t[1] === 'p' ? <Pin n={n} /> : t[1] === 's' ? <Sou n={n} /> : (
        <>
          <b>{NUMS[n - 1]}</b>
          <i>萬</i>
        </>
      )}
    </span>
  );
}
