import { useEffect, useState, useMemo, useRef } from 'react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';
import DashboardHeader from '../DashboardHeader';

/* ── Types ── */
interface Bond { isin: string; maturity: string; settle: string; coupon: number; price: number; cashflows: number }
interface ZeroPt { date: string; tenor: string; days: number; rate: number }
interface CmpRow {
  tenor: string; days: number; originalRate: number; csvRate: number; schedBuilderRate: number;
  csvVsOrigBps: number; schedVsOrigBps: number; csvVsSchedBps: number;
}
interface SchedRow {
  isin: string; maturityDate: number; couponRate: number; isZeroCoupon: string;
  daysAccrued: number; daysInPeriod: number; calculatedAccrued: number; csvAccrued: number;
  accruedDiff: number; isNewlyIssued: string; numCalcCashflows: number; numCsvCashflows: number;
}
interface CfRow { isin: string; cfDate: number; calculatedAmount: number; csvAmount: number; difference: number; type: string }
interface SpreadPt { tenor: string; days: number; spreadBps: number }
interface Spreads { description: string; rating: string; date: string; source: string; spreads: SpreadPt[] }
interface OisCurve { description: string; source: string; date: string; convention: string; rates: { tenor: string; days: number; parRate: number }[] }
interface DemoStep {
  step: number; isin: string; maturity: string; cleanPrice: number; couponRate: number;
  timeToMaturity: number; dirtyPrice: number; cashflowCount: number; convergenceError: number;
  bondsProcessed: string[]; curvePoints: { tenor: string; days: number; zeroRate: number }[];
}

type Tab = 'bond-data' | 'demo' | 'bootstrap' | 'spreads';
const TABS: { key: Tab; label: string }[] = [
  { key: 'bond-data', label: 'Bond Universe' },
  { key: 'demo', label: 'Bootstrap Replay' },
  { key: 'bootstrap', label: 'Validation' },
  { key: 'spreads', label: 'Credit Waterfall' },
];

const chartGrid = '#1a1a28';
const chartAxis = '#55546a';
const tt = {
  contentStyle: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 6, fontSize: 12 },
  labelStyle: { color: '#8b8a97' },
};

