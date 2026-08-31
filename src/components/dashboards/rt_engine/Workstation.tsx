import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

interface Row {
  id: string; book: string; npv: number; dv01: number; fair: number; degraded: boolean;
}
// One book of the trades the session opened with. Tickets dealt during the
// session carry their own book name and are added to the matching line as they
// arrive.
interface BookAgg {
  book: string; trades: number; npv: number; dv01: number;
  failed: number; degraded: number;
}
// [zero-bucket pv01, forward-bucket pv01] per bucket, flat, read against the
// bucket maturities the file carries under riskT.
type Ladder = number[];
// One trade's ladder on one curve, as the stretch that is not zero:
// [[first index, values...], [first index, values...]] for zero and forward.
// An empty list is a curve the trade has nothing on.
type Window = [number[], number[]];

// ---- the trade feed -------------------------------------------------------
// Tickets dealt during the session, on top of the book the desk opened with.
// Everything about a ticket that does not move with the market is held once, at
// the top of the file; each frame carries only its state and its mark.
const NOT_YET = 0, PENDING = 1, EXECUTED = 2, CANCELLED = 3;
interface FeedTrade {
  id: string; venue: string; desc: string; book: string; type: string;
  notional: number; maturity: number;
  rows: number;     // the ticket and its schedule, as a trade system hands it over
  arrive: number;   // frame the ticket appeared, pending
  resolve: number;  // frame it executed or was pulled
  outcome: number;  // what it resolved to
}
// [state, value, value of a basis point] for one ticket on one frame.
type FeedRow = [number, number, number];

interface Frame {
  label: string; note: string; ticks: string[];
  epoch: number; published: boolean;
  rebuilt: string[]; failed: string[];
  applied: number; duplicate: number; cycleUs: number;
  status: Record<string, string>;
  rows: Row[]; books: BookAgg[];
  feed: FeedRow[];
  deskNpv: number; deskDv01: number; deskTrades: number;
  npvUs: number; riskUs: number; threads: number; buckets: number;
  // The times each curve is published at. A curve appears here on the frame
  // its times change and not otherwise. A time can appear twice: where the
  // forward jumps, the value on each side is published and the chart draws
  // the edge vertically, exactly where it falls.
  curveT: Record<string, number[]>;
  // Three values per published time, flat: zero rate, instantaneous forward,
  // half-year forward, all in decimals. Present only on the frames the curve
  // rebuilt on; otherwise the last published values still stand.
  curves: Record<string, number[]>;
  // Bucket maturities per curve, carried the same way.
  riskT: Record<string, number[]>;
  // The opening book's ladder on this set.
  risk: Record<string, Ladder>;
  // Each live ticket's own ladder on this set. PV01 adds across trades, so a
  // ticket's ladder is its contribution to the book's.
  tradeLad: Record<string, Record<string, Window>>;
  // The names of the quoted instruments a market ladder is read against,
  // carried the same way as the axes above.
  mktQ: Record<string, string[]>;
  // Book-level market-quote PV01 for this set, one value per quoted
  // instrument, in three memberships. mktBase is the book the desk opened
  // with on its own, mkt adds the tickets executed by this set, and
  // mktPending adds the ones still pending as well. The engine measured all
  // three in one pass. Tickets arrive with the set they were dealt on, so the
  // page reads mkt, or mktPending when the blotter toggle is on; each covers
  // the same trades as the desk totals. mktBase stays in the file, but no
  // membership on screen matches it any more.
  //
  // All three are null where a curve on the set was being served stale, in
  // which case mktStale names it: the published curve is then the last good
  // solve rather than the solve of the quotes in the store, and bumping one of
  // those quotes measures the gap between two market states instead of a basis
  // point.
  mktBase: Record<string, (number | null)[]> | null;
  mkt: Record<string, (number | null)[]> | null;
  mktPending: Record<string, (number | null)[]> | null;
  mktStale?: string;
  mktUs: number; mktRebuilds: number; mktFailed: number;
}

// ---- position detail ------------------------------------------------------
// One position's three ladders on one curve, each flat against the axes above.
// A null is a node or a bump that did not build.
interface CurveLadder {
  z: (number | null)[]; f: (number | null)[]; m: (number | null)[];
  p?: number;  // something in this ladder did not build, and is flagged
}
interface Position {
  id: string; book: string; kind: 'book' | 'fed'; type: string;
  notional: number; maturity: number; strike: number;
  npv: number; dv01: number; fair: number;
  curves: string[]; note: string;
}
interface Detail {
  frame: number; epoch: number;
  ladderUs: number; mktUs: number; mktRebuilds: number;
  riskT: Record<string, number[]>;
  mktQ: Record<string, string[]>;
  positions: Position[];
  tradeRisk: Record<string, Record<string, CurveLadder>>;
}

export interface Timeline {
  trades: number; cashflows: number; aged: number; threads: number;
  curveIds: string[]; frames: Frame[];
  feed: FeedTrade[];
  detail?: Detail;
}

const LABEL: Record<string, string> = {
  EUR_ESTR: 'ESTR', EUR_ESTR_ECB: 'ESTR meeting', EUR_ESTR_IMM: 'ESTR IMM',
  EUR_ESTR_IMMFUT: 'ESTR IMM fut', EUR_EURIBOR6M: 'EURIBOR 6M',
  USD_SOFR: 'SOFR', GBP_SONIA: 'SONIA', EUR_USD_XCCY: 'EUR/USD xccy',
  AUD_AONIA: 'AONIA', AUD_AONIA_RBA: 'AONIA meeting', AUD_BBSW3M: 'BBSW 3M',
  AUD_BBSW6M: 'BBSW 6M', AUD_USD_XCCY: 'AUD/USD xccy',
  USD_CSA_CTD: 'USD CSA CTD',
};

