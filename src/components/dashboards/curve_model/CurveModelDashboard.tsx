import { useEffect, useState, useMemo } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import DashboardHeader from '../DashboardHeader';
import type { Domain } from '../../../config/projects';
import ArchitecturePanel from './ArchitecturePanel';

/* ── Types ── */
// Stamped at build time by vite.config so a redeploy cannot be served
// from a stale edge cache. See public/_headers.
declare const __BUILD_ID__: string;
const BUILD_ID = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';

type Pt = [number, number, number]; // [t, fwd%, zero%]
interface Quote { tenor: string; rate?: number; price?: number; instrument: string }
interface MarketCurve {
  curve: string; currency: string; index: string; type: string;
  day_counter: string; settlement_days: number;
  fx_spot?: number; futures_convexity_sigma?: number;
  meeting_dates?: string[]; quotes: Quote[];
  derived?: boolean; derivation?: string;
}
interface Inputs { curves: MarketCurve[] }

type Tab = 'inputs' | 'curves' | 'sensis' | 'perf' | 'arch';
const TABS: { key: Tab; label: string }[] = [
  { key: 'inputs', label: 'Market Data Model' },
  { key: 'curves', label: 'Bootstrapped Curves' },
  { key: 'sensis', label: 'Trade Risk & Cashflows' },
  { key: 'perf', label: 'CPU vs GPU' },
  { key: 'arch', label: 'Architecture' },
];

interface LadderRow { tenor: string; instrument: string; rate: number; cpu: number; gpu: number | null }
interface CurveLadderRow { tenor: string; role: string; time: number; rate: number; cpu: number; gpu: number }
interface FxRow { instrument: string; maturity: string; bumpType: string; pillar: string; baseQuote: number; pv01: number }
interface Cashflow {
  leg: 'fixed' | 'float'; start: string; end: string; pay: string;
  tau: number; rate: number; amount: number; df: number; pv: number;
}
interface Trade {
  id: string; label: string; product: string; notional: string; detail: string; ccy: string;
  curves: { key: string; role: string }[]; engine: string;
  ladders: Record<string, LadderRow[]>; hasGpu: boolean; fx?: FxRow[];
  curveLadders?: Record<string, Record<string, CurveLadderRow[]>>;
  fairRate: number | null; npv: number | null;
  fixedLegNpv?: number | null; floatLegNpv?: number | null;
  cashflows: Cashflow[];
}
interface TradesFile { bump_bps: number; trades: Trade[] }

/* Renders "3.6e-14" as 3.6x10 with a real superscript exponent. Composing the
   exponent from unicode superscript characters instead mixes two Unicode
   blocks, Latin-1 for one/two/three and the superscripts block for the rest,
   and most fonts draw them at different heights, so a two-digit exponent looks
   misaligned. A <sup> keeps the glyphs in one typeface. */
function Sci({ v }: { v: string }) {
  const m = /^(-?[\d.]+)e([+-]?\d+)$/.exec(v.trim());
  if (!m) return <>{v}</>;
  return <>{m[1]}&times;10<sup style={{ fontSize: '0.72em' }}>{Number(m[2])}</sup></>;
}

interface PerfLane { lane: string; ms: number; kind: 'cpu' | 'gpu' }
interface ScalePt { trades: number; repricings: number; cpu: number | null; flat: number; mt: number; nvlink: number | null; gpu: number; upload: number; kernel: number }
interface NpvPt { trades: number; cashflows: number; quantlib: number | null; flat: number; mt: number; ser: number; serMt: number; gpuSer: number; nvlink: number | null; gpu: number; kernel: number }
interface NpvScaling { points: NpvPt[]; crossoverBelow: NpvPt | null; crossoverAbove: NpvPt | null; topFlatVsQuantLib: number | null; flatVsQuantLibAtTrades: number | null; topGpuVsFlat: number; topGpuVsMt: number; mtCrossoverBelow: NpvPt | null; mtCrossoverAbove: NpvPt | null; threads: number | null; nvlinkGBs: number; topNvlinkVsMt: number | null; singleThreaded: boolean }
interface Agree { scope: string; comparison: string; value: string }
interface Scaling { buckets: number; points: ScalePt[]; crossoverBelow: ScalePt | null; crossoverAbove: ScalePt | null; mtCrossoverBelow: ScalePt | null; mtCrossoverAbove: ScalePt | null; topGpuVsFlat: number | null; topGpuVsMt: number | null; threads: number | null }
interface PerfPattern { id: string; name: string; workload: string; note: string; lanes: PerfLane[]; baseline: string }
interface BookScale { trades: number; cashflows: number; bumps: number; repricings: number;
  bootstrapMs: number; hostMs: number; gpuMs: number; gpuH2dMs: number; gpuKernelMs: number;
  gpuMB: number; threads: number; agreement: string; gpuVsHost: number; bootstrapShareHost: number }
interface MarketLanes { bumps: number; bootstrapMs: number; quantlibMs: number; hostMs: number;
  gpuMs: number; threads: number; hostVsQlNotional: string; gpuVsQlNotional: string;
  hostVsQlLadder: string; gpuVsQlLadder: string }
interface AggLadderLanes { tradeMt: number; gpuTrade: number; agg: number }
interface AggBench {
  cashflows: number; terms: number; buildMs: number; evalMs: number | null;
  gpuAggKernelMs: number | null; threads: number | null;
  bookNpv: { cpuMt: number; gpuTrade: number; agg: number; recon: string };
  ladder: { buckets: number; zero: AggLadderLanes | null; forward: AggLadderLanes | null };
  marketPv01: { bumps: number; bootstrapMs: number; cpuMt: number; gpuTrade: number; agg: number };
  worstPv01Rel: string | null;
}
interface PerfFile { patterns: PerfPattern[]; accuracy: { metric: string; value: string; note: string }[]; scaling?: Record<string, Scaling>; npvScaling?: NpvScaling; agreement?: Agree[]; bookScale?: BookScale; marketLanes?: MarketLanes; aggBench?: AggBench }

const CCY_SYM: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', AUD: 'A$' };
const fmtMs = (v: number) =>
  v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}s`
    : v >= 1 ? `${v.toFixed(v >= 100 ? 0 : 1)}ms`
      : `${v.toFixed(2)}ms`;
const fmtCcy = (v: number | null, ccy: string) =>
  v == null ? 'n/a' : `${CCY_SYM[ccy] ?? ''}${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const FX_BUMP_COLORS: Record<string, string> = {
  SPOT: '#d4a853', FXSWAP_PT: '#5eaab5', XCCY_BASIS: '#8b7ec8',
};
const FX_BUMP_LABELS: Record<string, string> = {
  SPOT: 'FX spot', FXSWAP_PT: 'FX swap point', XCCY_BASIS: 'Xccy basis',
};

const CURVE_COLORS: Record<string, string> = {
  ESTR: '#d4a853', ESTR_ECB: '#e07850', ESTR_IMM: '#5cb87a', ESTR_IMMFUT: '#b8b04a',
  EURIBOR6M: '#8b7ec8', EURUSD: '#4a9a68', SOFR: '#9a8bd8', SONIA: '#c86e6e',
  AONIA: '#63c4f0', AONIA_RBA: '#3b87d4', BBSW3M: '#e896cc', BBSW6M: '#b34a85',
  AUDUSD: '#3fc4a5',
  // Vivid amber-orange: the one mid-luminance hue band still free on this
  // chart, and it sits opposite the violet/teal/green of the CTD curve's
  // three parents (SOFR, EURUSD, AUDUSD), so the envelope stays separable
  // from the curves it rides under both protan and deutan vision.
  CSA_CTD: '#e8963c',
};
const CURVE_LABELS: Record<string, string> = {
  ESTR: 'ESTR (tenor OIS, comparison)', ESTR_ECB: 'ESTR ECB meeting-dated',
  ESTR_IMM: 'ESTR IMM-only (comparison)', ESTR_IMMFUT: 'ESTR IMM + futures (comparison)',
  EURIBOR6M: 'EURIBOR 6M (dual-curve)', EURUSD: 'EUR under USD collateral (xccy)',
  SOFR: 'SOFR FOMC meeting-dated', SONIA: 'SONIA MPC meeting-dated',
  AONIA: 'AONIA (tenor OIS, comparison)', AONIA_RBA: 'AONIA RBA meeting-dated',
  BBSW3M: 'BBSW 3M (dual-curve, 3s6s long end)', BBSW6M: 'BBSW 6M (dual-curve, 3s6s front)',
  AUDUSD: 'AUD under USD collateral (xccy)',
  CSA_CTD: 'USD CSA cheapest-to-deliver (derived)',
};
const INSTR_BADGE: Record<string, string> = {
  OIS: '#5eaab5', IMM_OIS: '#5cb87a', MTG_OIS: '#e07850', FUTURE: '#b8b04a',
  DEPOSIT: '#8b8a97', FRA: '#8b8a97', IMM_FRA: '#5cb87a', IRS: '#8b7ec8',
  FXSWAP: '#4a9a68', XCCY: '#d4a853', SPOT: '#c9a227', TBS: '#c9699e',
};

type Measure = 'market' | 'zero' | 'forward';
const MEASURES: { key: Measure; label: string; desc: string }[] = [
  {
    key: 'market', label: 'Market PV01',
    desc: 'Each quoted instrument is bumped a basis point in turn, the curve re-solved and the trade revalued. The buckets are instruments a desk deals, so hedges are written off this ladder.',
  },
  {
    key: 'zero', label: 'Zero PV01',
    desc: 'The solved zero curve is bumped at each node, with no re-bootstrap, to show where the exposure sits along the curve.',
  },
  {
    key: 'forward', label: 'Forward PV01',
    desc: 'The forward rate is bumped flat across one interval at a time, so the exposure lands on the periods the cashflows accrue over.',
  },
];

/* The ladder a given domain holds for a trade, or null where the run produced
   none. Module scope so the panel memos below do not have to carry it as a
   dependency and rebuild on every render. */
const ladderCurveSource = (t: Trade | null, m: Measure) =>
  (m === 'market' ? t?.ladders : t?.curveLadders?.[m]) ?? null;

const chartGrid = '#1a1a28';
const chartAxis = '#55546a';

/* Axis labels for three charts sitting side by side. A full thousands-separated
   number needs about 64px of gutter, which is a sixth of the panel at desktop
   width, so the ladders get read at 2.6k instead. */
const fmtAxis = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1000) return `${(v / 1000).toFixed(a >= 10000 ? 0 : 1)}k`;
  return String(+v.toFixed(a > 0 && a < 10 ? 1 : 0));
};
const tt = {
  contentStyle: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 6, fontSize: 12 },
  labelStyle: { color: '#8b8a97' },
};

