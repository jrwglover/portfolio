import { useEffect, useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';
import DashboardHeader from '../DashboardHeader';

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

type Tab = 'inputs' | 'curves' | 'methods' | 'sensis' | 'perf';
const TABS: { key: Tab; label: string }[] = [
  { key: 'inputs', label: 'Market Data Model' },
  { key: 'curves', label: 'Bootstrapped Curves' },
  { key: 'methods', label: 'Interpolation Methods' },
  { key: 'sensis', label: 'Trade Risk & Cashflows' },
  { key: 'perf', label: 'CPU vs GPU' },
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
interface PerfPattern { id: string; name: string; workload: string; note: string; lanes: PerfLane[]; baseline: string }
interface PerfFile { date: string; patterns: PerfPattern[]; accuracy: { metric: string; value: string; note: string }[] }

const CCY_SYM: Record<string, string> = { EUR: '€', USD: '$', GBP: '£' };
const fmtCcy = (v: number | null, ccy: string) =>
  v == null ? '—' : `${CCY_SYM[ccy] ?? ''}${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

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
const METHOD_COLORS: Record<string, string> = {
  LogCubicDiscount: '#d4a853', LinearZero: '#5eaab5',
  LinearForward: '#8b7ec8', FlatForward: '#5cb87a',
};
const METHOD_LABELS: Record<string, string> = {
  LogCubicDiscount: 'Cubic spline on log-DF (production)',
  LinearZero: 'Linear on zeros', LinearForward: 'Linear on forwards',
  FlatForward: 'Flat forwards (step)',
};
const INSTR_BADGE: Record<string, string> = {
  OIS: '#5eaab5', IMM_OIS: '#5cb87a', MTG_OIS: '#e07850', FUTURE: '#b8b04a',
  DEPOSIT: '#8b8a97', FRA: '#8b8a97', IMM_FRA: '#5cb87a', IRS: '#8b7ec8',
  FXSWAP: '#4a9a68', XCCY: '#d4a853',
};

const chartGrid = '#1a1a28';
const chartAxis = '#55546a';
const tt = {
  contentStyle: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 6, fontSize: 12 },
  labelStyle: { color: '#8b8a97' },
};

function toChart(series: Record<string, Pt[]>, keys: string[], field: 1 | 2, tMax: number) {
  const base = series[keys[0]] ?? [];
  return base
    .filter(p => p[0] <= tMax)
    .map(p => {
      const row: Record<string, number> = { t: p[0] };
      for (const k of keys) {
        const arr = series[k];
        if (!arr) continue;
        // arrays share the same t-grid per extraction; guard by nearest index
        const idx = arr.findIndex(q => q[0] >= p[0]);
        if (idx >= 0) row[k] = arr[idx][field];
      }
      return row;
    });
}

export default function CurveModelDashboard({ defaultTab, breadcrumb }: { defaultTab?: string; breadcrumb?: string[] }) {
  const [tab, setTab] = useState<Tab>((defaultTab as Tab) ?? 'inputs');
  const [inputs, setInputs] = useState<Inputs | null>(null);
  const [curves, setCurves] = useState<Record<string, Pt[]>>({});
  const [methods, setMethods] = useState<Record<string, Record<string, Pt[]>>>({});
  const [selCurve, setSelCurve] = useState('EUR_ESTR_ECB');
  const [shown, setShown] = useState<string[]>(['ESTR', 'ESTR_ECB', 'EURIBOR6M', 'EURUSD']);
  const [methodCurve, setMethodCurve] = useState<'ESTR' | 'EURIBOR6M'>('ESTR');
  const [domain, setDomain] = useState<'fwd' | 'zero'>('fwd');
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
    fetch(`${base}/methods.json`).then(r => r.json()).then(setMethods).catch(() => {});
    fetch(`${base}/trades.json`).then(r => r.json()).then(setTrades).catch(() => {});
    fetch(`${base}/performance.json`).then(r => r.json()).then(setPerf).catch(() => {});
  }, []);

  const selMkt = inputs?.curves.find(c => c.curve === selCurve);
  const curveKeys = Object.keys(CURVE_LABELS).filter(k => curves[k]);

  const outChart = useMemo(
    () => toChart(curves, shown, domain === 'fwd' ? 1 : 2, tMax),
    [curves, shown, domain, tMax]);

  const methodChart = useMemo(() => {
    const ms = Object.keys(METHOD_LABELS).filter(m => methods[m]?.[methodCurve]);
    const series: Record<string, Pt[]> = {};
    for (const m of ms) series[m] = methods[m][methodCurve];
    return toChart(series, ms, domain === 'fwd' ? 1 : 2, tMax);
  }, [methods, methodCurve, domain, tMax]);

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
        subtitle="From raw quotes to bootstrapped curves: 8 curves, 11 instrument types, 4 interpolation methods"
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
            Valuation {inputs.date} · {inputs.curves.length} curves · every instrument
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
                          {q.price != null ? q.price.toFixed(2) + ' (price)' : ((q.rate ?? 0) * 100).toFixed(4) + '%'}
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
          <div className="flex gap-2 mb-3 flex-wrap items-center">
            {curveKeys.map(k => (
              <button key={k}
                onClick={() => setShown(s => s.includes(k) ? s.filter(x => x !== k) : [...s, k])}
                className="font-mono text-[11px] px-2.5 py-1 rounded"
                style={chip(shown.includes(k), CURVE_COLORS[k])}>{CURVE_LABELS[k]}</button>
            ))}
          </div>
          <div className="flex gap-2 mb-5 font-mono text-[11px]">
            {(['fwd', 'zero'] as const).map(d => (
              <button key={d} onClick={() => setDomain(d)} className="px-2.5 py-1 rounded"
                style={chip(domain === d, '#5eaab5')}>{d === 'fwd' ? 'instantaneous forwards' : 'zero rates'}</button>
            ))}
            {[2.5, 10, 30].map(x => (
              <button key={x} onClick={() => setTMax(x)} className="px-2.5 py-1 rounded"
                style={chip(tMax === x, '#8b7ec8')}>{x}Y</button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={outChart}>
              <CartesianGrid stroke={chartGrid} />
              <XAxis dataKey="t" stroke={chartAxis} tick={{ fontSize: 11 }} type="number"
                domain={[0, tMax]} tickFormatter={v => `${v}Y`} />
              <YAxis stroke={chartAxis} tick={{ fontSize: 11 }} domain={['auto', 'auto']}
                tickFormatter={v => `${Number(v).toFixed(1)}%`} width={52} />
              <Tooltip {...tt} formatter={(v: any, n: any) => [`${v.toFixed(3)}%`, CURVE_LABELS[n] ?? n]}
                labelFormatter={l => `t = ${Number(l).toFixed(2)}Y`} />
              <Legend formatter={(v: string) => <span style={{ fontSize: 11 }}>{CURVE_LABELS[v] ?? v}</span>} />
              {shown.map(k => (
                <Line key={k} dataKey={k} stroke={CURVE_COLORS[k]} dot={false} strokeWidth={1.8} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs mt-3 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
            Zoom to 2.5Y with the ESTR variants selected to see the short-end constructions:
            the ECB curve steps at policy effective dates, the IMM curves quarterly, the
            tenor curve glides. All four reprice their instruments exactly; the GPU evaluates
            the identical spline to 3&times;10<sup>-14</sup>.
          </p>
        </div>
      )}

      {tab === 'methods' && (
        <div>
          <div className="flex gap-2 mb-3 font-mono text-[11px] flex-wrap">
            {(['ESTR', 'EURIBOR6M'] as const).map(c => (
              <button key={c} onClick={() => setMethodCurve(c)} className="px-2.5 py-1 rounded"
                style={chip(methodCurve === c, CURVE_COLORS[c])}>{CURVE_LABELS[c]}</button>
            ))}
            {(['fwd', 'zero'] as const).map(d => (
              <button key={d} onClick={() => setDomain(d)} className="px-2.5 py-1 rounded"
                style={chip(domain === d, '#5eaab5')}>{d === 'fwd' ? 'forwards' : 'zeros'}</button>
            ))}
            {[10, 30].map(x => (
              <button key={x} onClick={() => setTMax(x)} className="px-2.5 py-1 rounded"
                style={chip(tMax === x, '#8b7ec8')}>{x}Y</button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={methodChart}>
              <CartesianGrid stroke={chartGrid} />
              <XAxis dataKey="t" stroke={chartAxis} tick={{ fontSize: 11 }} type="number"
                domain={[0, tMax]} tickFormatter={v => `${v}Y`} />
              <YAxis stroke={chartAxis} tick={{ fontSize: 11 }} domain={['auto', 'auto']}
                tickFormatter={v => `${Number(v).toFixed(1)}%`} width={52} />
              <Tooltip {...tt} formatter={(v: any, n: any) => [`${v.toFixed(3)}%`, METHOD_LABELS[n] ?? n]}
                labelFormatter={l => `t = ${Number(l).toFixed(2)}Y`} />
              <Legend formatter={(v: string) => <span style={{ fontSize: 11 }}>{METHOD_LABELS[v] ?? v}</span>} />
              {Object.keys(METHOD_LABELS).map(m => (
                <Line key={m} dataKey={m} stroke={METHOD_COLORS[m]} dot={false} strokeWidth={1.8} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs mt-3 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
            Same instruments, four interpolations. All four reprice the calibration set —
            the differences between pillars are the model's freedom. Switch to forwards to
            see why the desk choice is the cubic spline on log-discount: forwards are the
            spline's derivative (C&sup1;), where linear-zero interpolation produces the
            classic sawtooth and flat-forward the staircase.
          </p>
        </div>
      )}

      {tab === 'sensis' && trades && (
        <div>
          <p className="text-sm mb-4 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
            Market-quote PV01 per trade: every input instrument bumped {trades.bump_bps}bp,
            the curve family re-bootstrapped, the trade repriced. One example trade per
            curve in the framework &mdash; pick a trade to see where its risk lands.
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
                  ? 'Two independent ladders: the CPU one bumps the market quote and re-runs the global bootstrap, so the shock propagates through the spline; the GPU one bumps the pillar directly. Where they differ is what re-bootstrapping adds — risk leaking to neighbouring buckets through the interpolation.'
                  : 'Each bar is one market quote bumped and the curve rebuilt — the buckets are the instruments the desk hedges with.'}
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
                The risk localizes &mdash; a 5Y forward&apos;s exposure sits at the 5Y basis
                pillar, a 10Y forward&apos;s at 10Y &mdash; the sanity check that the
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
                Struck at fair so the two legs offset &mdash; the residual NPV is the
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
                  historical EURIBOR 6M fixing, not a projected forward &mdash; the
                  in-flight coupon that makes a seasoned trade different from a spot-start one.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'perf' && perf && (
        <div>
          <p className="text-sm mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
            Where GPU acceleration actually pays, measured per workload pattern on this
            machine. Bars are wall-clock milliseconds on a log scale; the multiple is
            against the CPU baseline for that pattern.
          </p>

          {perf.patterns.map(p => {
            const base = p.lanes.find(l => l.lane === p.baseline)?.ms ?? 1;
            const data = p.lanes.map(l => ({ ...l, x: Math.max(l.ms, 0.001) }));
            return (
              <div key={p.id} className="mb-10">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{p.name}</h3>
                <p className="font-mono text-[11px] mb-3" style={{ color: 'var(--text-dim)' }}>{p.workload}</p>
                <ResponsiveContainer width="100%" height={40 + data.length * 38}>
                  <BarChart data={data} layout="vertical" margin={{ left: 8, right: 60 }}>
                    <CartesianGrid stroke={chartGrid} horizontal={false} />
                    <XAxis type="number" scale="log" domain={['auto', 'auto']} stroke={chartAxis}
                      tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}s` : `${v}ms`} />
                    <YAxis type="category" dataKey="lane" width={250} stroke={chartAxis} tick={{ fontSize: 11 }} />
                    <Tooltip {...tt} formatter={(v: any) => [
                      Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(2)} s` : `${Number(v).toFixed(3)} ms`, 'wall clock']} />
                    <Bar dataKey="x" isAnimationActive={false} radius={[0, 3, 3, 0]}>
                      {data.map((d, i) => (
                        <Cell key={i} fill={d.kind === 'gpu' ? '#d4a853' : '#5b8fc9'} />
                      ))}
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
                <p className="text-xs max-w-3xl" style={{ color: 'var(--text-dim)' }}>{p.note}</p>
              </div>
            );
          })}

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
        </div>
      )}
    </div>
  );
}
