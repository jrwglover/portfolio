// Types for /data/rt_engine/risk_val.json, written by the engine's exporter
// (rt_curve_engine/export_timeline.cpp). Every number the two tabs render
// comes out of this file; the page formats and never computes.

export interface RvMeta {
  epoch: number; frame: number; trades: number; cashflows: number;
  terms: number; pairs: number; threads: number;
  collapseBuildUs: number; evalCompileUs: number;
  baseNpv: number; tradeLevelNpv: number; tradeLevelNpvUs: number;
}

export interface LimitRow { key: string; dv01: number; util: number; breach: boolean }
export interface LimitFrame {
  label: string; epoch: number; published: boolean; rows: LimitRow[];
}
export interface RvLimits {
  config: { key: string; limit: number }[];
  frames: LimitFrame[];
}

export interface RvVar {
  scenarios: number; seed: number; pillars: number[];
  stress: { start: number; end: number; volMult: number };
  var95: number; var99: number; es95: number; es99: number;
  var99TenDay: number;
  stressed: { start: number; end: number; var99: number; es99: number; var99TenDay: number };
  backtest: {
    tested: number; exceptions: number;
    last250Tested: number; last250Exceptions: number; zone: string;
  };
  hist: { lo: number; width: number; counts: number[] };
  pnl: number[];
  timing: {
    collapsedUs: number; perScenarioUs: number;
    tradeLevelPerScenarioUs: number; equivalentTradeLevelMs: number;
  };
  recon: { day: number; collapsed: number; tradeLevel: number; absDiff: number }[];
  worstScenAbsDiff: number;
}

export interface StressRow {
  name: string; note: string; total: number;
  byBook: { book: string; pnl: number }[];
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
  byCurve: { curve: string; closeOut: number; mpu: number; quotes: number }[];
  total: number; mpuTotal: number;
  quotesCovered: number; quotesMissing: number;
}

export interface AvaRow {
  category: string; article: string; status: string;
  raw?: number; ava?: number; note: string;
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
  AUD_AONIA: 'AONIA', AUD_AONIA_RBA: 'AONIA meeting', AUD_BBSW3M: 'BBSW 3M',
  AUD_BBSW6M: 'BBSW 6M', AUD_USD_XCCY: 'AUD/USD xccy',
  USD_CSA_CTD: 'USD CSA CTD', TOTAL: 'Desk total',
};

export const COLOUR: Record<string, string> = {
  EUR_ESTR: '#d4a853', EUR_ESTR_ECB: '#e07850', EUR_ESTR_IMM: '#5cb87a',
  EUR_ESTR_IMMFUT: '#b8b04a', EUR_EURIBOR6M: '#8b7ec8', EUR_USD_XCCY: '#4a9a68',
  USD_SOFR: '#9a8bd8', GBP_SONIA: '#c86e6e',
  AUD_AONIA: '#63c4f0', AUD_AONIA_RBA: '#3b87d4', AUD_BBSW3M: '#e896cc',
  AUD_BBSW6M: '#b34a85', AUD_USD_XCCY: '#3fc4a5', USD_CSA_CTD: '#e8963c',
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
