import { useMemo, useState } from 'react';
import { LABEL, COLOUR, chip, money, millions, ms, pct, moveColour, dimText } from './riskval';

// Types for /data/rt_engine/val_adjustments.json, written by the engine's
// exporter (rt_curve_engine/export_timeline.cpp) from the prudent-valuation
// module (rt_curve_engine/prudent_valuation.*) and the full-revaluation lane
// (rt_curve_engine/eod_marking.*). Every number this panel renders exists in
// that file. The ONLY client-side arithmetic is formatting (money / millions
// / ms / pct / toFixed / showLevel unit conversion, the sign prefix on
// signed figures) plus two enumerated trivial derivations from file fields:
// the build-count total perInstrumentBuilds + jointBuilds, and the count of
// rows with floored = true. No other sums, gaps or ratios are computed here;
// the engine exported them all.

export interface VaMeta {
  seed: number; generated: string; baseNpv: number;
  quotes: number; curves: number; threads: number; scope: string;
  timing: {
    passPrudentUs: number; passEvUs: number; passExitUs: number;
    jointMpuBuildUs: number; jointCocBuildUs: number; totalUs: number;
  };
  rebuilds: {
    passPrudent: number; passEv: number; passExit: number;
    jointMpu: number; jointCoc: number; jacobianReference: number;
  };
  noShortcut: {
    interpolation: string; worstRoundTripBp: number; roundTripGateBp: number;
    bbswMaxPairIterations: number; bbswTol: number;
    perInstrumentBuilds: number; jointBuilds: number; npvLane: string;
  };
}
export interface VaRow {
  curve: string; service: string; tenor: string; inst: string; quoteId: string;
  years: number; fairBp: number; consMidBp: number; sdBp: number;
  halfBoBp: number; u90Bp: number; p10Bp: number; p90Bp: number; ctb: number;
  sPerBp: number; dir: 'p10' | 'p90';
  mpuSensi: number; mpuFull: number; cocSensi: number; cocFull: number;
  evMinusPvFull: number; apvaMpuFull: number; apvaCocFull: number;
  linErrMpu: number; linErrCoc: number; floored: boolean;
}
export interface VaTotals {
  mpu: { sensi: number; full: number; gap: number; gapPct: number };
  coc: { sensi: number; full: number; gap: number; gapPct: number };
  worstRowLinErrPctMpu: number;
  apva: {
    mpuFull: number; cocFull: number; mpuSensi: number; cocSensi: number;
    headline: number; method1Mpu: number; method1Coc: number;
  };
}
export interface VaJointLeg {
  npv: number; loss: number; sumIndividualRaw: number; crossResidual: number;
  pairIterations: number; worstRoundTripBp: number;
}
export interface VaJoint { mpu: VaJointLeg; coc: VaJointLeg }
export interface VaAvaRow {
  category: string; article: string;
  raw: number | null; apva: number | null; note: string;
}
export interface ValAdjustments {
  meta: VaMeta; rows: VaRow[]; totals: VaTotals; joint: VaJoint;
  ava: VaAvaRow[];
}

// Outrights read in percent, spreads in basis points: the units each market
// quotes in. Pure formatting of file numbers (EodMarkingTab idiom).
const isSpread = (inst: string) => inst === 'TBS' || inst === 'XCCY';
const showLevel = (bp: number, inst: string) =>
  isSpread(inst) ? bp.toFixed(2) : (bp / 100).toFixed(4);
const unitOf = (inst: string) => (isSpread(inst) ? 'bp' : '%');

const signed = (v: number) => (v >= 0 ? '+' : '') + money(v);
const eodLabel = (id: string) => {
  const t = id.replace(/^EOD_/, '');
  return LABEL[t] ?? t;
};
const eodColour = (id: string) => COLOUR[id.replace(/^EOD_/, '')] ?? '#8b8a97';

const TEAL = '#5eaab5';
const AMBER = '#d4a853';

