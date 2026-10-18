/** 風位 / 圈風：東南西北 */
export type Wind = 'E' | 'S' | 'W' | 'N';

/**
 * 明章牌組。
 * chow 上（tile 為最細的一張）、pung 碰、kong 大明槓、addedKong 加槓、concealedKong 暗槓
 */
export type MeldKind = 'chow' | 'pung' | 'kong' | 'addedKong' | 'concealedKong';

export interface Meld {
  kind: MeldKind;
  tile: string;
}

/** selfDraw 自摸、discard 食出銃、robKong 搶槓、flower 花糊 */
export type WinType = 'selfDraw' | 'discard' | 'robKong' | 'flower';

/** 花糊方式：七搶一（食出）或 八仙過海／兩台花（自摸） */
export type FlowerWin = 'sevenRobOne' | 'eightFlowers';

export interface Flags {
  /** 叮牌 */
  ting?: boolean;
  /** 即食 */
  immediate?: boolean;
  /** 天叮 / 地叮 / 人叮 */
  tingKind?: 'tian' | 'di' | 'ren';
  /** 天糊 / 地糊 / 人糊 */
  winKind?: 'tian' | 'di' | 'ren';
  /** 海底撈月 */
  lastTile?: boolean;
  /** 花上自摸 */
  flowerDraw?: boolean;
  /** 槓上自摸 */
  kongDraw?: boolean;
  /** 尾牌連摸：連續補了 n 張尾牌後自摸（n ≥ 2） */
  tailDraws?: number;
  /** 一炮多響：2 雙響、3 三響 */
  multiWin?: 1 | 2 | 3;
  /** 地下剩餘牌數：十隻內 / 七隻內 / 四隻內 */
  tilesLeft?: 10 | 7 | 4;
}

export interface Settings {
  /** 每底金額（每位付款者另付一底） */
  base: number;
  /** 每番金額 */
  perFan: number;
}

export interface WinInput {
  /** 暗手（不包括食糊牌） */
  concealed: string[];
  /** 食糊牌（花糊時可省略） */
  winningTile?: string;
  melds: Meld[];
  flowers: string[];
  winType: WinType;
  /** 出銃者 / 被搶槓者 / 七搶一時持一張花的一家 */
  discarder?: Wind;
  flowerWin?: FlowerWin;
  roundWind: Wind;
  /** 食糊者風位（東家即莊家） */
  seatWind: Wind;
  /** 連莊數（拉莊 N） */
  dealerStreak: number;
  flags: Flags;
  settings: Settings;
}

export interface FanItem {
  name: string;
  fan: number;
}

export type GroupKind = 'chow' | 'pung' | 'kong' | 'pair' | 'single';

export interface GroupView {
  kind: GroupKind;
  tiles: string[];
  /** 明（上/碰/槓/食出銃完成）或 暗 */
  concealed: boolean;
  /** 包含食糊牌 */
  winning: boolean;
  /** 來源標籤，例如「上」「碰」「暗槓」 */
  label: string;
}

export interface Payment {
  seat: Wind;
  fan: number;
  amount: number;
}

export interface ScoreResult {
  valid: boolean;
  errors: string[];
  notes: string[];
  form?: string;
  groups: GroupView[];
  /** 牌型番種（不包括莊家／拉莊） */
  fans: FanItem[];
  handFan: number;
  /** 莊家 + 拉莊番數（只在食糊者或付款者為莊家時加計） */
  dealerFans: FanItem[];
  waits: string[];
  payments: Payment[];
  totalAmount: number;
  /** 暗槓數（中途獎勵：每次暗槓收每家一底） */
  concealedKongs: number;
}