/* ── Par rates implied by a bootstrapped curve ──────────────────────────────
   The exported zero rates are continuously compounded, so DF(t) = exp(-z t).
   For a single-curve (OIS) trade the same curve projects and discounts:
       S(T) = (1 - DF(T)) / Σ DF(t_i)                      annual fixed leg
   EURIBOR 6M is dual-curve, so its float leg is projected off EURIBOR and
   every cashflow discounted on the meeting-dated ESTR curve:
       S(T) = Σ DF_d(t_j)·(DF_p(t_{j-1})/DF_p(t_j) - 1) / Σ DF_d(t_i)         */
function zeroAt(pts: Pt[], t: number): number {
  if (!pts.length) return 0;
  if (t <= pts[0][0]) return pts[0][2];
  let lo = 0, hi = pts.length - 1;
  if (t >= pts[hi][0]) return pts[hi][2];
  while (lo < hi - 1) { const m = (lo + hi) >> 1; if (pts[m][0] <= t) lo = m; else hi = m; }
  const [t0, , z0] = pts[lo], [t1, , z1] = pts[hi];
  return t1 === t0 ? z0 : z0 + (z1 - z0) * (t - t0) / (t1 - t0);
}
const dfAt = (pts: Pt[], t: number) => Math.exp(-(zeroAt(pts, t) / 100) * t);

/* Instantaneous forward, read straight off the exported column.

   Sampled linearly between exported points. Snapping each sample to the point
   on its left is the other option, and it reads worse: past 3Y the export thins
   from daily to 15-day spacing, sparser than the chart grid, so the line
   quantises into ledges that are an artifact of the export and nothing to do
   with the curve. Below 3Y the export is daily, so the two treatments differ by
   well under a pixel. */
function instAt(pts: Pt[], t: number): number {
  if (!pts.length) return 0;
  if (t <= pts[0][0]) return pts[0][1];
  let lo = 0, hi = pts.length - 1;
  if (t >= pts[hi][0]) return pts[hi][1];
  while (lo < hi - 1) { const m = (lo + hi) >> 1; if (pts[m][0] <= t) lo = m; else hi = m; }
  const [t0, f0] = pts[lo], [t1, f1] = pts[hi];
  return t1 === t0 ? f0 : f0 + (f1 - f0) * (t - t0) / (t1 - t0);
}



export interface CurveChapter { tab: string; curves?: string[]; domain?: Domain }

