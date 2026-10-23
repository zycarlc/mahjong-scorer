import { INPUT_SIZE, parseOutput, sortReadingOrder, type Detection } from './postprocess';

type Ort = typeof import('onnxruntime-web/wasm');
type Session = import('onnxruntime-web/wasm').InferenceSession;

let loading: Promise<{ ort: Ort; session: Session }> | undefined;

function load() {
  loading ??= (async () => {
    const ort = await import('onnxruntime-web/wasm');
    const base = new URL(import.meta.env.BASE_URL, document.baseURI).href;
    ort.env.wasm.wasmPaths = `${base}ort/`;
    ort.env.wasm.numThreads = 1; // 多執行緒需要 COOP/COEP，靜態主機不一定有
    const session = await ort.InferenceSession.create(`${base}models/mahjong-yolon.onnx`, { executionProviders: ['wasm'] });
    return { ort, session };
  })();
  loading.catch(() => (loading = undefined));
  return loading;
}

/** 辨識相片中的麻雀牌，按閱讀次序回傳 */
export async function detectTiles(img: ImageBitmap | HTMLImageElement, onStatus?: (s: string) => void): Promise<Detection[]> {
  onStatus?.('載入辨識模型…');
  const { ort, session } = await load();
  onStatus?.('辨識中…');

  const sw = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  const sh = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
  const scale = Math.min(INPUT_SIZE / sw, INPUT_SIZE / sh);
  const nw = Math.round(sw * scale);
  const nh = Math.round(sh * scale);
  const padX = (INPUT_SIZE - nw) / 2;
  const padY = (INPUT_SIZE - nh) / 2;

  const canvas = document.createElement('canvas');
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
  const dets = parseOutput(out[session.outputNames[0]].data as Float32Array);
  // 還原到原圖座標
  return sortReadingOrder(dets.map((d) => ({ ...d, x: (d.x - padX) / scale, y: (d.y - padY) / scale, w: d.w / scale, h: d.h / scale })));
}
