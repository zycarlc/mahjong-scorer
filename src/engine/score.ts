import { FAN, HAND_EXCLUDES, type FanName } from './fanTable';
import { bestPatterns, type Group } from './patterns';
import {
  basicDecompositions,
  computeWaits,
  isKong,
  isLigu,
  isSixteenUnrelated,
  liguGroups,
  meldTiles,
  sixteenSuitNumbers,
  thirteenOrphansArrangements,
  type RawGroup,
} from './shapes';
import {
  indexTile,
  isDragon,
  isFlower,
  isHonor,
  isSeatFlower,
  isTerminal,
  isTerminalOrHonor,
  isValidTile,
  isWind,
  numOf,
  sortTiles,
  suitOf,
  tileIndex,
  tileName,
  toCounts,
  windIndex,
  WINDS,
} from './tiles';
import type { FanItem, GroupView, Payment, ScoreResult, WinInput, Wind } from './types';

type Form = '基本形' | '嚦咕嚦咕' | '十三么' | '十六不搭';

interface Evaluated {
  form: Form | '嚦咕兩食';
  groups: Group[];
  fans: FanItem[];
}

interface Ctx {
  input: WinInput;
  win: number;
  selfDraw: boolean;
  /** 沒有上／碰（包括加槓） */
  menqing: boolean;
  waits: number[];
}

const MELD_LABEL = { chow: '上', pung: '碰', kong: '明槓', addedKong: '加槓', concealedKong: '暗槓' } as const;
const RAW_LABEL = { chow: '順子', pung: '刻子', kong: '槓', pair: '眼', single: '單張' } as const;

/** 嚦咕兩食時，嚦咕形中會與基本形重複計算的番種（底分、門清、般高等不重複） */
const LIGU_DOUBLE = new Set<string>([
  '嚦咕嚦咕', '八對嚦咕', '三元嚦咕', '四喜嚦咕', '三色同對',
  '三連對', '四連對', '五連對', '六連對', '七連對', '八連對',
  '明四歸二', '暗四歸二', '八歸', '十二歸',
  '清一色', '混一色', '字一色', '缺一門', '斷么', '混帶么', '全帶么', '混么', '清么', '缺五',
  '混滿庭芳', '純滿庭芳', '小五門', '小七門',
]);

export function evaluate(input: WinInput): ScoreResult {
  const result: ScoreResult = {
    valid: false,
    errors: [],
    notes: [],
    groups: [],
    fans: [],
    handFan: 0,
    dealerFans: [],
    waits: [],
    payments: [],
    totalAmount: 0,
    concealedKongs: input.melds.filter((m) => m.kind === 'concealedKong').length,
  };
  const errors = result.errors;

  checkCommon(input, errors);
  if (input.winType === 'flower') {
    if (errors.length) return result;
    return finish(result, input, flowerWin(input, errors));
  }

  checkTiles(input, errors);
  if (errors.length) return result;

  const win = tileIndex(input.winningTile!);
  const ctx: Ctx = {
    input,
    win,
    selfDraw: input.winType === 'selfDraw',
    menqing: input.melds.every((m) => m.kind === 'kong' || m.kind === 'concealedKong'),
    waits: computeWaits(input.concealed, input.melds).map(tileIndex),
  };
  checkFlags(ctx, errors);
  if (errors.length) return result;

  const counts = toCounts([...input.concealed, input.winningTile!]);
  const candidates: Evaluated[] = [];
  const basic = evaluateBasic(ctx, counts);
  const ligu = input.melds.length === 0 && isLigu(counts) ? evaluateLigu(ctx, counts) : undefined;
  if (basic && ligu) candidates.push(combineLigu(basic, ligu));
  else if (basic) candidates.push(basic);
  else if (ligu) candidates.push(ligu);
  candidates.push(...evaluateThirteen(ctx, counts));
  if (input.melds.length === 0 && isSixteenUnrelated(counts)) candidates.push(evaluateSixteen(ctx, counts));

  if (candidates.length === 0) {
    errors.push('詐糊：手牌不符合食糊形（基本形五組面子加一對眼，或嚦咕嚦咕、十三么、十六不搭）');
    return result;
  }
  const best = candidates.reduce((a, b) => (sum(b.fans) > sum(a.fans) ? b : a));
  addChicken(best.fans, ctx.selfDraw);
  result.form = best.form;
  result.groups = best.groups.map(toView);
  result.waits = ctx.waits.map(indexTile);
  if (best.form === '嚦咕兩食') result.notes.push('嚦咕兩食：基本形與嚦咕形的番數相加（底分、門清、般高等不重複計算）');
  return finish(result, input, best.fans);
}

