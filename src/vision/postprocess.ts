/**
 * Mahjong-YOLO（YOLO11, 640×640）輸出解析。
 * 輸出張量 [1, 4+37, 8400]：前四行 cx,cy,w,h（輸入像素），其後 37 行類別分數。
 */

export const INPUT_SIZE = 640;
export const NUM_CLASSES = 37;
export const NUM_ANCHORS = 8400;

/** 模型類別順序（data.yaml）；0m/0p/0s 為赤牌五 */
export const MODEL_CLASSES = [
  '1m', '1p', '1s', '1z', '2m', '2p', '2s', '2z', '3m', '3p', '3s', '3z', '4m', '4p', '4s', '4z',
  '5m', '5p', '5s', '5z', '6m', '6p', '6s', '6z', '7m', '7p', '7s', '7z', '8m', '8p', '8s',
  '9m', '9p', '9s', '0m', '0p', '0s',
];

/** 模型用天鳳記法（5z 白、6z 發、7z 中）；本程式為 5z 中、6z 發、7z 白 */
export function modelClassToTile(name: string): string {
  const n = name[0];
  const suit = name[1];
  if (suit === 'z') return n === '5' ? '7z' : n === '7' ? '5z' : name;
  return n === '0' ? `5${suit}` : name;
}

export interface Detection {
  tile: string;
  score: number;
  /** 左上角 x,y 及闊高（輸入像素） */
  x: number;
  y: number;
  w: number;
  h: number;
}

function iou(a: Detection, b: Detection): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

export function parseOutput(data: ArrayLike<number>, scoreThreshold = 0.4, iouThreshold = 0.5): Detection[] {
  const cands: Detection[] = [];
  for (let i = 0; i < NUM_ANCHORS; i++) {
    let best = -1;
    let bestScore = scoreThreshold;
    for (let c = 0; c < NUM_CLASSES; c++) {
      const sc = data[(4 + c) * NUM_ANCHORS + i];
      if (sc > bestScore) {
        bestScore = sc;
        best = c;
      }
    }
    if (best < 0) continue;
    const cx = data[i];
    const cy = data[NUM_ANCHORS + i];
    const w = data[2 * NUM_ANCHORS + i];
    const h = data[3 * NUM_ANCHORS + i];
    cands.push({ tile: modelClassToTile(MODEL_CLASSES[best]), score: bestScore, x: cx - w / 2, y: cy - h / 2, w, h });
  }
  cands.sort((a, b) => b.score - a.score);
  const kept: Detection[] = [];
  for (const c of cands) {
    // 不分類別的 NMS：同一位置只會有一張牌
    if (kept.every((k) => iou(k, c) < iouThreshold)) kept.push(c);
  }
  return kept;
}

/** 依閱讀次序排列：先按行（垂直位置相近者同一行），行內由左至右 */
export function sortReadingOrder(dets: Detection[]): Detection[] {
  const sorted = [...dets].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
  const rows: Detection[][] = [];
  for (const d of sorted) {
    const row = rows.find((r) => Math.abs(r[0].y + r[0].h / 2 - (d.y + d.h / 2)) < r[0].h * 0.6);
    if (row) row.push(d);
    else rows.push([d]);
  }
  return rows.flatMap((r) => r.sort((a, b) => a.x - b.x));
}