// The curve model's own colours, so a curve is the same colour on both projects.
const COLOUR: Record<string, string> = {
  EUR_ESTR: '#d4a853', EUR_ESTR_ECB: '#e07850', EUR_ESTR_IMM: '#5cb87a',
  EUR_ESTR_IMMFUT: '#b8b04a', EUR_EURIBOR6M: '#8b7ec8', EUR_USD_XCCY: '#4a9a68',
  USD_SOFR: '#9a8bd8', GBP_SONIA: '#c86e6e',
  AUD_AONIA: '#63c4f0', AUD_AONIA_RBA: '#3b87d4', AUD_BBSW3M: '#e896cc',
  AUD_BBSW6M: '#b34a85', AUD_USD_XCCY: '#3fc4a5', USD_CSA_CTD: '#e8963c',
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
// microseconds and these span six orders of magnitude, from a cycle that did
// nothing to a three second market PV01 run.
const ms = (us: number) =>
  us >= 1e6 ? (us / 1e6).toFixed(2) + ' s'
    : us >= 1e3 ? Math.round(us / 1e3) + ' ms'
      : us + ' µs';

// The trade bridge's measured write rate: 1,035,762 rows into SQL Server over
// eight parallel connections in 10k batches, 9.9 seconds. Its delta lane staged
// and merged a 20,000-trade day in 0.8 seconds. Nothing about this project's
// trade transfer was measured, so those are the numbers the blotter copy
// quotes and it says where they come from.
const BRIDGE_RPS = 105000;
const BRIDGE_CONNECTIONS = 8;
const DELTA_TRADES = 20000;
const DELTA_SECS = 0.8;

// ---------------------------------------------------------------------------
// Reading a curve
// ---------------------------------------------------------------------------
// The engine evaluates each published curve itself and writes the values the
// page needs: for each published time, the zero rate, the instantaneous
// forward and the half-year forward, all in decimals. The page draws and
// prices off those numbers and re-derives nothing.

interface CurveVals { t: number[]; v: number[] }

// Discount factors at the published times, for the swap pricer. The published
// times include every half-year point the pricer asks for, so each lookup is
// a value the engine wrote and nothing sits between two of them.
const dfMap = (c: CurveVals): Map<number, number> => {
  const m = new Map<number, number>();
  for (let i = 0; i < c.t.length; i++)
    if (!m.has(c.t[i])) m.set(c.t[i], Math.exp(-c.v[i * 3] * c.t[i]));
  return m;
};

function priceSwap(proj: Map<number, number> | null,
                   disc: Map<number, number> | null,
                   years: number, fixedRate: number, notional: number) {
  if (!proj?.size || !disc?.size) return null;
  const df = (m: Map<number, number>, t: number) => (t <= 0 ? 1 : m.get(t));
  let annuity = 0;               // fixed leg, per unit of rate
  for (let k = 1; k <= Math.round(years); k++) {
    const d = df(disc, k);
    if (d === undefined) return null;
    annuity += d;
  }
  let floatLeg = 0;              // projected coupons, discounted
  const step = 0.5;
  for (let t = step; t <= years + 1e-9; t += step) {
    const p0 = df(proj, t - step), p1 = df(proj, t), d = df(disc, t);
    if (p0 === undefined || p1 === undefined || d === undefined) return null;
    floatLeg += (p0 / p1 - 1) / step * step * d;
  }
  const fair = annuity > 0 ? floatLeg / annuity : 0;
  const npv = notional * (floatLeg - fixedRate * annuity);
  return { npv, fair: fair * 100, annuity, dv01: notional * annuity * 1e-4 };
}

// Points to draw one curve with: the published times against the view's own
// published value at each. A time that appears twice is an edge, and the two
// values draw it vertically, exactly where it falls.
function drawPoints(c: CurveVals, view: string, tMax: number) {
  const pts: { t: number; y: number }[] = [];
  for (let i = 0; i < c.t.length; i++) {
    const t = c.t[i];
    if (t > tMax) continue;
    const z = c.v[i * 3];
    const y = view === 'zero' ? z * 100
      : view === 'inst' ? c.v[i * 3 + 1] * 100
        : view === 'df' ? Math.exp(-z * t)
          : c.v[i * 3 + 2] * 100;
    pts.push({ t, y });
  }
  return pts;
}

// ---------------------------------------------------------------------------

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
  // The instantaneous forward is the most sensitive of the four views, so it is
  // the one that opens. The other three average detail away.
  const [domain, setDomain] = useState<'fwd' | 'inst' | 'zero' | 'df'>('inst');
  const [tMax, setTMax] = useState(30);
  const [shown, setShown] = useState<string[]>(
    ['EUR_ESTR', 'EUR_ESTR_ECB', 'EUR_EURIBOR6M', 'EUR_USD_XCCY']);
  const [riskCurve, setRiskCurve] = useState('EUR_ESTR_ECB');
  // Three domains over the same book: market quotes, zero buckets, forward
  // buckets. What differs is what a bucket means, not how the ladder is shown.
  const [riskMode, setRiskMode] = useState<'mkt' | 'zero' | 'fwd'>('zero');
  // The position panel. Its ladders were measured against one published set,
  // so all three domains are read off that same set and the panel says which.
  const detail = tl.detail;
  const feedDefs = useMemo(() => tl.feed ?? [], [tl.feed]);

  // One cycle in this session published nothing: every quote in it was a
  // replay the engine had already applied, so no set came out of it and the
  // epoch did not advance. Anything dated to that frame belongs to the set
  // still standing, which is the last one published before it, and the frame
  // is labelled for what it is rather than numbered as a set.
  const epochAt = useMemo(() => (k: number) => {
    for (let j = Math.min(k, tl.frames.length - 1); j >= 0; j--)
      if (tl.frames[j].published) return tl.frames[j].epoch;
    return tl.frames[0].epoch;
  }, [tl.frames]);
  const [posId, setPosId] = useState<string | null>(
    detail?.positions.find(p => p.kind === 'fed')?.id
    ?? detail?.positions[0]?.id ?? null);
  const [posDomain, setPosDomain] = useState<'mkt' | 'zero' | 'fwd'>('zero');
  const [posCurve, setPosCurve] = useState<string | null>(null);
  // Pending tickets are not positions. The toggle puts them into the totals and
  // the ladders anyway, which is the question a desk asks before it commits.
  const [withPending, setWithPending] = useState(false);

  // The tickets dealt on each set, by their place in the feed list. They come
  // across with the set itself, so nothing here waits on a load.
  const arrivals = useMemo(() => {
    const m: number[][] = tl.frames.map(() => []);
    feedDefs.forEach((d, k) => { if (m[d.arrive]) m[d.arrive].push(k); });
    return m;
  }, [feedDefs, tl.frames]);

  const f = tl.frames[i];
  const prev = i > 0 ? tl.frames[i - 1] : null;

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

  // ---- what stands on each set -------------------------------------------
  // The file writes a curve's values on the sets it rebuilt on, and the
  // published times and the two ladder axes on the sets they changed on.
  // Everything else still stands from the last set that carried it, which is
  // what a published curve means. This walks the session once and hands each
  // set the version that was live on it.
  const standing = useMemo(() => {
    const out: {
      times: Record<string, number[]>; vals: Record<string, number[]>;
      riskT: Record<string, number[]>; mktQ: Record<string, string[]>;
    }[] = [];
    let times = {}, vals = {}, riskT = {}, mktQ = {};
    for (const fr of tl.frames) {
      times = { ...times, ...(fr.curveT ?? {}) };
      vals = { ...vals, ...(fr.curves ?? {}) };
      riskT = { ...riskT, ...(fr.riskT ?? {}) };
      mktQ = { ...mktQ, ...(fr.mktQ ?? {}) };
      out.push({ times, vals, riskT, mktQ });
    }
    return out;
  }, [tl.frames]);
  const here = standing[i] ?? standing[standing.length - 1];

  const curvesOf = useMemo(() => {
    const m: Record<string, CurveVals> = {};
    for (const [id, v] of Object.entries(here.vals))
      if (here.times[id]) m[id] = { t: here.times[id], v };
    return m;
  }, [here]);

  // One point list per curve, off that curve's own published times. Recharts
  // takes a data array per series, so no shared grid has to be invented to
  // hold them.
  const curveLines = useMemo(() => shown
    .filter(c => curvesOf[c]?.t.length)
    .map(c => ({ id: c, pts: drawPoints(curvesOf[c], domain, tMax) })),
    [curvesOf, shown, domain, tMax]);

  // ---- the blotter --------------------------------------------------------
  // The tickets on screen are the ones that have arrived. A ticket arrives
  // with the set it was dealt on and stays from then on, and its status
  // carries on moving as later sets arrive.
  const blotter = useMemo(() => {
    const rows = f.feed ?? [];
    return feedDefs
      .map((d, k) => ({ def: d, idx: k, row: rows[k] ?? [NOT_YET, 0, 0] as FeedRow }))
      .filter(r => r.row[0] !== NOT_YET)
      .reverse();
  }, [f.feed, feedDefs]);

  const feedCount = useMemo(() => {
    let pending = 0, executed = 0, cancelled = 0;
    for (const b of blotter) {
      if (b.row[0] === PENDING) pending++;
      else if (b.row[0] === EXECUTED) executed++;
      else if (b.row[0] === CANCELLED) cancelled++;
    }
    return { pending, executed, cancelled };
  }, [blotter]);

  // ---- totals over the membership on screen -------------------------------
  // The opening book's value and basis point come off the engine per set. A
  // ticket that has arrived carries its own mark on that same set. Both are
  // sums over trades, so the desk line is the book plus the executed tickets,
  // with the pending ones added when the blotter toggle is on, and every term
  // in it is a number the engine produced.
  const included = useMemo(() => {
    const want = (st: number) =>
      st === EXECUTED || (withPending && st === PENDING);
    const all = feedDefs.map((_, k) => k);
    return { all, on: (fr: Frame) => all.filter(k => want(fr.feed?.[k]?.[0] ?? NOT_YET)) };
  }, [feedDefs, withPending]);

  const totalsOn = useMemo(() => (frame: number) => {
    const fr = tl.frames[frame];
    const byBook: Record<string, { npv: number; dv01: number; trades: number }> = {};
    let npv = fr.deskNpv, dv01 = fr.deskDv01, trades = fr.deskTrades;
    for (const k of included.on(fr)) {
      const r = fr.feed[k];
      npv += r[1]; dv01 += r[2]; trades += 1;
      const b = byBook[feedDefs[k].book] ??
        (byBook[feedDefs[k].book] = { npv: 0, dv01: 0, trades: 0 });
      b.npv += r[1]; b.dv01 += r[2]; b.trades += 1;
    }
    return { npv, dv01, trades, byBook };
  }, [tl.frames, feedDefs, included]);

  const totals = totalsOn(i);
  const prevTotals = prev ? totalsOn(i - 1) : null;
  const openTotals = totalsOn(0);

  // What the tickets still pending would add, summed off their own marks.
  const pendingAdds = useMemo(() => {
    let npv = 0, dv01 = 0;
    for (const k of included.all) {
      const r = f.feed?.[k];
      if (r && r[0] === PENDING) { npv += r[1]; dv01 += r[2]; }
    }
    return { npv, dv01 };
  }, [f.feed, included]);

  // ---- the zero and forward ladder ----------------------------------------
  // The opening book's ladder plus the ladder of every ticket in the
  // membership. PV01 adds across trades, and the engine's own tests check that
  // a trade's ladder is its marginal contribution to a book's.
  const ladderOn = useMemo(() => (curve: string) => {
    const times = here.riskT[curve] ?? [];
    const base = f.risk?.[curve] ?? [];
    const z = times.map((_, n) => base[n * 2] ?? 0);
    const w = times.map((_, n) => base[n * 2 + 1] ?? 0);
    for (const k of included.on(f)) {
      const lad = f.tradeLad?.[feedDefs[k].id]?.[curve];
      if (!lad) continue;
      const [zw, fw] = lad;
      for (let n = 1; n < zw.length; n++) z[zw[0] + n - 1] += zw[n];
      for (let n = 1; n < fw.length; n++) w[fw[0] + n - 1] += fw[n];
    }
    return { times, z, w };
  }, [f, here, included, feedDefs]);

  // Curves with something to show in the domain on screen. The market domain
  // is read against the quoted instruments; the other two against the bucket
  // axes.
  const riskCurves = useMemo(() => tl.curveIds.filter(c =>
    riskMode === 'mkt' ? (here.mktQ[c] ?? []).length : (f.risk?.[c] ?? []).length),
    [tl.curveIds, riskMode, here, f]);
  const curveOn = riskCurves.includes(riskCurve) ? riskCurve : (riskCurves[0] ?? riskCurve);

  const riskChart = useMemo(() => {
    const { times, z, w } = ladderOn(curveOn);
    const rows: { label: string; pv01: number; t: number }[] = [];
    times.forEach((t, n) => {
      if (t <= 0) return;
      rows.push({
        label: t < 1 ? Math.round(t * 12) + 'M' : Math.round(t) + 'Y',
        pv01: riskMode === 'zero' ? z[n] : w[n], t,
      });
    });
    return rows;
  }, [ladderOn, curveOn, riskMode]);

  // ---- market-quote ladder ------------------------------------------------
  // The engine computes this ladder on every published set, like the zero and
  // forward ones, and measures three memberships in one pass. Tickets arrive
  // with the set they were dealt on, so the membership on screen is the book
  // with the executed tickets, or with the pending ones as well when the
  // blotter toggle is on; the page reads mkt or mktPending to match. mktBase,
  // the opening book on its own, is a membership the desk no longer sees.
  const mktLadder = f.mkt ? (withPending ? f.mktPending : f.mkt) : null;
  const mktTotals = useMemo(() => {
    let total = 0, quotes = 0;
    for (const rows of Object.values(mktLadder ?? {}))
      for (const v of rows) if (v !== null) { total += v; quotes += 1; }
    return { total, quotes };
  }, [mktLadder]);
  const mktChart = useMemo(() => {
    const rows = mktLadder?.[curveOn] ?? [];
    const ids = here.mktQ[curveOn] ?? [];
    return rows.map((pv01, n) => ({
      label: (ids[n] ?? '').split('/')[0], full: ids[n] ?? '', pv01,
    })).filter(r => r.pv01 !== null) as
      { label: string; full: string; pv01: number }[];
  }, [mktLadder, curveOn, here]);
  const mktCurveTotal = mktChart.reduce((s, r) => s + r.pv01, 0);
  // The forward-bucket ladder over the same set and membership, summed. A
  // basis point on every forward interval and a basis point on every quote
  // are two routes to the same move, so the two totals are worth putting side
  // by side.
  const fwdTotal = useMemo(() => {
    let s = 0;
    for (const rows of Object.values(f.risk ?? {}))
      for (let n = 1; n < rows.length; n += 2) s += rows[n];
    for (const k of included.on(f))
      for (const lad of Object.values(f.tradeLad?.[feedDefs[k].id] ?? {}))
        for (let n = 1; n < lad[1].length; n++) s += lad[1][n];
    return s;
  }, [f, included, feedDefs]);

  // ---- position detail ----------------------------------------------------
  const position = detail?.positions.find(p => p.id === posId) ?? null;
  const posDef = feedDefs.find(d => d.id === posId) ?? null;
  const ladders = (position && detail?.tradeRisk[position.id]) || null;
  const hasDetail = useMemo(
    () => new Set((detail?.positions ?? []).map(p => p.id)), [detail]);
  // The axes the detail ladders are read against: the ones standing on the set
  // it was measured on, with anything the detail run turned up on top.
  const detailAxis = useMemo(() => {
    const at = detail ? standing[detail.frame] : null;
    return {
      riskT: { ...(at?.riskT ?? {}), ...(detail?.riskT ?? {}) },
      mktQ: { ...(at?.mktQ ?? {}), ...(detail?.mktQ ?? {}) },
    };
  }, [detail, standing]);

  // Curves this position has something to show on, for the domain on screen.
  // The market domain reaches further than the other two: an FX forward has no
  // node ladder on the meeting-dated ESTR curve and still has a market ladder
  // on it, because bumping one of its quotes re-solves the cross-currency
  // curve the forward prices off. So the curve list is rebuilt per domain,
  // off what the exported ladder actually holds.
  const posCurves = useMemo(() => {
    if (!ladders) return [];
    return Object.keys(ladders).filter(c =>
      posDomain === 'mkt' ? ladders[c].m.length
        : (posDomain === 'zero' ? ladders[c].z : ladders[c].f).length);
  }, [ladders, posDomain]);
  const curveShown = posCurve && posCurves.includes(posCurve) ? posCurve : posCurves[0];

  const posChart = useMemo(() => {
    if (!ladders || !curveShown) return [];
    const l = ladders[curveShown];
    if (posDomain === 'mkt') {
      const ids = detailAxis.mktQ[curveShown] ?? [];
      return l.m.map((pv01, n) => ({
        label: (ids[n] ?? '').split('/')[0], full: ids[n] ?? '', pv01,
      })).filter(r => r.pv01 !== null) as
        { label: string; full: string; pv01: number }[];
    }
    const times = detailAxis.riskT[curveShown] ?? [];
    const vals = posDomain === 'zero' ? l.z : l.f;
    return vals.map((pv01, n) => ({
      t: times[n] ?? 0,
      label: (times[n] ?? 0) < 1
        ? Math.round((times[n] ?? 0) * 12) + 'M' : Math.round(times[n] ?? 0) + 'Y',
      full: (times[n] ?? 0).toFixed(2) + 'Y', pv01,
    })).filter(r => r.t > 0 && r.pv01 !== null) as
      { label: string; full: string; pv01: number }[];
  }, [ladders, curveShown, posDomain, detailAxis]);

  // The ladder total on the curve shown, against the position's parallel DV01.
  // A curve-node ladder over every node of every dependency curve sums to the
  // parallel shift, so on a single-curve position these two agree; on a
  // two-curve one each curve carries part of it.
  const posTotal = posChart.reduce((s, r) => s + r.pv01, 0);
  const posAllTotal = useMemo(() => {
    if (!ladders) return 0;
    const sum = (v: (number | null)[]) =>
      v.reduce((a: number, x) => a + (x ?? 0), 0);
    return Object.values(ladders).reduce((s, l) => s + sum(
      posDomain === 'mkt' ? l.m : posDomain === 'zero' ? l.z : l.f), 0);
  }, [ladders, posDomain]);

  const priced = useMemo(() => {
    const p = curvesOf['EUR_EURIBOR6M'], d = curvesOf['EUR_ESTR_ECB'];
    return priceSwap(p ? dfMap(p) : null, d ? dfMap(d) : null,
                     tenor, rate / 100, notional * 1e6);
  }, [curvesOf, tenor, rate, notional]);

  // A book line is the trades it opened with plus the tickets on it that have
  // arrived, on whichever set is being read.
  const bookOn = (name: string, frame: number,
                  t: ReturnType<typeof totalsOn>) => {
    const base = tl.frames[frame].books.find(x => x.book === name);
    const add = t.byBook[name];
    return {
      npv: (base?.npv ?? 0) + (add?.npv ?? 0),
      dv01: (base?.dv01 ?? 0) + (add?.dv01 ?? 0),
      trades: (base?.trades ?? 0) + (add?.trades ?? 0),
    };
  };
  const bookMove = (b: BookAgg) => {
    const now = bookOn(b.book, i, totals);
    return {
      since: prevTotals ? now.npv - bookOn(b.book, i - 1, prevTotals).npv : 0,
      fromOpen: now.npv - bookOn(b.book, 0, openTotals).npv,
    };
  };
  const deskNpv = totals.npv;
  const deskDv01 = totals.dv01;
  const deskTrades = totals.trades;
  const deskSince = prevTotals ? deskNpv - prevTotals.npv : 0;
  const deskFromOpen = deskNpv - openTotals.npv;

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
        <div className="flex gap-1 ml-1">
          {/* A hollow mark for the cycle that published nothing, so a reader
              counting sets is not counting one that does not exist. */}
          {tl.frames.map((fr, k) => (
            <button key={k} onClick={() => { setI(k); setPlaying(false); }}
              title={fr.published ? `set ${fr.epoch}` : 'nothing published on this cycle'}
              className="w-6 rounded-sm"
              style={fr.published
                ? { height: 6, background: k === i ? '#d4a853' : 'var(--border-subtle)' }
                : { height: 6, background: 'transparent',
                    border: `1px dashed ${k === i ? '#d4a853' : 'var(--text-dim)'}` }} />
          ))}
        </div>
        <span className="font-mono text-[11px] ml-1" style={{ color: 'var(--text-dim)' }}>
          {f.published ? `set ${f.epoch}`
            : `no set published, set ${epochAt(i)} stands`} &middot;{' '}
          {deskTrades.toLocaleString()} trades &middot;{' '}
          {(tl.cashflows / 1e6).toFixed(1)}m cashflows
        </span>
      </div>

      {/* ---- what each clock cost on this cycle ---- */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-4 font-mono text-[11px]">
        {([['Curves rebuilt', ms(f.cycleUs), f.rebuilt.length + ' of ' + tl.curveIds.length + ' curves'],
          ['Book revalued', ms(f.npvUs), 'every trade, ' + tl.threads + ' cores'],
          ['Risk ladders', ms(f.riskUs), f.buckets + ' buckets, zero and forward'],
          ['Market PV01', f.mkt ? ms(f.mktUs) : '-',
            f.mkt ? mktTotals.quotes + ' quotes bumped, ' + f.mktRebuilds + ' curve solves'
              : 'not run, a curve is stale']]
        ).map(([k, v, note]) => (
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
                  const now = bookOn(b.book, i, totals);
                  return (
                    <tr key={b.book} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td className="px-3 py-1.5" style={{ color: b.degraded ? '#c86e6e' : 'var(--text-secondary)' }}>
                        {b.book}{b.degraded ? ' *' : ''}
                      </td>
                      <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-dim)' }}>
                        {now.trades.toLocaleString()}
                      </td>
                      <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-primary)' }}>{millions(now.npv)}</td>
                      <td className="px-3 py-1.5 text-right" style={{ color: moveColour(d.since, 1e4) }}>
                        {signed(d.since, 1e4)}
                      </td>
                      <td className="px-3 py-1.5 text-right" style={{ color: moveColour(d.fromOpen, 1e4) }}>
                        {signed(d.fromOpen, 1e4)}
                      </td>
                      <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-dim)' }}>{money(now.dv01)}</td>
                    </tr>
                  );
                })}
                <tr style={{ borderTop: '1px solid var(--border-hover)' }}>
                  <td className="px-3 py-1.5" style={{ color: 'var(--text-dim)' }}>Desk</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-dim)' }}>
                    {deskTrades.toLocaleString()}
                  </td>
                  <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-primary)' }}>{millions(deskNpv)}</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: moveColour(deskSince, 1e4) }}>
                    {signed(deskSince, 1e4)}
                  </td>
                  <td className="px-3 py-1.5 text-right" style={{ color: moveColour(deskFromOpen, 1e4) }}>
                    {signed(deskFromOpen, 1e4)}
                  </td>
                  <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-dim)' }}>{money(deskDv01)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[11px] mt-2" style={{ color: 'var(--text-dim)' }}>
            On this move is against the previous published set. Since open is against the
            first one, which is the mark the session starts from.
            {withPending && ' Pending tickets are in these totals, because the blotter toggle below is on.'}
            {f.books.some(b => b.degraded) && ' A book marked * holds trades priced on a curve that failed to rebuild and is serving its last good version.'}
          </p>

          <div className="text-[10px] uppercase mt-4 mb-2" style={{ color: 'var(--text-dim)' }}>
            Trades from the opening book
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
              These eight are from the book the desk opened with. The trades dealt
              during the session arrive on the blotter further down. Pick a row in
              either to put its own ladder on screen, below.
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
          The engine evaluates each published curve itself; nothing on screen is
          derived in the browser. Two shapes are real, not artifacts: the EURIBOR 6M
          bump between 13 and 16 months sits where its quote spacing changes, and the
          ~25bp drop in the EUR/USD instantaneous forward across year end is the
          year-end turn.
        </p>
      </div>

      {/* ---- risk ---- */}
      <div className="mt-6">
        <div className="text-[10px] uppercase mb-2" style={{ color: 'var(--text-dim)' }}>Risk</div>
        <p className="text-[11px] mb-3 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
          Three ladders, all run on every published set. Market PV01 buckets by quoted
          instrument, the ones a desk deals. Zero and forward PV01 bucket by curve
          node and interval.
        </p>
        <div className="flex gap-1.5 mb-2 flex-wrap font-mono text-[10px] items-center">
          {([['mkt', 'Market PV01'], ['zero', 'Zero PV01'],
             ['fwd', 'Forward PV01']] as const).map(([m, l]) => (
            <button key={m} onClick={() => setRiskMode(m)} className="px-2 py-0.5 rounded"
              style={chip(riskMode === m, '#5eaab5')}>{l}</button>
          ))}
          <span className="mx-1" style={{ color: 'var(--border-subtle)' }}>|</span>
          {riskCurves.map(c => (
            <button key={c} onClick={() => setRiskCurve(c)} className="px-2 py-0.5 rounded"
              style={chip(curveOn === c, COLOUR[c] ?? '#8b8a97')}>{LABEL[c] ?? c}</button>
          ))}
        </div>
        {riskMode === 'mkt' && !f.mkt ? (
          <div className="rounded px-4 py-6 text-center" style={{ border: '1px dashed var(--border-subtle)' }}>
            <p className="text-xs max-w-2xl mx-auto" style={{ color: 'var(--text-dim)' }}>
              Market PV01 was not run on set {epochAt(i)}.{' '}
              {LABEL[f.mktStale ?? ''] ?? f.mktStale} is being served stale, so the
              published curve is not the solve of the quotes behind it, and a bump
              would measure the gap between two market states. The other{' '}
              {tl.frames.filter(x => x.mkt).length} sets carry this ladder.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded px-3 py-2 mb-2 font-mono text-[11px]"
              style={{ border: '1px solid #5eaab555', background: '#5eaab50a', color: 'var(--text-secondary)' }}>
              {f.published ? `set ${f.epoch}` : `set ${epochAt(i)}, still standing`}
              <span style={{ color: 'var(--text-dim)' }}>
                {riskMode === 'mkt' ? <>
                  {' '}&middot; {mktTotals.quotes} quoted instruments,{' '}
                  {f.mktRebuilds} curve solves, in {ms(f.mktUs)} on {f.threads} cores
                </> : <>
                  {' '}&middot; {f.buckets} buckets in both the zero and forward domains, in{' '}
                  {ms(f.riskUs)} on {f.threads} cores
                </>}
                {feedCount.executed > 0 && <>
                  {' '}&middot; {feedCount.executed} executed{' '}
                  {feedCount.executed === 1 ? 'ticket is' : 'tickets are'} in it
                </>}
              </span>
              {withPending && feedCount.pending > 0 && (
                <span style={{ color: '#d4a853' }}>
                  {' '}&middot; pending tickets are in this ladder
                </span>
              )}
              {riskMode === 'mkt' && f.mktFailed > 0 && (
                <span style={{ color: '#c86e6e' }}>
                  {' '}&middot; {f.mktFailed} bumps did not build and are missing from
                  the ladder
                </span>
              )}
            </div>
            <div className="rounded p-2" style={{ border: '1px solid var(--border-subtle)' }}>
              <ResponsiveContainer width="100%" height={240}>
                {riskMode === 'mkt' ? (
                  <BarChart data={mktChart} margin={{ left: 4, right: 12, top: 6, bottom: 4 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" stroke="#55546a" tick={{ fontSize: 9 }}
                      interval={Math.max(0, Math.ceil(mktChart.length / 16) - 1)}
                      angle={-45} textAnchor="end" height={40} />
                    <YAxis stroke="#55546a" tick={{ fontSize: 10 }} width={62}
                      tickFormatter={(v: number) => Math.round(v).toLocaleString()} />
                    <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #1e1e2e', fontSize: 11 }}
                      labelFormatter={(_: any, p: any) => p?.[0]?.payload?.full ?? ''}
                      formatter={(v: any) => [Math.round(Number(v)).toLocaleString(), 'value of 1bp']} />
                    <ReferenceLine y={0} stroke="#55546a" />
                    <Bar dataKey="pv01" fill={COLOUR[curveOn] ?? '#5b8fc9'} isAnimationActive={false} />
                  </BarChart>
                ) : (
                  <BarChart data={riskChart} margin={{ left: 4, right: 12, top: 6, bottom: 4 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" stroke="#55546a" tick={{ fontSize: 9 }} interval={0} />
                    <YAxis stroke="#55546a" tick={{ fontSize: 10 }} width={62}
                      tickFormatter={(v: number) => Math.round(v).toLocaleString()} />
                    <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #1e1e2e', fontSize: 11 }}
                      formatter={(v: any) => [Math.round(Number(v)).toLocaleString(), 'value of 1bp']} />
                    <ReferenceLine y={0} stroke="#55546a" />
                    <Bar dataKey="pv01" fill={COLOUR[curveOn] ?? '#5b8fc9'} isAnimationActive={false} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
            {riskMode === 'mkt' && (
              <div className="font-mono text-[10.5px] mt-2 flex gap-6 flex-wrap"
                style={{ color: 'var(--text-dim)' }}>
                <span>
                  {LABEL[curveOn] ?? curveOn} sums to{' '}
                  <span style={{ color: 'var(--text-primary)' }}>{money(mktCurveTotal)}</span>
                </span>
                <span>
                  every curve together{' '}
                  <span style={{ color: 'var(--text-primary)' }}>{money(mktTotals.total)}</span>
                </span>
                <span>
                  forward buckets on the same set{' '}
                  <span style={{ color: 'var(--text-primary)' }}>{money(fwdTotal)}</span>
                </span>
                <span>
                  book DV01{' '}
                  <span style={{ color: 'var(--text-primary)' }}>{money(totals.dv01)}</span>
                </span>
              </div>
            )}
            <p className="text-[11px] mt-2 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
              {riskMode === 'mkt' ? <>
                Each bar is one quoted instrument of {LABEL[curveOn] ?? curveOn}: the
                quote moves a basis point, the curves re-solve in dependency order, the
                book reprices. The totals above sit side by side because a basis point
                on every quote and on every forward interval are two routes to the same
                move.
              </> : <>
                What the book gains or loses for one basis point at each{' '}
                {riskMode === 'zero' ? 'node' : 'interval'} of{' '}
                {LABEL[curveOn] ?? curveOn}, applied as an overlay on the published
                curve: the bump moves one bucket and leaves the rest alone.
              </>}
            </p>
            <p className="text-[11px] mt-3 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
              The blotter toggle below adds pending tickets to the desk totals and
              every ladder together.
            </p>
          </>
        )}
      </div>

      {/* ---- position detail ---- */}
      {detail && (
        <div className="mt-6">
          <div className="text-[10px] uppercase mb-2" style={{ color: 'var(--text-dim)' }}>
            Incoming trades
          </div>

          {/* ---- blotter ---- */}
          <div className="text-[11px] mb-3 max-w-3xl space-y-2" style={{ color: 'var(--text-dim)' }}>
            <p>
              The desk opened with {tl.trades.toLocaleString()} trades and{' '}
              {tl.cashflows.toLocaleString()} cashflow rows, and that book is already
              here. It came over as nested Parquet on {BRIDGE_CONNECTIONS} parallel
              connections, one record a trade with its schedule held as an array
              underneath it. The trade bridge on this site measured{' '}
              {BRIDGE_RPS.toLocaleString()} rows a second writing that shape, which puts
              this book at about {Math.round((tl.trades + tl.cashflows) / BRIDGE_RPS)}{' '}
              seconds.
            </p>
            <p>
              Trades arrive during the session the way prices do. The tickets dealt on
              a set come across with it and land here.{' '}
              {arrivals[i].length > 0 && <>
                {f.published ? `Set ${f.epoch}` : `The cycle after set ${epochAt(i)}`}{' '}
                carries {arrivals[i].length}, which is{' '}
                {arrivals[i].reduce((s, k) => s + (feedDefs[k].rows ?? 0), 0)
                  .toLocaleString()} rows.{' '}
              </>}
              The same bridge staged and merged a{' '}
              {DELTA_TRADES.toLocaleString()}-trade delta in {DELTA_SECS} seconds, so
              an arrival this size costs a round trip.
            </p>
            <p>
              A ticket stays on the blotter once it has arrived, and its status moves
              as later sets come in: pending until the confirmation comes back, then
              executed or pulled. An executed ticket is in the totals and the ladders
              above; a cancelled one never enters them.
            </p>
          </div>

          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <button onClick={() => setWithPending(v => !v)}
              className="px-2.5 py-1 rounded font-mono text-[10px]"
              style={chip(withPending, '#d4a853')}>
              include pending in value and risk
            </button>
            <span className="font-mono text-[10px]" style={{ color: 'var(--text-dim)' }}>
              {feedCount.executed} executed &middot; {feedCount.pending} pending &middot;{' '}
              {feedCount.cancelled} cancelled
            </span>
            {feedCount.pending > 0 && (
              <span className="font-mono text-[10px]" style={{ color: 'var(--text-dim)' }}>
                pending adds{' '}
                <span style={{ color: moveColour(pendingAdds.npv, 1) }}>
                  {money(pendingAdds.npv)}</span>
                {' '}of value and{' '}
                <span style={{ color: 'var(--text-primary)' }}>{money(pendingAdds.dv01)}</span>
                {' '}to the desk basis point
              </span>
            )}
          </div>

          <div className="rounded overflow-x-auto mb-4" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full font-mono text-[10.5px]">
              <thead>
                <tr style={{ color: 'var(--text-dim)' }}>
                  <th className="text-left px-3 py-1.5 font-normal">Ticket</th>
                  <th className="text-left px-3 py-1.5 font-normal">Venue</th>
                  <th className="text-left px-3 py-1.5 font-normal">Instrument</th>
                  <th className="text-right px-3 py-1.5 font-normal">Notional</th>
                  <th className="text-left px-3 py-1.5 font-normal">Status</th>
                  <th className="text-right px-3 py-1.5 font-normal">Value</th>
                  <th className="text-right px-3 py-1.5 font-normal">Value of 1bp</th>
                </tr>
              </thead>
              <tbody>
                {blotter.length === 0 && (
                  <tr style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="px-3 py-2" colSpan={7} style={{ color: 'var(--text-dim)' }}>
                      No trades have arrived by this set.
                    </td>
                  </tr>
                )}
                {blotter.map(({ def, row }) => {
                  const state = row[0];
                  const on = def.id === posId;
                  const has = hasDetail.has(def.id);
                  const sc = state === PENDING ? '#d4a853'
                    : state === EXECUTED ? 'var(--accent-green)' : '#c86e6e';
                  const sl = state === PENDING ? 'pending'
                    : state === EXECUTED ? 'executed' : 'cancelled';
                  const dead = state === CANCELLED;
                  return (
                    <tr key={def.id}
                      onClick={has || dead ? () => setPosId(def.id) : undefined}
                      style={{
                        borderTop: '1px solid var(--border-subtle)',
                        cursor: has || dead ? 'pointer' : 'default',
                        background: on ? '#5eaab518' : 'transparent',
                        boxShadow: on ? 'inset 3px 0 0 #5eaab5' : 'none',
                        opacity: dead ? 0.5 : 1,
                      }}>
                      <td className="px-3 py-1" style={{ color: on ? '#5eaab5' : 'var(--text-secondary)' }}>
                        {def.id}
                      </td>
                      <td className="px-3 py-1" style={{ color: 'var(--text-dim)' }}>{def.venue}</td>
                      <td className="px-3 py-1" style={{ color: 'var(--text-dim)' }}>{def.desc}</td>
                      <td className="px-3 py-1 text-right" style={{ color: 'var(--text-dim)' }}>
                        {millions(def.notional)}
                      </td>
                      <td className="px-3 py-1" style={{ color: sc }}>{sl}</td>
                      <td className="px-3 py-1 text-right"
                        style={{ color: dead ? 'var(--text-dim)' : 'var(--text-primary)' }}>
                        {dead ? '-' : money(row[1])}
                      </td>
                      <td className="px-3 py-1 text-right" style={{ color: 'var(--text-dim)' }}>
                        {dead ? '-' : money(row[2])}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        {position && (<>
          <div className="text-[10px] uppercase mb-2" style={{ color: 'var(--text-dim)' }}>
            Position detail
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
              {position.kind === 'fed' && posDef
                ? <>
                    The ticket came in on {posDef.venue} against set{' '}
                    {epochAt(posDef.arrive)}
                    {posDef.outcome === EXECUTED
                      ? <>, and the confirmation came back on set{' '}
                          {epochAt(posDef.resolve)}. It has been in the book
                          since then.</>
                      : <>. It is still open, so it stays out of the totals above until
                          the blotter toggle is on.</>}
                  </>
                : position.note}
            </div>
            <div className="font-mono text-[10.5px] mt-1" style={{ color: 'var(--text-dim)' }}>
              as of set {detail.epoch}
              {detail.epoch !== epochAt(i) && (
                <span style={{ color: '#d4a853' }}>
                  {' '}&middot; the feed has since moved to set {epochAt(i)}
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
            {ladders?.[curveShown]?.p && (
              <span style={{ color: '#c86e6e' }}>
                part of this ladder did not build and is missing from it
              </span>
            )}
          </div>

          <p className="text-[11px] mt-3 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
            {posDomain === 'mkt' ? (
              <>
                One bar per quoted instrument on {LABEL[curveShown] ?? curveShown}. The
                quote is moved a basis point, the curve and everything built on it are
                solved again, and this position is repriced against the result. The
                buckets are denominated in the instruments a hedge is executed in.
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
                is repriced. The bump is the same overlay in a different shape, and it
                localises the move to the period the cashflows accrue over.
              </>
            )}
          </p>

          <p className="text-[11px] mt-2 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
            Zero and forward overlays cost {ms(detail.ladderUs)} for the{' '}
            {detail.positions.length} positions here. The market run re-solves the
            curve per quote ({detail.mktRebuilds.toLocaleString()} solves,{' '}
            {ms(detail.mktUs)}), however many positions are watched. The curve list is
            wider in the market domain because a bump reaches through the bootstrap: an
            FX forward carries a ladder on the ESTR curve it never reads directly.
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
        </>)}
        {!position && posDef && (
          <div className="rounded px-4 py-6" style={{ border: '1px dashed var(--border-subtle)' }}>
            <p className="text-xs max-w-2xl" style={{ color: 'var(--text-dim)' }}>
              {posDef.id} was pulled before it confirmed. It never entered the book, so
              there is no mark and no ladder against it.
            </p>
          </div>
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
            floating, projected on EURIBOR and discounted on the meeting-dated ESTR curve.
          </p>
        </div>
      </div>
    </div>
  );
}
