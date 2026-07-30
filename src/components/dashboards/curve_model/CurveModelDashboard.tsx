import { useEffect, useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
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

type Tab = 'inputs' | 'curves' | 'methods';
const TABS: { key: Tab; label: string }[] = [
  { key: 'inputs', label: 'Market Data Model' },
  { key: 'curves', label: 'Bootstrapped Curves' },
  { key: 'methods', label: 'Interpolation Methods' },
];

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

  useEffect(() => {
    const base = '/data/curve_model';
    fetch(`${base}/inputs.json`).then(r => r.json()).then(setInputs).catch(() => {});
    fetch(`${base}/curves.json`).then(r => r.json()).then(setCurves).catch(() => {});
    fetch(`${base}/methods.json`).then(r => r.json()).then(setMethods).catch(() => {});
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
    </div>
  );
}