// ---------------------------------------------------------------- 檢查

function checkCommon(input: WinInput, errors: string[]) {
  const seen = new Set<string>();
  for (const f of input.flowers) {
    if (!isFlower(f)) errors.push(`非法花牌：${f}`);
    else if (seen.has(f)) errors.push(`花牌「${tileName(f)}」重複`);
    seen.add(f);
  }
  const { winType, discarder, seatWind } = input;
  if (winType === 'discard' || winType === 'robKong' || (winType === 'flower' && input.flowerWin === 'sevenRobOne')) {
    const who = winType === 'robKong' ? '被搶槓者' : winType === 'flower' ? '持一張花的一家' : '出銃者';
    if (!discarder) errors.push(`請選擇${who}`);
    else if (discarder === seatWind) errors.push(`${who}不能是食糊者自己（出銃者）`);
  }
  if (!Number.isInteger(input.dealerStreak) || input.dealerStreak < 0) errors.push('連莊數必須是零或正整數');
}

function checkTiles(input: WinInput, errors: string[]) {
  if (!input.winningTile) {
    errors.push('請選擇食糊牌');
    return;
  }
  const all = [...input.concealed, input.winningTile];
  for (const t of all) if (!isValidTile(t)) errors.push(`非法牌：${t}`);
  if (input.melds.length > 5) errors.push('明章最多五組');
  for (const m of input.melds) {
    if (!isValidTile(m.tile)) {
      errors.push(`非法牌：${m.tile}`);
      continue;
    }
    const i = tileIndex(m.tile);
    if (m.kind === 'chow' && (isHonor(i) || numOf(i) > 7)) {
      errors.push(`上牌必須是同色三張相連的數牌（${tileName(m.tile)}）`);
    }
  }
  if (errors.length) return;
  const counts = toCounts([...all, ...input.melds.flatMap(meldTiles)]);
  counts.forEach((n, i) => {
    if (n > 4) errors.push(`「${tileName(indexTile(i))}」超過四張（${n} 張）`);
  });
  const expected = 17 - 3 * input.melds.length;
  if (all.length !== expected) {
    errors.push(`張數不符：暗手連食糊牌應有 ${expected} 張，現有 ${all.length} 張`);
  }
}

function checkFlags(ctx: Ctx, errors: string[]) {
  const { input, selfDraw, menqing } = ctx;
  const f = input.flags;
  const ting = f.ting || !!f.tingKind;
  const dealer = input.seatWind === 'E';
  if (f.immediate && !ting) errors.push('即食必須先叮牌');
  if ((f.tingKind === 'tian' || f.tingKind === 'di') && !menqing) errors.push('天叮、地叮必須門清');
  if (f.winKind) {
    const label = { tian: '天糊', di: '地糊', ren: '人糊' }[f.winKind];
    if (input.melds.length > 0) errors.push(`${label}必須門清，不能有明章或槓`);
    if (f.winKind === 'tian' && !(dealer && selfDraw)) errors.push('天糊只限莊家起手自摸');
    if (f.winKind === 'di' && (dealer || input.winType !== 'discard' || input.discarder !== 'E')) {
      errors.push('地糊只限閒家食東家首張打出的牌');
    }
  }
  if (!selfDraw && (f.flowerDraw || f.kongDraw || f.tailDraws)) errors.push('花上自摸、槓上自摸、尾牌連摸只限自摸');
  if (f.kongDraw && !input.melds.some(isKong)) errors.push('槓上自摸必須有槓');
  if (f.tailDraws !== undefined && f.tailDraws !== 0 && f.tailDraws < 2) errors.push('尾牌連摸至少要連續補兩張尾牌');
  if (f.multiWin && f.multiWin > 1 && selfDraw) errors.push('雙響、三響只限食出銃');
}

// ---------------------------------------------------------------- 各食糊形

