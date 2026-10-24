import { INPUT_SIZE, parseOutput, sortReadingOrder, type Detection } from './postprocess';
import { CLASSIFIER_LABELS, CROP_H, CROP_W, decideTile } from './classify';

type Ort = typeof import('onnxruntime-web/wasm');
type Session = import('onnxruntime-web/wasm').InferenceSession;

let loading: Promise<{ ort: Ort; session: Session; cls?: Session }> | undefined;

function load() {
  loading ??= (async () => {
    const ort = await import('onnxruntime-web/wasm');
    const base = new URL(import.meta.env.BASE_URL, document.baseURI).href;
    ort.env.wasm.wasmPaths = `${base}ort/`;
    ort.env.wasm.numThreads = 1; // 多執行緒需要 COOP/COEP，靜態主機不一定有
    const session = await ort.InferenceSession.create(`${base}models/mahjong-yolon.onnx`, { executionProviders: ['wasm'] });
    // 專用分類器（用自己副牌的相片訓練）；載入失敗就只用偵測模型
    const cls = await ort.InferenceSession.create(`${base}models/mahjong-tiles.onnx`, { executionProviders: ['wasm'] }).catch(() => undefined);
    return { ort, session, cls };
  })();
  loading.catch(() => (loading = undefined));
  return loading;
}

export type Source = ImageBitmap | HTMLImageElement | HTMLVideoElement;

export function sourceSize(img: Source): [number, number] {
  if (img instanceof HTMLVideoElement) return [img.videoWidth, img.videoHeight];
  if (img instanceof HTMLImageElement) return [img.naturalWidth, img.naturalHeight];
  return [img.width, img.height];
}

/** 預先載入模型（例如開啟鏡頭時） */
export async function preload(): Promise<void> {
  await load();
}

let canvas: HTMLCanvasElement | undefined;
let cropCanvas: HTMLCanvasElement | undefined;

/** 有分類器時，偵測門檻放低，確保每張牌都有框 */
const BOX_THRESHOLD = 0.12;

/** 辨識相片或影片當前畫面中的麻雀牌，按閱讀次序回傳（座標為原圖像素） */
export async function detectTiles(img: Source, onStatus?: (s: string) => void): Promise<Detection[]> {
  onStatus?.('載入辨識模型…');
  const { ort, session, cls } = await load();
  onStatus?.('辨識中…');

  const [sw, sh] = sourceSize(img);
  if (!sw || !sh) return [];
  const scale = Math.min(INPUT_SIZE / sw, INPUT_SIZE / sh);
  const nw = Math.round(sw * scale);
  const nh = Math.round(sh * scale);
  const padX = (INPUT_SIZE - nw) / 2;
  const padY = (INPUT_SIZE - nh) / 2;

  canvas ??= document.createElement('canvas');
  canvas.width = canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = 'rgb(114,114,114)';
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  ctx.drawImage(img, padX, padY, nw, nh);
  const px = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;

  const n = INPUT_SIZE * INPUT_SIZE;
  const input = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    input[i] = px[i * 4] / 255;
    input[n + i] = px[i * 4 + 1] / 255;
    input[2 * n + i] = px[i * 4 + 2] / 255;
  }
  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, INPUT_SIZE, INPUT_SIZE]) });
  const boxes = parseOutput(out[session.outputNames[0]].data as Float32Array, cls ? BOX_THRESHOLD : undefined);
  // 還原到原圖座標
  let dets = boxes.map((d) => ({ ...d, x: (d.x - padX) / scale, y: (d.y - padY) / scale, w: d.w / scale, h: d.h / scale }));
  if (cls && dets.length) dets = await reclassify(ort, cls, img, dets);
  return sortReadingOrder(dets);
}

/** 偵測只負責找牌的位置；牌面交給分類器重新判斷，不確定時才沿用偵測模型的結果 */
async function reclassify(ort: Ort, cls: Session, img: Source, dets: Detection[]): Promise<Detection[]> {
  cropCanvas ??= document.createElement('canvas');
  cropCanvas.width = CROP_W;
  cropCanvas.height = CROP_H;
  const ctx = cropCanvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  const n = CROP_W * CROP_H;
  const input = new Float32Array(dets.length * 3 * n);
  dets.forEach((d, k) => {
    ctx.drawImage(img, d.x, d.y, d.w, d.h, 0, 0, CROP_W, CROP_H);
    const px = ctx.getImageData(0, 0, CROP_W, CROP_H).data;
    const o = k * 3 * n;
    for (let i = 0; i < n; i++) {
      input[o + i] = px[i * 4] / 255;
      input[o + n + i] = px[i * 4 + 1] / 255;
      input[o + 2 * n + i] = px[i * 4 + 2] / 255;
    }
  });
  const out = await cls.run({ [cls.inputNames[0]]: new ort.Tensor('float32', input, [dets.length, 3, CROP_H, CROP_W]) });
  const logits = out[cls.outputNames[0]].data as Float32Array;
  const k = CLASSIFIER_LABELS.length;
  const result: Detection[] = [];
  dets.forEach((d, i) => {
    const tile = decideTile(logits.subarray(i * k, (i + 1) * k), d);
    if (tile) result.push({ ...d, tile });
  });
  return result;
}