export default function ValAdjustmentsTab({ va }: { va: ValAdjustments }) {
  const curves = useMemo(() => {
    const seen: string[] = [];
    for (const r of va.rows) if (!seen.includes(r.curve)) seen.push(r.curve);
    return seen;
  }, [va.rows]);
  const [curve, setCurve] = useState<string | null>(null);

  const services = useMemo(() => {
    const seen: string[] = [];
    for (const r of va.rows)
      if ((!curve || r.curve === curve) && !seen.includes(r.service))
        seen.push(r.service);
    return seen;
  }, [va.rows, curve]);

  const t = va.totals;
  const n = va.meta.noShortcut;
  const flooredCount = va.rows.filter(r => r.floored).length;

  const tile = (k: string, v: string, note: string, colour?: string) => (
    <div key={k} className="rounded px-3 py-2" style={{
      border: `1px solid ${colour ? colour + '55' : 'var(--border-subtle)'}`,
    }}>
      <div className="text-[10px] uppercase" style={dimText}>{k}</div>
      <div className="text-sm font-mono" style={{ color: colour ?? 'var(--text-primary)' }}>{v}</div>
      <div className="text-[10px] mt-0.5" style={dimText}>{note}</div>
    </div>
  );

  const gapMaterial = Math.abs(t.mpu.gapPct) > 0.001;

  return (
    <div>
      <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        Valuation Adjustments
      </h3>
      <p className="text-sm mb-2 max-w-4xl" style={dimText}>
        I compute the market price uncertainty (Art. 9) and close-out cost (Art. 10)
        AVAs for the EOD marking universe under CDR (EU) 2016/101, as amended by
        2020/866, using both of the methods Art. 9(5)(c) allows. Fair value is the EOD family
        valuation, and the consensus inputs are the same GENERATED Totem-style run the
        IPV sheet reads, seed {va.meta.seed}.
      </p>
      <ul className="text-sm mb-3 max-w-4xl space-y-1 list-disc pl-5" style={dimText}>
        <li>
          The sensitivity route, Art. 9(5)(c)(i), multiplies the bump-and-resolve
          Jacobian by the prudent shift. It&apos;s the market-standard
          approximation.
        </li>
        <li>
          The full-revaluation route, Art. 9(5)(c)(ii), is the one I treat as
          authoritative. It re-bootstraps the EOD family for each of the{' '}
          {va.meta.quotes} instruments at the prudent, expected-value and exit
          quote, then revalues the whole book on the rebuilt curves through the
          collapsed lane.
        </li>
        <li>
          The gap between the two routes is the sensitivity route&apos;s linearity
          error, and it&apos;s printed for every instrument.
        </li>
      </ul>

      {/* ---- A: header tiles ---- */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-3 font-mono text-[11px]">
        {tile('MPU, full reval', millions(t.mpu.full),
          'Art. 9 category total, 90% confidence, per-instrument re-bootstrap', TEAL)}
        {tile('Close-out cost, full reval', millions(t.coc.full),
          'Art. 10 category total, half the 90%-confident spread crossed')}
        {tile('Sensitivity route', millions(t.mpu.sensi) + ' / ' + millions(t.coc.sensi),
          'MPU / CoC via the Jacobian, Art. 9(5)(c)(i)')}
        {tile('Linearity gap', signed(t.mpu.gap) + ' (' + pct(t.mpu.gapPct) + ')',
          `MPU full minus sensi · CoC ${signed(t.coc.gap)} (${pct(t.coc.gapPct)}) · worst single row ${pct(t.worstRowLinErrPctMpu)} of its own AVA`,
          gapMaterial ? AMBER : undefined)}
        {tile('Diversified AVA, the CET1 deduction', millions(t.apva.headline),
          'Method 2, alpha 50%, MPU + CoC on the full-reval route', TEAL)}
      </div>

      {/* ---- B: curve filter ---- */}
      <div className="flex gap-1.5 mb-3 flex-wrap font-mono text-[10px]">
        <button onClick={() => setCurve(null)} className="px-2 py-0.5 rounded"
          style={chip(curve === null, TEAL)}>all curves</button>
        {curves.map(c => (
          <button key={c} onClick={() => setCurve(c === curve ? null : c)}
            className="px-2 py-0.5 rounded" style={chip(curve === c, eodColour(c))}>
            {eodLabel(c)}
          </button>
        ))}
      </div>

      {/* ---- C: the instrument configuration ---- */}
      <div className="rounded overflow-x-auto mb-2" style={{ border: '1px solid var(--border-subtle)' }}>
        <table className="w-full font-mono text-[10.5px]">
          <thead>
            <tr style={{ color: 'var(--text-dim)' }}>
              <th className="text-left px-2 py-1.5 font-normal">Tenor</th>
              <th className="text-right px-2 py-1.5 font-normal">Cons mid</th>
              <th className="text-right px-2 py-1.5 font-normal">P10</th>
              <th className="text-right px-2 py-1.5 font-normal">P90</th>
              <th className="text-right px-2 py-1.5 font-normal">1/2 BO</th>
              <th className="text-right px-2 py-1.5 font-normal">Ctb</th>
              <th className="text-right px-2 py-1.5 font-normal">dNPV/bp</th>
              <th className="text-center px-2 py-1.5 font-normal">Dir</th>
              <th className="text-right px-2 py-1.5 font-normal">MPU sensi</th>
              <th className="text-right px-2 py-1.5 font-normal">MPU full</th>
              <th className="text-right px-2 py-1.5 font-normal">CoC sensi</th>
              <th className="text-right px-2 py-1.5 font-normal">CoC full</th>
              <th className="text-right px-2 py-1.5 font-normal">Lin err</th>
            </tr>
          </thead>
          <tbody>
            {services.map(s => {
              const group = va.rows.filter(r =>
                r.service === s && (!curve || r.curve === curve));
              const inst = group[0]?.inst ?? '';
              return [
                <tr key={s + '#head'} style={{ borderTop: '1px solid var(--border-hover)' }}>
                  <td colSpan={13} className="px-2 py-1" style={{ color: 'var(--text-secondary)' }}>
                    {s}
                    <span className="ml-2" style={dimText}>levels in {unitOf(inst)}</span>
                  </td>
                </tr>,
                ...group.map(r => (
                  <tr key={r.curve + r.quoteId} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="px-2 py-1" style={{ color: 'var(--text-secondary)' }}>
                      {r.tenor}
                      {r.floored && (
                        <span className="ml-1.5 px-1 py-0.5 rounded text-[9px] uppercase"
                          title="full-reval AVA floored at zero per Art 8(4), a linearity exhibit"
                          style={{ border: '1px solid #c86e6e66', color: '#c86e6e' }}>
                          floored
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right" style={{ color: 'var(--text-secondary)' }}>
                      {showLevel(r.consMidBp, r.inst)}
                    </td>
                    <td className="px-2 py-1 text-right" style={dimText}>{showLevel(r.p10Bp, r.inst)}</td>
                    <td className="px-2 py-1 text-right" style={dimText}>{showLevel(r.p90Bp, r.inst)}</td>
                    <td className="px-2 py-1 text-right" style={dimText}>{r.halfBoBp.toFixed(2)}</td>
                    <td className="px-2 py-1 text-right" style={dimText}>{r.ctb}</td>
                    <td className="px-2 py-1 text-right" style={dimText}>{money(r.sPerBp)}</td>
                    <td className="px-2 py-1 text-center">
                      <span className="px-1.5 py-0.5 rounded text-[9.5px] uppercase"
                        title={r.dir === 'p10'
                          ? 'the book loses when this quote falls, so the prudent level sits at the 10th percentile'
                          : 'the book loses when this quote rises, so the prudent level sits at the 90th percentile'}
                        style={{
                          border: `1px solid ${r.dir === 'p10' ? TEAL : AMBER}66`,
                          color: r.dir === 'p10' ? TEAL : AMBER,
                        }}>
                        {r.dir}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-right" style={dimText}>{money(r.mpuSensi)}</td>
                    <td className="px-2 py-1 text-right" style={{ color: 'var(--text-primary)' }}>
                      {money(r.mpuFull)}
                    </td>
                    <td className="px-2 py-1 text-right" style={dimText}>{money(r.cocSensi)}</td>
                    <td className="px-2 py-1 text-right" style={{ color: 'var(--text-secondary)' }}>
                      {money(r.cocFull)}
                    </td>
                    <td className="px-2 py-1 text-right" style={{ color: moveColour(r.linErrMpu, 100) }}>
                      {signed(r.linErrMpu)}
                    </td>
                  </tr>
                )),
              ];
            })}
            <tr style={{ borderTop: '1px solid var(--border-hover)' }}>
              <td className="px-2 py-1" colSpan={8} style={dimText}>
                Total, all curves
              </td>
              <td className="px-2 py-1 text-right" style={dimText}>{money(t.mpu.sensi)}</td>
              <td className="px-2 py-1 text-right" style={{ color: 'var(--text-primary)' }}>{money(t.mpu.full)}</td>
              <td className="px-2 py-1 text-right" style={dimText}>{money(t.coc.sensi)}</td>
              <td className="px-2 py-1 text-right" style={{ color: 'var(--text-primary)' }}>{money(t.coc.full)}</td>
              <td className="px-2 py-1 text-right" style={{ color: moveColour(t.mpu.gap, 100) }}>{signed(t.mpu.gap)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-sm mb-4 max-w-4xl" style={dimText}>
        Outrights are in percent, basis rows in basis points and adjustment columns
        in currency units. Consensus mid, half bid-offer and contributor count come
        from the GENERATED Totem-style run, seed {va.meta.seed}. P10/P90 are mid
        minus and plus the 90% confidence half-width (1.2816 x SD), and dNPV/bp is
        the engine&apos;s bump-and-resolve Jacobian ({va.meta.quotes} quotes,{' '}
        {va.meta.rebuilds.jacobianReference} curve re-solves). Lin err is MPU full
        reval minus the sensitivity route.
        {flooredCount > 0 && ` ${flooredCount} instrument${flooredCount > 1 ? 's' : ''} floored at zero per Art. 8(4).`}
      </p>

      {/* ---- D: route comparison and the no-shortcut receipt ---- */}
      <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        The two routes, reconciled
      </h4>
      <div className="rounded overflow-x-auto mb-3 max-w-2xl" style={{ border: '1px solid var(--border-subtle)' }}>
        <table className="w-full font-mono text-[10.5px]">
          <thead>
            <tr style={{ color: 'var(--text-dim)' }}>
              <th className="text-left px-3 py-1.5 font-normal">Category</th>
              <th className="text-right px-3 py-1.5 font-normal">Sensitivity</th>
              <th className="text-right px-3 py-1.5 font-normal">Full reval</th>
              <th className="text-right px-3 py-1.5 font-normal">Gap</th>
              <th className="text-right px-3 py-1.5 font-normal">Gap %</th>
            </tr>
          </thead>
          <tbody>
            {([['Market price uncertainty', t.mpu], ['Close-out costs', t.coc]] as
              [string, { sensi: number; full: number; gap: number; gapPct: number }][]).map(([label2, c]) => (
                <tr key={label2} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>{label2}</td>
                  <td className="px-3 py-1.5 text-right" style={dimText}>{money(c.sensi)}</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-primary)' }}>{money(c.full)}</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: AMBER }}>{signed(c.gap)}</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: AMBER }}>{pct(c.gapPct)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="rounded p-3 mb-3 max-w-4xl text-sm" style={{
        border: `1px solid ${TEAL}55`, background: `${TEAL}0d`, color: 'var(--text-secondary)',
      }}>
        <div className="text-[10px] uppercase mb-1" style={{ color: TEAL }}>
          Full-revaluation build checks, measured by the engine
        </div>
        <ul className="space-y-1 list-disc pl-5">
          <li>
            {n.perInstrumentBuilds} per-instrument prudent bootstraps (three
            full passes over {va.meta.quotes} instruments) plus{' '}
            {n.jointBuilds} joint builds, with{' '}
            {va.meta.rebuilds.passPrudent} / {va.meta.rebuilds.passEv} /{' '}
            {va.meta.rebuilds.passExit} curve re-solves per pass against the
            Jacobian&apos;s {va.meta.rebuilds.jacobianReference}. Each shift
            re-solves exactly its dependency closure, and the small shortfall is
            the staged BBSW pair converging in fewer iterations on the smallest
            shifts, two builds per saved iteration.
          </li>
          <li>
            Interpolation: LogCubicDiscount, a natural cubic spline on log discount
            factors, as on the RT trading curves.
          </li>
          <li>
            The staged BBSW 3s6s fixed point runs on every build that touches the
            AUD pair, up to {n.bbswMaxPairIterations} iterations to tolerance{' '}
            {n.bbswTol}.
          </li>
          <li>
            The worst bootstrap round trip across all{' '}
            {n.perInstrumentBuilds + n.jointBuilds} builds is{' '}
            {n.worstRoundTripBp.toExponential(2)}bp against the{' '}
            {n.roundTripGateBp}bp gate, with every rebuilt curve re-implying its
            own shifted target quotes.
          </li>
          <li>
            NPV lane: {n.npvLane}. Wall time {ms(va.meta.timing.totalUs)} on{' '}
            {va.meta.threads} threads (passes{' '}
            {ms(va.meta.timing.passPrudentUs)} /{' '}
            {ms(va.meta.timing.passEvUs)} / {ms(va.meta.timing.passExitUs)},
            joints {ms(va.meta.timing.jointMpuBuildUs)} /{' '}
            {ms(va.meta.timing.jointCocBuildUs)}).
          </li>
        </ul>
      </div>

      <div className="rounded overflow-x-auto mb-2 max-w-3xl" style={{ border: '1px solid var(--border-subtle)' }}>
        <table className="w-full font-mono text-[10.5px]">
          <thead>
            <tr style={{ color: 'var(--text-dim)' }}>
              <th className="text-left px-3 py-1.5 font-normal">Joint scenario</th>
              <th className="text-right px-3 py-1.5 font-normal">Loss</th>
              <th className="text-right px-3 py-1.5 font-normal">Sum of individuals</th>
              <th className="text-right px-3 py-1.5 font-normal">Cross residual</th>
            </tr>
          </thead>
          <tbody>
            {([[`All ${va.meta.quotes} at prudent (MPU)`, va.joint.mpu], [`All ${va.meta.quotes} at exit (CoC)`, va.joint.coc]] as
              [string, VaJointLeg][]).map(([label2, j]) => (
                <tr key={label2} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>{label2}</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-primary)' }}>{money(j.loss)}</td>
                  <td className="px-3 py-1.5 text-right" style={dimText}>{money(j.sumIndividualRaw)}</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: moveColour(j.crossResidual, 100) }}>
                    {signed(j.crossResidual)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm mb-4 max-w-4xl" style={dimText}>
        The joint rows are the zero-diversification prudent scenario, one more
        full family bootstrap with every quote shifted at once. Their cross
        residual is the cross-gamma carried by the bootstrap coupling. This is NOT
        the Art. 9(6) aggregate, because the regulation aggregates the individual
        AVAs above.
      </p>

      {/* ---- E: the nine categories ---- */}
      <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        AVA categories, core approach
      </h4>
      <div className="rounded overflow-x-auto mb-2 max-w-3xl" style={{ border: '1px solid var(--border-subtle)' }}>
        <table className="w-full font-mono text-[10.5px]">
          <thead>
            <tr style={{ color: 'var(--text-dim)' }}>
              <th className="text-left px-3 py-1.5 font-normal">Category</th>
              <th className="text-left px-3 py-1.5 font-normal">RTS</th>
              <th className="text-right px-3 py-1.5 font-normal">Raw</th>
              <th className="text-right px-3 py-1.5 font-normal">AVA (50%)</th>
            </tr>
          </thead>
          <tbody>
            {va.ava.map(r => (
              <tr key={r.category} title={r.note}
                style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <td className="px-3 py-1.5" style={{
                  color: r.raw !== null ? 'var(--text-secondary)' : 'var(--text-dim)',
                }}>{r.category}</td>
                <td className="px-3 py-1.5" style={dimText}>{r.article}</td>
                <td className="px-3 py-1.5 text-right" style={dimText}>
                  {r.raw !== null ? money(r.raw) : ''}
                </td>
                <td className="px-3 py-1.5 text-right" style={{
                  color: r.apva !== null ? 'var(--text-primary)' : 'var(--text-dim)',
                }}>
                  {r.apva !== null ? money(r.apva) : 'not modelled'}
                </td>
              </tr>
            ))}
            <tr style={{ borderTop: '1px solid var(--border-hover)' }}>
              <td className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>
                Total AVA, the CET1 deduction
              </td>
              <td className="px-3 py-1.5" style={dimText}>Art. 1</td>
              <td className="px-3 py-1.5"></td>
              <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-primary)' }}>
                {money(t.apva.headline)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-sm mb-4 max-w-4xl" style={dimText}>
        Hover a row for its basis. Under Method 1, 50% of the category totals
        would give {money(t.apva.method1Mpu)} (MPU) and{' '}
        {money(t.apva.method1Coc)} (CoC). The Method 2 MPU aggregate comes out
        lower because expected value sits between fair value and the prudent
        level, instrument by instrument.
      </p>

      {/* ---- F: methodology ---- */}
      <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        Methodology and assumptions
      </h4>
      <ul className="text-sm mb-3 max-w-4xl space-y-1 list-disc pl-5" style={dimText}>
        <li>
          Consensus inputs are GENERATED (seed {va.meta.seed}) because real
          consensus data can&apos;t be published on a portfolio site.
        </li>
        <li>
          Scope: {va.meta.scope}.
        </li>
        <li>
          MPU is mid-based per Art. 9(5)(a)(ii), so close-out cost is a
          separate nonzero AVA per Art. 10(2). I take the consensus half
          bid-offer as the 90%-confident half-spread (the Art. 10(6)
          assumption), and the exit shift crosses 50% of it.
        </li>
        <li>
          The 90% confidence half-width is 1.2816 x contributor SD, with P10 at
          mid minus that width and P90 at mid plus it. The sign of the
          book&apos;s net sensitivity picks the adverse side for each instrument.
        </li>
        <li>
          Both routes follow Art. 9(5)(c)(i) and (ii) verbatim. On
          low-net-sensitivity long-end quotes the sensitivity route&apos;s
          linearity error reaches {pct(t.worstRowLinErrPctMpu)} of the
          instrument&apos;s own AVA, even though the category totals agree to{' '}
          {pct(Math.abs(t.mpu.gapPct))}. That per-instrument error is why I treat
          the full-revaluation route as authoritative.
        </li>
        <li>
          The full-revaluation route re-bootstraps with the trading curves&apos;
          own construction (GlobalBootstrap over log-cubic discount splines, the
          staged BBSW 3s6s fixed point and the xccy dependency chain), with no
          additive curve shifts, overlay revaluation or substitute interpolation.
          The build checks above are measured on every export, and the export
          aborts if any of them fails.
        </li>
        <li>
          No fair-value reserves are held (Art. 8(3)) and every AVA is floored at
          zero (Art. 8(4)). Granularity is per instrument across all{' '}
          {va.meta.quotes}, with no parameter reduction.
        </li>
        <li>
          The fair-value frame is the EOD family ({millions(va.meta.baseNpv)}{' '}
          book NPV). The model basis between the trading and EOD curves is
          measured separately on the IPV tab.
        </li>
      </ul>
      <p className="text-sm max-w-4xl" style={dimText}>
        Every figure on this panel was computed by the engine and exported as
        JSON for the browser to draw.
      </p>
    </div>
  );
}
