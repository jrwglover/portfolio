import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

interface Row {
  id: string; book: string; npv: number; dv01: number; fair: number; degraded: boolean;
}
interface BookAgg {
  book: string; trades: number; npv: number; dv01: number;
  failed: number; degraded: number;
}
// [maturity, zero-bucket pv01, forward-bucket pv01]
type Bucket = [number, number, number];

interface Frame {
  label: string; note: string; ticks: string[];
  epoch: number; published: boolean;
  rebuilt: string[]; failed: string[];
  applied: number; duplicate: number; cycleUs: number;
  status: Record<string, string>;
  rows: Row[]; books: BookAgg[];
  deskNpv: number; deskDv01: number;
  npvUs: number; riskUs: number; threads: number; buckets: number;
  // Each curve as its own coefficients, flat: [c0,c1,c2,c3,xL,xR,form] per
  // interval. The curve itself, not a sampling of it.
  curves: Record<string, number[]>;
  risk: Record<string, Bucket[]>;
}

// ---- position detail ------------------------------------------------------
// [node maturity, pv01] for the two curve-node domains, [quote id, pv01] for
// the market one. Market rows are per quoted instrument, so they carry the
// instrument's name where the others carry a time.
type Node = [number, number];
type QuoteRow = [string, number];
interface CurveLadder {
  zero: Node[]; fwd: Node[]; mkt: QuoteRow[];
  partial?: boolean;  // a node or a bump that did not build, dropped and flagged
}
interface Position {
  id: string; book: string; kind: 'book' | 'draft'; type: string;
  notional: number; maturity: number; strike: number;
  npv: number; dv01: number; fair: number;
  curves: string[]; note: string;
}
interface Detail {
  frame: number; epoch: number;
  ladderUs: number; mktUs: number; mktRebuilds: number;
  positions: Position[];
  tradeRisk: Record<string, Record<string, CurveLadder>>;
}

export interface Timeline {
  trades: number; cashflows: number; aged: number; threads: number;
  curveIds: string[]; frames: Frame[];
  detail?: Detail;
}

const LABEL: Record<string, string> = {
  EUR_ESTR: 'ESTR', EUR_ESTR_ECB: 'ESTR meeting', EUR_ESTR_IMM: 'ESTR IMM',
  EUR_ESTR_IMMFUT: 'ESTR IMM fut', EUR_EURIBOR6M: 'EURIBOR 6M',
  USD_SOFR: 'SOFR', GBP_SONIA: 'SONIA', EUR_USD_XCCY: 'EUR/USD xccy',
};

// The curve model's own colours, so a curve is the same colour on both projects.
const COLOUR: Record<string, string> = {
  EUR_ESTR: '#d4a853', EUR_ESTR_ECB: '#e07850', EUR_ESTR_IMM: '#5cb87a',
  EUR_ESTR_IMMFUT: '#b8b04a', EUR_EURIBOR6M: '#8b7ec8', EUR_USD_XCCY: '#4a9a68',
  USD_SOFR: '#9a8bd8', GBP_SONIA: '#c86e6e',
};

const chip = (on: boolean, colour: string) => ({
  border: `1px solid ${on ? colour : 'var(--border-subtle)'}`,
  color: on ? colour : 'var(--text-dim)',
  background: on ? colour + '18' : 'transparent',
});

const money = (v: number) =>
  (v < 0 ? '-' : '') + Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 });

const millions = (v: number) =>
  (v < 0 ? '-' : '') + (Math.abs(v) / 1e6).toFixed(1) + 'm';

// Microseconds in, a unit a person reads out. The engine reports everything in
// microseconds and these span five orders of magnitude, from a cycle that did
// nothing to a four second ladder.
const ms = (us: number) =>
  us >= 1e6 ? (us / 1e6).toFixed(2) + ' s'
    : us >= 1e3 ? Math.round(us / 1e3) + ' ms'
      : us + ' µs';

// ---------------------------------------------------------------------------
// Reading a curve
// ---------------------------------------------------------------------------

interface Seg { c0: number; c1: number; c2: number; c3: number; xL: number; xR: number; form: number }

const segments = (flat: number[]): Seg[] => {
  const out: Seg[] = [];
  for (let i = 0; i + 6 < flat.length; i += 7)
    out.push({ c0: flat[i], c1: flat[i + 1], c2: flat[i + 2], c3: flat[i + 3],
               xL: flat[i + 4], xR: flat[i + 5], form: flat[i + 6] });
  return out;
};

// Which interval owns t. Outside the ends the outermost polynomial is extended,
// which is the engine's own extrapolation.
function owning(segs: Seg[], t: number): Seg {
  let lo = 0, hi = segs.length - 1;
  if (t <= segs[0].xR) return segs[0];
  if (t >= segs[hi].xL) return segs[hi];
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (t < segs[mid].xR) hi = mid; else lo = mid + 1;
  }
  return segs[lo];
}

/* The engine publishes coefficients, not samples, so this reads them the same
   way its own csEvalZeroHost does. form 1 carries -log DF as the polynomial, so
   the zero rate is that over t and the instantaneous forward is its derivative.
   form 0 carries the zero rate directly. Both forwards are analytic rather than
   a difference between two nearby points. */
const zeroOn = (g: Seg, t: number) =>
  g.form > 0.5 ? (t > 0 ? g.c0 / t + g.c1 + (g.c2 + g.c3 * t) * t : g.c1)
    : ((g.c3 * t + g.c2) * t + g.c1) * t + g.c0;

