import { useMemo, useState } from 'react';
import { millions, money, dimText } from './riskval';

// Types for /data/rt_engine/eod_marking.json, written by the engine's
// exporter (rt_curve_engine/export_timeline.cpp). Every number here is
// engine-computed; the ONLY arithmetic this panel performs is the
// explicitly-labelled first-order application of trader overrides:
//   P&L_i  = (mark_i - default_i) * J_i        (J from the file, per bp)
//   NPV    = eodNpv + sum of P&L_i
//   dev_i  = (mark_i - mid_i) / halfBO_i
// and the IPV classification of dev_i against the thresholds the file
// carries. The measured error of that first-order application against a
// full curve re-solve is quoted from the file, not assumed.

export interface EodRow {
  curve: string; service: string; tenor: string; inst: string; years: number;
  defaultBp: number; jBp: number;
  midBp: number; sdBp: number; halfBoBp: number; u90Bp: number;
  contrib: number; devBp: number; ratio: number; status: number;
  rtErrBp: number;
}
export interface EodFamilyRow {
  id: string; tradingId: string; label: string; currency: string;
  conventions: string; instruments: number; valued: boolean;
  basis: number; worstRoundTripBp: number;
}
export interface EodFirstOrder {
  label: string; bumpBp: number; quotes: number;
  full: number; firstOrder: number; absErr: number; relErr: number;
}
export interface EodMarking {
  meta: {
    valuationDate: string; epoch: number; trades: number; threads: number;
    familyBuildUs: number; pairIterations: number;
    worstRoundTripBp: number; roundTripGateBp: number;
  };
  npv: {
    eod: number; rt: number; basis: number; crossResidual: number;
    eodTradeLevel: number; reconAbs: number;
    collapsedUs: number; tradeLevelUs: number;
  };
  family: EodFamilyRow[];
  rows: EodRow[];
  jacobian: { bumpBp: number; rebuilds: number; computeUs: number; threads: number };
  firstOrder: EodFirstOrder[];
  ipv: { seed: number; watch: number; flag: number; generated: boolean };
}

const STATUS = [
  { label: 'pass', colour: '#5cb87a' },
  { label: 'watch', colour: '#d4a853' },
  { label: 'flag', colour: '#c86e6e' },
];

// Outrights read in percent, spreads in basis points: the units each market
// quotes in. Pure formatting of file numbers.
const isSpread = (inst: string) => inst === 'TBS' || inst === 'XCCY';
const showLevel = (bp: number, inst: string) =>
  isSpread(inst) ? bp.toFixed(2) : (bp / 100).toFixed(4);
const unitOf = (inst: string) => (isSpread(inst) ? 'bp' : '%');
// An edited value in display units back to basis points.
const toBp = (v: number, inst: string) => (isSpread(inst) ? v : v * 100);

