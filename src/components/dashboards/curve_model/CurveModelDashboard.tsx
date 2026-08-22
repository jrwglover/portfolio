import { useEffect, useState, useMemo } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import DashboardHeader from '../DashboardHeader';
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
  fx_spot?: number; short_end_step?: boolean; futures_convexity_sigma?: number;
  meeting_dates?: string[]; quotes: Quote[];
}
interface Inputs { date: string; fixings?: unknown[]; curves: MarketCurve[] }

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
interface TradesFile { date: string; bump_bps: number; trades: Trade[] }

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
interface NpvScaling { points: NpvPt[]; crossoverBelow: NpvPt | null; crossoverAbove: NpvPt | null; topFlatVsQuantLib: number | null; topGpuVsFlat: number; topGpuVsMt: number; mtCrossoverBelow: NpvPt | null; mtCrossoverAbove: NpvPt | null; threads: number | null; nvlinkGBs: number; topNvlinkVsMt: number | null; singleThreaded: boolean }
interface Agree { scope: string; comparison: string; value: string }
interface Scaling { buckets: number; points: ScalePt[]; crossoverBelow: ScalePt | null; crossoverAbove: ScalePt | null; mtCrossoverBelow: ScalePt | null; mtCrossoverAbove: ScalePt | null; topGpuVsFlat: number | null; topGpuVsMt: number | null; threads: number | null }
interface PerfPattern { id: string; name: string; workload: string; note: string; lanes: PerfLane[]; baseline: string }
interface PerfFile { date: string; patterns: PerfPattern[]; accuracy: { metric: string; value: string; note: string }[]; scaling?: Record<string, Scaling>; npvScaling?: NpvScaling; agreement?: Agree[] }

const CCY_SYM: Record<string, string> = { EUR: '€', USD: '$', GBP: '£' };
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
};
const CURVE_LABELS: Record<string, string> = {
  ESTR: 'ESTR (tenor OIS)', ESTR_ECB: 'ESTR ECB meeting-dated',
  ESTR_IMM: 'ESTR IMM-only', ESTR_IMMFUT: 'ESTR IMM + futures',
  EURIBOR6M: 'EURIBOR 6M (dual-curve)', EURUSD: 'EUR under USD collateral (xccy)',
  SOFR: 'SOFR', SONIA: 'SONIA',
};
const INSTR_BADGE: Record<string, string> = {
  OIS: '#5eaab5', IMM_OIS: '#5cb87a', MTG_OIS: '#e07850', FUTURE: '#b8b04a',
  DEPOSIT: '#8b8a97', FRA: '#8b8a97', IMM_FRA: '#5cb87a', IRS: '#8b7ec8',
  FXSWAP: '#4a9a68', XCCY: '#d4a853', SPOT: '#c9a227',
};

const chartGrid = '#1a1a28';
const chartAxis = '#55546a';
const tt = {
  contentStyle: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 6, fontSize: 12 },
  labelStyle: { color: '#8b8a97' },
};

/* ── Par rates implied by a bootstrapped curve ──────────────────────────────
   The exported zero rates are continuously compounded, so DF(t) = exp(-z t).
   For a single-curve (OIS) trade the same curve projects and discounts:
       S(T) = (1 - DF(T)) / Σ DF(t_i)                      annual fixed leg
   EURIBOR 6M is dual-curve, so its float leg is projected off EURIBOR and
   every cashflow discounted on ESTR:
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

/* Instantaneous forward, read straight off the exported column. A period
   forward averages over its tenor, which smooths clean across the meeting-dated
   and IMM plateaus - a 3M average over ~6-week ECB steps erases them entirely -
   so the step construction is only visible here.

   Interpolated, rather than held piecewise constant. Holding it constant keeps genuine
   risers sharp but snaps every sample to the left data point, and past 3Y the
   export thins from daily to 15-day spacing - sparser than the chart grid - so
   a smooth spline quantises into ledges that look exactly like step
   interpolation where there is none. The step region is daily, so a riser spans
   well under a pixel even interpolated; the artifact is the only thing that
   changes. */
function instAt(pts: Pt[], t: number): number {
  if (!pts.length) return 0;
  if (t <= pts[0][0]) return pts[0][1];
  let lo = 0, hi = pts.length - 1;
  if (t >= pts[hi][0]) return pts[hi][1];
  while (lo < hi - 1) { const m = (lo + hi) >> 1; if (pts[m][0] <= t) lo = m; else hi = m; }
  const [t0, f0] = pts[lo], [t1, f1] = pts[hi];
  return t1 === t0 ? f0 : f0 + (f1 - f0) * (t - t0) / (t1 - t0);
}