function meldGroups(input: WinInput): Group[] {
  return input.melds.map((m) => ({
    kind: m.kind === 'chow' ? 'chow' : m.kind === 'pung' ? 'pung' : 'kong',
    tile: tileIndex(m.tile),
    concealed: m.kind === 'concealedKong',
    meld: m.kind,
    winning: false,
  }));
}

/** 把食糊牌放進某一組暗手牌組：食出銃完成的牌組算明 */
function placeWin(ctx: Ctx, raw: RawGroup[], at: number): Group[] {
  return raw.map((g, i) => ({
    kind: g.kind,
    tile: g.tile,
    concealed: i === at ? ctx.selfDraw : true,
    winning: i === at,
  }));
}

function containsTile(g: RawGroup, t: number): boolean {
  return g.kind === 'chow' ? t >= g.tile && t <= g.tile + 2 : g.tile === t;
}

/** 列出食糊牌可放進的各組（相同牌組只取一次） */
function winPlacements(raw: RawGroup[], win: number): number[] {
  const seen = new Set<string>();
  const out: number[] = [];
  raw.forEach((g, i) => {
    const key = `${g.kind}${g.tile}`;
    if (containsTile(g, win) && !seen.has(key)) {
      seen.add(key);
      out.push(i);
    }
  });
  return out;
}

function evaluateBasic(ctx: Ctx, counts: number[]): Evaluated | undefined {
  let best: Evaluated | undefined;
  for (const raw of basicDecompositions(counts, 5 - ctx.input.melds.length)) {
    for (const at of winPlacements(raw, ctx.win)) {
      const groups = [...meldGroups(ctx.input), ...placeWin(ctx, raw, at)];
      const fans = applyExcludes([...basicFans(ctx, groups), ...situational(ctx)]);
      if (!best || sum(fans) > sum(best.fans)) best = { form: '基本形', groups, fans };
    }
  }
  return best;
}

function evaluateLigu(ctx: Ctx, counts: number[]): Evaluated {
  const raw = liguGroups(counts);
  // 食糊牌所在的對子（如食糊牌成三張，則為那一對）
  const at = raw.findIndex((g) => g.tile === ctx.win);
  const groups = placeWin(ctx, raw, at);
  const fans = applyExcludes([...liguFans(ctx, counts, groups), ...situational(ctx)]);
  return { form: '嚦咕嚦咕', groups, fans };
}

function combineLigu(basic: Evaluated, ligu: Evaluated): Evaluated {
  return {
    form: '嚦咕兩食',
    groups: basic.groups,
    fans: [...basic.fans, ...ligu.fans.filter((f) => LIGU_DOUBLE.has(f.name))],
  };
}

function evaluateThirteen(ctx: Ctx, counts: number[]): Evaluated[] {
  const { melds } = ctx.input;
  if (!melds.every((m) => m.kind === 'concealedKong' || m.kind === 'kong')) return [];
  return thirteenOrphansArrangements(counts, melds.length).map((raw) => {
    const at = raw.findIndex((g) => containsTile(g, ctx.win));
    const groups = [...meldGroups(ctx.input), ...placeWin(ctx, raw, at)];
    const fans: FanItem[] = [item('十三么')];
    if (ctx.waits.length >= 13) fans.push(item('十三扉'));
    fans.push(...honorPungFans(ctx, groups), ...kongFans(groups), ...terminalFans(groups));
    return { form: '十三么' as const, groups, fans: applyExcludes([...fans, ...situational(ctx)]) };
  });
}

function evaluateSixteen(ctx: Ctx, counts: number[]): Evaluated {
  const groups = placeWin(ctx, liguGroups(counts), -1).map((g) => ({ ...g, winning: g.tile === ctx.win }));
  const fans: FanItem[] = [item('十六不搭')];
  if (ctx.waits.length >= 16) fans.push(item('十六扉不搭'));
  const [m, p, s] = sixteenSuitNumbers(counts).map((ns) => ns.join(''));
  if (m === p && p === s) fans.push(item('不搭三相'));
  if ([m, p, s].sort().join() === '147,258,369') fans.push(item('不搭雜龍'));
  return { form: '十六不搭', groups, fans: applyExcludes([...fans, ...situational(ctx)]) };
}

