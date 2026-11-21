// Types for /data/rt_engine/risk_val.json, written by the engine's exporter
// (rt_curve_engine/export_timeline.cpp). Every number the two tabs render
// comes out of this file; the page formats and never computes.

export interface RvMeta {
  epoch: number; frame: number; trades: number; cashflows: number;
  terms: number; pairs: number; threads: number;
  collapseBuildUs: number; evalCompileUs: number;
  baseNpv: number; tradeLevelNpv: number; tradeLevelNpvUs: number;
  // The government bond desk in the closing book, once the export carries it:
  // positions held in BondBook as book GOVT_RV, hedge swaps in the swap lanes.
  bondPositions?: number; bondHedges?: number; bondValue?: number;
}

export interface LimitRow { key: string; dv01: number; util: number; breach: boolean }
export interface LimitFrame {
  label: string; epoch: number; published: boolean;
  // Limits key off the market PV01 ladders only. A set where that run was
  // skipped is not evaluated and carries no rows.
  evaluated: boolean;
  rows: LimitRow[];
}
export interface RvLimits {
  config: { key: string; limit: number }[];
  frames: LimitFrame[];
}

export interface VarRegime {
  name: string; start: string; end: string;
  startIdx: number; endIdx: number; volMult: number; tailDf: number;
}
export interface VarPairRow {
  horizon: string; var99: number; es99: number; svar99: number; ses99: number;
}
// One leg of the VaR split, loss positive. The stressed figures of a leg are
// taken on the total's stressed window.
export interface VarSet {
  var99: number; var95: number; es99: number; es95: number;
  svar99: number; ses99: number;
}
export interface BondScenarios {
  generated: boolean; positions: number; curve: string;
  curveMove: string; spreadSource: string;
  bondsWithHistory: number; historyDays: number; recycled: boolean; frozen: number;
}
export interface RvVar {
  scenarios: number; seed: number; window: number;
  from: string; to: string; pillars: number[];
  regimes: VarRegime[];
  rows: VarPairRow[];
  var95: number; var99: number; es95: number; es99: number;
  svarRatio: number;
  trailing: { from: string; to: string; startIdx: number };
  stressed: {
    startIdx: number; endIdx: number; start: string; end: string;
    var99: number; es99: number;
  };
  backtest: {
    tested: number; exceptions: number;
    last250Tested: number; last250Exceptions: number; zone: string;
    from: string;
  };
  yearTicks: { idx: number; label: string }[];
  hist: { lo: number; width: number; counts: number[] };
  pnl: number[];
  timing: {
    collapsedUs: number; perScenarioUs: number;
    tradeLevelPerScenarioUs: number; equivalentTradeLevelMs: number;
  };
  recon: {
    day: number; date: string; collapsed: number; tradeLevel: number;
    absDiff: number;
  }[];
  worstScenAbsDiff: number;
  // With bonds in the book: pnl is the combined series, pnlBonds the bond
  // part on the same days, and split the swap and bond legs.
  pnlBonds?: number[];
  split?: { swaps: VarSet; bonds: VarSet; diversification99: number };
  bondScenarios?: BondScenarios;
  bondRecon?: { day: number; date: string; evaluator: number; viewRoute: number; absDiff: number }[];
}

export interface StressRow {
  name: string; note: string; total: number;
  // GOVT_RV carries its split: bond positions revalued in full, and the
  // hedge swaps from the swap lane. pnl = bonds + hedges.
  byBook: { book: string; pnl: number; bonds?: number; hedges?: number }[];
}

export interface ConsensusRow {
  curve: string; q: string; years: number;
  markBp: number; midBp: number; sdBp: number; halfBoBp: number; u90Bp: number;
  contrib: number; diffBp: number; ratio: number; status: number;
}
export interface RvConsensus {
  seed: number; rows: ConsensusRow[];
  summary: { quotes: number; within: number; warn: number; breach: number };
}

export interface IpvLane {
  name: string; kind: 'lane' | 'construction';
  a: number; b: number; diff: number; tol?: number; pass?: boolean;
}