export default function CurveModelDashboard({ defaultTab, breadcrumb }: { defaultTab?: string; breadcrumb?: string[] }) {
  const [tab, setTab] = useState<Tab>((defaultTab as Tab) ?? 'inputs');
  const [inputs, setInputs] = useState<Inputs | null>(null);
  const [curves, setCurves] = useState<Record<string, Pt[]>>({});
  const [selCurve, setSelCurve] = useState('EUR_ESTR_ECB');
  const [shown, setShown] = useState<string[]>(['ESTR', 'ESTR_ECB', 'EURIBOR6M', 'EURUSD']);
  const [domain, setDomain] = useState<'fwd' | 'inst' | 'zero' | 'df' | 'fx'>('fwd');
  const [measure, setMeasure] = useState<'market' | 'zero' | 'forward'>('market');
  const [fwdTenor, setFwdTenor] = useState(0.25);
  const [tMax, setTMax] = useState(30);
  const [trades, setTrades] = useState<TradesFile | null>(null);
  const [selTradeId, setSelTradeId] = useState('aged-euribor');
  const [tradeCurve, setTradeCurve] = useState<string | null>(null);
  const [fxInstr, setFxInstr] = useState('5Y_FX_FWD');
  const [perf, setPerf] = useState<PerfFile | null>(null);
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

  const selMkt = inputs?.curves.find(c => c.curve === selCurve);
  const curveKeys = Object.keys(CURVE_LABELS).filter(k => curves[k]);

  // One chart, four domains. Discrete forwards are period rates off the same
  // discount curve, so they show what a FRA or future pays; the instantaneous
  // forward is the curve's own local rate, which is where the meeting-dated and
  // IMM step construction is actually visible.
  const fxSpot = inputs?.curves.find(c => c.index === 'EURUSD')?.fx_spot;

  const curveChart = useMemo(() => {
    const keys = domain === 'fx' ? ['EURUSD'] : shown.filter(k => curves[k]?.length);
    if (!keys.length) return [];
    // A period forward at t needs data out to t + tenor. Past the last
    // exported point the zero clamps flat, which fabricates a rising forward
    // at the right edge, so stop the series before that happens.
    const lastT = Math.min(...keys.map(k => curves[k][curves[k].length - 1][0]));
    const end = Math.min(tMax, domain === 'fwd' ? lastT - fwdTenor : lastT);
    const step = tMax <= 2.5 ? 1 / 52 : tMax <= 10 ? 1 / 12 : 1 / 4;
    const grid: number[] = [];
    // The step region ends by ~2Y and its plateaus are as short as six weeks,
    // so on the 30Y grid (quarterly) a 14-step ECB curve gets 8 samples and
    // aliases into a jagged line rather than a staircase. Sample that window
    // weekly at EVERY zoom and use the normal spacing beyond it, so the
    // construction reads correctly whichever range is selected.
    if (domain === 'inst') {
      const fineEnd = Math.min(end, 2.5), fineStep = 1 / 104;
      for (let t = fineStep; t <= fineEnd + 1e-9; t += fineStep) grid.push(+t.toFixed(6));
      for (let t = fineEnd + step; t <= end + 1e-9; t += step) grid.push(+t.toFixed(6));
    } else {
      for (let t = step; t <= end + 1e-9; t += step) grid.push(+t.toFixed(6));
    }
    // EUR/USD outright forward. Covered interest parity on the two curves the
    // engine already solved: F(T) = S * DF_EUR(T) / DF_USD(T), where DF_EUR is
    // the EUR curve under USD collateral and DF_USD is SOFR. This is the object
    // the FX swap points and xccy basis actually quote - the implied zero curve
    // shown in the other domains is derived FROM it - so it is worth showing
    // directly. Rebuilt this way it reprices the quoted points to under a pip.
    if (domain === 'fx') {
      const eur = curves['EURUSD'], usd = curves['SOFR'];
      if (!eur?.length || !usd?.length || !fxSpot) return [];
      // Anchor the series at spot. Every point on this curve is spot times a
      // ratio of discount factors, so spot is where it comes from, not just
      // where it happens to start: at t = 0 both discount factors are 1 and the
      // forward IS spot. Beginning the line at the first grid point instead
      // hides that, and hides how much of the curve is carry rather than level.
      return [{ t: 0, EURUSD: fxSpot }].concat(
        grid.map(t => ({ t, EURUSD: fxSpot * (dfAt(eur, t) / dfAt(usd, t)) })));
    }
    return grid.map(t => {
      const row: Record<string, number> = { t };
      for (const k of keys) {
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
  }, [curves, shown, domain, tMax, fwdTenor, fxSpot]);

  const selTrade = trades?.trades.find(t => t.id === selTradeId) ?? null;

  // Three risk views of the same trade. Market bumps a QUOTE and re-runs the
  // bootstrap; zero and forward bump the CURVE directly. They answer different
  // questions and are not rescalings of each other, so they get a toggle rather
  // than being blended.
  const curveLadders = selTrade?.curveLadders;
  const measureAvailable = curveLadders ? Object.keys(curveLadders) : [];
  const activeMeasure = measure !== 'market' && measureAvailable.includes(measure)
    ? measure : 'market';

  const ladderSource = activeMeasure === 'market'
    ? (selTrade?.ladders ?? {})
    : (curveLadders?.[activeMeasure] ?? {});
  const tradeCurveKeys = Object.keys(ladderSource);
  const activeCurve = tradeCurve && tradeCurveKeys.includes(tradeCurve) ? tradeCurve : tradeCurveKeys[0];

  const ladderChart = useMemo(() => {
    if (!activeCurve) return [];
    const rows = ladderSource[activeCurve] ?? [];
    return (rows as (LadderRow | CurveLadderRow)[]).map(r => ({
      tenor: r.tenor,
      instrument: 'instrument' in r ? r.instrument : (r as CurveLadderRow).role,
      cpu: +r.cpu.toFixed(2),
      gpu: r.gpu == null ? undefined : +r.gpu.toFixed(2),
    }));
  }, [ladderSource, activeCurve]);

  // Curve-node ladders always carry both lanes; the market ladder only does
  // where the engine ran a GPU pillar pass.
  // The market view's GPU column is hidden. Both lanes bump the same quote and
  // re-bootstrap, so they should agree, and they do not: risk shifts between
  // neighbouring pillars on the aged trade while the total is preserved. That
  // is an unexplained difference between two ways of rebuilding the curve, not
  // a modelling choice, so it should not be shown as though it were a result.
  // The zero and forward views keep both lanes, where they agree to 1e-15.
  const showGpu = activeMeasure !== 'market';

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
    <div className="max-w-6xl mx-auto px-6 py-10">
      <DashboardHeader
        label={(breadcrumb ?? ['Rates']).join(' / ')}
        title="Curve Market Data Model"
        subtitle="From raw quotes to bootstrapped curves: 8 curves, 10 instrument types, each solved in the domain its instruments pin"
        techBadges={['C++', 'QuantLib', 'CUDA', 'GlobalBootstrap']}
      />

      <div className="flex gap-2 mb-8 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="font-mono text-xs px-4 py-2 rounded transition-colors"
            style={chip(tab === t.key, '#5b8fc9')}>{t.label}</button>
        ))}
      </div>

      {tab === 'inputs' && inputs && (
        <div>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            {inputs.curves.length} curves · every instrument
            below is a bootstrap constraint and a PV01 risk bucket. Labels: IMM = 3rd
            Wednesday futures dates, MTG = ECB policy effective dates.
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
                {selMkt.short_end_step && <span style={{ color: '#e07850' }}>step-forward short end</span>}
                {selMkt.futures_convexity_sigma && <span>futures σ {(selMkt.futures_convexity_sigma * 100).toFixed(1)}%</span>}
                {selMkt.meeting_dates && <span>{selMkt.meeting_dates.length} ECB effective dates</span>}
              </div>
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
                                : ((q.rate ?? 0) * 100).toFixed(4) + '%'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'curves' && (
        <div>
          <p className="text-sm mb-4 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
            Every curve, in whichever domain answers the question. Discrete forwards are the
            {' '}{fwdTenor === 0.25 ? '3M' : '6M'} rate a FRA or future actually pays, so they average out the
            interpolation and are directly comparable to the quotes on the Market Data Model
            tab. Zero rates discount cashflows; discount factors are the raw solved quantity.
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
            {([['fwd', 'discrete forwards'], ['inst', 'instantaneous forward'], ['zero', 'zero rates'], ['df', 'discount factors'], ['fx', 'EUR/USD forwards']] as const)
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
                  domain === 'fx' ? 'EUR/USD outright' : CURVE_LABELS[n] ?? n]}
                labelFormatter={l => `t = ${Number(l).toFixed(2)}Y`} />
              <Legend formatter={(v: string) => <span style={{ fontSize: 11 }}>{CURVE_LABELS[v] ?? v}</span>} />
              {(domain === 'fx' ? ['EURUSD'] : shown).map(k => (
                <Line key={k} dataKey={k} stroke={CURVE_COLORS[k]} dot={false} strokeWidth={1.8} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>

          <p className="text-xs mt-3 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
            Each curve is solved in the domain its instruments pin: the OIS strips on zero
            rates, the meeting-dated and IMM curves as flat forwards between policy or IMM
            dates joined to a min-curvature spline, and the EUR/USD curve as an implied zero
            curve against USD collateral. Every curve uses the same interpolation: a
            minimum-curvature cubic spline on LOG DISCOUNT FACTORS. Pick the instantaneous forward at 2.5Y with the ESTR
            variants selected to see the step construction directly: flat between ECB
            meetings out to 1.5Y, flat between IMM dates out to 2Y, then the spline. A
            discrete forward averages over its own tenor, so a 3M rate smooths straight
            across six-week meeting steps and hides them.
          </p>
          <p className="text-xs mt-2 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
            The domain matters more than the scheme. Interpolating zero rates makes the
            ZERO curve smooth but leaves the forward free to ring: f = z + t z', so a
            cubic's third derivative jumps at every knot and the jump is multiplied by t -
            17 to 18 times amplification by the long end, worst where pillar spacing
            changes. Interpolating log discount factors instead makes the forward the
            spline's own first derivative, so it is a quadratic spline: continuous in
            value and slope, with no maturity amplification. Same class, same pillars,
            same quotes - only the interpolated quantity changes.
          </p>
          <p className="text-xs mt-2 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
            EURIBOR is solved on discrete 6M forwards, one per instrument date. A FRA pins the
            average of the instantaneous forward over its accrual window, never the forward at a
            point, so the curve is built as the smoothest instantaneous forward satisfying every
            one of those window averages: minimum curvature under interval-average constraints
            rather than point constraints. That is the min-curvature objective under the
            Hagan-West constraint, which is what makes the 6M forwards exact and the curve smooth
            at the same time.
          </p>
        </div>
      )}

      {tab === 'sensis' && trades && (
        <div>
          <p className="text-sm mb-4 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
            Market-quote PV01 per trade: every input instrument bumped {trades.bump_bps}bp,
            the curve family re-bootstrapped, the trade repriced. One example trade per
            curve in the framework. Pick a trade to see where its risk lands.
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
              <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{selTrade.detail}</p>
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
              {measureAvailable.length > 0 && (
                <div className="flex gap-2 mb-3 font-mono text-[11px] flex-wrap items-center">
                  <span className="text-[10px] uppercase mr-1" style={{ color: 'var(--text-dim)' }}>risk measure</span>
                  {([['market', 'market quote'], ['zero', 'zero bucket'], ['forward', 'forward bucket']] as const)
                    .filter(([k]) => k === 'market' || measureAvailable.includes(k))
                    .map(([k, label]) => (
                      <button key={k} onClick={() => { setMeasure(k); setTradeCurve(null); }}
                        className="px-2.5 py-1 rounded"
                        style={chip(activeMeasure === k, '#b07fc9')}>
                        {label}
                      </button>
                    ))}
                </div>
              )}
              <div className="flex gap-2 mb-3 font-mono text-[11px] flex-wrap">
                {tradeCurveKeys.map(k => (
                  <button key={k} onClick={() => setTradeCurve(k)} className="px-2.5 py-1 rounded"
                    style={chip(activeCurve === k, CURVE_COLORS[k] ?? '#5b8fc9')}>
                    {CURVE_LABELS[k] ?? k}
                  </button>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={ladderChart}>
                  <CartesianGrid stroke={chartGrid} />
                  <XAxis dataKey="tenor" stroke={chartAxis} tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={50} />
                  <YAxis stroke={chartAxis} tick={{ fontSize: 11 }} width={64}
                    tickFormatter={v => Number(v).toLocaleString()} />
                  <Tooltip {...tt} formatter={(v: any, n: any) =>
                    [Number(v).toLocaleString(),
                      n === 'cpu' ? 'Processor' : 'Graphics card']}
                    labelFormatter={(l: any) => {
                      const row = ladderChart.find(r => r.tenor === l);
                      return `${l}${row ? ` · ${row.instrument}` : ''}`;
                    }} />
                  {showGpu && <Legend formatter={(v: string) =>
                    <span style={{ fontSize: 11 }}>
                      {v === 'cpu' ? 'Processor' : 'Graphics card'}</span>} />}
                  <ReferenceLine y={0} stroke={chartAxis} />
                  <Bar dataKey="cpu" fill="#5b8fc9" isAnimationActive={false} />
                  {showGpu && <Bar dataKey="gpu" fill="#d4a853" isAnimationActive={false} />}
                </BarChart>
              </ResponsiveContainer>
              {showGpu && ladderChart.length > 0 && (() => {
                // Bucket differences on the market view can look alarming when
                // the two lanes are really redistributing the same total between
                // neighbouring pillars. Showing both sums makes that visible
                // rather than leaving it to the caption.
                const cs = ladderChart.reduce((a, r) => a + (r.cpu ?? 0), 0);
                const gs = ladderChart.reduce((a, r) => a + (r.gpu ?? 0), 0);
                const rel = Math.abs(cs) > 1e-9 ? Math.abs(cs - gs) / Math.abs(cs) : 0;
                return (
                  <div className="font-mono text-[11px] mt-2 flex gap-4 flex-wrap"
                    style={{ color: 'var(--text-dim)' }}>
                    <span>ladder total, CPU {cs.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    <span>GPU {gs.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    <span style={{ color: rel < 0.01 ? 'var(--accent-green)' : 'var(--text-dim)' }}>
                      {rel < 1e-6 ? 'identical' : 'differ by ' + (rel * 100).toFixed(2) + '%'}
                    </span>
                  </div>
                );
              })()}
              <p className="text-xs mt-3 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
                {activeMeasure === 'market'
                  ? (selTrade.hasGpu
                    ? 'Two different definitions of the same risk, so they are not expected to match bucket by bucket. The CPU bumps the market quote and re-runs the bootstrap, so the shock spreads through the spline into neighbouring pillars; the GPU bumps the pillar directly and keeps it local. The totals reconcile, and the gap between them is the risk the re-bootstrap moves between buckets. The machine-precision agreement quoted on the performance tab applies to the zero and forward views below, where both lanes price the same perturbed curve.'
                    : 'Each bar is one market quote bumped and the curve rebuilt; the buckets are the instruments the desk hedges with.')
                  : activeMeasure === 'zero'
                    ? 'Each bar bumps one zero-curve node by 1bp through a tent that falls to zero at its neighbours, with no bootstrap in the loop. Both lanes price the identical perturbed curve, so any gap between them is a pricing difference and never a curve difference.'
                    : 'Each bar bumps the instantaneous forward by 1bp across one bucket and leaves the rest of the curve untouched. No solver runs, so every bucket is independent and the whole ladder prices in a single GPU launch.'}
                {activeCurve === 'ESTR_ECB' && ' MTG pillars are ECB policy effective dates: the ladder is per central bank meeting.'}
                {(activeCurve === 'ESTR_IMM' || activeCurve === 'ESTR_IMMFUT') && ' IMM pillars are quarterly futures dates.'}
                {activeCurve === 'ESTR_IMMFUT' && ' FUT buckets are convexity-adjusted futures contracts.'}
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
              <p className="text-xs mt-3 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
                The risk localizes: a 5Y forward&apos;s exposure sits at the 5Y basis
                pillar and a 10Y forward&apos;s at 10Y, the sanity check that the
                FX/xccy bootstrap keys each instrument to the right part of the curve.
              </p>
            </div>
          )}

          {selTrade && selTrade.cashflows.length > 0 && (
            <div className="mt-10">
              <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                Cashflow schedule
              </h3>
              <p className="text-xs mb-4 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
                Every remaining cashflow priced off the same curves as the ladder above:
                accrual period, projected rate, amount, discount factor and present value.
                Struck at fair so the two legs offset, leaving a residual NPV that is the
                rounding of the quoted rate, not a mispricing.
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
                <p className="text-xs mt-3 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
                  The first floating coupon accrues from before today: its rate is the
                  historical EURIBOR 6M fixing, not a projected forward. That is the
                  in-flight coupon that makes a seasoned trade different from a spot-start one.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'arch' && <ArchitecturePanel />}

      {tab === 'perf' && perf && (
        <div>
          <p className="text-sm mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
            Valuing a book of swaps means working out what every future cashflow is
            worth today. Each one needs a discount factor read off a curve, and a
            few hundred thousand trades comes to tens of millions of those reads.
          </p>
          <p className="text-xs mb-4 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
            Speed matters because of what it lets a desk do rather than for its own
            sake. A revaluation that takes twenty minutes runs overnight and once
            more at midday if someone asks. The same one at twenty seconds can run
            whenever the market moves, which is the difference between marks that
            describe this morning and marks that describe now. It also decides how
            many scenarios are affordable: a full curve risk ladder is the book
            repriced against every bucket of every curve, so a book that takes a
            minute to value takes half an hour to risk, and a stress run across a
            dozen shocks stops being something you do before lunch.
          </p>
          <p className="text-xs mb-4 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
            A processor and a graphics card are good at different things. A processor
            has a few dozen fast cores and the data already sits in its memory. A
            graphics card has thousands of slower cores, but the data has to be
            copied across to it first, and on this machine that copy takes longer
            than the calculation does. So the graphics card tends to win when there
            is a lot of arithmetic per byte copied, and lose when there is not.
            Everything here is from this one machine, so it is a guide rather than
            a general rule.
          </p>
          <p className="text-xs mb-4 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
            Most of the gain comes from two changes. Cashflows are held as plain
            arrays and priced directly, without going through QuantLib for each
            value. And the discount factors are worked out once when the curve is
            built, then read back, rather than recalculated for every cashflow.
            Curves only move when the market does, so the same values were being
            recomputed many times over. Storing them daily loses no accuracy,
            since cashflows fall on whole days.
          </p>

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
              <div className="mb-10">
                <div className="grid md:grid-cols-3 gap-3">
                  {cell('1. Leave the object model',
                        ns.topFlatVsQuantLib + '\u00d7',
                        'same arithmetic, same curve, one core, no special hardware',
                        true)}
                  {cell('2. Use every core',
                        threadX ? threadX + '\u00d7 more' : 'n/a',
                        (ns.threads ?? 16) + ' cores on the same pricer. Memory bound, so it scales less than linearly.',
                        true)}
                  {cell('3. Add a GPU',
                        'it depends',
                        (gpuRisk ?? '?') + '\u00d7 on bucketed risk, and ' +
                        (gpuNpv && gpuNpv < 1 ? (1 / gpuNpv).toFixed(1) + '\u00d7 slower' : 'slower') +
                        ' on portfolio NPV, against those same cores',
                        false)}
                </div>
                <p className="text-xs mt-3 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
                  The first two are code changes and they hold anywhere. The third is a
                  hardware question with no fixed answer: the same card earns its place on
                  one of these jobs and not the other, and changing the link it sits behind
                  flips one of those.
          </p>
          <p className="text-xs mt-3 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
            The split comes from how much arithmetic each byte buys. Bucketed risk
                  sends the book across once and reprices it against {risk.buckets}{' '}
                  perturbed curves, so one crossing pays for {risk.buckets} passes and the
                  card wins even here. Portfolio NPV reads each cashflow once, so it spends
                  most of its time moving {(nTop.cashflows / 1e6).toFixed(1)}M cashflows
                  rather than pricing them. The arithmetic was never the constraint: the
                  card does the pricing in a fraction of the time it spends waiting for the
                  data to arrive. Put it on a link where the book arrives quickly and the
                  NPV result reverses, which is the NVLink line on the second chart.
                </p>
                <p className="text-xs mt-2 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
                  Market-quote risk is a fourth case and none of it helps. Every bumped
                  quote needs the curve rebuilt, the solver runs on the processor, and the
                  repricing beside it is a rounding error. Shown below unaccelerated,
                  because that is what it is.
                </p>
              </div>
            );
          })()}

          {perf.patterns.map(p => {
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
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{p.name}</h3>
                <p className="text-xs mb-1 max-w-3xl" style={{ color: 'var(--text-dim)' }}>{p.note}</p>
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

          {perf.scaling && Object.entries(perf.scaling).map(([mode, sc]) => {
            // A log axis cannot resolve 'dataMin' once any series carries nulls,
            // and QuantLib is capped part way up this sweep, so the bounds are
            // computed here over real values only. Left to recharts the whole
            // chart renders blank rather than just dropping the short series.
            const rv = sc.points.flatMap(q => [q.cpu, q.flat, q.mt, q.gpu, q.nvlink]
              .filter((x): x is number => typeof x === 'number' && x > 0));
            const rLo = Math.pow(10, Math.floor(Math.log10(Math.min(...rv))));
            const rHi = Math.pow(10, Math.ceil(Math.log10(Math.max(...rv))));
            const lo = sc.crossoverBelow, hi = sc.crossoverAbove;
            return (
              <div key={mode} className="mb-10">
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  Curve risk: how the cost grows with the size of the book
                </h3>
                <p className="text-xs mb-1 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
                  The same {sc.buckets} {mode} buckets repriced across books of growing size.
                  Two CPU lines, and the gap between them is the point: QuantLib revalues
                  through its object model, while the flattened lane prices the same
                  cashflows from the same spline coefficients the device uses, on one core.
                  Measuring a GPU against the first mostly measures the object model. The
                  GPU pays a fixed per-bucket upload whatever the book size, so it starts
                  behind and overtakes as the book grows: past one core early, and past the
                  same pricer on all {sc.threads ?? 16} cores at
                  {sc.mtCrossoverAbove ? sc.mtCrossoverAbove.trades.toLocaleString() + ' trades'
                    : ' no size measured'}. The thread pool is the comparison that matters,
                  since the alternative to a device is usually the cores already
                  available. The sweep runs to book scale for that reason rather than
                  stopping at a few thousand trades. All lanes are given the same
                  pre-flattened book, so none is charged for a step the others get free.
                  Timings are the best of three after a warm-up.
                </p>
                <p className="font-mono text-[11px] mb-3" style={{ color: 'var(--text-dim)' }}>
                  {sc.buckets} buckets &times; 1 to {sc.points[sc.points.length - 1].trades} EURIBOR swaps,
                  up to {sc.points[sc.points.length - 1].repricings.toLocaleString()} repricings
                  &middot; lower is faster, so QuantLib is the slowest lane throughout
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
                      label={{ value: 'wall clock, lower is faster', angle: -90,
                               position: 'insideLeft', offset: 4,
                               style: { fill: 'var(--text-dim)', fontSize: 11, textAnchor: 'middle' } }} />
                    <Tooltip {...tt}
                      labelFormatter={(v: any) => Number(v).toLocaleString() + ' trades'}
                      formatter={(v: any, n: any) => [fmtMs(Number(v)),
                        n === 'cpu' ? 'QuantLib' : n === 'flat' ? 'Flattened CPU, 1 core'
                          : n === 'mt' ? 'Flattened CPU, all cores'
                          : n === 'gpu' ? 'GPU total'
                          : 'Graphics card on NVLink-C2C (projected)']} />
                    <Legend formatter={(v: string) => <span style={{ fontSize: 11 }}>
                      {v === 'cpu' ? 'QuantLib' : v === 'flat' ? 'Flattened CPU, 1 core'
                        : v === 'mt' ? 'Flattened CPU, all cores'
                        : v === 'gpu' ? 'GPU total'
                        : 'Graphics card on NVLink-C2C (projected)'}</span>} />
                    {lo && hi && (
                      <ReferenceArea x1={lo.trades} x2={hi.trades} fill="#d4a853" fillOpacity={0.10}
                        label={{ value: 'crossover', position: 'insideTop',
                                 style: { fill: 'var(--text-dim)', fontSize: 10 } }} />
                    )}
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
                <div className="grid md:grid-cols-3 gap-3 mt-3">
                  <div className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>Crossover vs 1 core</div>
                    <div className="font-mono text-sm" style={{ color: 'var(--accent-green)' }}>
                      {lo && hi ? lo.trades + ' to ' + hi.trades + ' trades' : 'not reached'}
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>
                      {lo && hi ? 'between ' + lo.repricings.toLocaleString() + ' and ' +
                        hi.repricings.toLocaleString() + ' repricings, bracketed by measured sizes rather than interpolated'
                        : 'the GPU did not overtake at any size measured'}
                    </div>
                  </div>
                  <div className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>Crossover vs {sc.threads ?? 16} cores</div>
                    <div className="font-mono text-sm" style={{ color: 'var(--accent-green)' }}>
                      {sc.mtCrossoverAbove ? sc.mtCrossoverAbove.trades.toLocaleString() + ' trades' : 'not reached'}
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>
                      below this, the cores already available are quicker
                    </div>
                  </div>
                  <div className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>At the largest book, over {sc.threads ?? 16} cores</div>
                    <div className="font-mono text-sm" style={{ color: 'var(--accent-green)' }}>
                      {sc.topGpuVsFlat ? sc.topGpuVsFlat + '\u00d7' : 'n/a'}
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>
                      over the flattened pricer on the same cores, at the largest book
                      measured
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {perf.npvScaling && (() => {
            const ns = perf.npvScaling;
            const lo = ns.crossoverBelow, hi = ns.crossoverAbove;
            const nv = ns.points.flatMap(q => [q.quantlib, q.flat, q.mt, q.gpu, q.nvlink]
              .filter((x): x is number => typeof x === 'number' && x > 0));
            const nLo = Math.pow(10, Math.floor(Math.log10(Math.min(...nv))));
            const nHi = Math.pow(10, Math.ceil(Math.log10(Math.max(...nv))));
            const top = ns.points[ns.points.length - 1];
            return (
              <div className="mb-10">
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  Valuing the whole book: how the cost grows with its size
                </h3>
                <p className="text-xs mb-1 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
                  A whole book priced once, across books of growing size, with all four
                  lanes in one process on one machine. Most of the distance is covered
                  before the GPU is reached: flattening the book out of QuantLib&apos;s object
                  model is worth {ns.topFlatVsQuantLib ?? 0}&times; on a single core, and the
                  device adds {ns.topGpuVsFlat}&times; on top of that. Quoting the GPU
                  against QuantLib alone would fold the first number into the second.
                </p>
                <p className="text-xs mb-1 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
                  The QuantLib line here is full object revaluation, one priced swap at a
                  time. It is a different and slower baseline than the one in the repricing
                  pattern above, which is already a flat loop and keeps QuantLib only for
                  the curve lookup. The two are not interchangeable and the gap between
                  them is most of what that pattern&apos;s multiple is measuring.
                </p>
                <p className="font-mono text-[11px] mb-3" style={{ color: 'var(--text-dim)' }}>
                  1 to {top.trades.toLocaleString()} swaps, up to {top.cashflows.toLocaleString()} cashflows
                  &middot; lower is faster, so QuantLib is the slowest lane throughout
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
                      label={{ value: 'wall clock, lower is faster', angle: -90,
                               position: 'insideLeft', offset: 4,
                               style: { fill: 'var(--text-dim)', fontSize: 11, textAnchor: 'middle' } }} />
                    <Tooltip {...tt}
                      labelFormatter={(v: any) => Number(v).toLocaleString() + ' swaps'}
                      formatter={(v: any, n: any) => [fmtMs(Number(v)),
                        n === 'quantlib' ? 'QuantLib' : n === 'flat' ? 'Flattened CPU, 1 core'
                          : n === 'mt' ? 'Flattened CPU, all cores'
                          : n === 'gpu' ? 'GPU total'
                          : 'Graphics card on NVLink-C2C (projected)']} />
                    <Legend formatter={(v: string) => <span style={{ fontSize: 11 }}>
                      {v === 'quantlib' ? 'QuantLib' : v === 'flat' ? 'Flattened CPU, 1 core'
                        : v === 'mt' ? 'Flattened CPU, all cores'
                        : v === 'gpu' ? 'GPU total'
                        : 'Graphics card on NVLink-C2C (projected)'}</span>} />
                    {lo && hi && (
                      <ReferenceArea x1={lo.trades} x2={hi.trades} fill="#d4a853" fillOpacity={0.10}
                        label={{ value: 'crossover', position: 'insideTop',
                                 style: { fill: 'var(--text-dim)', fontSize: 10 } }} />
                    )}
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
                <div className="grid md:grid-cols-3 gap-3 mt-3">
                  <div className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>Leaving the object model</div>
                    <div className="font-mono text-sm" style={{ color: 'var(--accent-green)' }}>{ns.topFlatVsQuantLib ?? 0}&times;</div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>
                      same arithmetic, same curve, one CPU core, no device
                    </div>
                  </div>
                  <div className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>Then the GPU</div>
                    <div className="font-mono text-sm" style={{ color: 'var(--accent-green)' }}>{ns.topGpuVsFlat}&times;</div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>
                      over the flattened CPU at the largest book
                    </div>
                  </div>
                  <div className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>Crossover</div>
                    <div className="font-mono text-sm" style={{ color: 'var(--accent-green)' }}>
                      {lo && hi ? lo.trades.toLocaleString() + ' to ' + hi.trades.toLocaleString() + ' swaps' : 'not reached'}
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>
                      against the flattened CPU, not against QuantLib
                    </div>
                  </div>
                </div>
                {ns.singleThreaded && (
                  <>
                  <p className="text-xs mt-3 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
                    The dotted pink line is the only projection on this page. Every
                    GPU figure here includes copying the book across PCIe, which on this
                    machine runs at about 7.5 GB/s and accounts for most of the GPU&apos;s
                    time. Banks generally do not run pricing over a consumer PCIe link, so
                    that line rescales the copy to {ns.nvlinkGBs} GB/s, the NVLink-C2C
                    bandwidth on an NVIDIA Grace Hopper part, and keeps the kernel time
                    exactly as measured. On that basis the device would come out about{' '}
                    {ns.topNvlinkVsMt}&times; ahead of all {ns.threads ?? 16} cores rather
                    than behind them. It is a bandwidth rescale rather than a run on real
                    hardware: a Grace Hopper would also run the kernel faster, which makes
                    it conservative, while real NVLink will not sustain its headline figure
                    and this assumes the copy and the kernel do not overlap.
                  </p>
                  <p className="text-xs mt-2 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
                    The green line is the same flattened pricer across all
                    {ns.threads ?? 16} cores, which is the comparison worth making before
                    choosing a device over the cores you already own. Against one core the
                    GPU wins {ns.topGpuVsFlat}&times; here; against the thread pool it is
                    {ns.topGpuVsMt}&times;. The order of magnitude to the left of both,
                    leaving the object model, is larger than either and needs no hardware.
                  </p>
                  </>
                )}
              </div>
            );
          })()}

          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Do the faster methods give the same answer
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
              <h3 className="text-sm font-semibold mb-1 mt-8" style={{ color: 'var(--text-primary)' }}>
                Checking each method against QuantLib
              </h3>
              <p className="text-xs mb-3 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
                Every lane above is checked against QuantLib per instrument, at every book
                size. A faster lane is only worth reporting if it computes the same number,
                and a kernel that indexes the wrong scenario still returns plausible
                figures. Differences are quoted against notional rather than NPV, because a
                swap struck near par has an NPV close to zero and dividing by it makes a
                negligible difference look large.
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
        </div>
      )}
    </div>
  );
}
