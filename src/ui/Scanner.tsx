import { useRef, useState } from 'preact/hooks';
import { tileName } from '../engine/tiles';
import { LiveScanner } from './LiveScanner';
import { Tile } from './Tile';

interface Props {
  onApply: (tiles: string[]) => void;
}

/** 鏡頭即時辨識／選相辨識麻雀牌，確認後加入暗手 */
export function Scanner({ onApply }: Props) {
  const camera = useRef<HTMLInputElement>(null);
  const album = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [found, setFound] = useState<string[]>();
  const [live, setLive] = useState(false);

  const onFile = async (e: Event) => {
    const el = e.target as HTMLInputElement;
    const file = el.files?.[0];
    el.value = '';
    if (!file) return;
    setError(undefined);
    setFound(undefined);
    setBusy('準備中…');
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const { detectTiles } = await import('../vision/detect');
      const dets = await detectTiles(bmp, setBusy);
      bmp.close();
      setFound(dets.map((d) => d.tile));
    } catch (err) {
      setError(`辨識失敗：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div class="scanner">
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={album} type="file" accept="image/*" hidden onChange={onFile} />
      <div class="scan-actions">
        <button
          class="scan-btn"
          disabled={!!busy}
          onClick={() => {
            setError(undefined);
            setFound(undefined);
            setLive(true);
          }}
        >
          📷 鏡頭辨識
        </button>
        <button class="scan-btn" disabled={!!busy} onClick={() => album.current?.click()}>
          🖼️ 從相簿選擇
        </button>
      </div>
      {live && (
        <LiveScanner
          onClose={() => setLive(false)}
          onResult={(tiles) => {
            setLive(false);
            setFound(tiles);
          }}
          onFallback={() => {
            setLive(false);
            camera.current?.click();
          }}
        />
      )}
      {busy && <p class="muted small">{busy}</p>}
      {error && <p class="scan-err">{error}</p>}
      {found && (
        <div class="scan-result">
          {found.length === 0 ? (
            <p class="muted small">未能辨認到牌，請在光線充足處、牌排成一行再影過。</p>
          ) : (
            <>
              <p class="muted small">辨識到 {found.length} 張，點牌可移除錯誤項目：</p>
              <div class="tiles wrap">
                {found.map((t, i) => (
                  <button key={`${t}${i}`} class="tile-btn" aria-label={`移除${tileName(t)}`} onClick={() => setFound(found.filter((_, j) => j !== i))}>
                    <Tile t={t} />
                  </button>
                ))}
              </div>
              <div class="scan-actions">
                <button
                  class="scan-btn"
                  onClick={() => {
                    onApply(found);
                    setFound(undefined);
                  }}
                >
                  加入暗手
                </button>
                <button class="scan-btn ghost" onClick={() => setFound(undefined)}>
                  取消
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
