import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { evaluate } from '../engine/score';
import { DISCREPANCIES } from '../engine/fanTable';
import { meldTiles } from '../engine/shapes';
import { ALL_TILES, FLOWERS, WINDS, WIND_NAMES, tileName } from '../engine/tiles';
import type { Flags, MeldKind, ScoreResult, WinType, Wind } from '../engine/types';
import {
  addTile,
  concealedTarget,
  initialState,
  removeConcealed,
  removeMeld,
  toInput,
  usedCount,
  type FormState,
  type Mode,
} from './builder';
import { CheatSheet } from './CheatSheet';
import { Tile } from './Tile';

const SETTINGS_KEY = 'mahjong-scorer:settings';

const MODES: { mode: Mode; label: string }[] = [
  { mode: 'concealed', label: '暗手' },
  { mode: 'win', label: '食糊牌' },
  { mode: 'chow', label: '上' },
  { mode: 'pung', label: '碰' },
  { mode: 'kong', label: '明槓' },
  { mode: 'addedKong', label: '加槓' },
  { mode: 'concealedKong', label: '暗槓' },
];

const MELD_LABEL: Record<MeldKind, string> = {
  chow: '上',
  pung: '碰',
  kong: '明槓',
  addedKong: '加槓',
  concealedKong: '暗槓',
};

const WIN_TYPES: { v: WinType; label: string }[] = [
  { v: 'discard', label: '食出銃' },
  { v: 'selfDraw', label: '自摸' },
  { v: 'robKong', label: '搶槓' },
  { v: 'flower', label: '花糊' },
];

const seatLabel = (w: Wind) => `${WIND_NAMES[w]}家${w === 'E' ? '（莊）' : ''}`;

function loadState(): FormState {
  const s = initialState();
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
    if (typeof saved.base === 'number') s.base = saved.base;
    if (typeof saved.perFan === 'number') s.perFan = saved.perFan;
  } catch {
    // 私密瀏覽等情況下沒有儲存空間，用預設值
  }
  return s;
}

