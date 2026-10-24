import { useEffect, useRef } from 'preact/hooks';
import { meldTiles } from '../engine/shapes';
import { ALL_TILES, FLOWERS, tileName } from '../engine/tiles';
import type { MeldKind } from '../engine/types';
import { concealedTarget, isConcealedMode, usedCount, type FormState, type Mode } from './builder';
import { Scanner } from './Scanner';
import { Tile } from './Tile';

const MELD_LABEL: Record<MeldKind, string> = {
  chow: '上',
  pung: '碰',
  kong: '明槓',
  addedKong: '加槓',
  concealedKong: '暗槓',
};

const HIDDEN: { mode: Mode; label: string }[] = [
  { mode: 'concealed', label: '暗手' },
  { mode: 'win', label: '食糊牌' },
  { mode: 'concealedKong', label: '暗槓' },
];

const EXPOSED: { mode: Mode; label: string }[] = [
  { mode: 'chow', label: '上' },
  { mode: 'pung', label: '碰' },
  { mode: 'kong', label: '明槓' },
  { mode: 'addedKong', label: '加槓' },
];

const HINT: Record<Mode, string> = {
  concealed: '點牌加入暗手（不包括食糊牌）；點上面的牌可移除',
  win: '點選食糊的那一張牌',
  concealedKong: '暗槓：點選該款牌，一次加四張',
  chow: '上：點選順子最細的一張，例如點三萬即三四五萬',
  pung: '碰：點選該款牌，一次加三張',
  kong: '明槓：點選該款牌，一次加四張',
  addedKong: '加槓：先碰後再摸到第四張，點選該款牌',
  flower: '',
};

interface Props {
  open: boolean;
  onClose: () => void;
  s: FormState;
  mode: Mode;
  setMode: (m: Mode) => void;
  /** 只選花（花糊） */
  flowersOnly: boolean;
  onPick: (tile: string) => void;
  onScan: (tiles: string[], exposed: boolean) => void;
  onRemoveConcealed: (i: number) => void;
  onRemoveMeld: (i: number) => void;
  onClearWin: () => void;
}

/** 由下而上滑出的砌牌抽屜：暗牌／明牌分頁、鏡頭辨識、全副牌選擇 */
export function InputDrawer({ open, onClose, s, mode, setMode, flowersOnly, onPick, onScan, onRemoveConcealed, onRemoveMeld, onClearWin }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number } | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  // 拖動頂部把手向下掃關閉
  const onTouchStart = (ev: TouchEvent) => {
    drag.current = { y: ev.touches[0].clientY, dy: 0 };
    drawerRef.current?.classList.add('dragging');
  };
  const onTouchMove = (ev: TouchEvent) => {
    const d = drag.current;
    if (!d) return;
    d.dy = Math.max(0, ev.touches[0].clientY - d.y);
    panelRef.current!.style.transform = `translateY(${d.dy}px)`;
  };
  const onTouchEnd = () => {
    const d = drag.current;
    drag.current = undefined;
    drawerRef.current?.classList.remove('dragging');
    if (!d) return;
    panelRef.current!.style.transform = '';
    if (d.dy > Math.min(120, panelRef.current!.offsetHeight * 0.3)) onClose();
  };

  const exposed = !isConcealedMode(mode);
  const target = concealedTarget(s);
  const tabs = exposed ? EXPOSED : HIDDEN;

  return (
    <div class={open ? 'sheet open' : 'sheet'} aria-hidden={!open} ref={drawerRef}>
      <div class="sheet-scrim" onClick={onClose} />
      <div class="sheet-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="砌牌">
        <div class="sheet-grab" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
          <span />
        </div>
        <header class="sheet-head">
          <h2>砌牌</h2>
          <button class="sheet-done" onClick={onClose}>
            完成
          </button>
        </header>

        <div class="sheet-body">
          {!flowersOnly && (
            <>
              <div class="sheet-hand">
                <div class="sheet-line">
                  <span class="sheet-tag">明牌</span>
                  {s.melds.length === 0 ? (
                    <span class="empty">沒有</span>
                  ) : (
                    s.melds.map((m, i) => (
                      <button class="meld" key={i} onClick={() => onRemoveMeld(i)} aria-label={`移除${MELD_LABEL[m.kind]}${tileName(m.tile)}`}>
                        <span class="meld-tag">{MELD_LABEL[m.kind]}</span>
                        <span class="tiles">
                          {meldTiles(m).map((t, j) => (
                            <Tile key={j} t={t} size="sm" />
                          ))}
                        </span>
                      </button>
                    ))
                  )}
                </div>
                <div class="sheet-line">
                  <span class="sheet-tag">
                    暗牌 <span class={s.concealed.length === target ? 'ok' : 'muted'}>{s.concealed.length}/{target}</span>
                  </span>
                  {s.concealed.length === 0 && <span class="empty">未加</span>}
                  <span class="tiles wrap">
                    {s.concealed.map((t, i) => (
                      <button class="tile-btn" key={`${t}${i}`} onClick={() => onRemoveConcealed(i)} aria-label={`移除${tileName(t)}`}>
                        <Tile t={t} size="sm" />
                      </button>
                    ))}
                  </span>
                  <span class="sheet-win">
                    食糊
                    {s.winningTile ? (
                      <button class="tile-btn" onClick={onClearWin} aria-label="清除食糊牌">
                        <Tile t={s.winningTile} size="sm" highlight />
                      </button>
                    ) : (
                      <span class="empty">未選</span>
                    )}
                  </span>
                </div>
              </div>

              <div class="side" role="tablist">
                <button role="tab" aria-selected={!exposed} class={!exposed ? 'on' : ''} onClick={() => !exposed || setMode('concealed')}>
                  暗牌
                </button>
                <button role="tab" aria-selected={exposed} class={exposed ? 'on' : ''} onClick={() => exposed || setMode('chow')}>
                  明牌
                </button>
              </div>
              <div class="modes">
                {tabs.map(({ mode: m, label }) => (
                  <button key={m} class={mode === m ? 'mode on' : 'mode'} aria-pressed={mode === m} onClick={() => setMode(m)}>
                    {label}
                  </button>
                ))}
              </div>
              <p class="mode-hint">{HINT[mode]}</p>

              <Scanner onApply={(tiles) => onScan(tiles, exposed)} applyLabel={exposed ? '砌成明牌' : '加入暗手'} />

              {[0, 1, 2, 3].map((row) => (
                <div class="palette" key={row}>
                  {ALL_TILES.slice(row * 9, row * 9 + 9).map((t) => (
                    <button key={t} class="tile-btn" onClick={() => onPick(t)} aria-label={tileName(t)}>
                      <Tile t={t} dim={usedCount(s, t) >= 4} />
                    </button>
                  ))}
                </div>
              ))}
            </>
          )}

          <div class="palette flowers">
            {FLOWERS.map((t) => (
              <button key={t} class={s.flowers.includes(t) ? 'tile-btn picked' : 'tile-btn'} onClick={() => onPick(t)} aria-pressed={s.flowers.includes(t)} aria-label={tileName(t)}>
                <Tile t={t} dim={!s.flowers.includes(t)} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
