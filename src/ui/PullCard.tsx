import { useEffect, useState } from 'preact/hooks';
import { pull, pullAmount, runningTotals, settleAmount, type Pull, type Settle } from '../engine/pull';
import { WIND_NAMES } from '../engine/tiles';
import type { ScoreResult } from '../engine/types';

const PULL_KEY = 'mahjong-scorer:pull';

const SETTLE_LABEL: Record<Settle, string> = { collect: '收取', kick: '踢半', cut: '斬拉' };

function loadPull(): Pull | undefined {
  try {
    const p = JSON.parse(localStorage.getItem(PULL_KEY) ?? 'null');
    const ok = Array.isArray(p?.scores) && p.scores.length > 0 && p.scores.every((x: unknown) => typeof x === 'number');
    return ok ? p : undefined;
  } catch {
    return undefined;
  }
}

/** 拉賬卡：記一筆拉賬，結算（收取／踢半／斬拉）後重新開始 */
export function PullCard({ result }: { result?: ScoreResult }) {
  const [p, setP] = useState<Pull | undefined>(loadPull);
  const [score, setScore] = useState('');
  const [settled, setSettled] = useState<string>();

  useEffect(() => {
    try {
      if (p) localStorage.setItem(PULL_KEY, JSON.stringify(p));
      else localStorage.removeItem(PULL_KEY);
    } catch {
      // 忽略
    }
  }, [p]);

  const n = Number(score);
  const validScore = score.trim() !== '' && Number.isFinite(n) && n >= 0;

  const doPull = () => {
    if (!validScore) return;
    setP(pull(p, n));
    setScore('');
    setSettled(undefined);
  };

  const settle = (how: Settle) => {
    if (!p) return;
    setSettled(`${SETTLE_LABEL[how]}：付 ${settleAmount(p, how)} 分（原記 ${pullAmount(p)} 分，拉 ${p.scores.length} 口），拉賬已重新開始`);
    setP(undefined);
  };

  const editScore = (i: number, v: number) => setP({ scores: p!.scores.map((x, j) => (j === i ? v : x)) });

  const removeScore = (i: number) => {
    const scores = p!.scores.filter((_, j) => j !== i);
    setP(scores.length ? { scores } : undefined);
  };

  const totals = p ? runningTotals(p.scores) : [];
  const amount = totals.at(-1) ?? 0;
  const kou = p?.scores.length ?? 0;

  return (
    <section class="card pull">
      <h2>拉賬</h2>
      <div class="pull-status">
        {p ? (
          <>
            <span class="big-num">{amount}</span> 分<span class="pull-kou">拉 {kou} 口</span>
          </>
        ) : (
          <span class="muted">未有拉賬</span>
        )}
      </div>
      {p && (
        <ol class="pull-log">
          {p.scores.map((x, i) => (
            <li key={i}>
              <span class="pull-no">第 {i + 1} 口</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={x}
                aria-label={`第 ${i + 1} 口本局分數`}
                onChange={(e) => {
                  const el = e.target as HTMLInputElement;
                  const v = Number(el.value);
                  if (el.value.trim() !== '' && Number.isFinite(v) && v >= 0) editScore(i, v);
                  else el.value = String(x);
                }}
              />
              <span class="pull-calc">{i === 0 ? `= ${totals[0]}` : `${totals[i - 1]} × 1.5 + ${x} = ${totals[i]}`}</span>
              <button class="pull-del" onClick={() => removeScore(i)} aria-label={`刪除第 ${i + 1} 口`}>
                ×
              </button>
            </li>
          ))}
        </ol>
      )}
      {settled && <p class="note">{settled}</p>}

      <div class="field">
        <div class="field-label">本局分數</div>
        <div class="pull-input">
          <input type="number" inputMode="decimal" min={0} value={score} placeholder="0" onInput={(e) => setScore((e.target as HTMLInputElement).value)} />
          <button class="btn primary" disabled={!validScore} onClick={doPull}>
            {p ? '拉' : '記賬'}
          </button>
        </div>
        {result?.valid && (
          <div class="chips">
            {result.payments.map((pay) => (
              <button key={pay.seat} class="chip" onClick={() => setScore(String(pay.amount))}>
                填入{WIND_NAMES[pay.seat]}家付 {pay.amount}
              </button>
            ))}
          </div>
        )}
      </div>

      {p && (
        <div class="pull-actions">
          <button class="btn ghost" onClick={() => settle('collect')}>
            收取 {amount}
          </button>
          <button class="btn ghost" onClick={() => settle('kick')}>
            踢半 {settleAmount(p, 'kick')}
          </button>
          {kou >= 3 && (
            <button class="btn ghost" onClick={() => settle('cut')}>
              斬拉 {amount}
            </button>
          )}
        </div>
      )}

      <details class="pull-rules">
        <summary>拉賬玩法</summary>
        <p>食糊的分數不即時結算，而是「拉」落下一局。假設 A 食 B，先把分數記賬（一口），之後：</p>
        <ul>
          <li>
            <b>拉</b>：A 再食 B 或 A 自摸 → 記下分數 × 1.5（向上取整）＋ 本局分數，口數加一（拉兩口、三口……）。
          </li>
          <li>
            <b>不變</b>：A 食 B 以外的兩家 → 繼續記下，不用按任何掣。
          </li>
          <li>
            <b>收取</b>：A、B 以外的人食糊，或 B 食另外兩家 → A 收取記下的全數。
          </li>
          <li>
            <b>踢半</b>：B 食 A 或 B 自摸 → B 付 A 記下分數的一半（向下取整）。
          </li>
          <li>
            <b>斬拉</b>：被拉三口或以上，可於下一局擲骰前提出不再拉 → 付記下的全數。
          </li>
          <li>每一口的本局分數都會記下，可直接修改或刪除，之後各口會自動重算（1.5 倍以上一口的累計計算）。</li>
          <li>收取、踢半或斬拉結算後，拉賬清零重新開始。</li>
          <li>暗槓、七搶一、兩台花等中途獎勵即時收取，不受拉賬影響。</li>
        </ul>
      </details>
    </section>
  );
}
