import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

interface Row { id: string; book: string; npv: number; dv01: number; degraded: boolean }
type Pair = [number, number];

interface Frame {
  label: string; note: string; ticks: string[];
  epoch: number; published: boolean;
  rebuilt: string[]; failed: string[];
  applied: number; duplicate: number; cycleUs: number;
  status: Record<string, string>;
  rows: Row[]; deskNpv: number; deskDv01: number;
  curveData: Record<string, Pair[]>;
  risk: Record<string, Pair[]>;
}
export interface Timeline { curves: string[]; frames: Frame[] }

const LABEL: Record<string, string> = {
  EUR_ESTR: 'ESTR', EUR_ESTR_ECB: 'ESTR meeting', EUR_ESTR_IMM: 'ESTR IMM',
  EUR_ESTR_IMMFUT: 'ESTR IMM fut', EUR_EURIBOR6M: 'EURIBOR 6M',
  USD_SOFR: 'SOFR', GBP_SONIA: 'SONIA', EUR_USD_XCCY: 'EUR/USD xccy',
};

const money = (v: number) =>
  (v < 0 ? '-' : '') + Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 });


/* Value a EURIBOR swap against whichever curve set is on screen.

   Zero rates are interpolated linearly between the curve's own nodes and held
   flat outside them, then discounting is exp(-z t). The projected rate for a
   period comes from the ratio of two discount factors on the projection curve,
   which is the same relationship the engine uses. The fair rate is the fixed
   rate that makes the two legs cancel. */
function zeroAt(pts: Pair[], t: number): number {
  if (!pts.length) return 0;
  if (t <= pts[0][0]) return pts[0][1];
  if (t >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) {
      const [t0, z0] = pts[i - 1], [t1, z1] = pts[i];
      return z0 + (z1 - z0) * (t - t0) / (t1 - t0);
    }
  }
  return pts[pts.length - 1][1];
}
const dfAt = (pts: Pair[], t: number) => Math.exp(-(zeroAt(pts, t) / 100) * t);

