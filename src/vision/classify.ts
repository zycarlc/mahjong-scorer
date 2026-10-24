import type { Detection } from './postprocess';

/** 牌面分類器（public/models/mahjong-tiles.onnx）：輸入 3×44×32 的牌面裁圖 */
export const CROP_W = 32;
export const CROP_H = 44;

/** 輸出類別順序；最後一個 bg 是「不是牌」 */
export const CLASSIFIER_LABELS = [
  '1z', '2z', '3z', '4z', '6z', '5z', '7z',
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `${n}m`),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `${n}s`),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `${n}p`),
  'bg',
];

/** 分類器有把握才採用其結果 */
const TRUST = 0.6;
/** 分類器沒把握時，偵測模型自己的分數要夠高才保留 */
const KEEP_DETECTOR = 0.4;

export function softmax(logits: ArrayLike<number>): number[] {
  const max = Math.max(...Array.from(logits));
  const e = Array.from(logits, (v) => Math.exp(v - max));
  const sum = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / sum);
}

/**
 * 綜合分類器與偵測模型決定一個框是哪張牌；回傳 undefined 表示不是牌。
 * 分類器有把握：用它（bg 即丟棄）；否則沿用偵測模型，但分數太低的框丟棄。
 */
export function decideTile(logits: ArrayLike<number>, det: Detection): string | undefined {
  const p = softmax(logits);
  let best = 0;
  for (let i = 1; i < p.length; i++) if (p[i] > p[best]) best = i;
  if (p[best] >= TRUST) {
    const label = CLASSIFIER_LABELS[best];
    return label === 'bg' ? undefined : label;
  }
  return det.score >= KEEP_DETECTOR ? det.tile : undefined;
}