// ---------------------------------------------------------------- 番種

function item(name: FanName, times = 1): FanItem {
  return { name, fan: FAN[name] * times };
}

function sum(fans: FanItem[]): number {
  return fans.reduce((a, f) => a + f.fan, 0);
}

function tilesOf(g: Group): number[] {
  switch (g.kind) {
    case 'chow':
      return [g.tile, g.tile + 1, g.tile + 2];
    case 'pung':
      return [g.tile, g.tile, g.tile];
    case 'kong':
      return [g.tile, g.tile, g.tile, g.tile];
    case 'pair':
      return [g.tile, g.tile];
    case 'single':
      return [g.tile];
  }
}

const isPungLike = (g: Group) => g.kind === 'pung' || g.kind === 'kong';
const isSet = (g: Group) => g.kind === 'chow' || isPungLike(g);

function basicFans(ctx: Ctx, groups: Group[]): FanItem[] {
  const { input } = ctx;
  const fans: FanItem[] = [];
  const sets = groups.filter(isSet);
  const pair = groups.find((g) => g.kind === 'pair')!;
  const winGroup = groups.find((g) => g.winning)!;

  // 門清／求人
  if (ctx.menqing) fans.push(item('門清'));
  if (input.melds.length === 5 && input.melds.every((m) => m.kind === 'chow' || m.kind === 'pung')) {
    fans.push(item(ctx.selfDraw ? '半求人' : '全求人'));
  }

  // 叫糊方式
  const role = winRole(winGroup, ctx.win);
  if (role === '對碰') fans.push(item('對碰'));
  if (ctx.waits.length > 1 && (role === '單釣' || role === '卡窿' || role === '偏張')) fans.push(item('假獨'));
  if (!isHonor(pair.tile) && [2, 5, 8].includes(numOf(pair.tile))) fans.push(item('將眼'));

  // 順子
  if (sets.every((g) => g.kind === 'chow')) {
    const noHonor = !groups.some((g) => isHonor(g.tile));
    fans.push(item(noHonor && input.flowers.length === 0 ? '大平糊' : '平糊'));
  }
  fans.push(...bestPatterns(groups));

  // 刻槓
  const pungs = sets.filter(isPungLike);
  if (pungs.length === 5) fans.push(item('對對糊'));
  const hidden = pungs.filter((g) => g.concealed).length;
  if (hidden >= 2) fans.push(item((['二暗刻', '三暗刻', '四暗刻', '五暗刻'] as const)[hidden - 2]));
  if (hidden === 5 && pungs.every((g) => g.kind === 'pung')) fans.push(item('坎坎糊'));
  fans.push(...kongFans(groups));

  fans.push(...honorPungFans(ctx, groups));
  fans.push(...fourFoldFans(groups));
  fans.push(...terminalFans(groups), ...suitFans(groups), ...doorFans(ctx, groups));
  return fans;
}

function winRole(g: Group, win: number): '單釣' | '對碰' | '卡窿' | '偏張' | '兩頭' {
  if (g.kind === 'pair') return '單釣';
  if (g.kind !== 'chow') return '對碰';
  if (win === g.tile + 1) return '卡窿';
  if ((win === g.tile + 2 && numOf(g.tile) === 1) || (win === g.tile && numOf(g.tile) === 7)) return '偏張';
  return '兩頭';
}

function kongFans(groups: Group[]): FanItem[] {
  const kongs = groups.filter((g) => g.kind === 'kong').length;
  return kongs ? [item('槓', kongs)] : [];
}