function priceSwap(proj: Pair[], disc: Pair[], years: number,
                   fixedRate: number, notional: number) {
  if (!proj?.length || !disc?.length) return null;
  let annuity = 0;               // fixed leg, per unit of rate
  for (let k = 1; k <= Math.round(years); k++) annuity += 1.0 * dfAt(disc, k);
  let floatLeg = 0;              // projected coupons, discounted
  const step = 0.5;
  for (let t = step; t <= years + 1e-9; t += step) {
    const fwd = (dfAt(proj, t - step) / dfAt(proj, t) - 1) / step;
    floatLeg += fwd * step * dfAt(disc, t);
  }
  const fair = annuity > 0 ? floatLeg / annuity : 0;
  const npv = notional * (floatLeg - fixedRate * annuity);
  return { npv, fair: fair * 100, annuity, dv01: notional * annuity * 1e-4 };
}

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
      () => setI(x => (x + 1) % tl.frames.length), 2600);
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

  const delta = (r: Row) => {
    const p = prev?.rows.find(x => x.id === r.id);
    return p ? r.npv - p.npv : 0;
  };
  const deskDelta = prev ? f.deskNpv - prev.deskNpv : 0;

  // One row per maturity, each curve a column, so the chart draws them together.
  const curveChart = useMemo(() => {
    const ts = new Set<number>();
    Object.values(f.curveData ?? {}).forEach(pts => pts.forEach(([t]) => ts.add(t)));
    return [...ts].sort((a, b) => a - b).map(t => {
      const row: Record<string, number> = { t };
      Object.entries(f.curveData ?? {}).forEach(([c, pts]) => {
        const hit = pts.find(pp => pp[0] === t);
        if (hit) row[c] = hit[1];
      });
      return row;
    });
  }, [f.curveData]);

  const riskChart = useMemo(() => (f.risk?.['EUR_ESTR'] ?? []).map(([t, v]) => ({
    label: t < 1 ? Math.round(t * 12) + 'M' : Math.round(t) + 'Y', pv01: v,
  })), [f.risk]);

  const priced = useMemo(() => priceSwap(
    f.curveData?.['EUR_EURIBOR6M'] ?? [], f.curveData?.['EUR_ESTR'] ?? [],
    tenor, rate / 100, notional * 1e6), [f.curveData, tenor, rate, notional]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button onClick={() => setPlaying(p => !p)} className="px-3 py-1.5 rounded font-mono text-[11px]"
          style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <div className="flex gap-1">
          {tl.frames.map((_, k) => (
            <button key={k} onClick={() => { setI(k); setPlaying(false); }}
              className="w-6 h-1.5 rounded-sm"
              style={{ background: k === i ? '#d4a853' : 'var(--border-subtle)' }} />
          ))}
        </div>
        <span className="font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>
          set {f.epoch} &middot; rebuilt in {(f.cycleUs / 1000).toFixed(2)} ms
        </span>
      </div>

      <div className="rounded px-4 py-3 mb-4" style={{ border: '1px solid #d4a85355', background: '#d4a8530a' }}>
        <div className="font-mono text-xs mb-1" style={{ color: '#d4a853' }}>{f.label}</div>
        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{f.note}</div>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.1fr] gap-4">
        {/* ---- curve board ---- */}
        <div>
          <div className="text-[10px] uppercase mb-2" style={{ color: 'var(--text-dim)' }}>Curves</div>
          <div className="grid grid-cols-2 gap-2">
            {tl.curves.map(c => {
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

        {/* ---- blotter ---- */}
        <div>
          <div className="text-[10px] uppercase mb-2" style={{ color: 'var(--text-dim)' }}>Positions</div>
          <div className="rounded overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full font-mono text-[11px]">
              <thead>
                <tr style={{ color: 'var(--text-dim)' }}>
                  <th className="text-left px-3 py-1.5 font-normal">Trade</th>
                  <th className="text-right px-3 py-1.5 font-normal">Value</th>
                  <th className="text-right px-3 py-1.5 font-normal">Change</th>
                  <th className="text-right px-3 py-1.5 font-normal">DV01</th>
                </tr>
              </thead>
              <tbody>
                {f.rows.map(r => {
                  const d = delta(r);
                  return (
                    <tr key={r.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td className="px-3 py-1.5" style={{ color: r.degraded ? '#c86e6e' : 'var(--text-secondary)' }}>
                        {r.id}{r.degraded ? ' *' : ''}
                      </td>
                      <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-primary)' }}>{money(r.npv)}</td>
                      <td className="px-3 py-1.5 text-right" style={{
                        color: Math.abs(d) < 1 ? 'var(--text-dim)' : d > 0 ? 'var(--accent-green)' : '#c86e6e',
                      }}>{Math.abs(d) < 1 ? '' : (d > 0 ? '+' : '') + money(d)}</td>
                      <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-dim)' }}>{money(r.dv01)}</td>
                    </tr>
                  );
                })}
                <tr style={{ borderTop: '1px solid var(--border-hover)' }}>
                  <td className="px-3 py-1.5" style={{ color: 'var(--text-dim)' }}>Desk</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-primary)' }}>{money(f.deskNpv)}</td>
                  <td className="px-3 py-1.5 text-right" style={{
                    color: Math.abs(deskDelta) < 1 ? 'var(--text-dim)' : deskDelta > 0 ? 'var(--accent-green)' : '#c86e6e',
                  }}>{Math.abs(deskDelta) < 1 ? '' : (deskDelta > 0 ? '+' : '') + money(deskDelta)}</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-dim)' }}>{money(f.deskDv01)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {f.rows.some(r => r.degraded) && (
            <p className="text-[11px] mt-2" style={{ color: '#c86e6e' }}>
              * priced on a curve that failed to rebuild and is serving its last
              good version. The value is not wrong, it is old, and it says so
              rather than going blank or quietly carrying on.
            </p>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <div>
          <div className="text-[10px] uppercase mb-2" style={{ color: 'var(--text-dim)' }}>
            Curves, as published
          </div>
          <div className="rounded p-2" style={{ border: '1px solid var(--border-subtle)' }}>
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={curveChart} margin={{ left: 4, right: 12, top: 6, bottom: 4 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="t" type="number" scale="log" domain={[0.25, 30]}
                  ticks={[0.25, 1, 2, 5, 10, 30]} stroke="#55546a" tick={{ fontSize: 10 }}
                  tickFormatter={(v: number) => (v < 1 ? v * 12 + 'M' : v + 'Y')} />
                <YAxis stroke="#55546a" tick={{ fontSize: 10 }} width={42}
                  tickFormatter={(v: number) => v.toFixed(2) + '%'} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #1e1e2e', fontSize: 11 }}
                  labelFormatter={(v: any) => Number(v) < 1 ? Number(v) * 12 + 'M' : v + 'Y'}
                  formatter={(v: any, n: any) => [Number(v).toFixed(3) + '%', LABEL[n] ?? n]} />
                {['EUR_ESTR', 'EUR_EURIBOR6M', 'USD_SOFR', 'GBP_SONIA'].map((c, i) => (
                  <Line key={c} type="monotone" dataKey={c} isAnimationActive={false}
                    stroke={['#5b8fc9', '#d4a853', '#7fae7f', '#b07fc9'][i]}
                    strokeWidth={flash.has(c) ? 2.5 : 1.5} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase mb-2" style={{ color: 'var(--text-dim)' }}>
            Book risk by maturity, ESTR
          </div>
          <div className="rounded p-2" style={{ border: '1px solid var(--border-subtle)' }}>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={riskChart} margin={{ left: 4, right: 12, top: 6, bottom: 4 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" stroke="#55546a" tick={{ fontSize: 10 }} interval={0} />
                <YAxis stroke="#55546a" tick={{ fontSize: 10 }} width={52}
                  tickFormatter={(v: number) => Math.round(v).toLocaleString()} />
                <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #1e1e2e', fontSize: 11 }}
                  formatter={(v: any) => [Math.round(Number(v)).toLocaleString(), 'value of 1bp']} />
                <ReferenceLine y={0} stroke="#55546a" />
                <Bar dataKey="pv01" fill="#5b8fc9" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4">
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
            Priced as a payer swap against the same published curves the blotter is
            using, so the numbers move with the session as it plays. Annual fixed
            against six month floating, projected on EURIBOR and discounted on ESTR.
          </p>
        </div>
      </div>
    </div>
  );
}
