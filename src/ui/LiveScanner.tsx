import { createPortal } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { tileName } from '../engine/tiles';
import { voteDetections, type Detection } from '../vision/postprocess';
import { Tile } from './Tile';

interface Props {
  onResult: (tiles: string[]) => void;
  onClose: () => void;
  /** 鏡頭無法使用時改用系統相機 */
  onFallback: () => void;
}

const VOTE_MS = 1000;

/** 即時鏡頭辨識：一邊對準一邊顯示辨識結果，滿意便採用 */
export function LiveScanner({ onResult, onClose, onFallback }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState('開啟鏡頭…');
  const [error, setError] = useState<string>();
  const [dets, setDets] = useState<Detection[]>([]);
  const [size, setSize] = useState<[number, number]>();

  useEffect(() => {
    let stream: MediaStream | undefined;
    let running = true;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('這個瀏覽器不支援網頁鏡頭');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!running) return;
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        setSize([v.videoWidth, v.videoHeight]);
        const { detectTiles } = await import('../vision/detect');
        setStatus('載入辨識模型…');
        // 每秒把這一秒內所有幀投票一次，才更新結果
        let frames: Detection[][] = [];
        let last = performance.now();
        while (running) {
          const found = await detectTiles(v);
          if (!running) break;
          frames.push(found);
          const now = performance.now();
          if (now - last >= VOTE_MS) {
            setDets(voteDetections(frames));
            setStatus('');
            frames = [];
            last = now;
          }
          // 讓出一個畫面，避免卡住介面
          await new Promise((r) => requestAnimationFrame(r));
        }
      } catch (err) {
        if (!running) return;
        const name = err instanceof DOMException ? err.name : '';
        setError(
          name === 'NotAllowedError'
            ? '未獲准使用鏡頭，請在瀏覽器設定中允許，或改用系統相機。'
            : `無法開啟鏡頭：${err instanceof Error ? err.message : String(err)}`,
        );
      }
    })();

    return () => {
      running = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const tiles = dets.map((d) => d.tile);
  const [w, h] = size ?? [16, 9];

  // 掛到 body，避免被頁面內的疊層（例如浮動的計番按鈕）蓋住
  return createPortal(
    <div class="live" role="dialog" aria-modal="true" aria-label="鏡頭辨識">
      <div class="live-head">
        <b>鏡頭辨識</b>
        <button class="live-close" onClick={onClose} aria-label="關閉">
          ✕
        </button>
      </div>

      <div class="live-stage">
        <div class="live-frame" style={{ width: `min(100cqw, ${(100 * w) / h}cqh)`, aspectRatio: `${w} / ${h}` }}>
          <video ref={video} playsInline muted autoPlay />
          {dets.map((d, i) => (
            <div
              key={i}
              class="live-box"
              style={{ left: `${(d.x / w) * 100}%`, top: `${(d.y / h) * 100}%`, width: `${(d.w / w) * 100}%`, height: `${(d.h / h) * 100}%` }}
            >
              <span>{tileName(d.tile)}</span>
            </div>
          ))}
        </div>
        {status && !error && <p class="live-status">{status}</p>}
      </div>

      <div class="live-foot">
        {error ? (
          <>
            <p class="scan-err">{error}</p>
            <div class="scan-actions">
              <button class="scan-btn" onClick={onFallback}>
                改用系統相機
              </button>
              <button class="scan-btn ghost" onClick={onClose}>
                取消
              </button>
            </div>
          </>
        ) : (
          <>
            <p class="muted small">將牌排成一行、正面向上，鏡頭靜止；結果每秒綜合多幀更新一次。</p>
            <div class="tiles wrap live-tiles">
              {tiles.length === 0 ? <span class="muted small">未辨識到牌</span> : tiles.map((t, i) => <Tile key={`${t}${i}`} t={t} size="sm" />)}
            </div>
            <div class="scan-actions">
              <button class="scan-btn" disabled={tiles.length === 0} onClick={() => onResult(tiles)}>
                用這個結果（{tiles.length} 張）
              </button>
              <button class="scan-btn ghost" onClick={onClose}>
                取消
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