/** 字牌、正字及三元／風的番種 */
function honorPungFans(ctx: Ctx, groups: Group[]): FanItem[] {
  const fans: FanItem[] = [];
  const honorPungs = groups.filter((g) => isPungLike(g) && isHonor(g.tile)).map((g) => g.tile);
  const pair = groups.find((g) => g.kind === 'pair');
  const dragons = honorPungs.filter(isDragon).length;
  const winds = honorPungs.filter(isWind).length;
  const dragonPair = !!pair && isDragon(pair.tile);
  const windPair = !!pair && isWind(pair.tile);

  const dragonHand = dragons === 3 ? '大三元' : dragons === 2 && dragonPair ? '小三元' : undefined;
  let windHand: FanName | undefined;
  if (winds === 4) windHand = '大四喜';
  else if (winds === 3 && windPair) windHand = '小四喜';
  else if (winds === 3) windHand = '大三風';
  else if (winds === 2 && windPair) windHand = '小三風';
  if (dragonHand) fans.push(item(dragonHand));
  if (windHand) fans.push(item(windHand));

  const seat = windIndex(ctx.input.seatWind);
  const round = windIndex(ctx.input.roundWind);
  let ziPai = 0;
  let zhengZi = 0;
  for (const t of honorPungs) {
    if (isDragon(t)) {
      if (dragonHand) continue;
      ziPai++;
      zhengZi++;
    } else {
      if (windHand === '大四喜') continue;
      // 三風／小四喜：錯位風不算番，正位風算番
      if (!windHand) ziPai++;
      if (t === seat) zhengZi++;
      if (t === round) zhengZi++;
    }
  }
  if (ziPai) fans.push(item('字牌', ziPai));
  if (zhengZi) fans.push(item('正字', zhengZi));
  return fans;
}

/** 四歸：四張相同的牌（非槓）分歸於多個組合 */
function fourFoldFans(groups: Group[]): FanItem[] {
  const fans: FanItem[] = [];
  const names = { 2: '四歸二', 3: '四歸三', 4: '四歸四' } as const;
  for (let t = 0; t < 34; t++) {
    const holders = groups.filter((g) => g.kind !== 'kong' && tilesOf(g).includes(t));
    const n = holders.reduce((a, g) => a + tilesOf(g).filter((x) => x === t).length, 0);
    if (n !== 4 || holders.length < 2) continue;
    const prefix = holders.every((g) => g.concealed) ? '暗' : '明';
    fans.push(item(`${prefix}${names[holders.length as 2 | 3 | 4]}` as FanName));
  }
  if (fans.length >= 3) fans.push(item('十二歸'));
  else if (fans.length === 2) fans.push(item('八歸'));
  return fans;
}

/** 數字類：斷么、帶么、么九、缺五、滿庭芳 */
function terminalFans(groups: Group[]): FanItem[] {
  const fans: FanItem[] = [];
  const tiles = groups.flatMap(tilesOf);
  const hasHonor = tiles.some(isHonor);
  if (!tiles.some(isTerminalOrHonor)) fans.push(item('斷么'));
  if (groups.every((g) => tilesOf(g).some(isTerminalOrHonor))) {
    fans.push(item(hasHonor ? '混帶么' : '全帶么'));
  }
  if (tiles.every(isTerminalOrHonor) && hasHonor && !tiles.every(isHonor)) fans.push(item('混么'));
  if (tiles.every(isTerminal)) fans.push(item('清么'));
  if (!hasHonor && !tiles.some((t) => numOf(t) === 5)) fans.push(item('缺五'));
  if (!hasHonor) fans.push(item('無字'));
  for (let x = 2; x <= 8; x++) {
    const ok = groups.every((g) => tilesOf(g).some((t) => isHonor(t) || numOf(t) === x));
    if (ok && groups.some((g) => !isHonor(g.tile))) {
      fans.push(item(hasHonor ? '混滿庭芳' : '純滿庭芳'));
      break;
    }
  }
  return fans;
}

/** 花色類：清一色、混一色、缺一門、字一色 */
function suitFans(groups: Group[]): FanItem[] {
  const tiles = groups.flatMap(tilesOf);
  const suits = new Set(tiles.filter((t) => !isHonor(t)).map(suitOf));
  const hasHonor = tiles.some(isHonor);
  if (suits.size === 0) return [item('字一色')];
  if (suits.size === 1) return [item(hasHonor ? '混一色' : '清一色')];
  if (suits.size === 2 && !hasHonor) return [item('缺一門')];
  return [];
}

