import { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ReferenceLine, ReferenceArea, Cell, ComposedChart,
} from 'recharts';

/* Government bond curve and relative value. Everything shown is read from
   bonds.json, which the engine's bond_rv run writes: the curve solved from the
   benchmark bonds on the min-curve spline, and every bond in the universe
   measured against that curve and against ESTR. The bonds, prices and history
   are generated. */

const CARD = 'var(--bg-card)';
const EDGE = 'var(--border-subtle)';
const DIM = 'var(--text-dim)';
const SEC = 'var(--text-secondary)';
const PRI = 'var(--text-primary)';
const GOV = '#d9a441';
const REF = '#5b8fc9';
const CHEAP = '#5cb87a';
const RICH = '#c86e6e';
const NEUTRAL = '#6f6e80';
const chartGrid = '#1a1a28';
const chartAxis = '#55546a';
const tt = {
  contentStyle: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 6, fontSize: 12 },
  labelStyle: { color: '#8b8a97' },
};

interface BondRow {
  id: string; name: string; cls: string; benchmark: string; onCurve: boolean;
  coupon: number; maturity: string; t: number; outstandingBn: number;
  clean: number; accrued: number; modelClean: number; yield: number;
  residBp: number; residCents: number; zSpreadBp: number; curveSpreadBp: number;
  aswBp: number; modDur: number; dv01: number;
  histMean?: number; histSd?: number; histMin?: number; histMax?: number; z?: number;
  history?: number[];
}
interface BondData {
  date: string; settlement: string; provenance: string; historyDays: number;
  curve: { id: string; interpolation: string; reference: string; instruments: number;
           universe: number; worstRepriceCents: number; worstOnCurveBp: number };
  pillars: { t: number; date: string; zero: number }[];
  grid: number[][];
  bonds: BondRow[];
}

type SortKey = 'z' | 't' | 'residBp' | 'zSpreadBp' | 'aswBp';

const signalOf = (r: BondRow) =>
  r.onCurve || r.z === undefined ? 'curve' : r.z >= 2 ? 'cheap' : r.z <= -2 ? 'rich' : 'fair';
const colourOf = (r: BondRow) => {
  const s = signalOf(r);
  return s === 'cheap' ? CHEAP : s === 'rich' ? RICH : s === 'curve' ? GOV : NEUTRAL;
};
const bp = (v: number, d = 1) => (v >= 0 ? '+' : '') + v.toFixed(d);