const instOn = (g: Seg, t: number) => {
  const dP = g.c1 + 2 * g.c2 * t + 3 * g.c3 * t * t;
  if (g.form > 0.5) return dP;                    // P is -log DF, so f = dP/dt
  const z = ((g.c3 * t + g.c2) * t + g.c1) * t + g.c0;
  return z + t * dP;                              // f = d(z t)/dt
};

// Coefficients carry decimals, the way the engine holds them: a 1.9% zero rate
// is 0.019 here. Everything below works in that unit and converts once, at the
// point of display. Treating them as percent divided every discount factor's
// exponent by a hundred, which made the curve chart read 0.02% and the swap
// pricer quote a fair rate of 0.019%.
const zeroAt = (segs: Seg[], t: number) => zeroOn(owning(segs, t), t);
const dfAt = (segs: Seg[], t: number) =>
  t <= 0 ? 1 : Math.exp(-zeroAt(segs, t) * t);

function priceSwap(proj: Seg[], disc: Seg[], years: number,
                   fixedRate: number, notional: number) {
  if (!proj?.length || !disc?.length) return null;
  let annuity = 0;               // fixed leg, per unit of rate
  for (let k = 1; k <= Math.round(years); k++) annuity += 1.0 * dfAt(disc, k);
  let floatLeg = 0;              // projected coupons, discounted
  const step = 0.5;
  for (let t = step; t <= years + 1e-9; t += step) {
    const f = (dfAt(proj, t - step) / dfAt(proj, t) - 1) / step;
    floatLeg += f * step * dfAt(disc, t);
  }
  const fair = annuity > 0 ? floatLeg / annuity : 0;
  const npv = notional * (floatLeg - fixedRate * annuity);
  return { npv, fair: fair * 100, annuity, dv01: notional * annuity * 1e-4 };
}

// Points to draw one curve with. Each interval contributes its own endpoints, so
// a step edge is a vertical rather than a diagonal across whatever the sampling
// resolution happened to be, and a flat interval needs exactly two points. The
// curved ones get a handful more, which is all a cubic needs to look like itself.
function drawPoints(segs: Seg[], view: string, tMax: number) {
  const pts: { t: number; y: number }[] = [];
  const value = (t: number, g: Seg) => {
    if (view === 'zero') return zeroOn(g, t) * 100;
    if (view === 'inst') return instOn(g, t) * 100;
    if (view === 'df') return Math.exp(-zeroOn(g, t) * t);
    const d0 = dfAt(segs, t), d1 = dfAt(segs, t + 0.5);
    return d1 > 0 ? (d0 / d1 - 1) / 0.5 * 100 : 0;
  };
  for (const g of segs) {
    if (g.xL > tMax) break;
    const flat = g.form > 0.5 && Math.abs(g.c2) < 1e-14 && Math.abs(g.c3) < 1e-14;
    const n = flat && view === 'inst' ? 1 : 8;
    for (let k = 0; k <= n; k++) {
      const t = g.xL + (g.xR - g.xL) * k / n;
      if (t < 1e-9 || t > tMax) continue;
      pts.push({ t, y: value(t, g) });
    }
  }
  return pts;
}

// ---------------------------------------------------------------------------

interface Snapshot { id: number; frame: number; epoch: number; at: string; label: string }