export function App() {
  const [s, setState] = useState<FormState>(loadState);
  const [mode, setMode] = useState<Mode>('concealed');
  const [toast, setToast] = useState<string>();
  const [result, setResult] = useState<ScoreResult>();
  const [cheatOpen, setCheatOpen] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const update = (next: FormState) => {
    setState(next);
    setResult(undefined);
  };

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ base: s.base, perFan: s.perFan }));
    } catch {
      // 忽略
    }
  }, [s.base, s.perFan]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(undefined), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [result]);

  const pick = (tile: string) => {
    const m: Mode = tile.endsWith('f') ? 'flower' : mode;
    const next = addTile(s, m, tile);
    if (typeof next === 'string') {
      setToast(next);
      return;
    }
    update(next);
    // 暗手滿了便自動轉去揀食糊牌
    if (m === 'concealed' && next.concealed.length === concealedTarget(next) && !next.winningTile) setMode('win');
    if (m !== 'concealed' && m !== 'win' && m !== 'flower') setMode('concealed');
  };

  const setWinType = (winType: WinType) => {
    const f: Flags = { ...s.flags };
    if (winType !== 'selfDraw') {
      delete f.flowerDraw;
      delete f.kongDraw;
      delete f.tailDraws;
    }
    if (winType === 'selfDraw' || winType === 'flower') delete f.multiWin;
    const discarder = s.discarder === s.seatWind ? undefined : s.discarder;
    update({ ...s, winType, flags: f, discarder });
  };

  const setSeat = (seatWind: Wind) =>
    update({ ...s, seatWind, discarder: s.discarder === seatWind ? undefined : s.discarder });

  const setFlag = <K extends keyof Flags>(k: K, v: Flags[K]) => {
    const flags = { ...s.flags, [k]: v };
    if (!v) delete flags[k];
    if (k === 'ting' && !v) {
      delete flags.immediate;
      delete flags.tingKind;
    }
    update({ ...s, flags });
  };

  const target = concealedTarget(s);
  const isFlowerWin = s.winType === 'flower';
  const needsDiscarder = s.winType === 'discard' || s.winType === 'robKong' || (isFlowerWin && s.flowerWin === 'sevenRobOne');
  const discarderLabel = s.winType === 'robKong' ? '被搶槓者' : isFlowerWin ? '持一張花的一家' : '出銃者';

  return (
    <div class="app">
      <header class="top">
        <div>
          <h1>港式台牌計番器</h1>
          <p>港式十六張新章 · 香港麻雀協會總例</p>
        </div>
        <button class="top-btn" onClick={() => setCheatOpen(true)}>
          番種表
        </button>
      </header>

      <main>
        <Card title="局況">
          <Field label="圈風">
            <Seg options={WINDS.map((w) => ({ v: w, label: WIND_NAMES[w] }))} value={s.roundWind} onChange={(roundWind) => update({ ...s, roundWind })} />
          </Field>
          <Field label="食糊者風位" hint="東家即莊家">
            <Seg options={WINDS.map((w) => ({ v: w, label: w === 'E' ? '東（莊）' : WIND_NAMES[w] }))} value={s.seatWind} onChange={setSeat} />
          </Field>
          <Field label="連莊數" hint="拉莊每連一莊加 2 番">
            <Stepper value={s.dealerStreak} min={0} onChange={(dealerStreak) => update({ ...s, dealerStreak })} />
          </Field>
        </Card>

        <Card title="食糊方式">
          <Seg options={WIN_TYPES} value={s.winType} onChange={setWinType} />
          {isFlowerWin && (
            <Field label="花糊">
              <Seg
                options={[
                  { v: 'sevenRobOne' as const, label: '七搶一' },
                  { v: 'eightFlowers' as const, label: '八仙過海' },
                ]}
                value={s.flowerWin}
                onChange={(flowerWin) => update({ ...s, flowerWin })}
              />
            </Field>
          )}
          {needsDiscarder && (
            <Field label={discarderLabel}>
              <Seg
                options={WINDS.filter((w) => w !== s.seatWind).map((w) => ({ v: w, label: seatLabel(w) }))}
                value={s.discarder}
                onChange={(discarder) => update({ ...s, discarder })}
              />
            </Field>
          )}
        </Card>

        <Card title="食糊者的牌">
          {!isFlowerWin && (
            <>
              <div class="hand-row">
                <div class="row-label">
                  明章 <span class="muted">{s.melds.length}/5 組</span>
                </div>
                {s.melds.length === 0 ? (
                  <div class="empty">沒有（門清）</div>
                ) : (
                  <div class="melds">
                    {s.melds.map((m, i) => (
                      <button class="meld" key={i} onClick={() => update(removeMeld(s, i))} aria-label={`移除${MELD_LABEL[m.kind]}${tileName(m.tile)}`}>
                        <span class="meld-tag">{MELD_LABEL[m.kind]}</span>
                        <span class="tiles">
                          {meldTiles(m).map((t, j) => (
                            <Tile key={j} t={t} size="sm" />
                          ))}
                        </span>
                        <span class="x">×</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div class="hand-row">
                <div class="row-label">
                  暗手{' '}
                  <span class={s.concealed.length === target ? 'ok' : 'muted'}>
                    {s.concealed.length}/{target} 張
                  </span>
                </div>
                {s.concealed.length === 0 ? (
                  <div class="empty">點選下面的牌加入暗手</div>
                ) : (
                  <div class="tiles wrap">
                    {s.concealed.map((t, i) => (
                      <button class="tile-btn" key={`${t}${i}`} onClick={() => update(removeConcealed(s, i))} aria-label={`移除${tileName(t)}`}>
                        <Tile t={t} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div class="hand-row win-row">
                <div class="row-label">食糊牌</div>
                {s.winningTile ? (
                  <button class="tile-btn" onClick={() => update({ ...s, winningTile: undefined })} aria-label="清除食糊牌">
                    <Tile t={s.winningTile} highlight />
                  </button>
                ) : (
                  <div class="empty">{mode === 'win' ? '點選下面的牌' : '未選'}</div>
                )}
              </div>
            </>
          )}

          <div class="hand-row">
            <div class="row-label">
              花 <span class="muted">{s.flowers.length} 隻</span>
            </div>
            {s.flowers.length === 0 ? (
              <div class="empty">沒有花</div>
            ) : (
              <div class="tiles wrap">
                {s.flowers.map((t) => (
                  <Tile key={t} t={t} size="sm" />
                ))}
              </div>
            )}
          </div>

          <div class="picker">
            {!isFlowerWin && (
              <>
                <div class="modes" role="tablist">
                  {MODES.map(({ mode: m, label }) => (
                    <button key={m} role="tab" aria-selected={mode === m} class={mode === m ? 'mode on' : 'mode'} onClick={() => setMode(m)}>
                      {label}
                    </button>
                  ))}
                </div>
                <p class="mode-hint">{modeHint(mode)}</p>
                {[0, 1, 2, 3].map((row) => (
                  <div class="palette" key={row}>
                    {ALL_TILES.slice(row * 9, row * 9 + 9).map((t) => (
                      <button key={t} class="tile-btn" onClick={() => pick(t)} aria-label={tileName(t)}>
                        <Tile t={t} dim={usedCount(s, t) >= 4} />
                      </button>
                    ))}
                  </div>
                ))}
              </>
            )}
            <div class="palette flowers">
              {FLOWERS.map((t) => (
                <button key={t} class={s.flowers.includes(t) ? 'tile-btn picked' : 'tile-btn'} onClick={() => pick(t)} aria-pressed={s.flowers.includes(t)}>
                  <Tile t={t} dim={!s.flowers.includes(t)} />
                </button>
              ))}
            </div>
          </div>
        </Card>

        {!isFlowerWin && <ConditionsCard s={s} setFlag={setFlag} />}

        <Card title="牌局設定">
          <div class="settings">
            <label>
              底
              <input type="number" inputMode="decimal" min={0} value={s.base} onInput={(e) => update({ ...s, base: Number((e.target as HTMLInputElement).value) || 0 })} />
            </label>
            <label>
              每番
              <input type="number" inputMode="decimal" min={0} value={s.perFan} onInput={(e) => update({ ...s, perFan: Number((e.target as HTMLInputElement).value) || 0 })} />
            </label>
          </div>
          <p class="muted small">每位付款者付：底 + 番數 × 每番。預設底 0、每番 1，即分數等於番數。</p>
        </Card>

        {result && (
          <div ref={resultRef}>
            <ResultCard r={result} s={s} />
          </div>
        )}

        <RulesNote />
      </main>

      <div class="bottom-bar">
        <button
          class="btn ghost"
          onClick={() => {
            update({ ...initialState(), base: s.base, perFan: s.perFan });
            setMode('concealed');
          }}
        >
          清除
        </button>
        <button class="btn primary" onClick={() => setResult(evaluate(toInput(s)))}>
          計番
        </button>
      </div>

      <CheatSheet open={cheatOpen} onClose={() => setCheatOpen(false)} />

      {toast && (
        <div class="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function modeHint(mode: Mode): string {
  switch (mode) {
    case 'concealed':
      return '點牌加入暗手（不包括食糊牌）；點暗手的牌可移除';
    case 'win':
      return '點選食糊的那一張牌';
    case 'chow':
      return '上：點選順子最細的一張，例如點三萬即三四五萬';
    default:
      return `${MODES.find((m) => m.mode === mode)!.label}：點選該款牌`;
  }
}

function ConditionsCard({ s, setFlag }: { s: FormState; setFlag: <K extends keyof Flags>(k: K, v: Flags[K]) => void }) {
  const f = s.flags;
  const self = s.winType === 'selfDraw';
  return (
    <Card title="其他番種條件">
      <div class="chips">
        <Chip on={!!f.ting} onClick={() => setFlag('ting', !f.ting)}>
          叮牌
        </Chip>
        {f.ting && (
          <Chip on={!!f.immediate} onClick={() => setFlag('immediate', !f.immediate)}>
            即食
          </Chip>
        )}
        <Chip on={!!f.lastTile} onClick={() => setFlag('lastTile', !f.lastTile)}>
          海底撈月
        </Chip>
        {self && (
          <>
            <Chip on={!!f.flowerDraw} onClick={() => setFlag('flowerDraw', !f.flowerDraw)}>
              花上自摸
            </Chip>
            <Chip on={!!f.kongDraw} onClick={() => setFlag('kongDraw', !f.kongDraw)}>
              槓上自摸
            </Chip>
          </>
        )}
      </div>
      {f.ting && (
        <Field label="叮牌時機">
          <Seg
            options={[
              { v: undefined, label: '一般' },
              { v: 'tian' as const, label: '天叮' },
              { v: 'di' as const, label: '地叮' },
              { v: 'ren' as const, label: '人叮' },
            ]}
            value={f.tingKind}
            onChange={(v) => setFlag('tingKind', v)}
          />
        </Field>
      )}
      <Field label="天地人糊">
        <Seg
          options={[
            { v: undefined, label: '無' },
            { v: 'tian' as const, label: '天糊' },
            { v: 'di' as const, label: '地糊' },
            { v: 'ren' as const, label: '人糊' },
          ]}
          value={f.winKind}
          onChange={(v) => setFlag('winKind', v)}
        />
      </Field>
      <Field label="地下剩牌">
        <Seg
          options={[
            { v: undefined, label: '不適用' },
            { v: 10 as const, label: '十隻內' },
            { v: 7 as const, label: '七隻內' },
            { v: 4 as const, label: '四隻內' },
          ]}
          value={f.tilesLeft}
          onChange={(v) => setFlag('tilesLeft', v)}
        />
      </Field>
      {!self && (
        <Field label="一炮多響">
          <Seg
            options={[
              { v: undefined, label: '單響' },
              { v: 2 as const, label: '雙響' },
              { v: 3 as const, label: '三響' },
            ]}
            value={f.multiWin}
            onChange={(v) => setFlag('multiWin', v)}
          />
        </Field>
      )}
      {self && (
        <Field label="尾牌連摸" hint="連續補了幾張尾牌後自摸（0 為不適用）">
          <Stepper
            value={f.tailDraws ?? 0}
            min={0}
            onChange={(n) => setFlag('tailDraws', n === 1 ? (f.tailDraws ? 0 : 2) : n)}
          />
        </Field>
      )}
    </Card>
  );
}

function ResultCard({ r, s }: { r: ScoreResult; s: FormState }) {
  if (!r.valid) {
    return (
      <section class="card result bad">
        <h2>不能計番</h2>
        <ul class="errors">
          {r.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </section>
    );
  }
  const money = s.base !== 0 || s.perFan !== 1;
  return (
    <section class="card result good">
      <h2>
        食糊成立{r.form && <span class="form-tag">{r.form}</span>}
      </h2>
      <div class="big">
        <span class="big-num">{r.handFan}</span> 番
        {r.dealerFans.length > 0 && <span class="muted"> ＋ 莊家 {r.dealerFans.reduce((a, f) => a + f.fan, 0)} 番</span>}
      </div>

      {r.groups.length > 0 && (
        <div class="arrangement">
          {r.groups.map((g, i) => (
            <div class="group" key={i}>
              <span class="tiles">
                {g.tiles.map((t, j) => (
                  <Tile key={j} t={t} size="sm" highlight={g.winning && j === g.tiles.indexOf(s.winningTile ?? '')} />
                ))}
              </span>
              <span class="group-label">
                {g.label}
                {g.label === '順子' || g.label === '刻子' ? (g.concealed ? '（暗）' : '（明）') : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      <table class="fans">
        <tbody>
          {r.fans.map((f, i) => (
            <tr key={i}>
              <td>{f.name}</td>
              <td class="num">{f.fan}</td>
            </tr>
          ))}
          {r.dealerFans.map((f) => (
            <tr key={f.name} class="dealer">
              <td>
                {f.name}
                <span class="muted small">（只限莊家出銃／自摸／被自摸）</span>
              </td>
              <td class="num">{f.fan}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>{r.payments.length > 1 ? '自摸：三家各付' : '付款'}</h3>
      <ul class="payments">
        {r.payments.map((p) => (
          <li key={p.seat}>
            <span>{seatLabel(p.seat)}</span>
            <span>
              {p.fan} 番{money && <b> ＝ {fmt(p.amount)}</b>}
            </span>
          </li>
        ))}
      </ul>
      <div class="total">
        合共收 <b>{money ? fmt(r.totalAmount) : `${r.totalAmount} 番`}</b>
      </div>

      {r.waits.length > 0 && (
        <div class="waits">
          <span class="muted">叫糊（{r.waits.length} 扉）</span>
          <span class="tiles wrap">
            {r.waits.map((t) => (
              <Tile key={t} t={t} size="sm" />
            ))}
          </span>
        </div>
      )}
      {r.notes.map((n) => (
        <p class="note" key={n}>
          {n}
        </p>
      ))}
    </section>
  );
}

const fmt = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

function RulesNote() {
  return (
    <details class="card rules">
      <summary>計番說明</summary>
      <ul>
        <li>番數以總例「番種簡表」為準。簡表與「番種詳述」不同之處：{DISCREPANCIES.map((d) => `${d.name} ${d.summary}（詳述 ${d.detail}）`).join('；')}。</li>
        <li>高點法：同一副牌有多種拆法時，取番數最高者；單式結算：同類番種的面子共用率低於 50% 才可重複計算。</li>
        <li>不複合原則：較高番種必然包含的較低番種不計；花、字牌、莊家不受影響。</li>
        <li>莊家 1 番、拉莊每連一莊 2 番，只在莊家食糊、出銃或被自摸時加計。</li>
        <li>門清：沒有上／碰（暗槓、大明槓仍算門清）。</li>
        <li>嚦咕兩食：基本形與嚦咕形番數相加，花、門清、叮、時態等只計一次。</li>
        <li>「拉／踢」跨局結算及暗槓、七搶一等中途獎勵不在此計算內。</li>
      </ul>
    </details>
  );
}

// ---------------------------------------------------------------- 小元件

function Card({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <section class="card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ComponentChildren }) {
  return (
    <div class="field">
      <div class="field-label">
        {label}
        {hint && <span class="muted small"> · {hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Seg<T>({ options, value, onChange }: { options: { v: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div class="seg" role="radiogroup">
      {options.map((o) => (
        <button key={String(o.v)} role="radio" aria-checked={o.v === value} class={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ComponentChildren }) {
  return (
    <button class={on ? 'chip on' : 'chip'} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

function Stepper({ value, min, onChange }: { value: number; min: number; onChange: (n: number) => void }) {
  return (
    <div class="stepper">
      <button onClick={() => onChange(Math.max(min, value - 1))} aria-label="減少">
        −
      </button>
      <span>{value}</span>
      <button onClick={() => onChange(value + 1)} aria-label="增加">
        ＋
      </button>
    </div>
  );
}