/** 五門齊／七門齊：萬、筒、索、風、三元（再加四季、花牌） */
function doorFans(ctx: Ctx, groups: Group[]): FanItem[] {
  const doorOf = (t: number) => (isHonor(t) ? (isDragon(t) ? 4 : 3) : suitOf(t));
  const hasSet = [false, false, false, false, false];
  const present = [false, false, false, false, false];
  for (const g of groups) {
    for (const t of tilesOf(g)) present[doorOf(t)] = true;
    if (isSet(g)) hasSet[doorOf(g.tile)] = true;
  }
  if (!present.every(Boolean)) return [];
  const big = hasSet.every(Boolean);
  const flowers = ctx.input.flowers.map((f) => Number(f[0]));
  const seven = flowers.some((n) => n <= 4) && flowers.some((n) => n >= 5);
  if (seven) return [item(big ? '大七門' : '小七門')];
  return [item(big ? '大五門' : '小五門')];
}

function liguFans(ctx: Ctx, counts: number[], groups: Group[]): FanItem[] {
  const fans: FanItem[] = [item('嚦咕嚦咕')];
  // 八對嚦咕：食糊前已有八對，食糊牌令其中一對成三張
  const pre = [...counts];
  pre[ctx.win]--;
  if (pre.every((n) => n % 2 === 0)) fans.push(item('八對嚦咕'));
  const has = (t: number) => counts[t] >= 2;
  if ([31, 32, 33].every(has)) fans.push(item('三元嚦咕'));
  if ([27, 28, 29, 30].every(has)) fans.push(item('四喜嚦咕'));
  for (let n = 0; n < 9; n++) if ([0, 1, 2].every((s) => has(s * 9 + n))) fans.push(item('三色同對'));
  const runNames = ['', '', '', '三連對', '四連對', '五連對', '六連對', '七連對', '八連對'] as const;
  for (let s = 0; s < 3; s++) {
    let run = 0;
    for (let n = 0; n <= 9; n++) {
      if (n < 9 && has(s * 9 + n)) {
        run++;
        continue;
      }
      if (run >= 3) fans.push(item(runNames[Math.min(run, 8)] as FanName));
      run = 0;
    }
  }
  // 四張相同作兩對：四歸二
  counts.forEach((n, t) => {
    if (n === 4) fans.push(item(t === ctx.win && !ctx.selfDraw ? '明四歸二' : '暗四歸二'));
  });
  fans.push(...terminalFans(groups), ...suitFans(groups), ...doorFans(ctx, groups));
  return fans;
}

/** 與牌型無關的番種：花、自摸、門清狀態、叮、時態類、叫糊數 */
function situational(ctx: Ctx): FanItem[] {
  const { input, selfDraw, menqing } = ctx;
  const f = input.flags;
  const fans: FanItem[] = [...flowerFans(input)];
  const allTiles = [...input.concealed, input.winningTile!, ...input.melds.flatMap(meldTiles)].map(tileIndex);
  if (!allTiles.some(isHonor) && input.flowers.length === 0) fans.push(item('無字花'));

  if (selfDraw) fans.push(item('自摸'));
  if (selfDraw && menqing) fans.push(item('門摸'));
  const ting = f.ting || !!f.tingKind;
  if (ting) fans.push(item(menqing ? '門叮' : '叮'));
  if (f.immediate) fans.push(item('即食'));
  if (f.tingKind) fans.push(item(({ tian: '天叮', di: '地叮', ren: '人叮' } as const)[f.tingKind]));
  if (f.winKind) fans.push(item(({ tian: '天糊', di: '地糊', ren: '人糊' } as const)[f.winKind]));
  if (f.tilesLeft) fans.push(item(({ 10: '十隻內', 7: '七隻內', 4: '四隻內' } as const)[f.tilesLeft]));
  if (f.multiWin === 2) fans.push(item('雙響'));
  if (f.multiWin === 3) fans.push(item('三響'));
  if (f.lastTile) fans.push(item('海底撈月'));
  if (f.flowerDraw) fans.push(item('花上自摸'));
  if (f.kongDraw) fans.push(item('槓上自摸'));
  if (f.tailDraws && f.tailDraws >= 2) fans.push({ name: '尾牌連摸', fan: FAN.尾牌連摸 * 2 ** (f.tailDraws - 1) });
  if (input.winType === 'robKong') fans.push(item('搶槓'));
  if (ctx.waits.length === 1) fans.push(item('獨獨'));
  return fans;
}