export default function Workstation({ tl }: { tl: Timeline }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  // Curves that rebuilt on the current frame are held lit briefly, so the
  // cascade is visible rather than instantaneous.
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const timer = useRef<number | null>(null);
  const [tenor, setTenor] = useState(5);
  const [rate, setRate] = useState(2.10);
  const [notional, setNotional] = useState(10);
  // The instantaneous forward is where the construction shows: flat between ECB
  // meetings on the meeting-dated curve, then a spline. The other three views
  // smooth that away.
  const [domain, setDomain] = useState<'fwd' | 'inst' | 'zero' | 'df'>('inst');
  const [tMax, setTMax] = useState(30);
  const [shown, setShown] = useState<string[]>(
    ['EUR_ESTR', 'EUR_ESTR_ECB', 'EUR_EURIBOR6M', 'EUR_USD_XCCY']);
  // A risk run is taken against ONE published set and keeps saying which one,
  // however far the feed has moved on since. Runs are kept, so a desk can hold
  // this morning's risk beside the one it just asked for.
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [viewing, setViewing] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const nextId = useRef(1);
  const [riskCurve, setRiskCurve] = useState('EUR_ESTR');
  const [riskMode, setRiskMode] = useState<'zero' | 'fwd'>('zero');
  // The position panel. Market risk was measured against one published set, so
  // all three domains are read off that same set and the panel says which.
  const detail = tl.detail;
  const [posId, setPosId] = useState<string | null>(
    detail?.positions[0]?.id ?? null);
  const [posDomain, setPosDomain] = useState<'mkt' | 'zero' | 'fwd'>('zero');
  const [posCurve, setPosCurve] = useState<string | null>(null);

  const takeSnapshot = () => {
    if (running) return;
    setPlaying(false);
    setRunning(true);
    const frame = i;
    window.setTimeout(() => {
      const id = nextId.current++;
      const now = new Date();
      setSnaps(list => [{
        id, frame, epoch: tl.frames[frame].epoch,
        at: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        label: tl.frames[frame].label,
      }, ...list].slice(0, 8));
      setViewing(id);
      setRunning(false);
    }, 900);
  };

  const f = tl.frames[i];
  const prev = i > 0 ? tl.frames[i - 1] : null;
  const open = tl.frames[0];

  useEffect(() => {
    setFlash(new Set(f.rebuilt));
    const t = window.setTimeout(() => setFlash(new Set()), 1100);
    return () => window.clearTimeout(t);
  }, [i, f.rebuilt]);

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setTimeout(
      () => setI(x => (x + 1) % tl.frames.length), 3200);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [i, playing, tl.frames.length]);

  const feed = useMemo(() => {
    const out: { label: string; ticks: string[]; rebuilt: number; dup: number }[] = [];
    for (let k = i; k >= 0 && out.length < 6; k--) {
      const fr = tl.frames[k];
      out.push({ label: fr.label, ticks: fr.ticks, rebuilt: fr.rebuilt.length, dup: fr.duplicate });
    }
    return out;
  }, [i, tl.frames]);

  const segsOf = useMemo(() => {
    const m: Record<string, Seg[]> = {};
    for (const [id, flat] of Object.entries(f.curves ?? {})) m[id] = segments(flat);
    return m;
  }, [f.curves]);

  // One point list per curve, off that curve's own intervals. Recharts takes a
  // data array per series, so no shared grid has to be invented to hold them.
  const curveLines = useMemo(() => shown
    .filter(c => segsOf[c]?.length)
    .map(c => ({ id: c, pts: drawPoints(segsOf[c], domain, tMax) })),
    [segsOf, shown, domain, tMax]);

  const chosen = snaps.find(x => x.id === viewing) ?? null;
  const riskSource = chosen ? tl.frames[chosen.frame] : null;
  const riskChart = useMemo(() => {
    if (!riskSource) return [];
    const lad = riskSource.risk?.[riskCurve] ?? [];
    return lad.filter(([t]) => t > 0).map(([t, z, w]) => ({
      label: t < 1 ? Math.round(t * 12) + 'M' : Math.round(t) + 'Y',
      pv01: riskMode === 'zero' ? z : w, t,
    }));
  }, [riskSource, riskCurve, riskMode]);

  // ---- position detail ----------------------------------------------------
  const position = detail?.positions.find(p => p.id === posId) ?? null;
  const ladders = (position && detail?.tradeRisk[position.id]) || null;
  const hasDetail = useMemo(
    () => new Set((detail?.positions ?? []).map(p => p.id)), [detail]);

  // Curves this position has something to show on, for the domain on screen.
  // The market domain reaches further than the other two: a swap discounted on
  // the meeting-dated curve has no ESTR node ladder and still has an ESTR
  // market ladder, because bumping an ESTR quote re-solves EURIBOR, which it
  // does project on. So the curve list is rebuilt per domain, off what the
  // exported ladder actually holds.
  const posCurves = useMemo(() => {
    if (!ladders) return [];
    return Object.keys(ladders).filter(c =>
      posDomain === 'mkt' ? ladders[c].mkt.length : ladders[c][posDomain].length);
  }, [ladders, posDomain]);
  const curveShown = posCurve && posCurves.includes(posCurve) ? posCurve : posCurves[0];

  const posChart = useMemo(() => {
    if (!ladders || !curveShown) return [];
    const l = ladders[curveShown];
    if (posDomain === 'mkt')
      return l.mkt.map(([qid, pv01]) => ({ label: qid.split('/')[0], full: qid, pv01 }));
    return l[posDomain].filter(([t]) => t > 0).map(([t, pv01]) => ({
      label: t < 1 ? Math.round(t * 12) + 'M' : Math.round(t) + 'Y',
      full: t.toFixed(2) + 'Y', pv01,
    }));
  }, [ladders, curveShown, posDomain]);

  // The ladder total on the curve shown, against the position's parallel DV01.
  // A curve-node ladder over every node of every dependency curve sums to the
  // parallel shift, so on a single-curve position these two agree; on a
  // two-curve one each curve carries part of it.
  const posTotal = posChart.reduce((s, r) => s + r.pv01, 0);
  const posAllTotal = useMemo(() => {
    if (!ladders) return 0;
    return Object.values(ladders).reduce((s, l) => s + (
      posDomain === 'mkt'
        ? l.mkt.reduce((a, [, v]) => a + v, 0)
        : l[posDomain].reduce((a, [, v]) => a + v, 0)), 0);
  }, [ladders, posDomain]);

  const priced = useMemo(() => priceSwap(
    segsOf['EUR_EURIBOR6M'] ?? [], segsOf['EUR_ESTR'] ?? [],
    tenor, rate / 100, notional * 1e6), [segsOf, tenor, rate, notional]);

  const bookMove = (b: BookAgg) => {
    const p = prev?.books.find(x => x.book === b.book);
    const o = open.books.find(x => x.book === b.book);
    return { since: p ? b.npv - p.npv : 0, fromOpen: o ? b.npv - o.npv : 0 };
  };
  const deskSince = prev ? f.deskNpv - prev.deskNpv : 0;
  const deskFromOpen = f.deskNpv - open.deskNpv;

  const moveColour = (v: number, floor = 1) =>
    Math.abs(v) < floor ? 'var(--text-dim)' : v > 0 ? 'var(--accent-green)' : '#c86e6e';
  const signed = (v: number, floor = 1) =>
    Math.abs(v) < floor ? '' : (v > 0 ? '+' : '') + millions(v);

  return (
    <div>
      {/* ---- transport ---- */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button onClick={() => setPlaying(p => !p)} className="px-3 py-1.5 rounded font-mono text-[11px]"
          style={chip(!playing, '#d4a853')}>
          {playing ? 'Pause feed' : 'Resume feed'}
        </button>
        <button onClick={takeSnapshot} disabled={running}
          className="px-3 py-1.5 rounded font-mono text-[11px]" style={chip(running, '#5eaab5')}>
          {running ? 'running risk…' : 'Run risk on this set'}
        </button>
        <div className="flex gap-1 ml-1">
          {tl.frames.map((_, k) => (
            <button key={k} onClick={() => { setI(k); setPlaying(false); }}
              className="w-6 h-1.5 rounded-sm"
              style={{ background: k === i ? '#d4a853' : 'var(--border-subtle)' }} />
          ))}
        </div>
        <span className="font-mono text-[11px] ml-1" style={{ color: 'var(--text-dim)' }}>
          set {f.epoch} &middot; {tl.trades.toLocaleString()} trades &middot;{' '}
          {(tl.cashflows / 1e6).toFixed(1)}m cashflows
        </span>
      </div>

      {/* ---- what each clock cost on this cycle ---- */}
      <div className="grid sm:grid-cols-3 gap-2 mb-4 font-mono text-[11px]">
        {[['Curves rebuilt', ms(f.cycleUs), f.rebuilt.length + ' of ' + tl.curveIds.length + ' curves'],
          ['Book revalued', ms(f.npvUs), 'every trade, ' + tl.threads + ' cores'],
          ['Risk ladders', ms(f.riskUs), f.buckets + ' buckets × the book']].map(([k, v, note]) => (
          <div key={k} className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
            <div className="text-[10px] uppercase" style={{ color: 'var(--text-dim)' }}>{k}</div>
            <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{v}</div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>{note}</div>
          </div>
        ))}
      </div>

      <div className="rounded px-4 py-3 mb-4" style={{ border: '1px solid #d4a85355', background: '#d4a8530a' }}>
        <div className="font-mono text-xs mb-1" style={{ color: '#d4a853' }}>{f.label}</div>
        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{f.note}</div>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.15fr] gap-4">
        {/* ---- curve board ---- */}
        <div>
          <div className="text-[10px] uppercase mb-2" style={{ color: 'var(--text-dim)' }}>Curve status</div>
          <div className="grid grid-cols-2 gap-2">
            {tl.curveIds.map((c: string) => {
              const st = f.status[c] ?? 'OK';
              const lit = flash.has(c);
              const stale = st !== 'OK';
              const colour = stale ? '#c86e6e' : lit ? '#d4a853' : 'var(--border-subtle)';
              return (
                <div key={c} className="rounded px-2.5 py-2" style={{
                  border: `1px solid ${colour}`,
                  background: lit ? '#d4a85314' : stale ? '#c86e6e10' : 'transparent',
                  transition: 'background 350ms, border-color 350ms',
                }}>
                  <div className="font-mono text-[11px]" style={{
                    color: stale ? '#c86e6e' : lit ? '#d4a853' : 'var(--text-primary)',
                  }}>{LABEL[c] ?? c}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>
                    {stale ? 'stale, last good' : lit ? 'rebuilt' : 'current'}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-[10px] uppercase mt-4 mb-2" style={{ color: 'var(--text-dim)' }}>Incoming prices</div>
          <div className="rounded p-2.5 font-mono text-[10.5px]" style={{
            border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)',
            minHeight: 132,
          }}>
            {feed.map((e, k) => (
              <div key={k} className="flex justify-between gap-3 py-0.5"
                style={{ color: k === 0 ? 'var(--text-secondary)' : 'var(--text-dim)', opacity: 1 - k * 0.14 }}>
                <span className="truncate">{e.ticks.length ? e.ticks[0] : e.label}</span>
                <span style={{ color: e.dup ? '#c86e6e' : e.rebuilt ? '#d4a853' : 'var(--text-dim)' }}>
                  {e.dup ? 'rejected' : e.rebuilt ? `${e.rebuilt} rebuilt` : 'no change'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ---- books ---- */}
        <div>
          <div className="text-[10px] uppercase mb-2" style={{ color: 'var(--text-dim)' }}>Books</div>
          <div className="rounded overflow-x-auto" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full font-mono text-[11px]">
              <thead>
                <tr style={{ color: 'var(--text-dim)' }}>
                  <th className="text-left px-3 py-1.5 font-normal">Book</th>
                  <th className="text-right px-3 py-1.5 font-normal">Trades</th>
                  <th className="text-right px-3 py-1.5 font-normal">Value</th>
                  <th className="text-right px-3 py-1.5 font-normal">On this move</th>
                  <th className="text-right px-3 py-1.5 font-normal">Since open</th>
                  <th className="text-right px-3 py-1.5 font-normal">DV01</th>
                </tr>
              </thead>
              <tbody>
                {f.books.map(b => {
                  const d = bookMove(b);
                  return (
                    <tr key={b.book} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td className="px-3 py-1.5" style={{ color: b.degraded ? '#c86e6e' : 'var(--text-secondary)' }}>
                        {b.book}{b.degraded ? ' *' : ''}
                      </td>
                      <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-dim)' }}>
                        {b.trades.toLocaleString()}
                      </td>
                      <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-primary)' }}>{millions(b.npv)}</td>
                      <td className="px-3 py-1.5 text-right" style={{ color: moveColour(d.since, 1e4) }}>
                        {signed(d.since, 1e4)}
                      </td>
                      <td className="px-3 py-1.5 text-right" style={{ color: moveColour(d.fromOpen, 1e4) }}>
                        {signed(d.fromOpen, 1e4)}
                      </td>
                      <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-dim)' }}>{money(b.dv01)}</td>
                    </tr>
                  );
                })}
                <tr style={{ borderTop: '1px solid var(--border-hover)' }}>
                  <td className="px-3 py-1.5" style={{ color: 'var(--text-dim)' }}>Desk</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-dim)' }}>
                    {tl.trades.toLocaleString()}
                  </td>
                  <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-primary)' }}>{millions(f.deskNpv)}</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: moveColour(deskSince, 1e4) }}>
                    {signed(deskSince, 1e4)}
                  </td>
                  <td className="px-3 py-1.5 text-right" style={{ color: moveColour(deskFromOpen, 1e4) }}>
                    {signed(deskFromOpen, 1e4)}
                  </td>
                  <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-dim)' }}>{money(f.deskDv01)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[11px] mt-2" style={{ color: 'var(--text-dim)' }}>
            On this move is against the previous published set. Since open is against the
            first one, which is the mark the session starts from.
            {f.books.some(b => b.degraded) && ' A book marked * holds trades priced on a curve that failed to rebuild and is serving its last good version.'}
          </p>

          <div className="text-[10px] uppercase mt-4 mb-2" style={{ color: 'var(--text-dim)' }}>
            A few of the trades behind those totals
          </div>
          <div className="rounded overflow-x-auto" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full font-mono text-[10.5px]">
              <tbody>
                {f.rows.slice(0, 8).map(r => {
                  // Detail was exported for these eight and nothing else. A row
                  // without it stays inert; a click there would land on an
                  // empty panel.
                  const has = hasDetail.has(r.id);
                  const on = has && r.id === posId;
                  return (
                    <tr key={r.id}
                      onClick={has ? () => setPosId(r.id) : undefined}
                      style={{
                        borderTop: '1px solid var(--border-subtle)',
                        cursor: has ? 'pointer' : 'default',
                        background: on ? '#5eaab518' : 'transparent',
                        boxShadow: on ? 'inset 3px 0 0 #5eaab5' : 'none',
                      }}>
                      <td className="px-3 py-1" style={{ color: on ? '#5eaab5' : 'var(--text-dim)' }}>{r.id}</td>
                      <td className="px-3 py-1" style={{ color: 'var(--text-dim)' }}>{r.book}</td>
                      <td className="px-3 py-1 text-right" style={{ color: 'var(--text-secondary)' }}>
                        {r.fair ? r.fair.toFixed(3) + '%' : ''}
                      </td>
                      <td className="px-3 py-1 text-right" style={{ color: 'var(--text-primary)' }}>{money(r.npv)}</td>
                      <td className="px-3 py-1 text-right" style={{ color: 'var(--text-dim)' }}>{money(r.dv01)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {detail && (
            <p className="text-[11px] mt-2" style={{ color: 'var(--text-dim)' }}>
              Pick a row to put its own ladder on screen, below.
            </p>
          )}
        </div>
      </div>

      {/* ---- curves ---- */}
      <div className="mt-4">
        <div className="text-[10px] uppercase mb-2" style={{ color: 'var(--text-dim)' }}>Curves</div>
        <div className="flex gap-1.5 mb-2 flex-wrap font-mono text-[10px]">
          {tl.curveIds.map(k => (
            <button key={k}
              onClick={() => setShown(v => v.includes(k) ? v.filter(x => x !== k) : [...v, k])}
              className="px-2 py-0.5 rounded"
              style={chip(shown.includes(k), COLOUR[k] ?? '#8b8a97')}>{LABEL[k] ?? k}</button>
          ))}
        </div>
        <div className="flex gap-1.5 mb-2 flex-wrap font-mono text-[10px] items-center">
          {([['fwd', 'discrete forwards'], ['inst', 'instantaneous forward'],
             ['zero', 'zero rates'], ['df', 'discount factors']] as const).map(([d, label]) => (
            <button key={d} onClick={() => setDomain(d)} className="px-2 py-0.5 rounded"
              style={chip(domain === d, '#5eaab5')}>{label}</button>
          ))}
          <span className="mx-1" style={{ color: 'var(--border-subtle)' }}>|</span>
          {[2.5, 10, 30, 50].map(x => (
            <button key={x} onClick={() => setTMax(x)} className="px-2 py-0.5 rounded"
              style={chip(tMax === x, '#8b7ec8')}>{x}Y</button>
          ))}
        </div>
        <div className="rounded p-2" style={{ border: '1px solid var(--border-subtle)' }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart margin={{ left: 4, right: 12, top: 6, bottom: 4 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="t" type="number" domain={[0, tMax]} allowDataOverflow
                allowDuplicatedCategory={false} stroke="#55546a" tick={{ fontSize: 10 }}
                tickFormatter={(v: number) => v + 'Y'} />
              <YAxis stroke="#55546a" tick={{ fontSize: 10 }} width={52}
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => domain === 'df'
                  ? Number(v).toFixed(3) : Number(v).toFixed(2) + '%'} />
              <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #1e1e2e', fontSize: 11 }}
                labelFormatter={(v: any) => 't = ' + Number(v).toFixed(2) + 'Y'}
                formatter={(v: any, n: any) => [
                  domain === 'df' ? Number(v).toFixed(6) : Number(v).toFixed(4) + '%',
                  LABEL[n] ?? n]} />
              {curveLines.map(({ id, pts }) => (
                <Line key={id} data={pts} dataKey="y" name={id} type="linear"
                  isAnimationActive={false} stroke={COLOUR[id] ?? '#8b8a97'}
                  strokeWidth={flash.has(id) ? 2.6 : 1.6} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] mt-2 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
          The engine publishes each curve as its own cubics over log discount factors,
          and this page evaluates them. Pick the instantaneous forward and the
          meeting-dated curve to see the policy steps: flat between ECB dates, then a
          spline. A discrete forward averages over its own window and smooths them away.
        </p>
        <p className="text-[11px] mt-2 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
          * EURIBOR 6M turns up slightly in the instantaneous forward between 13 and 15
          months. Its quotes are monthly out to 13M and bi-monthly after that, and the
          forward is the derivative of a cubic fitted through log discount factors, so it
          shows whatever the spline does where the pillar spacing changes. It comes to
          about 1.3 basis points. A monotone convex scheme would smooth it away by forcing
          the shape, which is a different kind of wrong, so it is left where you can see it.
        </p>
      </div>

      {/* ---- risk ---- */}
      <div className="mt-6">
        <div className="text-[10px] uppercase mb-2" style={{ color: 'var(--text-dim)' }}>Risk</div>
        {snaps.length > 0 && (
          <div className="rounded overflow-x-auto mb-3" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full font-mono text-[10.5px]">
              <thead>
                <tr style={{ color: 'var(--text-dim)' }}>
                  <th className="text-left px-3 py-1.5 font-normal">Run</th>
                  <th className="text-left px-3 py-1.5 font-normal">Taken</th>
                  <th className="text-left px-3 py-1.5 font-normal">Set</th>
                  <th className="text-left px-3 py-1.5 font-normal">Market at the time</th>
                  <th className="text-right px-3 py-1.5 font-normal">Buckets</th>
                  <th className="text-right px-3 py-1.5 font-normal">Took</th>
                </tr>
              </thead>
              <tbody>
                {snaps.map(sn => {
                  const fr = tl.frames[sn.frame];
                  const on = sn.id === viewing;
                  return (
                    <tr key={sn.id} onClick={() => setViewing(sn.id)}
                      style={{
                        borderTop: '1px solid var(--border-subtle)', cursor: 'pointer',
                        background: on ? '#5eaab512' : 'transparent',
                        color: on ? 'var(--text-primary)' : 'var(--text-dim)',
                      }}>
                      <td className="px-3 py-1" style={{ color: on ? '#5eaab5' : 'var(--text-dim)' }}>
                        #{sn.id}
                      </td>
                      <td className="px-3 py-1">{sn.at}</td>
                      <td className="px-3 py-1">{sn.epoch}</td>
                      <td className="px-3 py-1 truncate" style={{ maxWidth: 260 }}>{sn.label}</td>
                      <td className="px-3 py-1 text-right">{fr.buckets}</td>
                      <td className="px-3 py-1 text-right">{ms(fr.riskUs)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {riskSource === null ? (
          <div className="rounded px-4 py-6 text-center" style={{ border: '1px dashed var(--border-subtle)' }}>
            <p className="text-xs max-w-2xl mx-auto" style={{ color: 'var(--text-dim)' }}>
              Risk is asked for, not pushed. Press{' '}
              <span style={{ color: '#5eaab5' }}>Run risk on this set</span> to take the
              published set on screen and put a ladder against it. Every run is kept, and
              stays stamped with the set it describes however far the feed moves on.
            </p>
          </div>
        ) : (
          <>
            <div className="flex gap-1.5 mb-2 flex-wrap font-mono text-[10px] items-center">
              {tl.curveIds.filter(c => (riskSource.risk?.[c] ?? []).length).map(c => (
                <button key={c} onClick={() => setRiskCurve(c)} className="px-2 py-0.5 rounded"
                  style={chip(riskCurve === c, COLOUR[c] ?? '#8b8a97')}>{LABEL[c] ?? c}</button>
              ))}
              <span className="mx-1" style={{ color: 'var(--border-subtle)' }}>|</span>
              {([['zero', 'zero buckets'], ['fwd', 'forward buckets']] as const).map(([m, l]) => (
                <button key={m} onClick={() => setRiskMode(m)} className="px-2 py-0.5 rounded"
                  style={chip(riskMode === m, '#5eaab5')}>{l}</button>
              ))}
            </div>
            <div className="rounded px-3 py-2 mb-2 font-mono text-[11px]"
              style={{ border: '1px solid #5eaab555', background: '#5eaab50a', color: 'var(--text-secondary)' }}>
              as of set {riskSource.epoch}
              {riskSource.epoch !== f.epoch && (
                <span style={{ color: '#d4a853' }}> &middot; the feed has since moved to set {f.epoch}</span>
              )}
              <span style={{ color: 'var(--text-dim)' }}>
                {' '}&middot; run #{chosen?.id} at {chosen?.at} &middot; {riskSource.buckets} buckets
                across {tl.trades.toLocaleString()} trades in {ms(riskSource.riskUs)} on{' '}
                {riskSource.threads} cores
              </span>
            </div>
            <div className="rounded p-2" style={{ border: '1px solid var(--border-subtle)' }}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={riskChart} margin={{ left: 4, right: 12, top: 6, bottom: 4 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" stroke="#55546a" tick={{ fontSize: 9 }} interval={0} />
                  <YAxis stroke="#55546a" tick={{ fontSize: 10 }} width={62}
                    tickFormatter={(v: number) => Math.round(v).toLocaleString()} />
                  <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #1e1e2e', fontSize: 11 }}
                    formatter={(v: any) => [Math.round(Number(v)).toLocaleString(), 'value of 1bp']} />
                  <ReferenceLine y={0} stroke="#55546a" />
                  <Bar dataKey="pv01" fill={COLOUR[riskCurve] ?? '#5b8fc9'} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] mt-2 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
              What the book gains or loses for one basis point at each node of{' '}
              {LABEL[riskCurve] ?? riskCurve}. {riskMode === 'zero'
                ? 'A zero bucket lifts the curve around one node and tapers away to its neighbours.'
                : 'A forward bucket lifts the forward rate flat across one interval.'}{' '}
              Both are applied as an overlay on the published curve rather than by
              rebuilding it, so a bump moves the bucket asked for and leaves the rest of
              the curve alone.
            </p>
            <p className="text-[11px] mt-2 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
              This page is a recording. The engine ran a ladder against every published
              set in the session, and the timings shown are its own. The page serves them
              back; it is not doing the arithmetic in your browser.
            </p>
          </>
        )}
      </div>

      {/* ---- position detail ---- */}
      {detail && position && (
        <div className="mt-6">
          <div className="text-[10px] uppercase mb-2" style={{ color: 'var(--text-dim)' }}>
            Position detail
          </div>

          <div className="flex gap-1.5 mb-2 flex-wrap font-mono text-[10px] items-center">
            <span style={{ color: 'var(--text-dim)' }}>Load a draft</span>
            {detail.positions.filter(p => p.kind === 'draft').map(p => (
              <button key={p.id} onClick={() => setPosId(p.id)} className="px-2 py-0.5 rounded"
                style={chip(p.id === posId, '#d4a853')}>{p.id}</button>
            ))}
          </div>

          <div className="rounded px-3 py-2 mb-2"
            style={{ border: '1px solid #5eaab555', background: '#5eaab50a' }}>
            <div className="flex gap-6 flex-wrap font-mono text-[11px]">
              <span style={{ color: '#5eaab5' }}>{position.id}</span>
              <span style={{ color: 'var(--text-dim)' }}>
                {position.type} &middot; {position.maturity.toFixed(1)}Y &middot;{' '}
                {millions(position.notional)} &middot; {position.book}
              </span>
              <span style={{ color: 'var(--text-dim)' }}>
                struck at <span style={{ color: 'var(--text-primary)' }}>
                  {position.type === 'FX forward'
                    ? position.strike.toFixed(4) : position.strike.toFixed(3) + '%'}
                </span>
              </span>
              <span style={{ color: 'var(--text-dim)' }}>
                fair <span style={{ color: 'var(--text-primary)' }}>
                  {position.type === 'FX forward'
                    ? position.fair.toFixed(4) : position.fair.toFixed(3) + '%'}
                </span>
              </span>
              <span style={{ color: 'var(--text-dim)' }}>
                value <span style={{ color: position.npv >= 0 ? 'var(--accent-green)' : '#c86e6e' }}>
                  {money(position.npv)}
                </span>
              </span>
              <span style={{ color: 'var(--text-dim)' }}>
                value of 1bp <span style={{ color: 'var(--text-primary)' }}>{money(position.dv01)}</span>
              </span>
            </div>
            <div className="text-[11px] mt-1.5" style={{ color: 'var(--text-secondary)' }}>
              {position.note}
            </div>
            <div className="font-mono text-[10.5px] mt-1" style={{ color: 'var(--text-dim)' }}>
              as of set {detail.epoch}
              {detail.epoch !== f.epoch && (
                <span style={{ color: '#d4a853' }}>
                  {' '}&middot; the feed has since moved to set {f.epoch}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-1.5 mb-2 flex-wrap font-mono text-[10px] items-center">
            {([['mkt', 'market quotes'], ['zero', 'zero buckets'],
               ['fwd', 'forward buckets']] as const).map(([m, l]) => (
              <button key={m} onClick={() => setPosDomain(m)} className="px-2 py-0.5 rounded"
                style={chip(posDomain === m, '#5eaab5')}>{l}</button>
            ))}
            <span className="mx-1" style={{ color: 'var(--border-subtle)' }}>|</span>
            {posCurves.map(c => (
              <button key={c} onClick={() => setPosCurve(c)} className="px-2 py-0.5 rounded"
                style={chip(curveShown === c, COLOUR[c] ?? '#8b8a97')}>{LABEL[c] ?? c}</button>
            ))}
          </div>

          {posChart.length === 0 ? (
            <div className="rounded px-4 py-6 text-center"
              style={{ border: '1px dashed var(--border-subtle)' }}>
              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                Nothing built on this domain for this position.
              </p>
            </div>
          ) : (
            <div className="rounded p-2" style={{ border: '1px solid var(--border-subtle)' }}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={posChart} margin={{ left: 4, right: 12, top: 6, bottom: 4 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" stroke="#55546a" tick={{ fontSize: 9 }} interval={0} />
                  <YAxis stroke="#55546a" tick={{ fontSize: 10 }} width={62}
                    tickFormatter={(v: number) => Math.round(v).toLocaleString()} />
                  <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #1e1e2e', fontSize: 11 }}
                    labelFormatter={(_: any, p: any) => p?.[0]?.payload?.full ?? ''}
                    formatter={(v: any) => [Math.round(Number(v)).toLocaleString(), 'value of 1bp']} />
                  <ReferenceLine y={0} stroke="#55546a" />
                  <Bar dataKey="pv01" fill={COLOUR[curveShown] ?? '#5b8fc9'} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="font-mono text-[10.5px] mt-2 flex gap-6 flex-wrap"
            style={{ color: 'var(--text-dim)' }}>
            <span>
              {LABEL[curveShown] ?? curveShown} sums to{' '}
              <span style={{ color: 'var(--text-primary)' }}>{money(posTotal)}</span>
            </span>
            <span>
              every curve together{' '}
              <span style={{ color: 'var(--text-primary)' }}>{money(posAllTotal)}</span>
            </span>
            <span>
              parallel DV01 <span style={{ color: 'var(--text-primary)' }}>{money(position.dv01)}</span>
            </span>
            {ladders?.[curveShown]?.partial && (
              <span style={{ color: '#c86e6e' }}>
                part of this ladder did not build and is missing from it
              </span>
            )}
          </div>

          <p className="text-[11px] mt-3 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
            {posDomain === 'mkt' ? (
              <>
                One bar per quoted instrument on {LABEL[curveShown] ?? curveShown}: the
                quote is moved a basis point, the curve and everything built on it are
                bootstrapped again, and this position is repriced against the result.
                That is the number a trader hedges with. It is denominated in the
                instruments the hedge is executed in.
              </>
            ) : posDomain === 'zero' ? (
              <>
                One bar per node of {LABEL[curveShown] ?? curveShown}. The published
                curve is lifted a basis point around one node, tapering away to its
                neighbours, and this position is repriced. The curve is overlaid, with
                no bootstrap anywhere in the loop, so the bump moves the node asked for
                and leaves the rest of the curve where it was.
              </>
            ) : (
              <>
                One bar per interval of {LABEL[curveShown] ?? curveShown}. The forward
                rate is lifted a basis point flat across the interval and this position
                is repriced. Same overlay, a different shape of bump: it localises the
                move to the period the cashflows actually accrue over.
              </>
            )}
          </p>

          <p className="text-[11px] mt-2 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
            They cost very different amounts. Zero and forward buckets are an
            overlay on a curve that already exists, so the {detail.positions.length}{' '}
            positions here took {ms(detail.ladderUs)} between them. The market ladders
            ran {detail.mktRebuilds.toLocaleString()} bootstraps and took{' '}
            {ms(detail.mktUs)}. So the first two run on every published set, and the
            market one is a job you ask for, stamped with the set it was measured
            against.
          </p>

          <p className="text-[11px] mt-2 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
            The curve list changes with the domain. A zero or forward
            bump only ever reaches the curves a position prices off. A market bump
            reaches through the bootstrap, so the list is wider: a swap projected on
            EURIBOR carries an ESTR market ladder whether or not it discounts on ESTR,
            because EURIBOR is solved with ESTR discounting. Where that comes out at
            zero it is a measured zero across every quote on the curve, and it cost a
            bootstrap each to establish.
          </p>

          {position.type === 'FX forward' && (
            <p className="text-[11px] mt-2 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
              The three domains disagree on this one, so it is worth toggling between
              them. The zero ladder on the cross-currency curve is matched by an equal
              and opposite one on SOFR, which is why the parallel DV01 above comes out
              near zero. The market ladder puts the whole position on a single bar, the
              FX swap at its own maturity, which is the instrument you would hedge it
              with.
            </p>
          )}
        </div>
      )}

      {/* ---- pricer ---- */}
      <div className="mt-6">
        <div className="text-[10px] uppercase mb-2" style={{ color: 'var(--text-dim)' }}>
          Price a EURIBOR swap against the set on screen
        </div>
        <div className="rounded px-4 py-3" style={{ border: '1px solid var(--border-subtle)' }}>
          <div className="flex gap-5 flex-wrap items-end mb-3">
            <label className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
              <div className="mb-1">Maturity</div>
              <select value={tenor} onChange={e => setTenor(+e.target.value)}
                className="font-mono px-2 py-1 rounded"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                {[2, 3, 5, 7, 10, 15, 20, 30].map(y => <option key={y} value={y}>{y}Y</option>)}
              </select>
            </label>
            <label className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
              <div className="mb-1">Fixed rate {rate.toFixed(2)}%</div>
              <input type="range" min={1.0} max={3.5} step={0.01} value={rate}
                onChange={e => setRate(+e.target.value)} style={{ width: 190 }} />
            </label>
            <label className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
              <div className="mb-1">Notional {notional}m</div>
              <input type="range" min={1} max={100} step={1} value={notional}
                onChange={e => setNotional(+e.target.value)} style={{ width: 150 }} />
            </label>
          </div>
          {priced ? (
            <div className="flex gap-8 flex-wrap font-mono text-xs">
              <span style={{ color: 'var(--text-dim)' }}>
                fair rate <span style={{ color: 'var(--text-primary)' }}>{priced.fair.toFixed(3)}%</span>
              </span>
              <span style={{ color: 'var(--text-dim)' }}>
                value <span style={{ color: priced.npv >= 0 ? 'var(--accent-green)' : '#c86e6e' }}>
                  {money(priced.npv)}</span>
              </span>
              <span style={{ color: 'var(--text-dim)' }}>
                value of 1bp <span style={{ color: 'var(--text-primary)' }}>{money(priced.dv01)}</span>
              </span>
            </div>
          ) : (
            <div className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>waiting for curves</div>
          )}
          <p className="text-[11px] mt-3 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
            A payer swap against the same published curves the books above are using, so
            the numbers move with the session as it plays. Annual fixed against six month
            floating, projected on EURIBOR and discounted on ESTR.
          </p>
        </div>
      </div>
    </div>
  );
}
