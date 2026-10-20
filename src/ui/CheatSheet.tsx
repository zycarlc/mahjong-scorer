import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { parseTiles } from '../engine/tiles';
import { entryTitle, fanLabel, searchFans, type CheatEntry } from './fanGuide';
import { Tile } from './Tile';

/** 番種速查抽屜 */
export function CheatSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string>();
  const bodyRef = useRef<HTMLDivElement>(null);

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

  const entries = useMemo(() => searchFans(query), [query]);

  // 一次只展開一個番種
  const toggle = (key: string) => {
    const next = expanded === key ? undefined : key;
    setExpanded(next);
    if (next) {
      requestAnimationFrame(() =>
        bodyRef.current?.querySelector(`[data-fan="${next}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
      );
    }
  };

  return (
    <div class={open ? 'drawer open' : 'drawer'} aria-hidden={!open}>
      <div class="drawer-scrim" onClick={onClose} />
      <div class="drawer-panel" role="dialog" aria-modal="true" aria-label="番種表">
        <header class="drawer-head">
          <div class="drawer-title">
            <h2>番種表</h2>
            <button class="drawer-close" onClick={onClose} aria-label="關閉">
              ×
            </button>
          </div>
          <input
            class="drawer-search"
            type="search"
            placeholder="搜尋番種，例如「連刻」"
            value={query}
            onInput={(ev) => setQuery((ev.target as HTMLInputElement).value)}
          />
        </header>
        <div class="drawer-body" ref={bodyRef}>
          {entries.length === 0 && <p class="empty">找不到「{query}」</p>}
          {entries.map((x) => (
            <CheatRow key={x.names[0]} entry={x} open={expanded === x.names[0]} onToggle={() => toggle(x.names[0])} />
          ))}
          <p class="muted small">番數以「番種簡表」為準；括號內為不另計的番種。明／暗：組合中所有牌組皆暗才算暗。</p>
        </div>
      </div>
    </div>
  );
}

function CheatRow({ entry, open, onToggle }: { entry: CheatEntry; open: boolean; onToggle: () => void }) {
  return (
    <div class={open ? 'cheat-row open' : 'cheat-row'} data-fan={entry.names[0]}>
      <button class="cheat-top" aria-expanded={open} onClick={onToggle}>
        <b>{entryTitle(entry)}</b>
        <span class="cheat-fan">{fanLabel(entry)}</span>
        <span class="chev" aria-hidden="true">
          ›
        </span>
      </button>
      {open && (
        <div class="cheat-body">
          <p class="cheat-desc">{entry.desc}</p>
          {entry.ex && (
            <div class="cheat-ex">
              {entry.ex.split(' ').map((g, i) => (
                <span class="tiles" key={i}>
                  {parseTiles(g).map((t, j) => (
                    <Tile key={j} t={t} size="sm" />
                  ))}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