function flowerFans(input: WinInput): FanItem[] {
  const fl = input.flowers;
  if (fl.length === 0) return [item('無花')];
  if (fl.length === 8) return [item('八仙過海')];
  const fans: FanItem[] = [];
  let rest = fl;
  for (const set of [['1f', '2f', '3f', '4f'], ['5f', '6f', '7f', '8f']]) {
    if (set.every((x) => fl.includes(x))) {
      fans.push(item('一台花'));
      rest = rest.filter((x) => !set.includes(x));
    }
  }
  if (rest.length) fans.push(item('花牌', rest.length));
  const seatFlowers = rest.filter((x) => isSeatFlower(x, input.seatWind)).length;
  if (seatFlowers) fans.push(item('正花', seatFlowers));
  return fans;
}

/** 不複合原則：去掉被較高番種包含的番種 */
function applyExcludes(fans: FanItem[]): FanItem[] {
  // 由高番至低番處理：本身被不計的番種，不再令其他番種不計
  const removed = new Set<string>();
  for (const f of [...fans].sort((a, b) => b.fan - a.fan)) {
    if (removed.has(f.name)) continue;
    for (const x of HAND_EXCLUDES[f.name as FanName] ?? []) removed.add(x);
  }
  return fans.filter((f) => !removed.has(f.name));
}

/** 大雞／大鴨：除莊家及拉莊外，只有花牌的一番（大鴨為自摸） */
function addChicken(fans: FanItem[], selfDraw: boolean) {
  const names = fans.map((f) => f.name).sort().join();
  const flowerOnly = fans.find((f) => f.name === '花牌')?.fan === 1;
  if (!flowerOnly) return;
  if (names === '花牌') fans.push(item('大雞'));
  else if (selfDraw && names === ['自摸', '花牌'].sort().join()) fans.push(item('大鴨'));
}

// ---------------------------------------------------------------- 花糊

function flowerWin(input: WinInput, errors: string[]): FanItem[] {
  const n = input.flowers.length;
  if (input.flowerWin === 'sevenRobOne') {
    if (n !== 7) errors.push(`七搶一要有七隻花（現有 ${n} 隻）`);
    return [item('七搶一')];
  }
  if (input.flowerWin === 'eightFlowers') {
    if (n !== 8) errors.push(`八仙過海要有八隻花（現有 ${n} 隻）`);
    return [item('八仙過海')];
  }
  errors.push('請選擇花糊方式');
  return [];
}

// ---------------------------------------------------------------- 計分

function finish(result: ScoreResult, input: WinInput, fans: FanItem[]): ScoreResult {
  if (result.errors.length) return result;
  result.valid = true;
  result.fans = fans;
  result.handFan = sum(fans);

  const winner = input.seatWind;
  const order = [1, 2, 3].map((k) => WINDS[(WINDS.indexOf(winner) + k) % 4]);
  const selfPay = input.winType === 'selfDraw' || (input.winType === 'flower' && input.flowerWin === 'eightFlowers');
  const payers: Wind[] = selfPay ? order : [input.discarder!];

  const dealerFans: FanItem[] = [{ name: '莊家', fan: FAN.莊家 }];
  if (input.dealerStreak > 0) dealerFans.push({ name: '拉莊', fan: FAN.拉莊 * input.dealerStreak });
  const dealerTotal = sum(dealerFans);
  const involvesDealer = (payer: Wind) => winner === 'E' || payer === 'E';
  if (payers.some(involvesDealer)) result.dealerFans = dealerFans;

  const { base, perFan } = input.settings;
  result.payments = payers.map((seat): Payment => {
    const fan = result.handFan + (involvesDealer(seat) ? dealerTotal : 0);
    return { seat, fan, amount: base + fan * perFan };
  });
  result.totalAmount = result.payments.reduce((a, p) => a + p.amount, 0);
  if (result.concealedKongs > 0) {
    result.notes.push(`中途獎勵：${result.concealedKongs} 次暗槓，每次收每家一底（另計，不受拉踢影響）`);
  }
  return result;
}

function toView(g: Group): GroupView {
  const tiles = tilesOf(g).map(indexTile);
  const label = g.meld ? MELD_LABEL[g.meld] : RAW_LABEL[g.kind];
  return { kind: g.kind, tiles: sortTiles(tiles), concealed: g.concealed, winning: g.winning, label };
}