export interface RvCloseout {
  // The EUR_GOVT row, when present, is in price terms (unit 'price').
  byCurve: { curve: string; closeOut: number; mpu: number; quotes: number; unit?: string }[];
  total: number; mpuTotal: number;
  quotesCovered: number; quotesMissing: number;
}

export interface AvaRow {
  category: string; article: string; status: string;
  raw?: number; ava?: number; note: string;
  bonds?: { raw: number; ava: number };
}
export interface RvAva { rows: AvaRow[]; total: number; weights: string }

export interface InventoryCheck {
  name: string; unit: string; ran: boolean;
  value?: number; pass?: boolean; note?: string;
}
export interface InventoryRow {
  id: string; currency: string; construction: string; interpolation: string;
  parents: string[]; coupledWith?: string; derived: boolean;
  checks: InventoryCheck[];
}

export interface RiskVal {
  meta: RvMeta;
  limits: RvLimits;
  var: RvVar;
  stressScenarios: StressRow[];
  consensus: RvConsensus;
  ipvLanes: IpvLane[];
  closeout: RvCloseout;
  ava: RvAva;
  inventory: InventoryRow[];
}

// ---- shared formatting and tokens, matching the Workstation idiom ----------

export const LABEL: Record<string, string> = {
  EUR_ESTR: 'ESTR', EUR_ESTR_ECB: 'ESTR meeting', EUR_ESTR_IMM: 'ESTR IMM',
  EUR_ESTR_IMMFUT: 'ESTR IMM fut', EUR_EURIBOR6M: 'EURIBOR 6M',
  USD_SOFR: 'SOFR', GBP_SONIA: 'SONIA', EUR_USD_XCCY: 'EUR/USD xccy',
  USD_CSA_CTD: 'USD CSA CTD', EUR_GOVT: 'Govt bonds',
  GOVT_CS01: 'Govt CS01', BOND_NET: 'Bond net', TOTAL: 'Desk total',
};

// The limit lines that belong to the bond desk. EUR_GOVT counts in the desk
// total because it is rate risk, the other two do not.
export const BOND_KEYS = ['EUR_GOVT', 'GOVT_CS01', 'BOND_NET'];

export const COLOUR: Record<string, string> = {
  EUR_ESTR: '#d4a853', EUR_ESTR_ECB: '#e07850', EUR_ESTR_IMM: '#5cb87a',
  EUR_ESTR_IMMFUT: '#b8b04a', EUR_EURIBOR6M: '#8b7ec8', EUR_USD_XCCY: '#4a9a68',
  USD_SOFR: '#9a8bd8', GBP_SONIA: '#c86e6e',
  USD_CSA_CTD: '#e8963c', EUR_GOVT: '#5eaab5',
};

export const chip = (on: boolean, colour: string) => ({
  border: `1px solid ${on ? colour : 'var(--border-subtle)'}`,
  color: on ? colour : 'var(--text-dim)',
  background: on ? colour + '18' : 'transparent',
});

export const money = (v: number) =>
  (v < 0 ? '-' : '') + Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 });

export const millions = (v: number) =>
  (v < 0 ? '-' : '') + (Math.abs(v) / 1e6).toFixed(2) + 'm';

export const signedM = (v: number) => (v > 0 ? '+' : '') + millions(v);

export const ms = (us: number) =>
  us >= 1e6 ? (us / 1e6).toFixed(2) + ' s'
    : us >= 1e3 ? Math.round(us / 1e3) + ' ms'
      : Math.round(us) + ' µs';

export const pct = (v: number) => (v * 100).toFixed(1) + '%';

export const moveColour = (v: number, floor = 1) =>
  Math.abs(v) < floor ? 'var(--text-dim)' : v > 0 ? 'var(--accent-green)' : '#c86e6e';

// Panel scaffolding used by both tabs: a short heading and a one-or-two
// sentence intro, in the site's own type scale.
export const panelHead = { color: 'var(--text-primary)' } as const;
export const dimText = { color: 'var(--text-dim)' } as const;