export default function CurveModelDashboard({ defaultTab, breadcrumb, chapter }: { defaultTab?: string; breadcrumb?: string[]; chapter?: CurveChapter }) {
  // #collapse deep-links the RT engine page to the collapse analysis: open on
  // the perf tab and scroll once its data has arrived.
  const wantCollapse = typeof window !== 'undefined' && window.location.hash === '#collapse';
  const [tab, setTab] = useState<Tab>(chapter ? chapter.tab as Tab : wantCollapse ? 'perf' : (defaultTab as Tab) ?? 'inputs');
  const [inputs, setInputs] = useState<Inputs | null>(null);
  const [curves, setCurves] = useState<Record<string, Pt[]>>({});
  const [selCurve, setSelCurve] = useState('EUR_ESTR_ECB');
  const [shown, setShown] = useState<string[]>(chapter?.curves ?? ['ESTR', 'ESTR_ECB', 'EURIBOR6M', 'EURUSD']);
  const [domain, setDomain] = useState<Domain>(chapter?.domain ?? 'inst');
  const [fwdTenor, setFwdTenor] = useState(0.25);
  const [tMax, setTMax] = useState(30);
  const [trades, setTrades] = useState<TradesFile | null>(null);
  const [selTradeId, setSelTradeId] = useState('aged-euribor');
  const [tradeCurve, setTradeCurve] = useState<string | null>(null);
  const [fxInstr, setFxInstr] = useState('5Y_FX_FWD');
  const [perf, setPerf] = useState<PerfFile | null>(null);
  // Which of the fixed-size job comparisons is on screen. They are the same
  // chart drawn over different jobs, so they sit behind a selector rather than
  // stacked, the way the scaling sweeps below do.
  const [selPattern, setSelPattern] = useState<string | null>(null);
  // Which book-size sweep is on screen. Zero and forward are the same chart
  // over different bucket definitions, so they share one frame and a selector.
  const [selScale, setSelScale] = useState<string | null>(null);
  // Which risk domain the trade ladder shows. One chart with a selector, so
  // the three domains stop reading as three near-identical panels.
  const [selMeasure, setSelMeasure] = useState<Measure | null>(null);
  const [cfLeg, setCfLeg] = useState<'all' | 'fixed' | 'float'>('all');

  useEffect(() => {
    const base = '/data/curve_model';
    // Belt and braces with public/_headers. A deploy that rebuilds these files
    // was still being served from Cloudflare's cache, so the panel showed the
    // previous run's numbers with no sign anything was stale. The bundle hash
    // changes on every build, so it doubles as a cache key for the data.
    const v = `?v=${BUILD_ID}`;
    const get = (name: string, set: (x: any) => void) =>
      fetch(`${base}/${name}${v}`, { cache: 'no-store' })
        .then(r => r.json()).then(set).catch(() => {});
    get('inputs.json', setInputs);
    get('curves.json', setCurves);
    get('trades.json', setTrades);
    get('performance.json', setPerf);
  }, []);

  useEffect(() => {
    if (wantCollapse && perf) document.getElementById('collapse')?.scrollIntoView({ behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perf]);

  const selMkt = inputs?.curves.find(c => c.curve === selCurve);
  const curveKeys = Object.keys(CURVE_LABELS).filter(k => curves[k]);

  // One chart, four domains. Discrete forwards are period rates off the same
  // discount curve, so they show what a FRA or future pays; the instantaneous
  // forward is the curve's own local rate, and is the most sensitive of the
  // four views.
  const eurusdSpot = inputs?.curves.find(c => c.index === 'EURUSD')?.fx_spot;
  const audusdSpot = inputs?.curves.find(c => c.index === 'AUDUSD')?.fx_spot;

  const curveChart = useMemo(() => {
    const keys = (domain === 'fx' ? ['EURUSD', 'AUDUSD'] : shown).filter(k => curves[k]?.length);
    if (!keys.length) return [];
    // Past its last exported point a curve clamps flat, which fabricates a
    // rising forward at the right edge, so each SERIES stops at its own last
    // pillar (a period forward at t needs data out to t + tenor). The grid
    // itself runs to the longest shown curve: the xccy and CTD curves end at
    // their 30Y pillar while the majors run to 50Y, and clamping the whole
    // chart to the shortest curve cut every line off.
    const pad = domain === 'fwd' ? fwdTenor : 0;
    const lastOf: Record<string, number> = {};
    for (const k of keys) lastOf[k] = curves[k][curves[k].length - 1][0] - pad;
    const end = Math.min(tMax, Math.max(...keys.map(k => lastOf[k])));
    const step = tMax <= 2.5 ? 1 / 52 : tMax <= 10 ? 1 / 12 : 1 / 4;
    const grid: number[] = [];
    // Detail in the instantaneous forward runs at about six weeks inside the
    // first two years, so a quarterly grid aliases it into a jagged line.
    // Sample that window weekly at every zoom and use the normal spacing
    // beyond it, so the chart reads the same whichever range is selected.
    if (domain === 'inst') {
      const fineEnd = Math.min(end, 2.5), fineStep = 1 / 104;
      for (let t = fineStep; t <= fineEnd + 1e-9; t += fineStep) grid.push(+t.toFixed(6));
      for (let t = fineEnd + step; t <= end + 1e-9; t += step) grid.push(+t.toFixed(6));
    } else {
      for (let t = step; t <= end + 1e-9; t += step) grid.push(+t.toFixed(6));
    }
    // Every line starts at t=0. The exported samples begin at one day, and the
    // value drawn at zero is that first sample carried back a day: the discount
    // factor there is exactly 1 and the overnight rate covers the gap, so
    // nothing is invented. Without this the line begins a step in and the gap
    // is visible at the widest zoom. The FX branch below anchors itself.
    if (domain !== 'fx') grid.unshift(0);
    // EUR/USD outright forward. Covered interest parity on the two curves the
    // engine already solved: F(T) = S * DF_EUR(T) / DF_USD(T), where DF_EUR is
    // the EUR curve under USD collateral and DF_USD is SOFR. This is the object
    // the FX swap points and xccy basis actually quote - the implied zero curve
    // shown in the other domains is derived FROM it - so it is worth showing
    // directly. Rebuilt this way it reprices the quoted points to under a pip.
    if (domain === 'fx') {
      const usd = curves['SOFR'];
      const spots: Record<string, number | undefined> =
        { EURUSD: eurusdSpot, AUDUSD: audusdSpot };
      const pairs = ['EURUSD', 'AUDUSD']
        .filter(p => curves[p]?.length && spots[p]);
      if (!usd?.length || !pairs.length) return [];
      // Anchor each series at spot. Every point on this curve is spot times a
      // ratio of discount factors, so spot is where it comes from, not just
      // where it happens to start: at t = 0 both discount factors are 1 and the
      // forward IS spot. Beginning the line at the first grid point instead
      // hides that, and hides how much of the curve is carry rather than level.
      const usdLast = usd[usd.length - 1][0];
      const row0: Record<string, number> = { t: 0 };
      for (const pr of pairs) row0[pr] = spots[pr]!;
      return [row0].concat(grid.map(t => {
        const row: Record<string, number> = { t };
        for (const pr of pairs)
          if (t <= Math.min(lastOf[pr], usdLast) + 1e-9)
            row[pr] = spots[pr]! * (dfAt(curves[pr], t) / dfAt(usd, t));
        return row;
      }));
    }
    return grid.map(t => {
      const row: Record<string, number> = { t };
      for (const k of keys) {
        if (t > lastOf[k] + 1e-9) continue;
        const pts = curves[k];
        if (domain === 'zero') row[k] = zeroAt(pts, t);
        else if (domain === 'df') row[k] = dfAt(pts, t);
        else if (domain === 'inst') row[k] = instAt(pts, t);
        else {
          const d1 = dfAt(pts, t), d2 = dfAt(pts, t + fwdTenor);
          if (d1 > 0 && d2 > 0) row[k] = (Math.log(d1 / d2) / fwdTenor) * 100;
        }
      }
      return row;
    });
  }, [curves, shown, domain, tMax, fwdTenor, eurusdSpot, audusdSpot]);

  const selTrade = trades?.trades.find(t => t.id === selTradeId) ?? null;

  // Three risk views of the same trade. Market bumps a QUOTE and re-runs the
  // bootstrap; zero and forward bump the CURVE directly. They answer different
  // questions and are not rescalings of each other, so they are drawn together
  // rather than blended into one ladder.
  //
  // They used to sit behind a measure toggle, which meant the heading and the
  // explanation above them were re-read on every switch and the section read as
  // three near-identical sections. Side by side, the explanation is written once
  // and the reader can see the shapes differ without having to remember the last
  // one.
  // The curve selector is shared by all three panels, so its list is the union
  // over the domains in market order. On this dataset every domain carries the
  // same curves, but a domain that reaches a curve the others do not would
  // otherwise drop off the selector depending on which panel was consulted.
  const tradeCurveKeys = useMemo(() => {
    const keys: string[] = [];
    for (const m of MEASURES)
      for (const k of Object.keys(ladderCurveSource(selTrade, m.key) ?? {}))
        if (!keys.includes(k)) keys.push(k);
    return keys;
  }, [selTrade]);
  const activeCurve = tradeCurve && tradeCurveKeys.includes(tradeCurve) ? tradeCurve : tradeCurveKeys[0];

  const ladderPanels = useMemo(() => MEASURES.map(m => {
    const byCurve = ladderCurveSource(selTrade, m.key);
    const rows = activeCurve
      ? (byCurve?.[activeCurve] as (LadderRow | CurveLadderRow)[] | undefined)
      : undefined;
    const data = (rows ?? []).map(r => ({
      tenor: r.tenor,
      instrument: 'instrument' in r ? r.instrument : (r as CurveLadderRow).role,
      cpu: +r.cpu.toFixed(2),
      gpu: r.gpu == null ? undefined : +r.gpu.toFixed(2),
    }));
    // Curve-node ladders always carry both lanes; the market ladder only does
    // where the engine ran a GPU pillar pass.
    // The market view's GPU column is hidden. Both lanes bump the same quote and
    // re-bootstrap, so they should agree, and they do not: risk shifts between
    // neighbouring pillars on the aged trade while the total is preserved. That
    // is an unexplained difference between two ways of rebuilding the curve, not
    // a modelling choice, so it should not be shown as though it were a result.
    // The zero and forward views keep both lanes, where they agree to 1e-15.
    const showGpu = m.key !== 'market' && data.some(d => d.gpu !== undefined);
    // A panel with nothing in it says why. Dropping it silently would leave the
    // reader to guess whether the risk is zero or the run never happened.
    const curveName = activeCurve ? (CURVE_LABELS[activeCurve] ?? activeCurve) : 'this trade';
    const absent = !byCurve || !activeCurve
      ? `This trade has no ${m.label} ladder in the run.`
      : !rows
        ? `No ${m.label} ladder was produced for ${curveName}.`
        : rows.length === 0
          ? `The ${m.label} ladder for ${curveName} came back empty.`
          : null;
    return {
      ...m, data, showGpu, absent,
      cpuTotal: data.reduce((a, r) => a + (r.cpu ?? 0), 0),
      gpuTotal: data.reduce((a, r) => a + (r.gpu ?? 0), 0),
    };
  }), [selTrade, activeCurve]);

  const fxInstruments = useMemo(
    () => (selTrade?.fx ? [...new Set(selTrade.fx.map(r => r.instrument))] : []), [selTrade]);
  const fxChart = useMemo(() => {
    if (!selTrade?.fx) return [];
    return selTrade.fx
      .filter(r => r.instrument === fxInstr)
      .map(r => ({ pillar: r.pillar, bumpType: r.bumpType, pv01: +r.pv01.toFixed(2) }));
  }, [selTrade, fxInstr]);

  const chip = (active: boolean, color: string) => ({
    border: `1px solid ${active ? color : 'var(--border-subtle)'}`,
    color: active ? color : 'var(--text-dim)',
    background: active ? `${color}18` : 'transparent',
  });

  return (
    <div className={chapter ? '' : 'max-w-6xl mx-auto px-6 py-10'}>
      {!chapter && (
      <DashboardHeader
        label={(breadcrumb ?? ['Rates']).join(' / ')}
        title="Curve Market Data Model"
        subtitle="The quotes each curve is built from, and each one repriced afterwards by the curve it went into"
        techBadges={['C++', 'QuantLib', 'CUDA', 'GlobalBootstrap']}
      />
      )}
      {chapter && (
        <div className="flex flex-wrap gap-2 mb-4">
          {['C++', 'QuantLib', 'CUDA', 'GlobalBootstrap'].map(b => (
            <span key={b} className="font-mono text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(94,170,181,0.08)', border: '1px solid rgba(94,170,181,0.15)', color: 'var(--accent-cool)' }}>{b}</span>
          ))}
        </div>
      )}

      <p className={'text-sm mb-8 max-w-4xl' + (chapter ? '' : ' -mt-6')} style={{ color: 'var(--text-dim)' }}>
        I wrote the engine in C++17 on QuantLib, with CUDA for the GPU comparison. The
        book is priced and risked on one curve per currency dated to its central
        bank&apos;s meetings, ESTR (ECB), SOFR (FOMC), SONIA (MPC) and AONIA (RBA). The
        tenor and IMM builds are only for comparison.
      </p>

      {!chapter && (
      <div className="flex gap-2 mb-8 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="font-mono text-xs px-4 py-2 rounded transition-colors"
            style={chip(tab === t.key, '#5b8fc9')}>{t.label}</button>
        ))}
      </div>
      )}

      {tab === 'inputs' && inputs && (
        <div>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Each of the {inputs.curves.length} curves is built from the quotes listed
            here. Every quote has to be repriced by its finished curve, and each one is a
            risk bucket in the trade risk chapter. IMM = third Wednesday of the quarter. MTG = the
            day a policy decision takes effect.
          </p>
          <div className="flex gap-2 mb-5 flex-wrap">
            {inputs.curves.map(c => (
              <button key={c.curve} onClick={() => setSelCurve(c.curve)}
                className="font-mono text-xs px-3 py-1.5 rounded"
                style={chip(selCurve === c.curve, CURVE_COLORS[c.index] ?? '#5b8fc9')}>
                {c.curve}
              </button>
            ))}
          </div>
          {selMkt && (
            <div>
              <div className="font-mono text-xs mb-3 flex gap-4 flex-wrap" style={{ color: 'var(--text-dim)' }}>
                <span>index {selMkt.index}</span>
                <span>{selMkt.day_counter}</span>
                <span>T+{selMkt.settlement_days}</span>
                {selMkt.fx_spot && <span>spot {selMkt.fx_spot}</span>}
                {selMkt.futures_convexity_sigma && <span>futures σ {(selMkt.futures_convexity_sigma * 100).toFixed(1)}%</span>}
                {selMkt.meeting_dates && <span>{selMkt.meeting_dates.length} policy effective dates</span>}
              </div>
              {selMkt.derived ? (
                <div className="rounded px-4 py-3 text-sm max-w-4xl"
                     style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <p className="mb-2">
                    This curve has no quotes of its own and is derived from its parents
                    after they are built.
                  </p>
                  <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
                    {selMkt.derivation}
                  </p>
                </div>
              ) : (
              <div className="overflow-x-auto rounded" style={{ border: '1px solid var(--border-subtle)' }}>
                <table className="w-full font-mono text-xs">
                  <thead>
                    <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <th className="text-left px-3 py-2">Pillar</th>
                      <th className="text-left px-3 py-2">Instrument</th>
                      <th className="text-right px-3 py-2">Quote</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selMkt.quotes.map((q, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #14141f', color: 'var(--text-secondary)' }}>
                        <td className="px-3 py-1.5">{q.tenor}</td>
                        <td className="px-3 py-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px]"
                            style={{ background: `${INSTR_BADGE[q.instrument] ?? '#555'}22`, color: INSTR_BADGE[q.instrument] ?? '#aaa' }}>
                            {q.instrument}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {q.price != null ? q.price.toFixed(2) + ' (price)'
                            : q.instrument === 'SPOT' ? (q.rate ?? 0).toFixed(4)
                              : q.instrument === 'FXSWAP' ? ((q.rate ?? 0) * 1e4).toFixed(2) + ' pts'
                                : q.instrument === 'TBS' ? ((q.rate ?? 0) * 1e4).toFixed(2) + ' bp'
                                  : ((q.rate ?? 0) * 100).toFixed(4) + '%'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'curves' && (
        <div>
          <p className="text-sm mb-4 max-w-4xl" style={{ color: 'var(--text-secondary)' }}>
            Discrete forwards line up with the quoted instruments and FX forwards are
            the ratio of two curves. The instantaneous forward is the most sensitive of
            the five views and shows up problems the others hide.
          </p>

          <div className="flex gap-2 mb-3 flex-wrap items-center"
               style={{ opacity: domain === 'fx' ? 0.35 : 1 }}>
            {curveKeys.map(k => (
              <button key={k}
                onClick={() => setShown(s => s.includes(k) ? s.filter(x => x !== k) : [...s, k])}
                className="font-mono text-[11px] px-2.5 py-1 rounded"
                style={chip(shown.includes(k), CURVE_COLORS[k])}>{CURVE_LABELS[k]}</button>
            ))}
          </div>

          <div className="flex gap-2 mb-2 font-mono text-[11px] flex-wrap items-center">
            {([['fwd', 'discrete forwards'], ['inst', 'instantaneous forward'], ['zero', 'zero rates'], ['df', 'discount factors'], ['fx', 'FX forwards']] as const)
              .map(([d, label]) => (
                <button key={d} onClick={() => setDomain(d)} className="px-2.5 py-1 rounded"
                  style={chip(domain === d, '#5eaab5')}>{label}</button>
              ))}
            <span className="mx-1" style={{ color: 'var(--border-subtle)' }}>|</span>
            {[2.5, 10, 30].map(x => (
              <button key={x} onClick={() => setTMax(x)} className="px-2.5 py-1 rounded"
                style={chip(tMax === x, '#8b7ec8')}>{x}Y</button>
            ))}
            {domain === 'fwd' && (
              <>
                <span className="mx-1" style={{ color: 'var(--border-subtle)' }}>|</span>
                {[[0.25, '3M'], [0.5, '6M']].map(([v, l]) => (
                  <button key={l as string} onClick={() => setFwdTenor(v as number)} className="px-2.5 py-1 rounded"
                    style={chip(fwdTenor === v, '#d4a853')}>{l as string}</button>
                ))}
              </>
            )}
          </div>

          <ResponsiveContainer width="100%" height={440}>
            <LineChart data={curveChart}>
              <CartesianGrid stroke={chartGrid} />
              <XAxis dataKey="t" stroke={chartAxis} tick={{ fontSize: 11 }} type="number"
                domain={[0, tMax]} tickFormatter={v => `${v}Y`} />
              <YAxis stroke={chartAxis} tick={{ fontSize: 11 }} domain={['auto', 'auto']} width={62}
                tickFormatter={v => domain === 'df' ? Number(v).toFixed(3) : domain === 'fx' ? Number(v).toFixed(4) : `${Number(v).toFixed(2)}%`} />
              <Tooltip {...tt}
                formatter={(v: any, n: any) => [
                  domain === 'df' ? Number(v).toFixed(6)
                    : domain === 'fx' ? Number(v).toFixed(5)
                      : `${Number(v).toFixed(4)}%`,
                  domain === 'fx' ? `${String(n).slice(0, 3)}/USD outright` : CURVE_LABELS[n] ?? n]}
                labelFormatter={l => `t = ${Number(l).toFixed(2)}Y`} />
              <Legend formatter={(v: string) => <span style={{ fontSize: 11 }}>{CURVE_LABELS[v] ?? v}</span>} />
              {(domain === 'fx' ? ['EURUSD', 'AUDUSD'] : shown).map(k => (
                <Line key={k} dataKey={k} stroke={CURVE_COLORS[k]} dot={false} strokeWidth={1.8} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>

          <p className="text-sm mt-3 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
            Two shapes that look like artifacts are real. The EURIBOR 6M bump between 13
            and 16 months sits where its quote spacing changes from monthly to
            bi-monthly, and the ~25bp drop in the EUR/USD instantaneous forward across
            year end is the year-end turn held by the FX points.
          </p>
          <p className="text-sm mt-2 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
            The cross currency curves sit apart because they are implied from FX swap
            points and basis against SOFR, with no local quotes. The two BBSW curves
            split where the AUD market does, quarterly 3M swaps to 3Y and semi-annual 6M
            swaps from 4Y, and a quoted 6M/3M tenor basis strip stitches the halves so
            both run the full range. Solving those basis swaps as real float against
            float instruments makes the pair a joint solve, which the engine stages and
            iterates to a fixed point.
          </p>
          <p className="text-sm mt-2 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
            Under a USD CSA that accepts USD, EUR or AUD cash, the poster delivers
            whichever is cheapest and can substitute daily. The CTD curve is therefore
            the pointwise maximum of the forwards on SOFR and the two cross currency
            curves, integrated to discount factors. It&apos;s a zero volatility
            construction that gives the option to switch later no value, so a
            stochastic model would discount strictly below this envelope.
          </p>
        </div>
      )}

      {tab === 'sensis' && trades && (
        <div>
          <p className="text-sm mb-4 max-w-4xl" style={{ color: 'var(--text-secondary)' }}>
            Pick a trade, and each bar shows what one basis point in that bucket is
            worth to the position.
          </p>

          <div className="flex gap-2 mb-4 font-mono text-[11px] flex-wrap">
            {trades.trades.map(t => (
              <button key={t.id} onClick={() => { setSelTradeId(t.id); setTradeCurve(null); }}
                className="px-2.5 py-1 rounded"
                style={chip(selTradeId === t.id, CURVE_COLORS[t.curves[0].key] ?? '#5b8fc9')}>
                {t.label}
              </button>
            ))}
          </div>

          {selTrade && (
            <div className="rounded px-4 py-3 mb-5" style={{ border: '1px solid var(--border-subtle)' }}>
              <div className="font-mono text-xs mb-1 flex gap-4 flex-wrap" style={{ color: 'var(--text-primary)' }}>
                <span>{selTrade.product}</span>
                <span style={{ color: 'var(--text-dim)' }}>{selTrade.notional}</span>
              </div>
              <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{selTrade.detail}</p>
              <div className="font-mono text-[10px] flex gap-3 flex-wrap" style={{ color: 'var(--text-dim)' }}>
                {selTrade.curves.map(c => (
                  <span key={c.key}>
                    <span style={{ color: CURVE_COLORS[c.key] ?? 'var(--text-secondary)' }}>{CURVE_LABELS[c.key] ?? c.key}</span>
                    {' '}&middot; {c.role}
                  </span>
                ))}
                <span>&middot; {selTrade.engine}</span>
              </div>
            </div>
          )}

          {selTrade && !selTrade.fx && (
            <div>
              <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                Risk ladders: Market PV01 &middot; Zero PV01 &middot; Forward PV01
              </h3>
              <p className="text-sm mb-4 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
                All three ladders measure the same risk and differ only in where the
                basis point is applied.
              </p>
              <div className="flex gap-2 mb-3 font-mono text-[11px] flex-wrap items-center">
                <span className="text-[10px] uppercase mr-1" style={{ color: 'var(--text-dim)' }}>curve</span>
                {tradeCurveKeys.map(k => (
                  <button key={k} onClick={() => setTradeCurve(k)} className="px-2.5 py-1 rounded"
                    style={chip(activeCurve === k, CURVE_COLORS[k] ?? '#5b8fc9')}>
                    {CURVE_LABELS[k] ?? k}
                  </button>
                ))}
              </div>

              {/* Three across at desktop width, stacked below it. Each panel gets
                  about 340px, which is enough for the shape of a 30-bucket ladder
                  and not enough for 30 rotated tick labels, so the ticks thin to
                  roughly ten and the tooltip carries the rest. */}
              <div className="flex gap-2 mb-2 font-mono text-[11px] flex-wrap">
                {ladderPanels.map(p => (
                  <button key={p.key} onClick={() => setSelMeasure(p.key)}
                    className="px-2.5 py-1 rounded"
                    style={chip((selMeasure ?? ladderPanels[0].key) === p.key, '#b07fc9')}>
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="text-sm mb-3 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
                {ladderPanels.find(p => p.key === (selMeasure ?? ladderPanels[0].key))?.desc}
              </p>
              <div className="grid gap-4">
                {ladderPanels.filter(p => p.key === (selMeasure ?? ladderPanels[0].key)).map(p => (
                  <div key={p.key} className="rounded px-3 py-2 min-w-0"
                    style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="font-mono text-[11px]" style={{ color: '#b07fc9' }}>{p.label}</span>
                      {p.showGpu && (
                        <span className="font-mono text-[10px] flex gap-2" style={{ color: 'var(--text-dim)' }}>
                          <span><span style={{ color: '#5b8fc9' }}>&#9632;</span> processor</span>
                          <span><span style={{ color: '#d4a853' }}>&#9632;</span> GPU</span>
                        </span>
                      )}
                    </div>
                    {p.absent ? (
                      <div className="flex items-center justify-center px-3" style={{ height: 260 }}>
                        <p className="text-sm text-center" style={{ color: 'var(--text-dim)' }}>{p.absent}</p>
                      </div>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={p.data} margin={{ left: 0, right: 6, top: 4, bottom: 0 }}>
                            <CartesianGrid stroke={chartGrid} />
                            <XAxis dataKey="tenor" stroke={chartAxis} tick={{ fontSize: 9 }}
                              interval={Math.max(0, Math.ceil(p.data.length / 10) - 1)}
                              angle={-45} textAnchor="end" height={44} />
                            <YAxis stroke={chartAxis} tick={{ fontSize: 10 }} width={46}
                              tickFormatter={v => fmtAxis(Number(v))} />
                            <Tooltip {...tt} formatter={(v: any, n: any) =>
                              [Number(v).toLocaleString(),
                                n === 'cpu' ? 'Processor' : 'GPU']}
                              labelFormatter={(l: any) => {
                                const row = p.data.find(r => r.tenor === l);
                                return `${l}${row ? ` · ${row.instrument}` : ''}`;
                              }} />
                            <ReferenceLine y={0} stroke={chartAxis} />
                            <Bar dataKey="cpu" fill="#5b8fc9" isAnimationActive={false} />
                            {p.showGpu && <Bar dataKey="gpu" fill="#d4a853" isAnimationActive={false} />}
                          </BarChart>
                        </ResponsiveContainer>
                        {/* Bucket differences between the two lanes can look alarming
                            when they are really redistributing the same total between
                            neighbouring pillars. Showing both sums makes that visible
                            rather than leaving it to the caption. The total also does
                            the work the shared y-axis would have done: it is the one
                            figure that carries across panels. */}
                        {(() => {
                          const rel = Math.abs(p.cpuTotal) > 1e-9
                            ? Math.abs(p.cpuTotal - p.gpuTotal) / Math.abs(p.cpuTotal) : 0;
                          return (
                            <div className="font-mono text-[10px] mt-1 flex gap-3 flex-wrap"
                              style={{ color: 'var(--text-dim)' }}>
                              <span>total {p.cpuTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                              <span>{p.data.length} buckets</span>
                              {p.showGpu && (
                                <span style={{ color: rel < 0.01 ? 'var(--accent-green)' : 'var(--text-dim)' }}>
                                  {rel < 1e-6 ? 'lanes identical' : 'lanes differ by ' + (rel * 100).toFixed(2) + '%'}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                ))}
              </div>

              <p className="text-sm mt-3 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
                Each ladder has its own scale, so compare them by the total printed
                underneath. I&apos;ve left the GPU lane off Market PV01 because it moves
                risk between neighbouring pillars while the total holds, and I
                haven&apos;t explained that yet. On the zero and forward ladders the two
                lanes agree to the last digit.
              </p>
            </div>
          )}

          {selTrade?.fx && (
            <div>
              <div className="flex gap-2 mb-3 font-mono text-[11px] flex-wrap items-center">
                {fxInstruments.map(i => (
                  <button key={i} onClick={() => setFxInstr(i)} className="px-2.5 py-1 rounded"
                    style={chip(fxInstr === i, '#4a9a68')}>{i.replace(/_/g, ' ')}</button>
                ))}
                <span className="ml-2 flex gap-3">
                  {Object.entries(FX_BUMP_LABELS).map(([k, l]) => (
                    <span key={k} style={{ color: FX_BUMP_COLORS[k] }}>&#9632; {l}</span>
                  ))}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={fxChart}>
                  <CartesianGrid stroke={chartGrid} />
                  <XAxis dataKey="pillar" stroke={chartAxis} tick={{ fontSize: 10 }} interval={0} />
                  <YAxis stroke={chartAxis} tick={{ fontSize: 11 }} width={64}
                    tickFormatter={v => Number(v).toLocaleString()} />
                  <Tooltip {...tt} formatter={(v: any) => [`€${Number(v).toLocaleString()}`, 'PV01']}
                    labelFormatter={(l: any) => `pillar ${l}`} />
                  <ReferenceLine y={0} stroke={chartAxis} />
                  <Bar dataKey="pv01" isAnimationActive={false}>
                    {fxChart.map((r, i) => (
                      <Cell key={i} fill={FX_BUMP_COLORS[r.bumpType] ?? '#8b8a97'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-sm mt-3 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
                A 5Y forward&apos;s exposure sits at the 5Y basis pillar and a 10Y
                forward&apos;s at 10Y. That confirms the FX and xccy bootstrap has keyed
                each instrument to the right part of the curve.
              </p>
            </div>
          )}

          {selTrade && selTrade.cashflows.length > 0 && (
            <div className="mt-10">
              <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                Cashflow schedule
              </h3>
              <p className="text-sm mb-4 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
                Every remaining cashflow is valued off the same curves as the risk
                above. At a fair-rate strike the legs nearly cancel, and the residue is
                rounding on the quoted rate.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 font-mono text-xs">
                {[
                  ['Fair rate', `${selTrade.fairRate?.toFixed(4)}%`, 'var(--text-primary)'],
                  ['NPV', fmtCcy(selTrade.npv, selTrade.ccy), Math.abs(selTrade.npv ?? 0) < 1000 ? 'var(--accent-green)' : 'var(--text-primary)'],
                  ['Fixed leg PV', fmtCcy(selTrade.fixedLegNpv ?? null, selTrade.ccy), 'var(--text-secondary)'],
                  ['Float leg PV', fmtCcy(selTrade.floatLegNpv ?? null, selTrade.ccy), 'var(--text-secondary)'],
                ].map(([k, v, col]) => (
                  <div key={k} className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>{k}</div>
                    <div style={{ color: col }}>{v}</div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mb-3 font-mono text-[11px]">
                {(['all', 'fixed', 'float'] as const).map(l => (
                  <button key={l} onClick={() => setCfLeg(l)} className="px-2.5 py-1 rounded"
                    style={chip(cfLeg === l, l === 'fixed' ? '#d4a853' : l === 'float' ? '#5eaab5' : '#5b8fc9')}>
                    {l === 'all' ? 'both legs' : `${l} leg`}
                  </button>
                ))}
              </div>

              <div className="overflow-x-auto rounded" style={{ border: '1px solid var(--border-subtle)' }}>
                <table className="w-full font-mono text-[11px]">
                  <thead>
                    <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <th className="text-left px-3 py-2">Leg</th>
                      <th className="text-left px-3 py-2">Accrual start</th>
                      <th className="text-left px-3 py-2">Accrual end</th>
                      <th className="text-left px-3 py-2">Pay</th>
                      <th className="text-right px-3 py-2">τ</th>
                      <th className="text-right px-3 py-2">Rate %</th>
                      <th className="text-right px-3 py-2">Amount</th>
                      <th className="text-right px-3 py-2">DF</th>
                      <th className="text-right px-3 py-2">PV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selTrade.cashflows
                      .filter(c => cfLeg === 'all' || c.leg === cfLeg)
                      .sort((a, b) => a.pay.localeCompare(b.pay))
                      .map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #14141f', color: 'var(--text-secondary)' }}>
                          <td className="px-3 py-1">
                            <span className="px-1.5 py-0.5 rounded text-[10px]"
                              style={{
                                background: c.leg === 'fixed' ? 'rgba(212,168,83,0.15)' : 'rgba(94,170,181,0.15)',
                                color: c.leg === 'fixed' ? '#d4a853' : '#5eaab5',
                              }}>{c.leg}</span>
                          </td>
                          <td className="px-3 py-1">{c.start}</td>
                          <td className="px-3 py-1">{c.end}</td>
                          <td className="px-3 py-1">{c.pay}</td>
                          <td className="px-3 py-1 text-right">{c.tau.toFixed(4)}</td>
                          <td className="px-3 py-1 text-right">{c.rate.toFixed(4)}</td>
                          <td className="px-3 py-1 text-right">{fmtCcy(c.amount, selTrade.ccy)}</td>
                          <td className="px-3 py-1 text-right">{c.df.toFixed(6)}</td>
                          <td className="px-3 py-1 text-right" style={{ color: 'var(--text-primary)' }}>
                            {fmtCcy(c.pv, selTrade.ccy)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {selTrade.id === 'aged-euribor' && (
                <p className="text-sm mt-3 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
                  The first floating coupon started accruing before today, so its rate
                  is the historical EURIBOR 6M fixing. That in-flight coupon is what
                  separates a seasoned trade from a spot-start one.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'arch' && <ArchitecturePanel />}

      {tab === 'perf' && perf && (
        <div>
          <p className="text-sm mb-2 max-w-4xl" style={{ color: 'var(--text-secondary)' }}>
            I wanted the fastest way to value a book and refresh its risk during the
            trading day. Every timing is from this machine, and nearly all of the gain
            came from the code.
          </p>
          <p className="text-sm mb-4 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
            Most of this chapter compares trade-by-trade valuation on the processor and the
            GPU. Collapsing the book to curve level, measured at the end, changes the
            conclusion for book-level work.
          </p>

          <div className="flex gap-2 mb-3 font-mono text-[11px] flex-wrap">
            {perf.patterns.map(p => (
              <button key={p.id} onClick={() => setSelPattern(p.id)}
                className="px-2.5 py-1 rounded"
                style={chip((selPattern ?? perf.patterns[0].id) === p.id, '#5b8fc9')}>
                {p.name}
              </button>
            ))}
          </div>

          {perf.patterns.filter(p => p.id === (selPattern ?? perf.patterns[0].id)).map(p => {
            const base = p.lanes.find(l => l.lane === p.baseline)?.ms ?? 1;
            // A bar is drawn from the axis baseline, which on a log scale is
            // log(0) and so has no position: recharts 3.8 renders nothing at
            // all. Giving each bar an explicit [floor, value] range pins its
            // start to the axis floor instead of to zero, which is the only
            // form that survives a log axis.
            const vals = p.lanes.map(l => Math.max(l.ms, 0.001));
            const lo = Math.pow(10, Math.floor(Math.log10(Math.min(...vals))) - 1);
            const data = p.lanes.map(l => ({ ...l, ms: l.ms,
              x: [lo, Math.max(l.ms, 0.001)] as [number, number] }));
            const hi = Math.pow(10, Math.ceil(Math.log10(Math.max(...vals))));
            return (
              <div key={p.id} className="mb-10">
                <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{p.name}</h3>
                <p className="text-sm mb-1 max-w-4xl" style={{ color: 'var(--text-dim)' }}>{p.note}</p>
                <p className="font-mono text-[11px] mb-3" style={{ color: 'var(--text-dim)' }}>{p.workload}</p>
                <ResponsiveContainer width="100%" height={44 + data.length * 40}>
                  <BarChart data={data} layout="vertical" margin={{ left: 8, right: 96, top: 4, bottom: 4 }}>
                    <CartesianGrid stroke={chartGrid} horizontal={false} />
                    <XAxis type="number" scale="log" domain={[lo, hi]} allowDataOverflow
                      stroke={chartAxis} tick={{ fontSize: 10 }} tickFormatter={fmtMs} />
                    <YAxis type="category" dataKey="lane" width={250} stroke={chartAxis} tick={{ fontSize: 11 }} />
                    <Tooltip {...tt} cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      formatter={(v: any) => [fmtMs(Array.isArray(v) ? Number(v[1]) : Number(v)), 'wall clock']} />
                    <Bar dataKey="x" isAnimationActive={false} radius={[0, 3, 3, 0]} barSize={22}>
                      {data.map((d, i) => (
                        <Cell key={i} fill={d.kind === 'gpu' ? '#d4a853' : '#5b8fc9'} />
                      ))}
                      <LabelList dataKey="ms" position="right" formatter={(v: any) => fmtMs(Number(v))}
                        style={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'monospace' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-6 gap-y-1 mb-2 font-mono text-[11px]">
                  {p.lanes.filter(l => l.lane !== p.baseline).map(l => (
                    <span key={l.lane} style={{ color: 'var(--text-dim)' }}>
                      {l.lane}: <span style={{ color: base / l.ms >= 1 ? 'var(--accent-green)' : '#c86e6e' }}>
                        {(base / l.ms).toFixed(base / l.ms >= 100 ? 0 : 1)}&times;
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}

          {perf.scaling && Object.keys(perf.scaling).length > 1 && (
            <div className="flex gap-2 mb-3 font-mono text-[11px] flex-wrap">
              {[...Object.keys(perf.scaling), ...(perf.npvScaling ? ['npv'] : [])].map(m => (
                <button key={m} onClick={() => setSelScale(m)}
                  className="px-2.5 py-1 rounded"
                  style={chip((selScale ?? Object.keys(perf.scaling!)[0]) === m, '#5b8fc9')}>
                  {m === 'zero' ? 'zero buckets' : m === 'forward' ? 'forward buckets'
                    : m === 'npv' ? 'book value' : m}
                </button>
              ))}
            </div>
          )}

          {perf.scaling && Object.entries(perf.scaling)
            .filter(([mode]) => mode === (selScale ?? Object.keys(perf.scaling!)[0]))
            .map(([mode, sc]) => {
            // A log axis cannot resolve 'dataMin' once any series carries nulls,
            // and QuantLib is capped part way up this sweep, so the bounds are
            // computed here over real values only. Left to recharts the whole
            // chart renders blank rather than just dropping the short series.
            const rv = sc.points.flatMap(q => [q.cpu, q.flat, q.mt, q.gpu, q.nvlink]
              .filter((x): x is number => typeof x === 'number' && x > 0));
            const rLo = Math.pow(10, Math.floor(Math.log10(Math.min(...rv))));
            const rHi = Math.pow(10, Math.ceil(Math.log10(Math.max(...rv))));
            return (
              <div key={mode} className="mb-10">
                <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  Risk run: cost against book size
                </h3>
                <p className="text-sm mb-3 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
                  I timed a full risk run five different ways while growing the book. The GPU pays
                  a fixed transfer cost per curve, so it starts behind and catches up.
                  The line to watch is all{' '}
                  {sc.threads ?? 16} cores, the realistic alternative to buying a GPU.
                </p>
                <p className="font-mono text-[11px] mb-3" style={{ color: 'var(--text-dim)' }}>
                  {sc.buckets} buckets &times; 1 to {sc.points[sc.points.length - 1].trades} EURIBOR swaps,
                  up to {sc.points[sc.points.length - 1].repricings.toLocaleString()} repricings
                  &middot; same prepared book for every line, best of three after a warm-up
                  &middot; lower is faster
                </p>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={sc.points} margin={{ left: 8, right: 24, top: 8, bottom: 20 }}>
                    <CartesianGrid stroke={chartGrid} />
                    <XAxis dataKey="trades" scale="log" type="number"
                      domain={['dataMin', 'dataMax']} stroke={chartAxis}
                      tick={{ fontSize: 10 }} tickFormatter={(v: any) => Number(v).toLocaleString()}
                      label={{ value: 'trades in book', position: 'insideBottom', offset: -12,
                               style: { fill: 'var(--text-dim)', fontSize: 11 } }} />
                    <YAxis scale="log" domain={[rLo, rHi]} allowDataOverflow
                      stroke={chartAxis} tick={{ fontSize: 10 }} width={78}
                      tickFormatter={fmtMs}
                      label={{ value: 'time taken, lower is faster', angle: -90,
                               position: 'insideLeft', offset: 4,
                               style: { fill: 'var(--text-dim)', fontSize: 11, textAnchor: 'middle' } }} />
                    <Tooltip {...tt}
                      labelFormatter={(v: any) => Number(v).toLocaleString() + ' trades'}
                      formatter={(v: any, n: any) => [fmtMs(Number(v)),
                        n === 'cpu' ? 'QuantLib' : n === 'flat' ? 'Flattened CPU, 1 core'
                          : n === 'mt' ? 'Flattened CPU, all cores'
                          : n === 'gpu' ? 'GPU total'
                          : 'GPU on NVLink-C2C (projected)']} />
                    <Legend formatter={(v: string) => <span style={{ fontSize: 11 }}>
                      {v === 'cpu' ? 'QuantLib' : v === 'flat' ? 'Flattened CPU, 1 core'
                        : v === 'mt' ? 'Flattened CPU, all cores'
                        : v === 'gpu' ? 'GPU total'
                        : 'GPU on NVLink-C2C (projected)'}</span>} />
                    <Line type="monotone" dataKey="cpu" stroke="#5b8fc9" strokeWidth={2}
                      dot={{ r: 2 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="flat" stroke="#b07fc9" strokeWidth={2}
                      dot={{ r: 2 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="mt" stroke="#6fa8a0" strokeWidth={2}
                      dot={{ r: 2 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="gpu" stroke="#d4a853" strokeWidth={2}
                      dot={{ r: 2 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="nvlink" stroke="#d98ab0" strokeWidth={2.5}
                      dot={{ r: 2 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="grid md:grid-cols-2 gap-3 mt-3">
                  <div className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>At the largest book, over {sc.threads ?? 16} cores</div>
                    <div className="font-mono text-sm" style={{ color: 'var(--accent-green)' }}>
                      {sc.topGpuVsMt ? sc.topGpuVsMt + '\u00d7' : 'n/a'}
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>
                      over the same flattened pricer on all {sc.threads ?? 16} cores,
                      and {sc.topGpuVsFlat ?? '?'}&times; over a single core. A desk
                      deciding whether to buy a GPU already owns the cores, so this is
                      the comparison it faces.
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {perf.npvScaling && selScale === 'npv' && (() => {
            const ns = perf.npvScaling;
            const nv = ns.points.flatMap(q => [q.quantlib, q.flat, q.mt, q.gpu, q.nvlink]
              .filter((x): x is number => typeof x === 'number' && x > 0));
            const nLo = Math.pow(10, Math.floor(Math.log10(Math.min(...nv))));
            const nHi = Math.pow(10, Math.ceil(Math.log10(Math.max(...nv))));
            const top = ns.points[ns.points.length - 1];
            return (
              <div className="mb-10">
                <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  Book value: cost against book size
                </h3>
                <p className="text-sm mb-1 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
                  The book is valued once at each size, and most of the gain comes
                  before the GPU is involved. Moving cashflows out of library objects
                  into plain numbers is worth {ns.topFlatVsQuantLib ?? 0}&times; on a
                  single core.
                </p>
                <p className="font-mono text-[11px] mb-3" style={{ color: 'var(--text-dim)' }}>
                  1 to {top.trades.toLocaleString()} swaps, up to {top.cashflows.toLocaleString()} cashflows
                  &middot; lower is faster, so QuantLib is the slowest throughout
                </p>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={ns.points} margin={{ left: 8, right: 24, top: 8, bottom: 20 }}>
                    <CartesianGrid stroke={chartGrid} />
                    <XAxis dataKey="trades" scale="log" type="number"
                      domain={['dataMin', 'dataMax']} stroke={chartAxis}
                      tick={{ fontSize: 10 }} tickFormatter={(v: any) => Number(v).toLocaleString()}
                      label={{ value: 'swaps in book', position: 'insideBottom', offset: -12,
                               style: { fill: 'var(--text-dim)', fontSize: 11 } }} />
                    <YAxis scale="log" domain={[nLo, nHi]} allowDataOverflow
                      stroke={chartAxis} tick={{ fontSize: 10 }} width={78} tickFormatter={fmtMs}
                      label={{ value: 'time taken, lower is faster', angle: -90,
                               position: 'insideLeft', offset: 4,
                               style: { fill: 'var(--text-dim)', fontSize: 11, textAnchor: 'middle' } }} />
                    <Tooltip {...tt}
                      labelFormatter={(v: any) => Number(v).toLocaleString() + ' swaps'}
                      formatter={(v: any, n: any) => [fmtMs(Number(v)),
                        n === 'quantlib' ? 'QuantLib' : n === 'flat' ? 'Flattened CPU, 1 core'
                          : n === 'mt' ? 'Flattened CPU, all cores'
                          : n === 'gpu' ? 'GPU total'
                          : 'GPU on NVLink-C2C (projected)']} />
                    <Legend formatter={(v: string) => <span style={{ fontSize: 11 }}>
                      {v === 'quantlib' ? 'QuantLib' : v === 'flat' ? 'Flattened CPU, 1 core'
                        : v === 'mt' ? 'Flattened CPU, all cores'
                        : v === 'gpu' ? 'GPU total'
                        : 'GPU on NVLink-C2C (projected)'}</span>} />
                    <Line type="monotone" dataKey="quantlib" stroke="#5b8fc9" strokeWidth={2}
                      dot={{ r: 2 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="flat" stroke="#b07fc9" strokeWidth={2}
                      dot={{ r: 2 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="mt" stroke="#6fa8a0" strokeWidth={2}
                      dot={{ r: 2 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="gpu" stroke="#d4a853" strokeWidth={2}
                      dot={{ r: 2 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="nvlink" stroke="#d98ab0" strokeWidth={2.5}
                      dot={{ r: 2 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="rounded overflow-hidden mt-3" style={{ border: '1px solid var(--border-subtle)' }}>
                  <table className="w-full font-mono text-[11px]">
                    <thead>
                      <tr style={{ color: 'var(--text-dim)' }}>
                        <th className="text-left px-3 py-1.5 font-normal">At {top.trades.toLocaleString()} trades, quickest first</th>
                        <th className="text-right px-3 py-1.5 font-normal">time</th>
                        <th className="text-right px-3 py-1.5 font-normal">against the best</th>
                      </tr>
                    </thead>
                    <tbody>
                      {([
                        ['GPU, curve stored, shared memory', top.nvlink, true],
                        ['All ' + (ns.threads ?? 16) + ' cores, curve stored', top.serMt, false],
                        ['All ' + (ns.threads ?? 16) + ' cores, curve recalculated', top.mt, false],
                        ['GPU over this PCIe slot', top.gpuSer, false],
                        ['One core, curve stored', top.ser, false],
                        ['One core, curve recalculated', top.flat, false],
                        ['Through QuantLib', top.quantlib, false],
                      ] as [string, number | null, boolean][])
                        .filter(r => r[1])
                        .sort((a, b) => (a[1] as number) - (b[1] as number))
                        .map(([name, ms, best], k) => (
                          <tr key={name} style={{ borderTop: k ? '1px solid var(--border-subtle)' : undefined }}>
                            <td className="px-3 py-1.5" style={{ color: best ? '#d98ab0' : 'var(--text-secondary)' }}>
                              {name}{best ? ' (projected)' : ''}
                            </td>
                            <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-primary)' }}>
                              {fmtMs(ms as number)}
                            </td>
                            <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-dim)' }}>
                              {top.nvlink ? ((ms as number) / top.nvlink).toFixed(1) + '\u00d7' : ''}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {ns.singleThreaded && (
                  <>
                  <p className="text-sm mt-3 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
                  The NVLink line is a projection. On this machine&apos;s desktop slot
                  the copy takes longer than the calculation, so the projection re-costs
                  the copy at shared-memory link speed and keeps the measured
                  calculation time. On that link the GPU would come out{' '}
                  {ns.topNvlinkVsMt}&times; ahead of all {ns.threads ?? 16} cores, while
                  over the desktop slot it is behind them.
                </p>
                  </>
                )}
              </div>
            );
          })()}

          {perf.bookScale && perf.marketLanes && (() => {
            const b = perf.bookScale, m = perf.marketLanes;
            const bar = (label: string, ms: number, kind: 'cpu' | 'gpu' | 'boot', max: number) => (
              <div key={label} className="mb-2">
                <div className="flex justify-between font-mono text-[11px] mb-0.5">
                  <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{ color: 'var(--text-primary)' }}>{fmtMs(ms)}</span>
                </div>
                <div style={{ height: 8, background: 'var(--bg-surface)', borderRadius: 2 }}>
                  <div style={{
                    height: 8, borderRadius: 2, width: `${Math.max(1, 100 * ms / max)}%`,
                    background: kind === 'gpu' ? '#d4a853' : kind === 'boot' ? '#8b8a97' : '#5b8fc9',
                  }} />
                </div>
              </div>
            );
            const max = Math.max(b.bootstrapMs, b.hostMs, b.gpuMs);
            return (
              <div className="mb-10">
                <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  Market PV01 over a {b.trades.toLocaleString()}-trade book
                </h3>
                <p className="text-sm mb-1 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
                  Each of the {b.bumps} quoted prices is bumped a basis point, the curve
                  re-solved and the book revalued, {b.repricings.toLocaleString()}{' '}
                  valuations in all. The two lanes agree to <Sci v={b.agreement} /> of
                  notional.
                </p>
                <p className="font-mono text-[11px] mb-3" style={{ color: 'var(--text-dim)' }}>
                  {b.cashflows.toLocaleString()} cashflows &middot; {b.threads} cores
                  &middot; lower is faster
                </p>
                <div className="max-w-2xl">
                  {bar('Re-solving the curve, ' + b.bumps + ' times', b.bootstrapMs, 'boot', max)}
                  {bar('Revaluing the book, all ' + b.threads + ' cores', b.hostMs, 'cpu', max)}
                  {bar('Revaluing the book on the GPU', b.gpuMs, 'gpu', max)}
                </div>
                <div className="grid md:grid-cols-3 gap-3 mt-4">
                  <div className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>GPU against the cores</div>
                    <div className="font-mono text-sm" style={{ color: 'var(--accent-green)' }}>1.5 to 1.9&times;</div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>
                      across three runs. The book crosses once and all {b.bumps} curves read the
                      same copy, so the transfer is {fmtMs(b.gpuH2dMs)} of {fmtMs(b.gpuMs)}. The
                      GPU lane repeats to 0.4%, and the spread is the cores, which swing
                      a tenth run to run
                    </div>
                  </div>
                  <div className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>Spent rebuilding curves</div>
                    <div className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>{b.bootstrapShareHost}%</div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>
                      of the run, against over 99.9% at two trades. Most of that rebuilding
                      turned out to be repetition
                    </div>
                  </div>
                  <div className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>Same answer</div>
                    <div className="font-mono text-sm" style={{ color: 'var(--accent-green)' }}><Sci v={b.agreement} /></div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>
                      worst difference between the two lanes against notional, a single ulp
                    </div>
                  </div>
                </div>

                <h3 className="text-base font-semibold mb-1 mt-8" style={{ color: 'var(--text-primary)' }}>
                  Ladder accuracy against QuantLib
                </h3>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>Against notional</div>
                    <div className="font-mono text-sm" style={{ color: 'var(--accent-green)' }}>
                      <Sci v={m.gpuVsQlNotional} />
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>
                      GPU against QuantLib across all {m.bumps} bumps, and of the two
                      scales this is the flattering one
                    </div>
                  </div>
                  <div className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>Against the ladder</div>
                    <div className="font-mono text-sm" style={{ color: 'var(--accent-green)' }}>
                      <Sci v={m.gpuVsQlLadder} />
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>
                      against the biggest bucket in the same ladder, the one a hedge is
                      sized off. That is eleven figures, and it&apos;s the floor for this
                      method because a PV01 is the difference of two large numbers
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {perf.aggBench && (() => {
            const a = perf.aggBench;
            const zl = a.ladder.zero;
            const fl = a.ladder.forward;
            const mp = a.marketPv01;
            const nCores = a.threads ?? 16;
            const bar = (label: string, ms: number, kind: 'cpu' | 'gpu' | 'agg' | 'boot', max: number) => (
              <div key={label} className="mb-2">
                <div className="flex justify-between font-mono text-[11px] mb-0.5">
                  <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{ color: 'var(--text-primary)' }}>{fmtMs(ms)}</span>
                </div>
                <div style={{ height: 8, background: 'var(--bg-surface)', borderRadius: 2 }}>
                  <div style={{
                    height: 8, borderRadius: 2, width: `${Math.max(1, 100 * ms / max)}%`,
                    background: kind === 'gpu' ? '#d4a853' : kind === 'agg' ? '#5cb87a'
                      : kind === 'boot' ? '#8b8a97' : '#5b8fc9',
                  }} />
                </div>
              </div>
            );
            const sub = (title: string) => (
              <h4 className="text-sm font-semibold mb-2 mt-6" style={{ color: 'var(--text-primary)' }}>{title}</h4>
            );
            return (
              <div id="collapse" className="mb-10">
                <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  Collapsing the book to curve level
                </h3>
                <p className="text-sm mb-1 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
                  Cashflows sharing the same curves and dates have their coefficients
                  added before any curve is read. That is exact, but only book-level
                  answers survive it. Here {a.cashflows.toLocaleString()} cashflows
                  collapse to{' '}
                  {a.terms.toLocaleString()} terms, and the {fmtMs(a.buildMs)} build is
                  charged in full to every green bar below.
                </p>
                <p className="text-sm mb-1 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
                  <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Technical note:{' '}
                  </span>
                  every cashflow flattens to one of three shapes, each a coefficient
                  times values read off its curves, all discounted at the pay date:
                </p>
                <ul className="text-sm mb-2 max-w-4xl space-y-1 list-disc pl-5" style={{ color: 'var(--text-dim)' }}>
                  <li>fixed pays N·r·a</li>
                  <li>
                    floating pays N·a/(t<sub>e</sub>−t<sub>s</sub>) times DF
                    <sub>p</sub>(start)/DF<sub>p</sub>(end)−1
                  </li>
                  <li>compounded overnight pays N times the same ratio</li>
                </ul>
                <ul className="text-sm mb-1 max-w-4xl space-y-1 list-disc pl-5" style={{ color: 'var(--text-dim)' }}>
                  <li>
                    The coefficient carries no market data. A forward is never stored
                    but read at valuation time as a ratio of two discount factors, so a
                    curve move reprices every term without regenerating anything.
                  </li>
                  <li>
                    Terms that read the same curves on the same dates sum their
                    coefficients. The keys are whole days and curve ids, so cashflows
                    match exactly or not at all, and only the order of the additions
                    changes.
                  </li>
                  <li>
                    The one frozen value is a settled fixing. It becomes a fixed amount
                    because history must not move with the curve.
                  </li>
                </ul>
                <p className="font-mono text-[11px] mb-3" style={{ color: 'var(--text-dim)' }}>
                  {a.cashflows.toLocaleString()} cashflows &rarr; {a.terms.toLocaleString()} terms
                  &middot; collapsed lane runs on one core, build included
                  &middot; lower is faster
                </p>

                {sub('Book value')}
                <div className="max-w-2xl">
                  {bar('All ' + nCores + ' cores, trade by trade', a.bookNpv.cpuMt, 'cpu', a.bookNpv.gpuTrade)}
                  {bar('GPU, trade by trade', a.bookNpv.gpuTrade, 'gpu', a.bookNpv.gpuTrade)}
                  {bar('Collapsed, one core, build charged here',
                       a.bookNpv.agg, 'agg', a.bookNpv.gpuTrade)}
                  {a.evalMs != null &&
                    bar('Collapsed, one core, book already built',
                        a.evalMs, 'agg', a.bookNpv.gpuTrade)}
                </div>
                <p className="text-sm mt-2 mb-1 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
                  The two collapsed bars are the same method with and without the build.
                  Once the book is collapsed, a valuation costs
                  {a.evalMs != null && <> {fmtMs(a.evalMs)} against{' '}
                  {fmtMs(a.bookNpv.cpuMt)}</>} on the cores. A real-time engine builds
                  once and then pays only the smaller figure.
                </p>

                {zl && (<>
                  {sub('Zero and forward PV01 ladders')}
                  <div className="max-w-2xl">
                    {bar('All ' + nCores + ' cores, trade by trade', zl.tradeMt, 'cpu', zl.tradeMt)}
                    {bar('GPU, trade by trade', zl.gpuTrade, 'gpu', zl.tradeMt)}
                    {bar('Collapsed, one core', zl.agg, 'agg', zl.tradeMt)}
                  </div>
                  <p className="text-sm mt-2 mb-1 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
                    The book is revalued against {a.ladder.buckets} versions of its
                    curves, and trade by trade the GPU beats the cores because the book
                    crosses once and is read {a.ladder.buckets} times. Collapsed, the
                    whole ladder takes {fmtMs(zl.agg)} on one core, build included{fl && <>,
                    and the forward-rate version {fmtMs(fl.agg)} against{' '}
                    {fmtMs(fl.tradeMt)}</>}.
                  </p>
                </>)}

                {sub('Market PV01')}
                <div className="max-w-2xl">
                  {bar('Re-solving the curves, ' + mp.bumps + ' times', mp.bootstrapMs, 'boot', mp.bootstrapMs)}
                  {bar('Revaluing: all ' + nCores + ' cores, trade by trade', mp.cpuMt, 'cpu', mp.bootstrapMs)}
                  {bar('Revaluing: GPU, trade by trade', mp.gpuTrade, 'gpu', mp.bootstrapMs)}
                  {bar('Revaluing: collapsed, one core', mp.agg, 'agg', mp.bootstrapMs)}
                </div>
                <p className="text-sm mt-2 mb-1 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
                  Re-solving the curves dominates at {fmtMs(mp.bootstrapMs)}, whichever
                  method revalues. Collapsing cuts the revaluing from{' '}
                  {fmtMs(mp.cpuMt)} to {fmtMs(mp.agg)}, so any further gain has to come
                  from the re-solving.
                </p>

                <div className="grid md:grid-cols-3 gap-3 mt-4">
                  <div className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>Book risk, against the cores</div>
                    <div className="font-mono text-sm" style={{ color: 'var(--accent-green)' }}>
                      {zl ? (zl.tradeMt / zl.agg).toFixed(0) + '×' : 'n/a'}
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>
                      the full bucket ladder, collapsed on one core with the build
                      included, against all {nCores} cores at trade level
                    </div>
                  </div>
                  <div className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>Book value, against the cores</div>
                    <div className="font-mono text-sm" style={{ color: '#c86e6e' }}>
                      {(a.bookNpv.agg / a.bookNpv.cpuMt).toFixed(1)}&times; slower
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>
                      one valuation cannot repay the build, and this figure charges the
                      whole build to it. Against a book that is already collapsed, the
                      same valuation is the fastest lane here by a wide margin, so an
                      engine that keeps the collapsed book standing uses it for both
                    </div>
                  </div>
                  <div className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>Same answer</div>
                    <div className="font-mono text-sm" style={{ color: 'var(--accent-green)' }}>
                      <Sci v={a.bookNpv.recon} />
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>
                      book value against the trade-level run, relative.
                      {a.worstPv01Rel && <>{' '}The bucket sensitivities agree to{' '}
                      <Sci v={a.worstPv01Rel} /> at the worst bucket. A sensitivity is a
                      small difference of large values, so reordering the additions
                      shows up there sooner</>}
                    </div>
                  </div>
                </div>
                <p className="text-sm mt-3 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
                  Once the book is collapsed there is no work left for a GPU at book
                  level{a.evalMs != null && a.gpuAggKernelMs != null && <>, since one
                  core evaluates the {a.terms.toLocaleString()} terms in{' '}
                  {fmtMs(a.evalMs)}, less than the GPU&apos;s kernel alone took</>}. A
                  blotter still needs every trade valued, so the trade-level comparison
                  keeps its place.
                </p>
              </div>
            );
          })()}

          <h3 className="text-base font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Accuracy
          </h3>
          <div className="grid md:grid-cols-3 gap-3">
            {perf.accuracy.map(a => (
              <div key={a.metric} className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
                <div className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>{a.metric}</div>
                <div className="font-mono text-sm" style={{ color: 'var(--accent-green)' }}><Sci v={a.value} /></div>
                <div className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>{a.note}</div>
              </div>
            ))}
          </div>

          {perf.agreement && perf.agreement.length > 0 && (
            <>
              <h3 className="text-base font-semibold mb-1 mt-8" style={{ color: 'var(--text-primary)' }}>
                Agreement with QuantLib
              </h3>
              <p className="text-sm mb-3 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
                I check every method above trade by trade at every book size. Errors are
                measured against notional, because a near-par swap has an NPV close to zero.
              </p>
              <div className="grid md:grid-cols-3 gap-3">
                {perf.agreement.map(a => (
                  <div key={a.scope + a.comparison} className="rounded px-3 py-2"
                    style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>
                      {a.comparison.replace(/_/g, ' ')}
                    </div>
                    <div className="font-mono text-sm" style={{ color: 'var(--accent-green)' }}><Sci v={a.value} /></div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>
                      worst relative difference, {a.scope}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {perf.npvScaling && perf.scaling && (() => {
            const ns = perf.npvScaling;
            const nTop = ns.points[ns.points.length - 1];
            const threadX = nTop.mt ? +(nTop.flat / nTop.mt).toFixed(1) : null;
            const risk = perf.scaling['forward'] ?? Object.values(perf.scaling)[0];
            const gpuRisk = risk.topGpuVsMt;
            const gpuNpv = ns.topGpuVsMt;
            const cell = (label: string, value: string, note: string, good: boolean) => (
              <div className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
                <div className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>{label}</div>
                <div className="font-mono text-base" style={{ color: good ? 'var(--accent-green)' : '#c86e6e' }}>{value}</div>
                <div className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>{note}</div>
              </div>
            );
            return (
              <div className="mt-12 pt-8" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  What it adds up to
                </h3>
                <p className="text-sm mb-4 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
                  The changes are listed in the order I made them. All except the third
                  are code changes that cost nothing but the work, while the third is a
                  purchase whose payback depends on the job and the machine it goes
                  into.
                </p>
                <div className={perf.aggBench ? 'grid md:grid-cols-2 lg:grid-cols-4 gap-3' : 'grid md:grid-cols-3 gap-3'}>
                  {cell('1. Leave the object model',
                        ns.topFlatVsQuantLib + '\u00d7',
                        'same arithmetic, same curve, one core, no special hardware',
                        true)}
                  {cell('2. Use every core',
                        threadX ? threadX + '\u00d7 more' : 'n/a',
                        (ns.threads ?? 16) + ' cores on the same pricer. It is memory bound, so it scales less than linearly.',
                        true)}
                  {cell('3. Add a GPU',
                        'it depends on the link',
                        'Over this desktop slot, ' + (gpuRisk ?? '?') + '\u00d7 on trade-level bucketed risk but ' +
                        (gpuNpv && gpuNpv < 1 ? (1 / gpuNpv).toFixed(1) + '\u00d7 slower' : 'slower') +
                        ' valuing the book. On a shared memory link that second one becomes ' +
                        (ns.topNvlinkVsMt ?? '?') + '\u00d7 ahead.',
                        false)}
                  {perf.aggBench && perf.aggBench.ladder.zero &&
                    cell('4. Collapse the book',
                         (perf.aggBench.ladder.zero.tradeMt / perf.aggBench.ladder.zero.agg).toFixed(0) + '\u00d7',
                         'on book-level risk, exact, on one core. It only applies to book totals, '
                         + 'so a blotter and per-trade risk stay on the lanes above.',
                         true)}
                </div>
                <p className="text-sm mt-3 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
                  Whether the GPU earns its place comes down to how much work each transfer
                  buys. A trade-level risk run sends the book across once and then values
                  it against {risk.buckets} versions of the curve, and there the GPU beats
                  the cores it competes with. Valuing the book once reads each cashflow a
                  single time, so that job is mostly the transfer, and the link decides it.
                </p>
                {perf.aggBench && (
                  <p className="text-sm mt-2 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
                    The collapse is the one change that removes work instead of speeding
                    it up. For questions about the whole book it leaves{' '}
                    {perf.aggBench.terms.toLocaleString()} terms where the GPU was given
                    millions of cashflows, and at that size one core is quicker than a
                    device can be started. The GPU keeps the trade-level work that a
                    blotter and per-trade risk ask for.
                  </p>
                )}
              </div>
            );
          })()}

        </div>
      )}
    </div>
  );
}