const fmtDate = (d: string | number) => {
  const s = String(d);
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` : s;
};
const bpsColor = (bps: number) => {
  const a = Math.abs(bps);
  return a < 0.0001 ? 'var(--accent-green)' : a < 0.01 ? '#b8b04a' : '#c75f5f';
};

/* OIS par-to-zero bootstrap: annual Act/360 fixed leg vs compounded ESTR,
   solved sequentially per pillar with linear zero interpolation between pillars. */
function bootstrapOis(rates: { days: number; parRate: number }[]): { t: number; zero: number }[] {
  const pillars: { t: number; zero: number }[] = [];
  const tau = 365 / 360;
  const zeroAt = (t: number, extra?: { t: number; zero: number }) => {
    const pts = extra ? [...pillars, extra] : pillars;
    if (!pts.length) return 0.02;
    if (t <= pts[0].t) return pts[0].zero;
    for (let i = 1; i < pts.length; i++) {
      if (t <= pts[i].t) {
        const w = (t - pts[i - 1].t) / (pts[i].t - pts[i - 1].t);
        return pts[i - 1].zero + w * (pts[i].zero - pts[i - 1].zero);
      }
    }
    return pts[pts.length - 1].zero;
  };
  for (const r of [...rates].sort((a, b) => a.days - b.days)) {
    const t = r.days / 365;
    const p = r.parRate / 100;
    if (t <= 1.001) {
      pillars.push({ t, zero: Math.log(1 + p * (r.days / 360)) / t });
      continue;
    }
    const nPay = Math.round(t);
    const pv = (z: number) => {
      let fixed = 0;
      for (let i = 1; i <= nPay; i++) {
        const ti = i === nPay ? t : i;
        fixed += p * tau * Math.exp(-zeroAt(ti, { t, zero: z }) * ti);
      }
      return fixed + Math.exp(-z * t) - 1;
    };
    let lo = 0.0001, hi = 0.15;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (pv(mid) > 0) lo = mid; else hi = mid;
    }
    pillars.push({ t, zero: (lo + hi) / 2 });
  }
  return pillars;
}

const interp = (pts: { t: number; v: number }[], t: number) => {
  if (!pts.length) return 0;
  if (t <= pts[0].t) return pts[0].v;
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i].t) {
      const w = (t - pts[i - 1].t) / (pts[i].t - pts[i - 1].t);
      return pts[i - 1].v + w * (pts[i].v - pts[i - 1].v);
    }
  }
  return pts[pts.length - 1].v;
};

export default function BondDashboard({ defaultTab, breadcrumb }: { defaultTab?: string; breadcrumb?: string[] }) {
  const [tab, setTab] = useState<Tab>((defaultTab as Tab) ?? 'bond-data');
  const [bonds, setBonds] = useState<Bond[]>([]);
  const [zeroCurve, setZeroCurve] = useState<ZeroPt[]>([]);
  const [cmp, setCmp] = useState<CmpRow[]>([]);
  const [sched, setSched] = useState<SchedRow[]>([]);
  const [cfs, setCfs] = useState<CfRow[]>([]);
  const [spreadData, setSpreadData] = useState<Spreads | null>(null);
  const [ois, setOis] = useState<OisCurve | null>(null);
  const [estr, setEstr] = useState<{ date: string; value: number } | null>(null);
  const [steps, setSteps] = useState<DemoStep[]>([]);

  useEffect(() => {
    const base = '/data/bondbootstrapper';
    const load = (f: string, set: (v: any) => void) =>
      fetch(`${base}/${f}`).then(r => r.json()).then(set).catch(() => {});
    load('bonds.json', setBonds);
    load('zero_curve.json', setZeroCurve);
    load('curve_comparison.json', setCmp);
    load('schedule_comparison.json', setSched);
    load('cashflow_comparison.json', setCfs);
    load('credit_spreads.json', setSpreadData);
    load('ois_curve.json', setOis);
    load('estr_rate.json', setEstr);
    load('demo_steps.json', setSteps);
  }, []);

  const chip = (active: boolean, color: string) => ({
    border: `1px solid ${active ? color : 'var(--border-subtle)'}`,
    color: active ? color : 'var(--text-dim)',
    background: active ? `${color}18` : 'transparent',
  });

  /* ── Bond Universe ── */
  const [selIsin, setSelIsin] = useState<string | null>(null);
  const selCfs = useMemo(() => cfs.filter(c => c.isin === selIsin), [cfs, selIsin]);
  const selSched = sched.find(s => s.isin === selIsin);

  /* ── Demo replay ── */
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (!playing || !steps.length) return;
    timer.current = setInterval(() => {
      setStepIdx(i => {
        if (i >= steps.length - 1) { setPlaying(false); return i; }
        return i + 1;
      });
    }, speed * 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing, speed, steps.length]);

  const demoChart = useMemo(() => {
    const cur = steps[stepIdx]?.curvePoints ?? [];
    const prev = stepIdx > 0 ? steps[stepIdx - 1]?.curvePoints ?? [] : [];
    const byDays: Record<number, any> = {};
    for (const p of cur) byDays[p.days] = { t: +(p.days / 365).toFixed(4), cur: p.zeroRate };
    for (const p of prev) {
      const row = byDays[p.days] ?? (byDays[p.days] = { t: +(p.days / 365).toFixed(4) });
      row.prev = p.zeroRate;
    }
    return Object.values(byDays).sort((a: any, b: any) => a.t - b.t);
  }, [steps, stepIdx]);
  const demoStep = steps[stepIdx];

  /* ── Validation ── */
  const cmpChart = useMemo(() =>
    cmp.map(r => ({ t: +(r.days / 365).toFixed(4), original: r.originalRate, csv: r.csvRate, sched: r.schedBuilderRate })),
    [cmp]);
  const maxCurveBps = useMemo(() =>
    cmp.reduce((m, r) => Math.max(m, Math.abs(r.csvVsOrigBps), Math.abs(r.schedVsOrigBps)), 0), [cmp]);
  const cfMatched = useMemo(() => cfs.filter(c => c.difference === 0).length, [cfs]);
  const accrMatched = useMemo(() => sched.filter(s => Math.abs(s.accruedDiff) < 1e-9).length, [sched]);

  /* ── Credit waterfall ── */
  const [spreads, setSpreads] = useState<SpreadPt[]>([]);
  useEffect(() => { if (spreadData) setSpreads(spreadData.spreads.map(s => ({ ...s }))); }, [spreadData]);
  const oisPillars = useMemo(() => (ois ? bootstrapOis(ois.rates) : []), [ois]);
  const waterfallChart = useMemo(() => {
    if (!zeroCurve.length || !oisPillars.length || !spreads.length) return [];
    const oisPts = oisPillars.map(p => ({ t: p.t, v: p.zero * 100 }));
    const sprPts = spreads.map(s => ({ t: s.days / 365, v: s.spreadBps }));
    return zeroCurve.map(z => {
      const t = z.days / 365;
      const oisR = interp(oisPts, t);
      const bund = z.rate;
      const spr = interp(sprPts, t) / 100;
      return {
        t: +t.toFixed(4),
        ois: +oisR.toFixed(4),
        bundPrem: +Math.max(bund - oisR, 0).toFixed(4),
        credSpread: +spr.toFixed(4),
        bund: +bund.toFixed(4),
        credit: +(bund + spr).toFixed(4),
      };
    });
  }, [zeroCurve, oisPillars, spreads]);

  const setSpread = (i: number, v: number) =>
    setSpreads(s => s.map((row, j) => (j === i ? { ...row, spreadBps: Math.min(2000, Math.max(0, v)) } : row)));

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <DashboardHeader
        label={(breadcrumb ?? ['Rates']).join(' / ')}
        title={breadcrumb ? breadcrumb[breadcrumb.length - 1] : 'Government Bond Curve Engine'}
        subtitle="German Bund zero curve bootstrapped from 18 bond prices, validated across three independent builds, decomposed into OIS + sovereign + credit layers"
        techBadges={['C++', 'QuantLib', 'React', 'TypeScript']}
      />

      <div className="flex gap-2 mb-8 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="font-mono text-xs px-4 py-2 rounded transition-colors"
            style={chip(tab === t.key, '#5b8fc9')}>{t.label}</button>
        ))}
      </div>

      {/* ── Bond Universe ── */}
      {tab === 'bond-data' && (
        <div>
          <p className="text-sm mb-4 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
            The input universe: 18 German Bunds from a 3-week bill to a 30-year coupon
            bond, {cfs.length} cashflows in total. Every schedule below is rebuilt from
            bond terms by the C++ engine and diffed against the reference file.
            Select a bond to inspect its cashflows and accrual.
          </p>
          <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6">
            <div className="overflow-x-auto rounded" style={{ border: '1px solid var(--border-subtle)' }}>
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th className="text-left px-3 py-2">ISIN</th>
                    <th className="text-left px-3 py-2">Maturity</th>
                    <th className="text-right px-3 py-2">Coupon</th>
                    <th className="text-right px-3 py-2">Clean Px</th>
                    <th className="text-right px-3 py-2">CFs</th>
                  </tr>
                </thead>
                <tbody>
                  {bonds.map(b => (
                    <tr key={b.isin} onClick={() => setSelIsin(b.isin)} className="cursor-pointer"
                      style={{
                        borderBottom: '1px solid #14141f',
                        color: selIsin === b.isin ? 'var(--text-primary)' : 'var(--text-secondary)',
                        background: selIsin === b.isin ? 'rgba(91,143,201,0.08)' : 'transparent',
                      }}>
                      <td className="px-3 py-1.5">{b.isin}</td>
                      <td className="px-3 py-1.5">{fmtDate(b.maturity)}</td>
                      <td className="px-3 py-1.5 text-right">{b.coupon === 0
                        ? <span style={{ color: 'var(--text-dim)' }}>zero</span>
                        : `${b.coupon.toFixed(2)}%`}</td>
                      <td className="px-3 py-1.5 text-right">{b.price.toFixed(3)}</td>
                      <td className="px-3 py-1.5 text-right">{b.cashflows}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              {!selIsin && (
                <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  Select a bond to see its cashflow schedule.
                </p>
              )}
              {selIsin && (
                <div>
                  <p className="font-mono text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                    {selIsin} &middot; {selCfs.length} cashflows
                    {selSched && selSched.isNewlyIssued === 'Y' && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[10px]"
                        style={{ background: 'rgba(224,120,80,0.15)', color: '#e07850' }}>newly issued</span>
                    )}
                  </p>
                  {selSched && selSched.isZeroCoupon !== 'Y' && (
                    <p className="font-mono text-[11px] mb-2" style={{ color: 'var(--text-dim)' }}>
                      accrued {selSched.calculatedAccrued.toFixed(6)} ({selSched.daysAccrued}/{selSched.daysInPeriod} days)
                      &middot; diff vs reference {selSched.accruedDiff.toExponential(1)}
                    </p>
                  )}
                  <div className="overflow-x-auto rounded max-h-96 overflow-y-auto" style={{ border: '1px solid var(--border-subtle)' }}>
                    <table className="w-full font-mono text-[11px]">
                      <thead>
                        <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border-subtle)' }}>
                          <th className="text-left px-3 py-2">Date</th>
                          <th className="text-left px-3 py-2">Type</th>
                          <th className="text-right px-3 py-2">Amount / 1mm</th>
                          <th className="text-right px-3 py-2">Diff</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selCfs.map((c, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #14141f', color: 'var(--text-secondary)' }}>
                            <td className="px-3 py-1">{fmtDate(c.cfDate)}</td>
                            <td className="px-3 py-1">
                              <span style={{ color: c.type === 'MATURITY' ? '#5b8fc9' : 'var(--text-dim)' }}>{c.type}</span>
                            </td>
                            <td className="px-3 py-1 text-right">{c.calculatedAmount.toLocaleString()}</td>
                            <td className="px-3 py-1 text-right" style={{ color: bpsColor(c.difference) }}>
                              {c.difference === 0 ? '0' : c.difference.toExponential(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Bootstrap Replay ── */}
      {tab === 'demo' && (
        <div>
          <div className="flex gap-2 mb-4 items-center flex-wrap font-mono text-xs">
            <button onClick={() => setPlaying(p => !p)} className="px-4 py-2 rounded"
              style={{ background: playing ? 'var(--border-subtle)' : 'var(--accent-warm)', color: playing ? 'var(--text-secondary)' : '#0a0a0f' }}>
              {playing ? 'Pause' : stepIdx >= steps.length - 1 ? 'Replay' : 'Play'}
            </button>
            <button onClick={() => { setPlaying(false); setStepIdx(0); }} className="px-3 py-2 rounded"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>Reset</button>
            {[0.5, 1, 2].map(s => (
              <button key={s} onClick={() => setSpeed(s)} className="px-2.5 py-1.5 rounded"
                style={chip(speed === s, '#8b7ec8')}>{s}s/step</button>
            ))}
            <input type="range" min={0} max={Math.max(steps.length - 1, 0)} value={stepIdx}
              onChange={e => { setPlaying(false); setStepIdx(+e.target.value); }} className="flex-1 min-w-40" />
            <span style={{ color: 'var(--text-dim)' }}>bond {stepIdx + 1} / {steps.length}</span>
          </div>

          {demoStep && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4 font-mono text-xs">
              {[
                ['ISIN', demoStep.isin],
                ['Maturity', fmtDate(demoStep.maturity)],
                ['Coupon', demoStep.couponRate === 0 ? 'zero' : `${demoStep.couponRate.toFixed(2)}%`],
                ['Dirty price', demoStep.dirtyPrice.toFixed(4)],
                ['Convergence', demoStep.convergenceError.toExponential(1)],
                ['Curve points', String(demoStep.curvePoints.length)],
              ].map(([k, v]) => (
                <div key={k} className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
                  <div style={{ color: 'var(--text-dim)' }} className="text-[10px] uppercase mb-0.5">{k}</div>
                  <div style={{ color: 'var(--text-primary)' }}>{v}</div>
                </div>
              ))}
            </div>
          )}

          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={demoChart}>
              <CartesianGrid stroke={chartGrid} />
              <XAxis dataKey="t" stroke={chartAxis} tick={{ fontSize: 11 }} type="number"
                domain={[0, 30]} tickFormatter={v => `${v}Y`} />
              <YAxis stroke={chartAxis} tick={{ fontSize: 11 }} domain={['auto', 'auto']}
                tickFormatter={v => `${Number(v).toFixed(2)}%`} width={58} />
              <Tooltip {...tt} formatter={(v: any, n: any) => [`${Number(v).toFixed(4)}%`, n === 'cur' ? 'Current curve' : 'Previous step']}
                labelFormatter={l => `t = ${Number(l).toFixed(2)}Y`} />
              {demoStep && <ReferenceLine x={demoStep.timeToMaturity} stroke="#d4a853" strokeDasharray="4 4"
                label={{ value: 'new bond', fill: '#d4a853', fontSize: 10, position: 'top' }} />}
              <Line dataKey="prev" stroke="#55546a" dot={false} strokeWidth={1.2} strokeDasharray="5 3" isAnimationActive={false} />
              <Line dataKey="cur" stroke="#5b8fc9" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs mt-3 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
            The bootstrap replayed bond by bond from the engine&apos;s own step log: 18 bonds
            processed shortest to longest, each adding information at its maturity. Gray
            dashed is the previous step; the marker is the latest bond&apos;s maturity.
            Convergence error shown per step is the engine&apos;s reprice residual.
          </p>
        </div>
      )}

      {/* ── Validation ── */}
      {tab === 'bootstrap' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5 font-mono text-xs">
            {[
              ['Max curve diff (3 builds)', `${maxCurveBps.toExponential(2)} bps`],
              ['Cashflows matched', `${cfMatched} / ${cfs.length}`],
              ['Accruals matched', `${accrMatched} / ${sched.length}`],
            ].map(([k, v]) => (
              <div key={k} className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
                <div style={{ color: 'var(--text-dim)' }} className="text-[10px] uppercase mb-0.5">{k}</div>
                <div style={{ color: 'var(--accent-green)' }}>{v}</div>
              </div>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={cmpChart}>
              <CartesianGrid stroke={chartGrid} />
              <XAxis dataKey="t" stroke={chartAxis} tick={{ fontSize: 11 }} type="number"
                domain={[0, 30]} tickFormatter={v => `${v}Y`} />
              <YAxis stroke={chartAxis} tick={{ fontSize: 11 }} domain={['auto', 'auto']}
                tickFormatter={v => `${Number(v).toFixed(2)}%`} width={58} />
              <Tooltip {...tt} formatter={(v: any, n: any) =>
                [`${Number(v).toFixed(6)}%`, n === 'original' ? 'Reference' : n === 'csv' ? 'CSV bootstrap' : 'Schedule builder']}
                labelFormatter={l => `t = ${Number(l).toFixed(2)}Y`} />
              <Legend formatter={(v: string) =>
                <span style={{ fontSize: 11 }}>{v === 'original' ? 'Reference' : v === 'csv' ? 'CSV bootstrap' : 'Schedule builder'}</span>} />
              <Line dataKey="original" stroke="#8b8a97" dot={false} strokeWidth={2.4} strokeDasharray="6 4" isAnimationActive={false} />
              <Line dataKey="csv" stroke="#5b8fc9" dot={false} strokeWidth={1.6} isAnimationActive={false} />
              <Line dataKey="sched" stroke="#d4a853" dot={false} strokeWidth={1} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs mt-3 mb-6 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
            Three independently built curves — the reference, a bootstrap from the raw CSV,
            and a bootstrap from engine-rebuilt schedules — overlaid. They are
            indistinguishable by construction: the table shows the basis-point differences.
          </p>

          <div className="overflow-x-auto rounded mb-6 max-h-96 overflow-y-auto" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full font-mono text-[11px]">
              <thead>
                <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="text-left px-3 py-2">Tenor</th>
                  <th className="text-right px-3 py-2">Reference %</th>
                  <th className="text-right px-3 py-2">CSV %</th>
                  <th className="text-right px-3 py-2">Sched %</th>
                  <th className="text-right px-3 py-2">CSV vs Ref (bps)</th>
                  <th className="text-right px-3 py-2">Sched vs Ref (bps)</th>
                </tr>
              </thead>
              <tbody>
                {cmp.map(r => (
                  <tr key={r.tenor} style={{ borderBottom: '1px solid #14141f', color: 'var(--text-secondary)' }}>
                    <td className="px-3 py-1">{r.tenor}</td>
                    <td className="px-3 py-1 text-right">{r.originalRate.toFixed(6)}</td>
                    <td className="px-3 py-1 text-right">{r.csvRate.toFixed(6)}</td>
                    <td className="px-3 py-1 text-right">{r.schedBuilderRate.toFixed(6)}</td>
                    <td className="px-3 py-1 text-right" style={{ color: bpsColor(r.csvVsOrigBps) }}>{r.csvVsOrigBps.toExponential(1)}</td>
                    <td className="px-3 py-1 text-right" style={{ color: bpsColor(r.schedVsOrigBps) }}>{r.schedVsOrigBps.toExponential(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Accrued interest validation</h3>
          <div className="overflow-x-auto rounded" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full font-mono text-[11px]">
              <thead>
                <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="text-left px-3 py-2">ISIN</th>
                  <th className="text-right px-3 py-2">Coupon</th>
                  <th className="text-right px-3 py-2">Days accrued</th>
                  <th className="text-right px-3 py-2">Calculated</th>
                  <th className="text-right px-3 py-2">Reference</th>
                  <th className="text-right px-3 py-2">Diff</th>
                  <th className="text-left px-3 py-2">Flags</th>
                </tr>
              </thead>
              <tbody>
                {sched.map(s => (
                  <tr key={s.isin} style={{ borderBottom: '1px solid #14141f', color: 'var(--text-secondary)' }}>
                    <td className="px-3 py-1">{s.isin}</td>
                    <td className="px-3 py-1 text-right">{s.isZeroCoupon === 'Y' ? 'zero' : `${s.couponRate.toFixed(2)}%`}</td>
                    <td className="px-3 py-1 text-right">{s.daysAccrued}</td>
                    <td className="px-3 py-1 text-right">{s.calculatedAccrued.toFixed(6)}</td>
                    <td className="px-3 py-1 text-right">{s.csvAccrued.toFixed(6)}</td>
                    <td className="px-3 py-1 text-right" style={{ color: bpsColor(s.accruedDiff) }}>
                      {s.accruedDiff === 0 ? '0' : s.accruedDiff.toExponential(1)}
                    </td>
                    <td className="px-3 py-1">
                      {s.isNewlyIssued === 'Y' && <span style={{ color: '#e07850' }}>newly issued</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Credit Waterfall ── */}
      {tab === 'spreads' && (
        <div>
          <p className="text-sm mb-4 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
            Every basis point of an issuer&apos;s borrowing cost attributed to a source:
            the ESTR OIS curve (bootstrapped in your browser from ECB MMSR par rates,
            annual Act/360 converted to continuous Act/365), the Bund curve over it,
            and the {spreadData?.rating}-rated credit spread on top. Edit any spread
            and the credit curve rebuilds instantly.
          </p>
          {estr && (
            <p className="font-mono text-xs mb-5" style={{ color: 'var(--text-dim)' }}>
              ESTR fixing {estr.value}% ({estr.date}) &middot; OIS pillars: {ois?.rates.map(r => r.tenor).join(' ')}
            </p>
          )}

          <div className="grid lg:grid-cols-[1fr_320px] gap-6">
            <div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={waterfallChart}>
                  <CartesianGrid stroke={chartGrid} />
                  <XAxis dataKey="t" stroke={chartAxis} tick={{ fontSize: 11 }} type="number"
                    domain={[0, 30]} tickFormatter={v => `${v}Y`} />
                  <YAxis stroke={chartAxis} tick={{ fontSize: 11 }} domain={['auto', 'auto']}
                    tickFormatter={v => `${Number(v).toFixed(1)}%`} width={52} />
                  <Tooltip {...tt} formatter={(v: any, n: any) =>
                    [`${Number(v).toFixed(3)}%`, n === 'ois' ? 'ESTR OIS' : n === 'bund' ? 'Bund' : 'A-rated credit']}
                    labelFormatter={l => `t = ${Number(l).toFixed(2)}Y`} />
                  <Legend formatter={(v: string) =>
                    <span style={{ fontSize: 11 }}>{v === 'ois' ? 'ESTR OIS' : v === 'bund' ? 'Bund' : 'A-rated credit'}</span>} />
                  <Line dataKey="ois" stroke="#8b8a97" dot={false} strokeWidth={1.4} strokeDasharray="5 3" isAnimationActive={false} />
                  <Line dataKey="bund" stroke="#5b8fc9" dot={false} strokeWidth={1.8} isAnimationActive={false} />
                  <Line dataKey="credit" stroke="#d4a853" dot={false} strokeWidth={1.8} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>

              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={waterfallChart}>
                  <CartesianGrid stroke={chartGrid} />
                  <XAxis dataKey="t" stroke={chartAxis} tick={{ fontSize: 11 }} type="number"
                    domain={[0, 30]} tickFormatter={v => `${v}Y`} />
                  <YAxis stroke={chartAxis} tick={{ fontSize: 11 }}
                    tickFormatter={v => `${Number(v).toFixed(1)}%`} width={52} />
                  <Tooltip {...tt} formatter={(v: any, n: any) =>
                    [`${Number(v).toFixed(3)}%`, n === 'ois' ? 'OIS base' : n === 'bundPrem' ? 'Sovereign premium' : 'Credit spread']}
                    labelFormatter={l => `t = ${Number(l).toFixed(2)}Y`} />
                  <Legend formatter={(v: string) =>
                    <span style={{ fontSize: 11 }}>{v === 'ois' ? 'OIS base' : v === 'bundPrem' ? 'Sovereign premium' : 'Credit spread'}</span>} />
                  <Area dataKey="ois" stackId="w" stroke="none" fill="#3a3a4a" isAnimationActive={false} />
                  <Area dataKey="bundPrem" stackId="w" stroke="none" fill="#33567e" isAnimationActive={false} />
                  <Area dataKey="credSpread" stackId="w" stroke="none" fill="#d4a853" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Credit spreads (bps)</h3>
                <button onClick={() => spreadData && setSpreads(spreadData.spreads.map(s => ({ ...s })))}
                  className="font-mono text-[11px] px-2.5 py-1 rounded"
                  style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>Reset</button>
              </div>
              <div className="rounded" style={{ border: '1px solid var(--border-subtle)' }}>
                {spreads.map((s, i) => (
                  <div key={s.tenor} className="flex items-center justify-between px-3 py-1.5 font-mono text-xs"
                    style={{ borderBottom: i < spreads.length - 1 ? '1px solid #14141f' : 'none' }}>
                    <span style={{ color: 'var(--text-dim)' }}>{s.tenor}</span>
                    <input type="number" min={0} max={2000} value={s.spreadBps}
                      onChange={e => setSpread(i, +e.target.value)}
                      className="w-24 px-2 py-1 rounded text-right"
                      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} />
                  </div>
                ))}
              </div>
              <p className="text-[11px] mt-3" style={{ color: 'var(--text-dim)' }}>
                Spreads over the Bund zero curve, {spreadData?.date}. Source: {spreadData?.source}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