export default function EodMarkingTab({ em }: { em: EodMarking }) {
  // Trader overrides, in the display unit of each row, keyed curve|quote.
  // Client-side state only: nothing is submitted and nothing persists past
  // a reload, which the copy below says out loud.
  const [edit, setEdit] = useState<Record<string, string>>({});
  const key = (r: EodRow) => r.curve + '|' + r.tenor + '/' + r.inst;

  const marks = useMemo(() => {
    const out = new Map<string, { markBp: number; overridden: boolean }>();
    for (const r of em.rows) {
      const raw = edit[key(r)];
      const v = raw === undefined || raw.trim() === '' ? NaN : Number(raw);
      out.set(key(r), Number.isFinite(v)
        ? { markBp: toBp(v, r.inst), overridden: toBp(v, r.inst) !== r.defaultBp }
        : { markBp: r.defaultBp, overridden: false });
    }
    return out;
  }, [em.rows, edit]);

  // First-order override P&L, the labelled client-side arithmetic.
  const derived = useMemo(() => {
    let pnl = 0; let flags = 0; let watch = 0; let edited = 0;
    const rows = em.rows.map(r => {
      const m = marks.get(key(r))!;
      const rowPnl = (m.markBp - r.defaultBp) * r.jBp;
      const dev = r.halfBoBp > 0 ? (m.markBp - r.midBp) / r.halfBoBp : 0;
      const status = Math.abs(dev) < em.ipv.watch ? 0
        : Math.abs(dev) < em.ipv.flag ? 1 : 2;
      pnl += rowPnl;
      if (status === 2) flags++;
      if (status === 1) watch++;
      if (m.overridden) edited++;
      return { r, markBp: m.markBp, overridden: m.overridden, rowPnl, dev, status };
    });
    return { rows, pnl, flags, watch, edited };
  }, [em.rows, marks, em.ipv]);

  const services = useMemo(() => {
    const seen: string[] = [];
    for (const r of em.rows) if (!seen.includes(r.service)) seen.push(r.service);
    return seen;
  }, [em.rows]);
  const [service, setService] = useState<string | null>(null);

  const chip = (on: boolean, colour: string) => ({
    border: `1px solid ${on ? colour : 'var(--border-subtle)'}`,
    color: on ? colour : 'var(--text-dim)',
    background: on ? colour + '18' : 'transparent',
  });

  const worstFo = em.firstOrder.reduce((w, c) => Math.max(w, c.absErr), 0);
  const fo5 = em.firstOrder.filter(f => f.bumpBp === 5);
  const worstFo5Rel = fo5.reduce((w, c) => Math.max(w, c.relErr), 0);

  const tile = (k: string, v: string, note: string, colour?: string) => (
    <div key={k} className="rounded px-3 py-2" style={{
      border: `1px solid ${colour ? colour + '55' : 'var(--border-subtle)'}`,
    }}>
      <div className="text-[10px] uppercase" style={dimText}>{k}</div>
      <div className="text-sm font-mono" style={{ color: colour ?? 'var(--text-primary)' }}>{v}</div>
      <div className="text-[10px] mt-0.5" style={dimText}>{note}</div>
    </div>
  );

  return (
    <div>
      <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        EOD marking and Totem-structure IPV
      </h3>
      <p className="text-xs mb-2 max-w-3xl" style={dimText}>
        Intraday the desk trades on the meeting-dated model. At the close it marks a
        separate official EOD family: standard-tenor par instruments at each
        market&apos;s conventions, the shape a Totem-style consensus run quotes, and
        marks are verified against consensus per Art. 105 CRR.
      </p>
      <p className="text-xs mb-3 max-w-3xl" style={dimText}>
        Default levels are the last trading snapshot expressed in EOD conventions:
        the engine implies each standard-tenor par rate off the trading curves,
        instrument by instrument, then bootstraps the EOD family from them. Edit a
        mark to override it; overrides live in this page only and persist nowhere.
        The P&amp;L of an override is applied first order, (mark - default) x dNPV/dbp
        from the engine&apos;s bump-and-resolve Jacobian; against a full re-solve that
        approximation is off by at most {money(worstFo)} at 1bp and{' '}
        {(worstFo5Rel * 100).toFixed(2)}% at 5bp on the checks in the file.
      </p>

      {/* ---- header strip ---- */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-3 font-mono text-[11px]">
        {tile('EOD NPV at defaults', millions(em.npv.eod),
          `official close, ${em.meta.trades.toLocaleString()} trades on the EOD family`)}
        {tile('NPV with overrides', millions(em.npv.eod + derived.pnl),
          derived.edited ? `${derived.edited} mark${derived.edited > 1 ? 's' : ''} overridden` : 'no overrides',
          derived.edited ? '#5eaab5' : undefined)}
        {tile('Override P&L', (derived.pnl >= 0 ? '+' : '') + money(derived.pnl),
          'first order, sum of (mark - default) x J',
          derived.edited ? (derived.pnl >= 0 ? '#5cb87a' : '#c86e6e') : undefined)}
        {tile('IPV flags', `${derived.flags} flag / ${derived.watch} watch`,
          `|dev| >= ${em.ipv.flag} half bid-offers flags a mark`,
          derived.flags > 0 ? '#c86e6e' : undefined)}
        {tile('Model basis, EOD vs RT', (em.npv.basis >= 0 ? '+' : '') + money(em.npv.basis),
          `EOD ${millions(em.npv.eod)} vs trading model ${millions(em.npv.rt)}`)}
      </div>

      {/* ---- service filter + reset ---- */}
      <div className="flex gap-2 mb-3 font-mono text-[11px] flex-wrap items-center">
        <button onClick={() => setService(null)} className="px-2.5 py-1 rounded"
          style={chip(service === null, '#5b8fc9')}>all services</button>
        {services.map(s => (
          <button key={s} onClick={() => setService(s === service ? null : s)}
            className="px-2.5 py-1 rounded" style={chip(service === s, '#5b8fc9')}>{s}</button>
        ))}
        <button onClick={() => setEdit({})} className="px-2.5 py-1 rounded ml-auto"
          style={chip(derived.edited > 0, '#c86e6e')}>
          reset overrides
        </button>
      </div>

      {/* ---- the marking sheet ---- */}
      <div className="rounded overflow-x-auto mb-2" style={{ border: '1px solid var(--border-subtle)' }}>
        <table className="w-full font-mono text-[10.5px]">
          <thead>
            <tr style={{ color: 'var(--text-dim)' }}>
              <th className="text-left px-2 py-1.5 font-normal">Tenor</th>
              <th className="text-right px-2 py-1.5 font-normal">Default</th>
              <th className="text-right px-2 py-1.5 font-normal">Trader mark</th>
              <th className="text-right px-2 py-1.5 font-normal">Cons mid</th>
              <th className="text-right px-2 py-1.5 font-normal">SD</th>
              <th className="text-right px-2 py-1.5 font-normal">1/2 BO</th>
              <th className="text-right px-2 py-1.5 font-normal">Ctb</th>
              <th className="text-right px-2 py-1.5 font-normal">Dev (1/2 BO)</th>
              <th className="text-center px-2 py-1.5 font-normal">IPV</th>
              <th className="text-right px-2 py-1.5 font-normal">dNPV/bp</th>
              <th className="text-right px-2 py-1.5 font-normal">P&L</th>
            </tr>
          </thead>
          <tbody>
            {services.filter(s => !service || s === service).map(s => {
              const group = derived.rows.filter(d => d.r.service === s);
              const inst = group[0]?.r.inst ?? '';
              return [
                <tr key={s + '#head'} style={{ borderTop: '1px solid var(--border-hover)' }}>
                  <td colSpan={11} className="px-2 py-1" style={{ color: 'var(--text-secondary)' }}>
                    {s}
                    <span className="ml-2" style={dimText}>
                      levels in {unitOf(inst)}
                    </span>
                  </td>
                </tr>,
                ...group.map(d => {
                  const r = d.r;
                  const st = STATUS[d.status];
                  return (
                    <tr key={key(r)} style={{
                      borderTop: '1px solid var(--border-subtle)',
                      background: d.overridden ? '#5eaab50d' : 'transparent',
                    }}>
                      <td className="px-2 py-1" style={{ color: 'var(--text-secondary)' }}>{r.tenor}</td>
                      <td className="px-2 py-1 text-right" style={dimText}>
                        {showLevel(r.defaultBp, r.inst)}
                      </td>
                      <td className="px-2 py-1 text-right">
                        <input
                          value={edit[key(r)] ?? showLevel(r.defaultBp, r.inst)}
                          onChange={e => setEdit({ ...edit, [key(r)]: e.target.value })}
                          className="w-20 text-right rounded px-1 py-0.5 font-mono text-[10.5px]"
                          style={{
                            border: `1px solid ${d.overridden ? '#5eaab5' : 'var(--border-subtle)'}`,
                            background: 'var(--bg-surface)',
                            color: d.overridden ? '#5eaab5' : 'var(--text-primary)',
                          }}
                          aria-label={`trader mark ${r.service} ${r.tenor}`}
                        />
                      </td>
                      <td className="px-2 py-1 text-right" style={{ color: 'var(--text-secondary)' }}>
                        {showLevel(r.midBp, r.inst)}
                      </td>
                      <td className="px-2 py-1 text-right" style={dimText}>{r.sdBp.toFixed(2)}</td>
                      <td className="px-2 py-1 text-right" style={dimText}>{r.halfBoBp.toFixed(2)}</td>
                      <td className="px-2 py-1 text-right" style={dimText}>{r.contrib}</td>
                      <td className="px-2 py-1 text-right"
                        style={{ color: Math.abs(d.dev) >= 0.5 ? st.colour : 'var(--text-secondary)' }}>
                        {d.dev >= 0 ? '+' : ''}{d.dev.toFixed(2)}
                      </td>
                      <td className="px-2 py-1 text-center">
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] uppercase"
                          style={{ border: `1px solid ${st.colour}66`, color: st.colour }}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-right" style={dimText}>{money(r.jBp)}</td>
                      <td className="px-2 py-1 text-right" style={{
                        color: !d.overridden ? 'var(--text-dim)'
                          : d.rowPnl >= 0 ? 'var(--accent-green)' : '#c86e6e',
                      }}>
                        {d.overridden ? (d.rowPnl >= 0 ? '+' : '') + money(d.rowPnl) : '0'}
                      </td>
                    </tr>
                  );
                }),
              ];
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] mb-4 max-w-3xl" style={dimText}>
        Outrights are par rates in percent, basis rows in basis points. Consensus
        mid, dispersion, half bid-offer (read as 2 SD of the consensus range) and
        contributor count are a GENERATED Totem-style return, seed {em.ipv.seed},
        because real consensus data cannot ship with a portfolio site. Deviation is
        (mark - mid) in half bid-offer units; pass under {em.ipv.watch}, watch to{' '}
        {em.ipv.flag}, flagged beyond, the shape of an EBA prudent-valuation IPV
        test. dNPV/bp is the engine&apos;s bump-and-resolve Jacobian
        ({em.jacobian.rebuilds} curve re-solves).
      </p>

      {/* ---- the convention mapping and model basis ---- */}
      <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        The two families, and the measured basis between them
      </h4>
      <p className="text-xs mb-2 max-w-3xl" style={dimText}>
        Each EOD curve replaces one trading curve at the close. Swapping one curve
        at a time attributes the basis; single-curve swaps do not sum exactly to
        the joint swap, and the remainder is shown as the cross term, not hidden.
      </p>
      <div className="rounded overflow-x-auto mb-2" style={{ border: '1px solid var(--border-subtle)' }}>
        <table className="w-full font-mono text-[10.5px]">
          <thead>
            <tr style={{ color: 'var(--text-dim)' }}>
              <th className="text-left px-2 py-1.5 font-normal">EOD curve</th>
              <th className="text-left px-2 py-1.5 font-normal">Replaces</th>
              <th className="text-left px-2 py-1.5 font-normal">EOD conventions</th>
              <th className="text-right px-2 py-1.5 font-normal">Round trip</th>
              <th className="text-right px-2 py-1.5 font-normal">Basis share</th>
            </tr>
          </thead>
          <tbody>
            {em.family.map(f => (
              <tr key={f.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <td className="px-2 py-1" style={{ color: 'var(--text-secondary)' }}>{f.label}</td>
                <td className="px-2 py-1" style={dimText}>{f.tradingId}</td>
                <td className="px-2 py-1" style={dimText}>{f.conventions}</td>
                <td className="px-2 py-1 text-right" style={dimText}>
                  {f.worstRoundTripBp.toExponential(1)}bp
                </td>
                <td className="px-2 py-1 text-right" style={{
                  color: f.valued ? 'var(--text-primary)' : 'var(--text-dim)',
                }}>
                  {f.valued ? (f.basis >= 0 ? '+' : '') + money(f.basis) : 'nothing priced'}
                </td>
              </tr>
            ))}
            <tr style={{ borderTop: '1px solid var(--border-hover)' }}>
              <td className="px-2 py-1" style={dimText}>Cross term</td>
              <td /><td />
              <td className="px-2 py-1 text-right" style={dimText}>joint - sum of singles</td>
              <td className="px-2 py-1 text-right" style={dimText}>
                {(em.npv.crossResidual >= 0 ? '+' : '') + money(em.npv.crossResidual)}
              </td>
            </tr>
            <tr style={{ borderTop: '1px solid var(--border-hover)' }}>
              <td className="px-2 py-1" style={{ color: 'var(--text-primary)' }}>Model basis</td>
              <td /><td />
              <td className="px-2 py-1 text-right" style={dimText}>EOD NPV - RT NPV</td>
              <td className="px-2 py-1 text-right" style={{ color: 'var(--text-primary)' }}>
                {(em.npv.basis >= 0 ? '+' : '') + money(em.npv.basis)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[11px] max-w-3xl" style={dimText}>
        Verification, all engine-measured: the EOD bootstrap round-trips its default
        quotes to {em.meta.worstRoundTripBp.toExponential(1)}bp at worst (gate{' '}
        {em.meta.roundTripGateBp}bp, BBSW pair converged in {em.meta.pairIterations}{' '}
        staged iterations); the collapsed and trade-level lanes agree on the EOD
        family to {em.npv.reconAbs.toFixed(2)} currency units; first-order vs full
        re-solve: {em.firstOrder.map(f =>
          `${f.label} ${f.bumpBp}bp err ${money(f.absErr)}`).join(', ')}.
      </p>
    </div>
  );
}
