import { useEffect, useState, useMemo } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import DashboardHeader from '../DashboardHeader';
import ArchitecturePanel from './ArchitecturePanel';

/* ── Types ── */
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
interface FxRow { instrument: string; maturity: string; bumpType: string; pillar: string; baseQuote: number; pv01: number }
interface Cashflow {
  leg: 'fixed' | 'float'; start: string; end: string; pay: string;
  tau: number; rate: number; amount: number; df: number; pv: number;
}
interface Trade {
  id: string; label: string; product: string; notional: string; detail: string; ccy: string;
  curves: { key: string; role: string }[]; engine: string;
  ladders: Record<string, LadderRow[]>; hasGpu: boolean; fx?: FxRow[];
  fairRate: number | null; npv: number | null;
  fixedLegNpv?: number | null; floatLegNpv?: number | null;
  cashflows: Cashflow[];
}
interface TradesFile { date: string; bump_bps: number; trades: Trade[] }

interface PerfLane { lane: string; ms: number; kind: 'cpu' | 'gpu' }
interface ScalePt { trades: number; repricings: number; cpu: number; flat: number; gpu: number; upload: number; kernel: number }
interface NpvPt { trades: number; cashflows: number; quantlib: number; flat: number; gpu: number; kernel: number }
interface NpvScaling { points: NpvPt[]; crossoverBelow: NpvPt | null; crossoverAbove: NpvPt | null; topFlatVsQuantLib: number; topGpuVsFlat: number; singleThreaded: boolean }
interface Agree { scope: string; comparison: string; value: string }
interface Scaling { buckets: number; points: ScalePt[]; crossoverBelow: ScalePt | null; crossoverAbove: ScalePt | null }
interface PerfPattern { id: string; name: string; workload: string; note: string; lanes: PerfLane[]; baseline: string }
interface PerfFile { date: string; patterns: PerfPattern[]; accuracy: { metric: string; value: string; note: string }[]; scaling?: Scaling; npvScaling?: NpvScaling; agreement?: Agree[] }

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

   Interpolated, NOT held piecewise constant. Holding it constant keeps genuine
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
    fetch(`${base}/inputs.json`).then(r => r.json()).then(setInputs).catch(() => {});
    fetch(`${base}/curves.json`).then(r => r.json()).then(setCurves).catch(() => {});
    fetch(`${base}/trades.json`).then(r => r.json()).then(setTrades).catch(() => {});
    fetch(`${base}/performance.json`).then(r => r.json()).then(setPerf).catch(() => {});
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
  const tradeCurveKeys = selTrade ? Object.keys(selTrade.ladders) : [];
  const activeCurve = tradeCurve && tradeCurveKeys.includes(tradeCurve) ? tradeCurve : tradeCurveKeys[0];

  const ladderChart = useMemo(() => {
    if (!selTrade || !activeCurve) return [];
    return (selTrade.ladders[activeCurve] ?? []).map(r => ({
      tenor: r.tenor, instrument: r.instrument,
      cpu: +r.cpu.toFixed(2), gpu: r.gpu == null ? undefined : +r.gpu.toFixed(2),
    }));
  }, [selTrade, activeCurve]);

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
                    [Number(v).toLocaleString(), n === 'cpu' ? 'CPU bump & re-bootstrap' : 'GPU pillar ladder']}
                    labelFormatter={(l: any) => {
                      const row = ladderChart.find(r => r.tenor === l);
                      return `${l}${row ? ` · ${row.instrument}` : ''}`;
                    }} />
                  {selTrade.hasGpu && <Legend formatter={(v: string) =>
                    <span style={{ fontSize: 11 }}>{v === 'cpu' ? 'CPU bump & re-bootstrap' : 'GPU pillar ladder'}</span>} />}
                  <ReferenceLine y={0} stroke={chartAxis} />
                  <Bar dataKey="cpu" fill="#5b8fc9" isAnimationActive={false} />
                  {selTrade.hasGpu && <Bar dataKey="gpu" fill="#d4a853" isAnimationActive={false} />}
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs mt-3 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
                {selTrade.hasGpu
                  ? 'Two independent ladders: the CPU one bumps the market quote and re-runs the global bootstrap, so the shock propagates through the spline; the GPU one bumps the pillar directly. Where they differ is what re-bootstrapping adds: risk leaking to neighbouring buckets through the interpolation.'
                  : 'Each bar is one market quote bumped and the curve rebuilt; the buckets are the instruments the desk hedges with.'}
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
            Where GPU acceleration actually pays, and where it does not, measured per
            workload on this machine. Bars are wall-clock milliseconds on a log scale and
            the multiple is against the CPU baseline for that pattern. Every figure here
            is read from the engine&apos;s own timing output rather than typed in.
          </p>

          {perf.patterns.map(p => {
            const base = p.lanes.find(l => l.lane === p.baseline)?.ms ?? 1;
            const data = p.lanes.map(l => ({ ...l, x: Math.max(l.ms, 0.001) }));
            // On a log axis recharts draws bars from domain[0], so the smallest
            // value would render zero-width. Anchor below the minimum and leave
            // headroom above the maximum.
            const vals = data.map(d => d.x);
            const lo = Math.pow(10, Math.floor(Math.log10(Math.min(...vals))) - 1);
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
                      formatter={(v: any) => [fmtMs(Number(v)), 'wall clock']} />
                    <Bar dataKey="x" isAnimationActive={false} radius={[0, 3, 3, 0]} barSize={22}>
                      {data.map((d, i) => (
                        <Cell key={i} fill={d.kind === 'gpu' ? '#d4a853' : '#5b8fc9'} />
                      ))}
                      <LabelList dataKey="x" position="right" formatter={(v: any) => fmtMs(Number(v))}
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

          {perf.scaling && (() => {
            const sc = perf.scaling;
            const lo = sc.crossoverBelow, hi = sc.crossoverAbove;
            return (
              <div className="mb-10">
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  Where the GPU starts paying: book size against wall clock
                </h3>
                <p className="text-xs mb-1 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
                  The same {sc.buckets} forward buckets repriced across books of growing size.
                  Two CPU lines, and the gap between them is the point: QuantLib revalues
                  through its object model, while the flattened lane prices the same
                  cashflows from the same spline coefficients the device uses, on one core.
                  Measuring a GPU against the first mostly measures the object model. The
                  GPU pays a fixed upload per bucket regardless of book size, and on this
                  workload it does not overtake the flattened CPU at any size measured.
                </p>
                <p className="font-mono text-[11px] mb-3" style={{ color: 'var(--text-dim)' }}>
                  {sc.buckets} buckets &times; 1 to {sc.points[sc.points.length - 1].trades} EURIBOR swaps,
                  up to {sc.points[sc.points.length - 1].repricings.toLocaleString()} repricings
                </p>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={sc.points} margin={{ left: 8, right: 24, top: 8, bottom: 20 }}>
                    <CartesianGrid stroke={chartGrid} />
                    <XAxis dataKey="trades" scale="log" type="number"
                      domain={['dataMin', 'dataMax']} stroke={chartAxis}
                      tick={{ fontSize: 10 }} tickFormatter={(v: any) => Number(v).toLocaleString()}
                      label={{ value: 'trades in book', position: 'insideBottom', offset: -12,
                               style: { fill: 'var(--text-dim)', fontSize: 11 } }} />
                    <YAxis scale="log" domain={['dataMin', 'dataMax']} allowDataOverflow
                      stroke={chartAxis} tick={{ fontSize: 10 }} width={64}
                      tickFormatter={fmtMs} />
                    <Tooltip {...tt}
                      labelFormatter={(v: any) => Number(v).toLocaleString() + ' trades'}
                      formatter={(v: any, n: any) => [fmtMs(Number(v)),
                        n === 'cpu' ? 'QuantLib' : n === 'flat' ? 'Flattened CPU, 1 core'
                          : n === 'gpu' ? 'GPU total' : 'GPU kernel only']} />
                    <Legend formatter={(v: string) => <span style={{ fontSize: 11 }}>
                      {v === 'cpu' ? 'QuantLib' : v === 'flat' ? 'Flattened CPU, 1 core'
                        : v === 'gpu' ? 'GPU total' : 'GPU kernel only'}</span>} />
                    {lo && hi && (
                      <ReferenceArea x1={lo.trades} x2={hi.trades} fill="#d4a853" fillOpacity={0.10}
                        label={{ value: 'crossover', position: 'insideTop',
                                 style: { fill: 'var(--text-dim)', fontSize: 10 } }} />
                    )}
                    <Line type="monotone" dataKey="cpu" stroke="#5b8fc9" strokeWidth={2}
                      dot={{ r: 2 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="flat" stroke="#b07fc9" strokeWidth={2}
                      dot={{ r: 2 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="gpu" stroke="#d4a853" strokeWidth={2}
                      dot={{ r: 2 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="kernel" stroke="#7fae7f" strokeWidth={1.5}
                      strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="grid md:grid-cols-3 gap-3 mt-3">
                  <div className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>Crossover</div>
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
                    <div className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>Below it</div>
                    <div className="font-mono text-sm" style={{ color: '#c86e6e' }}>CPU wins</div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>
                      the per-bucket curve upload is fixed in book size, so a small book
                      never spreads it far enough
                    </div>
                  </div>
                  <div className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>At the largest book</div>
                    <div className="font-mono text-sm" style={{ color: 'var(--accent-green)' }}>
                      {(sc.points[sc.points.length - 1].cpu / sc.points[sc.points.length - 1].gpu).toFixed(1)}&times;
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>
                      the dashed line is the kernel alone; the gap above it is flattening the
                      book on the host, which a live system does once and keeps
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {perf.npvScaling && (() => {
            const ns = perf.npvScaling;
            const lo = ns.crossoverBelow, hi = ns.crossoverAbove;
            const top = ns.points[ns.points.length - 1];
            return (
              <div className="mb-10">
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  Portfolio NPV: where the GPU starts paying
                </h3>
                <p className="text-xs mb-1 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
                  A whole book priced once, across books of growing size, with all four
                  lanes in one process on one machine. Most of the distance is covered
                  before the GPU is reached: flattening the book out of QuantLib&apos;s object
                  model is worth {ns.topFlatVsQuantLib}&times; on a single core, and the
                  device adds {ns.topGpuVsFlat}&times; on top of that. Quoting the GPU
                  against QuantLib alone would fold the first number into the second.
                </p>
                <p className="font-mono text-[11px] mb-3" style={{ color: 'var(--text-dim)' }}>
                  1 to {top.trades.toLocaleString()} swaps, up to {top.cashflows.toLocaleString()} cashflows
                </p>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={ns.points} margin={{ left: 8, right: 24, top: 8, bottom: 20 }}>
                    <CartesianGrid stroke={chartGrid} />
                    <XAxis dataKey="trades" scale="log" type="number"
                      domain={['dataMin', 'dataMax']} stroke={chartAxis}
                      tick={{ fontSize: 10 }} tickFormatter={(v: any) => Number(v).toLocaleString()}
                      label={{ value: 'swaps in book', position: 'insideBottom', offset: -12,
                               style: { fill: 'var(--text-dim)', fontSize: 11 } }} />
                    <YAxis scale="log" domain={['dataMin', 'dataMax']} allowDataOverflow
                      stroke={chartAxis} tick={{ fontSize: 10 }} width={64} tickFormatter={fmtMs} />
                    <Tooltip {...tt}
                      labelFormatter={(v: any) => Number(v).toLocaleString() + ' swaps'}
                      formatter={(v: any, n: any) => [fmtMs(Number(v)),
                        n === 'quantlib' ? 'QuantLib' : n === 'flat' ? 'Flattened CPU, 1 core'
                          : n === 'gpu' ? 'GPU total' : 'GPU kernel only']} />
                    <Legend formatter={(v: string) => <span style={{ fontSize: 11 }}>
                      {v === 'quantlib' ? 'QuantLib' : v === 'flat' ? 'Flattened CPU, 1 core'
                        : v === 'gpu' ? 'GPU total' : 'GPU kernel only'}</span>} />
                    {lo && hi && (
                      <ReferenceArea x1={lo.trades} x2={hi.trades} fill="#d4a853" fillOpacity={0.10}
                        label={{ value: 'crossover', position: 'insideTop',
                                 style: { fill: 'var(--text-dim)', fontSize: 10 } }} />
                    )}
                    <Line type="monotone" dataKey="quantlib" stroke="#5b8fc9" strokeWidth={2}
                      dot={{ r: 2 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="flat" stroke="#b07fc9" strokeWidth={2}
                      dot={{ r: 2 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="gpu" stroke="#d4a853" strokeWidth={2}
                      dot={{ r: 2 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="kernel" stroke="#7fae7f" strokeWidth={1.5}
                      strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="grid md:grid-cols-3 gap-3 mt-3">
                  <div className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>Leaving the object model</div>
                    <div className="font-mono text-sm" style={{ color: 'var(--accent-green)' }}>{ns.topFlatVsQuantLib}&times;</div>
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
                  <p className="text-xs mt-3 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
                    Both CPU lanes are single threaded, so this is one core against a whole
                    GPU. On a multi core box the flattened CPU would take back most of the
                    remaining gap, which is worth knowing before choosing a device over a
                    thread pool.
                  </p>
                )}
              </div>
            );
          })()}

          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Accuracy of the accelerated path
          </h3>
          <div className="grid md:grid-cols-3 gap-3">
            {perf.accuracy.map(a => (
              <div key={a.metric} className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
                <div className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>{a.metric}</div>
                <div className="font-mono text-sm" style={{ color: 'var(--accent-green)' }}>{a.value}</div>
                <div className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>{a.note}</div>
              </div>
            ))}
          </div>

          {perf.agreement && perf.agreement.length > 0 && (
            <>
              <h3 className="text-sm font-semibold mb-1 mt-8" style={{ color: 'var(--text-primary)' }}>
                Do the lanes agree?
              </h3>
              <p className="text-xs mb-3 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
                Every lane above is checked against QuantLib per instrument, at every book
                size. A faster lane is only worth reporting if it computes the same number,
                and a fan out kernel that indexes the wrong scenario still returns entirely
                plausible figures.
              </p>
              <div className="grid md:grid-cols-3 gap-3">
                {perf.agreement.map(a => (
                  <div key={a.scope + a.comparison} className="rounded px-3 py-2"
                    style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>
                      {a.comparison.replace(/_/g, ' ')}
                    </div>
                    <div className="font-mono text-sm" style={{ color: 'var(--accent-green)' }}>{a.value}</div>
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