function Tile({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div className="rounded-lg px-4 py-3" style={{ background: CARD, border: `1px solid ${EDGE}` }}>
      <div className="font-mono text-[10px] uppercase tracking-wider" style={{ color: DIM }}>{title}</div>
      <div className="text-lg font-semibold mt-1" style={{ color: PRI }}>{value}</div>
      <div className="text-xs mt-0.5" style={{ color: SEC }}>{note}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-sm mb-2 font-mono uppercase tracking-wider" style={{ color: DIM }}>{children}</p>;
}

export default function BondPanel() {
  const [data, setData] = useState<BondData | null>(null);
  const [failed, setFailed] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('z');
  const [onlySignals, setOnlySignals] = useState(false);

  useEffect(() => {
    fetch('/data/curve_model/bonds.json', { cache: 'no-store' })
      .then(r => r.json()).then(setData).catch(() => setFailed(true));
  }, []);

  const curveChart = useMemo(() => (data?.grid ?? []).map(g => ({
    t: g[0], gov: g[1] * 100, ref: g[3] * 100, spread: (g[1] - g[3]) * 1e4,
  })), [data]);

  const measured = useMemo(() => (data?.bonds ?? []).filter(b => !b.onCurve && b.z !== undefined), [data]);

  const rows = useMemo(() => {
    const list = (data?.bonds ?? []).filter(b => !onlySignals || signalOf(b) === 'cheap' || signalOf(b) === 'rich');
    const key = (b: BondRow) => sort === 'z' ? Math.abs(b.z ?? 0) : sort === 't' ? -b.t : Math.abs(b[sort]);
    return [...list].sort((a, b) => key(b) - key(a));
  }, [data, sort, onlySignals]);

  if (failed) return <p className="text-sm" style={{ color: DIM }}>The bond data could not be loaded.</p>;
  if (!data) return <p className="text-sm" style={{ color: DIM }}>Loading the bond curve.</p>;

  const cheapest = [...measured].sort((a, b) => (b.z ?? 0) - (a.z ?? 0))[0];
  const richest = [...measured].sort((a, b) => (a.z ?? 0) - (b.z ?? 0))[0];
  const signals = measured.filter(b => Math.abs(b.z ?? 0) >= 2).length;
  const picked = data.bonds.find(b => b.id === (sel ?? cheapest?.id)) ?? cheapest;
  const hist = (picked?.history ?? []).map((v, i) => ({ d: i - (picked.history!.length - 1), v }));
  const tMax = Math.ceil(data.grid[data.grid.length - 1][0]);

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Tile title="Universe" value={`${data.curve.universe} bonds`}
          note={`${data.curve.instruments} on the curve, ${data.curve.universe - data.curve.instruments} measured against it`} />
        <Tile title="Curve instruments reprice" value={`${data.curve.worstRepriceCents.toFixed(4)} cents`}
          note="Worst price difference on a benchmark bond" />
        <Tile title="Cheapest against history" value={cheapest ? `${bp(cheapest.z ?? 0, 2)} sd` : '-'}
          note={cheapest ? `${cheapest.name}, ${bp(cheapest.residBp)} bp to the curve` : ''} />
        <Tile title="Richest against history" value={richest ? `${bp(richest.z ?? 0, 2)} sd` : '-'}
          note={richest ? `${richest.name}, ${bp(richest.residBp)} bp to the curve` : ''} />
      </div>

      <Label>The bond curve against ESTR</Label>
      <p className="text-sm mb-3 max-w-4xl" style={{ color: SEC }}>
        Zero rates, continuously compounded. The bond curve is solved from {data.curve.instruments}{' '}
        benchmark bonds, and the dots mark their maturities. The lower chart is the difference
        between the two curves.
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={curveChart} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
          <CartesianGrid stroke={chartGrid} />
          <XAxis dataKey="t" type="number" domain={[0, tMax]} stroke={chartAxis} tick={{ fontSize: 11 }}
            tickFormatter={v => `${v}Y`} />
          <YAxis stroke={chartAxis} tick={{ fontSize: 11 }} width={56} domain={['auto', 'auto']}
            tickFormatter={v => `${Number(v).toFixed(2)}%`} />
          <Tooltip {...tt} labelFormatter={l => `t = ${Number(l).toFixed(2)}Y`}
            formatter={(v, n) => [`${Number(v).toFixed(4)}%`, n === 'gov' ? 'Government bond curve' : 'ESTR']} />
          <Legend formatter={(v: string) => <span style={{ fontSize: 11 }}>{v === 'gov' ? 'Government bond curve' : v === 'ref' ? 'ESTR' : 'Benchmark bonds'}</span>} />
          <Line dataKey="ref" stroke={REF} dot={false} strokeWidth={1.6} isAnimationActive={false} />
          <Line dataKey="gov" stroke={GOV} dot={false} strokeWidth={1.8} isAnimationActive={false} />
          <Scatter name="pillars" data={data.pillars.map(p => ({ t: p.t, gov: p.zero * 100 }))} dataKey="gov"
            fill={GOV} isAnimationActive={false} legendType="circle" />
        </ComposedChart>
      </ResponsiveContainer>
      <ResponsiveContainer width="100%" height={170}>
        <LineChart data={curveChart} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
          <CartesianGrid stroke={chartGrid} />
          <XAxis dataKey="t" type="number" domain={[0, tMax]} stroke={chartAxis} tick={{ fontSize: 11 }}
            tickFormatter={v => `${v}Y`} />
          <YAxis stroke={chartAxis} tick={{ fontSize: 11 }} width={56}
            tickFormatter={v => `${Number(v).toFixed(0)} bp`} />
          <ReferenceLine y={0} stroke={chartAxis} />
          <Tooltip {...tt} labelFormatter={l => `t = ${Number(l).toFixed(2)}Y`}
            formatter={v => [`${Number(v).toFixed(1)} bp`, 'Bond curve less ESTR']} />
          <Line dataKey="spread" stroke={GOV} dot={false} strokeWidth={1.6} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-10">
        <Label>Rich and cheap against the curve</Label>
        <p className="text-sm mb-3 max-w-4xl" style={{ color: SEC }}>
          Each dot is a bond that is not on the curve. The height is its market yield less the
          yield at the curve price, so a bond above the line is cheap. The colour shows where
          today&apos;s value sits in the bond&apos;s own {data.historyDays}-day history, with
          two standard deviations as the threshold. Selecting a dot opens its history below.
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
            <CartesianGrid stroke={chartGrid} />
            <XAxis dataKey="t" type="number" domain={[0, tMax]} stroke={chartAxis} tick={{ fontSize: 11 }}
              tickFormatter={v => `${v}Y`} name="maturity" />
            <YAxis dataKey="residBp" type="number" stroke={chartAxis} tick={{ fontSize: 11 }} width={56}
              tickFormatter={v => `${v} bp`} name="residual" />
            <ReferenceLine y={0} stroke={chartAxis} />
            <Tooltip {...tt} cursor={{ strokeDasharray: '3 3' }}
              content={({ payload }) => {
                const r = payload?.[0]?.payload as BondRow | undefined;
                if (!r) return null;
                return (
                  <div style={{ ...tt.contentStyle, padding: '8px 10px' }}>
                    <div style={{ color: PRI, fontWeight: 600 }}>{r.name}</div>
                    <div style={{ color: SEC }}>{bp(r.residBp)} bp to the curve, {bp(r.z ?? 0, 2)} sd</div>
                    <div style={{ color: DIM }}>z-spread {bp(r.zSpreadBp)} bp, asset swap {bp(r.aswBp)} bp</div>
                  </div>
                );
              }} />
            <Scatter data={measured} isAnimationActive={false} onClick={(p: { payload?: BondRow }) => p?.payload && setSel(p.payload.id)}>
              {measured.map(r => (
                <Cell key={r.id} fill={colourOf(r)} stroke={r.id === picked?.id ? PRI : 'none'}
                  strokeWidth={1.5} style={{ cursor: 'pointer' }} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        <div className="flex gap-5 flex-wrap font-mono text-[11px] mt-1" style={{ color: DIM }}>
          <span><span style={{ color: CHEAP }}>&#9679;</span> cheap, 2 sd or more</span>
          <span><span style={{ color: RICH }}>&#9679;</span> rich, 2 sd or more</span>
          <span><span style={{ color: NEUTRAL }}>&#9679;</span> inside 2 sd</span>
          <span>{signals} of {measured.length} bonds outside 2 sd</span>
        </div>
      </div>

      {picked && hist.length > 0 && (
        <div className="mt-8">
          <Label>{picked.name}, residual history</Label>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={hist} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
              <CartesianGrid stroke={chartGrid} />
              <XAxis dataKey="d" type="number" domain={['dataMin', 0]} stroke={chartAxis} tick={{ fontSize: 11 }}
                tickFormatter={v => v === 0 ? 'today' : `${v}d`} />
              <YAxis stroke={chartAxis} tick={{ fontSize: 11 }} width={56} domain={['auto', 'auto']}
                tickFormatter={v => `${Number(v).toFixed(0)} bp`} />
              <ReferenceArea y1={(picked.histMean ?? 0) - 2 * (picked.histSd ?? 0)}
                y2={(picked.histMean ?? 0) + 2 * (picked.histSd ?? 0)} fill={NEUTRAL} fillOpacity={0.12} />
              <ReferenceLine y={picked.histMean} stroke={NEUTRAL} strokeDasharray="4 4" />
              <ReferenceLine y={picked.residBp} stroke={colourOf(picked)}
                label={{ value: `today ${bp(picked.residBp)} bp`, position: 'insideTopRight', fill: colourOf(picked), fontSize: 11 }} />
              <Tooltip {...tt} labelFormatter={l => `${l} business days`}
                formatter={v => [`${Number(v).toFixed(2)} bp`, 'Residual']} />
              <Line dataKey="v" stroke={PRI} dot={false} strokeWidth={1.2} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs mt-1" style={{ color: DIM }}>
            The band is the mean plus and minus two standard deviations over {data.historyDays} business days.
            The history is generated.
          </p>
        </div>
      )}

      <div className="mt-10">
        <div className="flex items-baseline justify-between gap-4 flex-wrap mb-2">
          <Label>Every bond</Label>
          <div className="flex gap-2 flex-wrap font-mono text-[11px]">
            {([['z', 'History'], ['residBp', 'Residual'], ['zSpreadBp', 'Z-spread'], ['aswBp', 'Asset swap'], ['t', 'Maturity']] as [SortKey, string][]).map(([k, l]) => (
              <button key={k} onClick={() => setSort(k)} className="px-2 py-1 rounded"
                style={{ border: `1px solid ${EDGE}`, color: sort === k ? PRI : DIM, background: sort === k ? CARD : 'transparent' }}>
                Sort by {l.toLowerCase()}
              </button>
            ))}
            <button onClick={() => setOnlySignals(v => !v)} className="px-2 py-1 rounded"
              style={{ border: `1px solid ${EDGE}`, color: onlySignals ? PRI : DIM, background: onlySignals ? CARD : 'transparent' }}>
              {onlySignals ? `Show all ${data.bonds.length}` : 'Show rich and cheap only'}
            </button>
          </div>
        </div>
        <div className="rounded-lg overflow-x-auto" style={{ border: `1px solid ${EDGE}` }}>
          <table className="w-full text-xs font-mono" style={{ background: CARD }}>
            <thead>
              <tr style={{ color: DIM }}>
                {['Bond', 'Role', 'Clean price', 'Yield', 'Residual', 'History', 'Z-spread', 'Asset swap', 'Duration', 'DV01 per 100'].map((h, i) => (
                  <th key={h} className={`font-normal uppercase tracking-wider text-[10px] px-3 py-2 ${i < 2 ? 'text-left' : 'text-right'}`}
                    style={{ borderBottom: `1px solid ${EDGE}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} onClick={() => !r.onCurve && setSel(r.id)}
                  style={{ borderTop: i ? `1px solid ${EDGE}` : undefined, cursor: r.onCurve ? 'default' : 'pointer',
                           background: r.id === picked?.id ? 'var(--bg-surface)' : undefined }}>
                  <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: PRI, fontFamily: 'inherit' }}>{r.name}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: colourOf(r) }}>
                    {r.onCurve ? `curve, ${r.benchmark}` : signalOf(r)}
                  </td>
                  <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{r.clean.toFixed(3)}</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{(r.yield * 100).toFixed(3)}%</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{r.onCurve ? '0.0' : bp(r.residBp)} bp</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: colourOf(r) }}>{r.z === undefined ? '-' : `${bp(r.z, 2)} sd`}</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{bp(r.zSpreadBp)} bp</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{bp(r.aswBp)} bp</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{r.modDur.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{r.dv01.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs mt-2 max-w-4xl" style={{ color: DIM }}>
          Valuation {data.date}, settlement {data.settlement}. The bonds, their prices and their history are
          generated, and no row is a real security or a real quote.
        </p>
      </div>
    </div>
  );
}
