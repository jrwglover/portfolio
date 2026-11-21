import { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { Timeline } from './Workstation';
import { S, type BondEvent, type ScreenRow } from './bondDesk';

/* The government bond desk on the recorded session. Every number is read from
   timeline.json: the engine marked the whole bond universe and the bond book
   on each set it published, and this panel steps through those sets. The
   bonds, their prices and their history are generated. */

const CARD = 'var(--bg-card)';
const EDGE = 'var(--border-subtle)';
const DIM = 'var(--text-dim)';
const SEC = 'var(--text-secondary)';
const PRI = 'var(--text-primary)';
const GOV = '#d9a441';
const REF = '#e07850';
const CHEAP = '#5cb87a';
const RICH = '#c86e6e';
const NEUTRAL = '#6f6e80';
const STATIC = '#8b7ec8';
const chartGrid = '#1a1a28';
const chartAxis = '#55546a';
const tt = {
  contentStyle: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 6, fontSize: 12 },
  labelStyle: { color: '#8b8a97' },
};

const money = (v: number) => (v < 0 ? '-' : '') + Math.abs(Math.round(v)).toLocaleString();
const signed = (v: number) => (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(Math.round(v)).toLocaleString();
const bp = (v: number, d = 1) => (v >= 0 ? '+' : '') + v.toFixed(d);
const ms = (us: number) => us >= 1000 ? (us / 1000).toFixed(1) + ' ms' : us + ' µs';
const pnlColour = (v: number) => (Math.abs(v) < 0.5 ? SEC : v > 0 ? CHEAP : RICH);
const utilColour = (u: number) => (u > 1.0 ? RICH : u > 0.85 ? GOV : SEC);
// A gate value or limit as a number a reader can take in: small and large
// ones in exponent form, the rest as they are.
const gateNum = (v: number) => v === 0 ? '0'
  : Math.abs(v) < 1e-2 || Math.abs(v) >= 1e6 ? v.toExponential(1)
    : v.toLocaleString(undefined, { maximumFractionDigits: 4 });
const LIMIT_LINE: Record<string, [string, string]> = {
  EUR_GOVT: ['Govt bonds limit', 'net DV01 on the government curve, in the desk total'],
  GOVT_CS01: ['Govt CS01 limit', 'DV01 to the bonds\' own spreads'],
  BOND_NET: ['Bond net limit', 'bonds and the GOVT_RV hedge swaps'],
};

function Tile({ title, value, note, colour }: { title: string; value: string; note: string; colour?: string }) {
  return (
    <div className="rounded-lg px-4 py-3" style={{ background: CARD, border: `1px solid ${EDGE}` }}>
      <div className="font-mono text-[10px] uppercase tracking-wider" style={{ color: DIM }}>{title}</div>
      <div className="text-lg font-semibold mt-1" style={{ color: colour ?? PRI }}>{value}</div>
      <div className="text-xs mt-0.5" style={{ color: SEC }}>{note}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-sm mb-2 font-mono uppercase tracking-wider" style={{ color: DIM }}>{children}</p>;
}

// A curve as the file publishes it: times once, then zero, instantaneous
// forward and half-year forward per time on the sets the curve rebuilt on.
// The values that stand on a set are the last ones written at or before it.
function standing(tl: Timeline, i: number, id: string): { t: number; z: number }[] {
  let times: number[] | undefined, vals: number[] | undefined;
  for (let k = i; k >= 0 && (!times || !vals); k--) {
    const f = tl.frames[k];
    if (!vals && f.curves?.[id]) vals = f.curves[id];
    if (!times && f.curveT?.[id]) times = f.curveT[id];
  }
  if (!times || !vals) return [];
  const n = Math.min(times.length, Math.floor(vals.length / 3));
  const out: { t: number; z: number }[] = [];
  for (let k = 0; k < n; k++) out.push({ t: times[k], z: vals[3 * k] * 100 });
  return out;
}

function at(curve: { t: number; z: number }[], t: number): number | null {
  if (!curve.length) return null;
  if (t <= curve[0].t) return curve[0].z;
  for (let k = 1; k < curve.length; k++) {
    if (t <= curve[k].t) {
      const a = curve[k - 1], b = curve[k];
      return b.t === a.t ? b.z : a.z + (b.z - a.z) * (t - a.t) / (b.t - a.t);
    }
  }
  return curve[curve.length - 1].z;
}

export default function BondDeskTab({ tl }: { tl: Timeline }) {
  const desk = tl.bondDesk;
  const first = Math.max(0, tl.frames.findIndex(f => (f.bond?.events.length ?? 0) > 0));
  const [i, setI] = useState(first);
  const [showAll, setShowAll] = useState(false);
  const [showPositions, setShowPositions] = useState(false);

  const f = tl.frames[i];
  const b = f?.bond;
  const prev = i > 0 ? tl.frames[i - 1].bond : undefined;

  const curves = useMemo(() => {
    if (!desk) return { rows: [], delta: [], tMax: 30 };
    const gov = standing(tl, i, desk.curve), ref = standing(tl, i, desk.swapCurve);
    const gov0 = standing(tl, 0, desk.curve);
    const govP = i > 0 ? standing(tl, i - 1, desk.curve) : gov;
    const refP = i > 0 ? standing(tl, i - 1, desk.swapCurve) : ref;
    const tMax = Math.ceil(gov.length ? gov[gov.length - 1].t : 30);
    const rows: { t: number; gov: number | null; ref: number | null; open: number | null }[] = [];
    const delta: { t: number; gov: number; ref: number }[] = [];
    for (let k = 1; k <= 240; k++) {
      const t = tMax * k / 240;
      const g = at(gov, t), r = at(ref, t);
      rows.push({ t, gov: g, ref: r, open: at(gov0, t) });
      delta.push({ t, gov: ((g ?? 0) - (at(govP, t) ?? 0)) * 100, ref: ((r ?? 0) - (at(refP, t) ?? 0)) * 100 });
    }
    return { rows, delta, tMax };
  }, [tl, i, desk]);

  const screen = useMemo(() => {
    if (!desk || !b) return [];
    const touched = new Set(b.events.map(e => e.id));
    const held = new Set(desk.positions.map(p => p.bond));
    return desk.bonds.map((info, k) => {
      const r = b.screen[k] as ScreenRow | null;
      const p = prev?.screen[k] as ScreenRow | null | undefined;
      return {
        k, info, r, touched: touched.has(info.id), held: held.has(k),
        t: info.years, resid: r ? r[S.resid] : 0, z: r ? r[S.z] : null,
        dResid: r && p ? r[S.resid] - p[S.resid] : null,
        dClean: r && p ? r[S.clean] - p[S.clean] : null,
        dZs: r && p ? r[S.zSpread] - p[S.zSpread] : null,
      };
    });
  }, [desk, b, prev]);

  if (!desk || !b) {
    return <p className="text-sm" style={{ color: DIM }}>The recorded session carries no bond desk.</p>;
  }

  const offCurve = screen.filter(s => !s.info.onCurve && s.r);
  const signals = offCurve.filter(s => Math.abs(s.z ?? 0) >= 2).length;
  const colourOf = (s: typeof screen[number]) =>
    s.info.onCurve ? GOV : (s.z ?? 0) >= 2 ? CHEAP : (s.z ?? 0) <= -2 ? RICH : NEUTRAL;
  const movers = [...screen].filter(s => s.r).sort((x, y) =>
    Number(y.touched) - Number(x.touched)
    || Math.abs(y.dResid ?? 0) - Math.abs(x.dResid ?? 0)
    || Math.abs(y.dClean ?? 0) - Math.abs(x.dClean ?? 0)
    || Math.abs(y.z ?? 0) - Math.abs(x.z ?? 0));
  const shownRows = showAll ? movers : movers.slice(0, 10);

  const staticEvent = b.events.some(e => e.kind === 'static');
  const curveEvent = b.events.some(e => e.onCurve);
  const eventLine = (e: BondEvent) => {
    const info = desk.bonds.find(x => x.id === e.id);
    return `${info?.name ?? e.id}: ${e.field.toLowerCase()} ${e.from} to ${e.to}`;
  };
  const outcome = b.events.length === 0
    ? 'No bond price and no bond record arrived on this set. The bonds are marked where they were and measured against the curves this set carries.'
    : b.rebuilt
      ? `The government curve was solved again in ${ms(f.cycleUs)} and published as version ${b.version}. No other curve was rebuilt.`
      : curveEvent
        ? 'The event was applied and the curve did not need to change.'
        : 'The bond is not a curve instrument, so no curve was rebuilt and no set was published.';

  // The desk in the book's limits, VaR and books on this set, when the export
  // carries them. Older data has none of these, and the strip stays off.
  const bondLines = (f.bl?.net ?? []).filter(r => r.key in LIMIT_LINE);
  const bondVar = f.varRt?.bonds && f.varRt ? { bonds: f.varRt.bonds.var99, total: f.varRt.var99 } : null;
  const govtRow = f.books.find(x => x.book === 'GOVT_RV' && x.positions !== undefined) ?? null;
  const inBook = bondLines.length > 0 || bondVar !== null || govtRow !== null;
  const bookGates = desk.bookGates ?? [];

  const govLad = b.govT.map((t, k) => ({ t, v: b.book.govLad[k] ?? 0 })).filter(d => d.t > 0);
  const swapLad = desk.swapT.map((t, k) => ({ t, v: b.book.swapLad[k] ?? 0 })).filter(d => d.t > 0.2);
  const bucket = (t: number) => t < 1 ? `${Math.round(t * 12)}M` : `${t.toFixed(t < 10 ? 1 : 0)}Y`;

  return (
    <div>
      <h3 className="text-base font-semibold mb-1" style={{ color: PRI }}>Government bonds</h3>
      <p className="text-sm mb-4 max-w-4xl" style={{ color: DIM }}>
        The recorded session also carries a government bond curve, {desk.bonds.length} bonds
        and a book of {desk.positions.length} bond positions hedged with {desk.hedges.length} swaps.
        The curve is one more curve in the engine. A bond price or a change in a bond&apos;s
        terms arrives as an event, and the desk is marked again on every set. The first nine
        sets are the rate session, where no bond trades. The last eight are bond events.
      </p>

      {/* ---- the sets ---- */}
      <div className="flex gap-1.5 mb-3 flex-wrap font-mono text-[11px] items-center">
        <button onClick={() => setI(x => Math.max(0, x - 1))} className="px-2 py-1 rounded navchip"
          style={{ border: `1px solid ${EDGE}`, color: SEC }} aria-label="Previous set">&#8592;</button>
        {tl.frames.map((fr, k) => {
          const ev = fr.bond?.events ?? [];
          const colour = ev.some(e => e.kind === 'static') ? STATIC : ev.length ? GOV : '#5b8fc9';
          const on = k === i;
          return (
            <button key={k} onClick={() => setI(k)} title={fr.label} className="px-2 py-1 rounded"
              style={{ border: `1px solid ${on ? colour : EDGE}`, color: on ? colour : ev.length ? colour : DIM,
                       background: on ? colour + '1a' : 'transparent', minWidth: 30 }}>{k + 1}</button>
          );
        })}
        <button onClick={() => setI(x => Math.min(tl.frames.length - 1, x + 1))} className="px-2 py-1 rounded navchip"
          style={{ border: `1px solid ${EDGE}`, color: SEC }} aria-label="Next set">&#8594;</button>
        <span className="ml-2" style={{ color: DIM }}>
          <span style={{ color: '#5b8fc9' }}>&#9632;</span> rates{' '}
          <span style={{ color: GOV }}>&#9632;</span> bond price{' '}
          <span style={{ color: STATIC }}>&#9632;</span> static record
        </span>
      </div>

      <div className="rounded px-4 py-3 mb-4" style={{ border: `1px solid ${staticEvent ? STATIC : GOV}55`, background: `${staticEvent ? STATIC : GOV}0a` }}>
        <div className="font-mono text-xs mb-1" style={{ color: staticEvent ? STATIC : GOV }}>
          Set {i + 1} of {tl.frames.length}. {f.label}
        </div>
        <div className="text-xs mb-2" style={{ color: SEC }}>{f.note}.</div>
        {b.events.length > 0 && (
          <div className="font-mono text-[11px] mb-2" style={{ color: PRI }}>
            {b.events.slice(0, 3).map((e, k) => <div key={k}>{eventLine(e)}</div>)}
            {b.events.length > 3 && <div style={{ color: DIM }}>and {b.events.length - 3} more prices</div>}
          </div>
        )}
        <div className="text-xs" style={{ color: DIM }}>
          {outcome} The desk marked {desk.bonds.length} bonds and the book in {ms(b.us)}.
        </div>
      </div>

      {/* ---- the book in four numbers ---- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Tile title="Book P&L since the open" value={signed(b.book.pnl)} colour={pnlColour(b.book.pnl)}
          note={`Bonds at market ${money(b.book.value)}`} />
        <Tile title="From the bond curve" value={signed(b.book.pnlCurve)} colour={pnlColour(b.book.pnlCurve)}
          note="Each bond on this curve at the spread it opened with" />
        <Tile title="From each bond's own spread" value={signed(b.book.pnlSpread)} colour={pnlColour(b.book.pnlSpread)}
          note="The rest of the move in its market price" />
        <Tile title="From the swap hedges" value={signed(b.book.pnlHedge)} colour={pnlColour(b.book.pnlHedge)}
          note={`${desk.hedges.length} swaps on ESTR`} />
      </div>

      {/* ---- the desk in the book ---- */}
      {inBook && (
        <div className="mb-8">
          <Label>The desk in the book&apos;s limits and VaR on this set</Label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-2">
            {bondLines.map(r => (
              <Tile key={r.key} title={LIMIT_LINE[r.key][0]} value={`${(r.util * 100).toFixed(1)}%`}
                colour={utilColour(r.util)}
                note={`${money(r.dv01)} of ${money(r.limit)}, ${LIMIT_LINE[r.key][1]}`} />
            ))}
            {bondVar && (
              <Tile title="Bond VaR, 99% 1-day" value={money(bondVar.bonds)}
                note={`the positions alone, the whole book ${money(bondVar.total)}`} />
            )}
            {govtRow && (
              <Tile title="Book GOVT_RV" value={money(govtRow.npv)}
                note={`${govtRow.positions} positions and ${govtRow.trades} hedge swaps, DV01 ${signed(govtRow.dv01)}`} />
            )}
          </div>
          <p className="text-xs max-w-4xl" style={{ color: DIM }}>
            The positions are in the book as GOVT_RV, and the hedge swaps are priced in
            the swap lanes with the rest of the book. The bond limit lines are read off
            the positions&apos; zero pillar ladder at held spread. VaR revalues the
            positions in full on every scenario and adds them to the swap P&amp;L, and the
            stress table has a GOVT_RV column. At the close the bond prices are verified
            against a generated consensus, and their valuation adjustments are a line of
            their own in the deduction.
          </p>
        </div>
      )}

      {/* ---- the curve ---- */}
      <div className="grid lg:grid-cols-2 gap-6 mb-10">
        <div>
          <Label>The two curves on this set</Label>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={curves.rows} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid stroke={chartGrid} />
              <XAxis dataKey="t" type="number" domain={[0, curves.tMax]} stroke={chartAxis} tick={{ fontSize: 11 }}
                tickFormatter={v => `${v}Y`} />
              <YAxis stroke={chartAxis} tick={{ fontSize: 11 }} width={52} domain={['auto', 'auto']}
                tickFormatter={v => `${Number(v).toFixed(2)}%`} />
              <Tooltip {...tt} labelFormatter={l => `t = ${Number(l).toFixed(2)}Y`}
                formatter={(v, n) => [`${Number(v).toFixed(4)}%`,
                  n === 'gov' ? 'Government curve' : n === 'ref' ? 'ESTR' : n === 'open' ? 'Government curve, first set' : 'Benchmark bond']} />
              <Line dataKey="ref" stroke={REF} dot={false} strokeWidth={1.5} isAnimationActive={false} />
              <Line dataKey="open" stroke={GOV} strokeDasharray="4 4" strokeOpacity={0.55} dot={false} strokeWidth={1.2} isAnimationActive={false} />
              <Line dataKey="gov" stroke={GOV} dot={false} strokeWidth={1.8} isAnimationActive={false} />
              <Scatter name="pillar" data={b.govT.map((t, k) => ({ t, gov: b.govZ[k] })).filter(p => p.t > 0)}
                dataKey="gov" fill={GOV} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="text-xs mt-1" style={{ color: DIM }}>
            Zero rates. <span style={{ color: GOV }}>Government curve</span>, with a dot at each
            benchmark bond and a dashed line for the first set of the session.{' '}
            <span style={{ color: REF }}>ESTR</span> from the same set.
          </p>
        </div>
        <div>
          <Label>Change against the previous set</Label>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={curves.delta} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid stroke={chartGrid} />
              <XAxis dataKey="t" type="number" domain={[0, curves.tMax]} stroke={chartAxis} tick={{ fontSize: 11 }}
                tickFormatter={v => `${v}Y`} />
              <YAxis stroke={chartAxis} tick={{ fontSize: 11 }} width={52} domain={['auto', 'auto']}
                tickFormatter={v => `${Number(v).toFixed(1)} bp`} />
              <ReferenceLine y={0} stroke={chartAxis} />
              <Tooltip {...tt} labelFormatter={l => `t = ${Number(l).toFixed(2)}Y`}
                formatter={(v, n) => [`${Number(v).toFixed(2)} bp`, n === 'gov' ? 'Government curve' : 'ESTR']} />
              <Line dataKey="ref" stroke={REF} dot={false} strokeWidth={1.5} isAnimationActive={false} />
              <Line dataKey="gov" stroke={GOV} dot={false} strokeWidth={1.8} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs mt-1" style={{ color: DIM }}>
            Zero rates on this set less the set before, in basis points. A change to one bond moves
            the curve around that bond&apos;s maturity and leaves the rest where it was.
          </p>
        </div>
      </div>

      {/* ---- the screen ---- */}
      <Label>Rich and cheap on this set</Label>
      <p className="text-sm mb-3 max-w-4xl" style={{ color: SEC }}>
        Each dot is a bond off the curve. The height is its yield less the yield at its curve
        price, so a bond above the line is cheap. A ring marks a bond with an event on this set.
        {' '}{signals} of {offCurve.length} bonds sit two standard deviations or more from their own history.
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid stroke={chartGrid} />
          <XAxis dataKey="t" type="number" domain={[0, curves.tMax]} stroke={chartAxis} tick={{ fontSize: 11 }}
            tickFormatter={v => `${v}Y`} name="maturity" />
          <YAxis dataKey="resid" type="number" stroke={chartAxis} tick={{ fontSize: 11 }} width={52}
            tickFormatter={v => `${v} bp`} name="residual" />
          <ReferenceLine y={0} stroke={chartAxis} />
          <Tooltip {...tt} cursor={{ strokeDasharray: '3 3' }}
            content={({ payload }) => {
              const s = payload?.[0]?.payload as typeof screen[number] | undefined;
              if (!s || !s.r) return null;
              return (
                <div style={{ ...tt.contentStyle, padding: '8px 10px' }}>
                  <div style={{ color: PRI, fontWeight: 600 }}>{s.info.name}</div>
                  <div style={{ color: SEC }}>{bp(s.resid)} bp to the curve{s.z !== null ? `, ${bp(s.z, 2)} sd` : ''}</div>
                  <div style={{ color: DIM }}>z-spread {bp(s.r[S.zSpread])} bp, asset swap {bp(s.r[S.asw])} bp</div>
                </div>
              );
            }} />
          <Scatter data={offCurve} isAnimationActive={false}>
            {offCurve.map(s => (
              <Cell key={s.info.id} fill={colourOf(s)} stroke={s.touched ? PRI : 'none'} strokeWidth={1.6} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex gap-5 flex-wrap font-mono text-[11px] mt-1 mb-4" style={{ color: DIM }}>
        <span><span style={{ color: CHEAP }}>&#9679;</span> cheap, 2 sd or more</span>
        <span><span style={{ color: RICH }}>&#9679;</span> rich, 2 sd or more</span>
        <span><span style={{ color: NEUTRAL }}>&#9679;</span> inside 2 sd</span>
      </div>

      <div className="flex items-baseline justify-between gap-4 flex-wrap mb-2">
        <Label>{showAll ? 'Every bond on this set' : 'What moved most on this set'}</Label>
        <button onClick={() => setShowAll(v => !v)} className="px-2 py-1 rounded font-mono text-[11px]"
          style={{ border: `1px solid ${EDGE}`, color: showAll ? PRI : DIM, background: showAll ? CARD : 'transparent' }}>
          {showAll ? 'Show the ten that moved most' : `Show all ${desk.bonds.length}`}
        </button>
      </div>
      <div className="rounded-lg overflow-x-auto mb-10" style={{ border: `1px solid ${EDGE}` }}>
        <table className="w-full text-xs font-mono" style={{ background: CARD }}>
          <thead>
            <tr style={{ color: DIM }}>
              {['Bond', 'Role', 'Clean price', 'Yield', 'Residual', 'Change', 'History', 'Z-spread', 'Change', 'Asset swap'].map((h, k) => (
                <th key={k} className={`font-normal uppercase tracking-wider text-[10px] px-3 py-2 ${k < 2 ? 'text-left' : 'text-right'}`}
                  style={{ borderBottom: `1px solid ${EDGE}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shownRows.map((s, k) => s.r && (
              <tr key={s.info.id} style={{ borderTop: k ? `1px solid ${EDGE}` : undefined,
                                           background: s.touched ? 'var(--bg-surface)' : undefined }}>
                <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: PRI, fontFamily: 'inherit' }}>{s.info.name}</td>
                <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: colourOf(s) }}>
                  {s.info.onCurve ? `curve, ${s.info.benchmark}` : (s.z ?? 0) >= 2 ? 'cheap' : (s.z ?? 0) <= -2 ? 'rich' : 'fair'}
                  {s.held ? ', held' : ''}
                </td>
                <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{s.r[S.clean].toFixed(4)}</td>
                <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{s.r[S.yield].toFixed(3)}%</td>
                <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{bp(s.resid, 2)} bp</td>
                <td className="px-3 py-1.5 text-right" style={{ color: Math.abs(s.dResid ?? 0) >= 0.05 ? PRI : DIM }}>
                  {s.dResid === null ? '-' : bp(s.dResid, 2)}
                </td>
                <td className="px-3 py-1.5 text-right" style={{ color: colourOf(s) }}>{s.z === null ? '-' : `${bp(s.z, 2)} sd`}</td>
                <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{bp(s.r[S.zSpread])} bp</td>
                <td className="px-3 py-1.5 text-right" style={{ color: Math.abs(s.dZs ?? 0) >= 0.05 ? PRI : DIM }}>
                  {s.dZs === null ? '-' : bp(s.dZs, 2)}
                </td>
                <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{bp(s.r[S.asw])} bp</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---- the book ---- */}
      <Label>The book, by package</Label>
      <p className="text-sm mb-3 max-w-4xl" style={{ color: SEC }}>
        The book was put on at the open from the screen. A bond two standard deviations cheap
        was bought and swapped. A bond that rich was sold against the nearest benchmark. An
        inventory in the benchmark bonds is hedged with four swaps. Each package opened with no
        net value of a basis point, so what it makes or loses is the spread it was put on for.
      </p>
      <div className="rounded-lg overflow-x-auto mb-3" style={{ border: `1px solid ${EDGE}` }}>
        <table className="w-full text-xs font-mono" style={{ background: CARD }}>
          <thead>
            <tr style={{ color: DIM }}>
              {['Package', 'Kind', 'P&L', 'Bond curve', 'Own spread', 'Swap hedge', 'DV01 bonds', 'DV01 swaps'].map((h, k) => (
                <th key={h} className={`font-normal uppercase tracking-wider text-[10px] px-3 py-2 ${k < 2 ? 'text-left' : 'text-right'}`}
                  style={{ borderBottom: `1px solid ${EDGE}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {desk.packages.map((p, k) => {
              const v = b.book.packages[k] ?? [0, 0, 0, 0, 0, 0];
              const name = p.name.replace(/GOV\w+/g, id => desk.bonds.find(x => x.id === id)?.name.replace(/^(Bond|Note|Bill) /, '') ?? id)
                .replace(/^ASW /, '').replace(/^SW /, '').replace(' / ', ' against ');
              return (
                <tr key={p.name} style={{ borderTop: k ? `1px solid ${EDGE}` : undefined }}>
                  <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: PRI, fontFamily: 'inherit' }}>{name}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: SEC }}>{p.strategy}</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: pnlColour(v[0]) }}>{signed(v[0])}</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{signed(v[1])}</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{signed(v[2])}</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{p.strategy === 'Switch' ? '-' : signed(v[3])}</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{signed(v[4])}</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{p.strategy === 'Switch' ? '-' : signed(v[5])}</td>
                </tr>
              );
            })}
            <tr style={{ borderTop: `1px solid ${EDGE}` }}>
              <td className="px-3 py-1.5" style={{ color: PRI, fontFamily: 'inherit' }}>Book</td>
              <td />
              <td className="px-3 py-1.5 text-right" style={{ color: pnlColour(b.book.pnl) }}>{signed(b.book.pnl)}</td>
              <td className="px-3 py-1.5 text-right" style={{ color: PRI }}>{signed(b.book.pnlCurve)}</td>
              <td className="px-3 py-1.5 text-right" style={{ color: PRI }}>{signed(b.book.pnlSpread)}</td>
              <td className="px-3 py-1.5 text-right" style={{ color: PRI }}>{signed(b.book.pnlHedge)}</td>
              <td className="px-3 py-1.5 text-right" style={{ color: PRI }}>{signed(b.book.dv01Govt)}</td>
              <td className="px-3 py-1.5 text-right" style={{ color: PRI }}>{signed(b.book.dv01Swap)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs mb-3 max-w-4xl" style={{ color: DIM }}>
        In euros. DV01 is the change in value for one basis point up, on the government curve
        for the bonds and on ESTR for the swaps. The two columns offset only while the two curves
        move together, which is the risk this book is paid to carry.
      </p>
      <button onClick={() => setShowPositions(v => !v)} className="px-2 py-1 rounded font-mono text-[11px] mb-3"
        style={{ border: `1px solid ${EDGE}`, color: showPositions ? PRI : DIM, background: showPositions ? CARD : 'transparent' }}>
        {showPositions ? 'Hide the positions' : `Show the ${desk.positions.length} positions and ${desk.hedges.length} swaps`}
      </button>
      {showPositions && (
        <div className="rounded-lg overflow-x-auto mb-3" style={{ border: `1px solid ${EDGE}` }}>
          <table className="w-full text-xs font-mono" style={{ background: CARD }}>
            <thead>
              <tr style={{ color: DIM }}>
                {['Position', 'Kind', 'Face or notional', 'Clean price', 'Value', 'P&L', 'Bond curve', 'Own spread', 'DV01'].map((h, k) => (
                  <th key={h} className={`font-normal uppercase tracking-wider text-[10px] px-3 py-2 ${k < 2 ? 'text-left' : 'text-right'}`}
                    style={{ borderBottom: `1px solid ${EDGE}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {desk.positions.map((p, k) => {
                const v = b.book.pos[k] ?? [0, 0, 0, 0, 0, 0];
                return (
                  <tr key={k} style={{ borderTop: k ? `1px solid ${EDGE}` : undefined }}>
                    <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: PRI, fontFamily: 'inherit' }}>{desk.bonds[p.bond]?.name}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: SEC }}>{p.strategy}</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{signed(p.face)}</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{v[5].toFixed(4)}</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{money(v[0])}</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: pnlColour(v[1]) }}>{signed(v[1])}</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{signed(v[2])}</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{signed(v[3])}</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{signed(v[4])}</td>
                  </tr>
                );
              })}
              {desk.hedges.map((h, k) => {
                const v = b.book.hedges[k] ?? [0, 0, 0];
                return (
                  <tr key={h.id} style={{ borderTop: `1px solid ${EDGE}` }}>
                    <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: PRI, fontFamily: 'inherit' }}>
                      {h.payer ? 'Pay' : 'Receive'} {h.rate.toFixed(3)}% ESTR to {h.years.toFixed(1)}Y
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: REF }}>Swap hedge</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{money(h.notional)}</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: DIM }}>-</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{money(v[0])}</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: pnlColour(v[1]) }}>{signed(v[1])}</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: DIM }}>-</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: DIM }}>-</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: SEC }}>{signed(v[2])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mt-6 mb-10">
        {([['Bonds, by pillar of the government curve', govLad, GOV],
           ['Swap hedges, by pillar of ESTR', swapLad, REF]] as const).map(([title, data, colour]) => (
          <div key={title}>
            <Label>{title}</Label>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data as { t: number; v: number }[]} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                <CartesianGrid stroke={chartGrid} vertical={false} />
                <XAxis dataKey="t" stroke={chartAxis} tick={{ fontSize: 10 }} interval="preserveStartEnd"
                  tickFormatter={v => bucket(Number(v))} />
                <YAxis stroke={chartAxis} tick={{ fontSize: 11 }} width={52}
                  tickFormatter={v => `${(Number(v) / 1000).toFixed(0)}k`} />
                <ReferenceLine y={0} stroke={chartAxis} />
                <Tooltip {...tt} cursor={{ fill: '#ffffff08' }} labelFormatter={l => bucket(Number(l))}
                  formatter={v => [signed(Number(v)), 'Value of a basis point']} />
                <Bar dataKey="v" fill={colour} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>

      {/* ---- the checks ---- */}
      <Label>What the engine checked on every set</Label>
      <div className="rounded-lg overflow-x-auto max-w-4xl" style={{ border: `1px solid ${EDGE}` }}>
        <table className="w-full text-xs" style={{ background: CARD }}>
          <thead>
            <tr style={{ color: DIM }}>
              {['Check', 'Worst value in the session', 'Limit'].map((h, k) => (
                <th key={h} className={`font-mono font-normal uppercase tracking-wider text-[10px] px-4 py-2 ${k ? 'text-right' : 'text-left'}`}
                  style={{ borderBottom: `1px solid ${EDGE}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {desk.gates.rows.map((g, k) => (
              <tr key={g.name} style={{ borderTop: k ? `1px solid ${EDGE}` : undefined }}>
                <td className="px-4 py-2" style={{ color: SEC }}>{GATE[g.name] ?? g.name}</td>
                <td className="px-4 py-2 text-right font-mono" style={{ color: PRI }}>{g.value === 0 ? '0' : g.value.toExponential(1)}</td>
                <td className="px-4 py-2 text-right font-mono" style={{ color: DIM }}>{g.limit.toExponential(0)}</td>
              </tr>
            ))}
            <tr style={{ borderTop: `1px solid ${EDGE}` }}>
              <td className="px-4 py-2" style={{ color: SEC }}>The government curve rebuilt on the sets with a benchmark price or record, and on no other</td>
              <td className="px-4 py-2 text-right font-mono" style={{ color: PRI }}>{desk.gates.rebuilds} of {desk.gates.sets} sets</td>
              <td className="px-4 py-2 text-right font-mono" style={{ color: DIM }}>must match</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs mt-2 max-w-4xl" style={{ color: DIM }}>
        The desk prices each bond from flattened cashflows, and the engine prices the same bond
        through QuantLib on the same curves as a check, {desk.gates.checks} times in this session.
        The export stops if any row is over its limit. Valuation {desk.valuation}. The bonds,
        their prices and their history are generated, and no row is a real security or a real quote.
      </p>

      {bookGates.length > 0 && (
        <>
          <div className="mt-6"><Label>What the engine checked on the bond book in the risk lanes</Label></div>
          <div className="rounded-lg overflow-x-auto max-w-4xl" style={{ border: `1px solid ${EDGE}` }}>
            <table className="w-full text-xs" style={{ background: CARD }}>
              <thead>
                <tr style={{ color: DIM }}>
                  {['Check', 'Worst value', 'Limit', 'Runs'].map((h, k) => (
                    <th key={h} className={`font-mono font-normal uppercase tracking-wider text-[10px] px-4 py-2 ${k ? 'text-right' : 'text-left'}`}
                      style={{ borderBottom: `1px solid ${EDGE}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bookGates.map((g, k) => (
                  <tr key={g.name} style={{ borderTop: k ? `1px solid ${EDGE}` : undefined }}>
                    <td className="px-4 py-2" style={{ color: SEC }}>{g.name}</td>
                    <td className="px-4 py-2 text-right font-mono" style={{ color: PRI }}>{gateNum(g.value)}</td>
                    <td className="px-4 py-2 text-right font-mono" style={{ color: DIM }}>{gateNum(g.limit)}</td>
                    <td className="px-4 py-2 text-right font-mono" style={{ color: DIM }}>{g.runs.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs mt-2 max-w-4xl" style={{ color: DIM }}>
            These hold the bond book to the risk lanes it joins. The hedge swaps in the
            swap lane agree with the desk&apos;s own marks, the scenario evaluator agrees
            with the desk&apos;s value and DV01, the limit lines add up from the pillar
            ladder, and each stress and adjustment total adds up from its rows. A failed
            check stops the export.
          </p>
        </>
      )}
    </div>
  );
}

const GATE: Record<string, string> = {
  'curve round trip, cents per 100': 'Each benchmark bond priced off the curve it built, against its quote, in cents per 100',
  'yield against QuantLib, bp': 'Yield from the flattened cashflows against QuantLib, in basis points',
  'curve price against QuantLib, cents per 100': 'Curve price from the flattened cashflows against QuantLib, in cents per 100',
  'z-spread against QuantLib, bp': 'Z-spread over ESTR against QuantLib, in basis points',
  'accrued against QuantLib, cents per 100': 'Accrued interest against QuantLib, in cents per 100',
  'P&L split against market value, currency': 'Curve part plus spread part against the change in market value, in euros',
  'ladder against parallel, relative': 'Sum of the pillar ladder against the parallel basis point, as a fraction',
};
