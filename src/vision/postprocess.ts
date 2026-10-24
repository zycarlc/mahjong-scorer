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

export function parseOutput(data: ArrayLike<number>, scoreThreshold = 0.25, iouThreshold = 0.5): Detection[] {
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

/**
 * 多幀投票：把一段時間內的逐幀偵測按位置歸類，同一位置取各幀總分最高的牌，
 * 只保留在過半數幀中出現的位置，令即時結果不會逐幀跳動。
 */
export function voteDetections(frames: Detection[][]): Detection[] {
  interface Cluster {
    box: Detection;
    hits: Detection[];
    frames: Set<number>;
  }
  const clusters: Cluster[] = [];
  frames.forEach((dets, f) => {
    for (const d of dets) {
      let best: Cluster | undefined;
      let bestIou = 0.4;
      for (const c of clusters) {
        if (c.frames.has(f)) continue;
        const o = iou(c.box, d);
        if (o > bestIou) {
          bestIou = o;
          best = c;
        }
      }
      if (!best) {
        clusters.push({ box: d, hits: [d], frames: new Set([f]) });
        continue;
      }
      best.hits.push(d);
      best.frames.add(f);
      const n = best.hits.length;
      const avg = (k: 'x' | 'y' | 'w' | 'h') => best!.hits.reduce((a, h) => a + h[k], 0) / n;
      best.box = { ...best.box, x: avg('x'), y: avg('y'), w: avg('w'), h: avg('h') };
    }
  });
  const need = Math.ceil(frames.length / 2);
  const out: Detection[] = [];
  for (const c of clusters) {
    if (c.frames.size < need) continue;
    const score = new Map<string, number>();
    for (const h of c.hits) score.set(h.tile, (score.get(h.tile) ?? 0) + h.score);
    const [tile] = [...score.entries()].sort((a, b) => b[1] - a[1])[0];
    out.push({ ...c.box, tile, score: score.get(tile)! / c.frames.size });
  }
  return sortReadingOrder(out);
}
