import { useMemo, useState } from 'react';
import {
  type RiskVal, type ConsensusRow, LABEL, COLOUR, chip, money, millions,
  dimText,
} from './riskval';
import { Group, PanelCard } from './PanelCard';

const STATUS = [
  { label: 'verified', colour: '#5cb87a' },
  { label: 'watch', colour: '#d4a853' },
  { label: 'investigate', colour: '#c86e6e' },
];

const bp = (v: number, dp = 2) => v.toFixed(dp);

export type ValPanel = 'ipv' | 'exit' | 'inventory';

export default function ValuationsTab({ rv, panel }: { rv: RiskVal; panel: ValPanel }) {
  const [ipvCurve, setIpvCurve] = useState<string | null>(null);

  const ipvCurves = useMemo(() => {
    const seen: string[] = [];
    for (const r of rv.consensus.rows)
      if (!seen.includes(r.curve)) seen.push(r.curve);
    return seen;
  }, [rv.consensus.rows]);

  // The rows shown: the widest first, top ten. Ordering is presentation;
  // every number in a row is the engine's.
  const ipvRows = useMemo(() => {
    const rows = rv.consensus.rows
      .filter(r => !ipvCurve || r.curve === ipvCurve)
      .slice()
      .sort((a, b) => b.ratio - a.ratio);
    return rows.slice(0, 10);
  }, [rv.consensus.rows, ipvCurve]);

  const s = rv.consensus.summary;

  return (
    <div className="space-y-8">
      {/* ================= IPV ================= */}
      {panel === 'ipv' && <Group title="Independent price verification"
        note="The engine's marks held against prices it did not produce, and against its own second route.">
        <PanelCard title="Consensus IPV"
          intro="The marks checked against a consensus service in the Totem style: a monthly run over the quoted instrument universe, each quote carrying a consensus mid, contributor count, dispersion and a half bid-offer read off the consensus range. The consensus set is generated off the fitted curves with dispersion by instrument type and maturity, because real consensus data cannot ship with this site.">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3 font-mono text-[11px]">
            {([
              ['Quotes checked', String(s.quotes), 'every quoted instrument the book prices on'],
              ['Inside half the half-BO', String(s.within), 'mark within 0.5x the consensus half bid-offer'],
              ['Between 0.5x and 1x', String(s.warn), 'watch list'],
              ['Beyond the half-BO', String(s.breach), 'flagged for investigation'],
            ] as [string, string, string][]).map(([k, v2, note], i) => (
              <div key={k} className="rounded px-3 py-2" style={{
                border: `1px solid ${i === 3 && s.breach > 0 ? '#c86e6e55' : 'var(--border-subtle)'}`,
              }}>
                <div className="text-[10px] uppercase" style={dimText}>{k}</div>
                <div className="text-sm" style={{ color: i === 3 && s.breach > 0 ? '#c86e6e' : 'var(--text-primary)' }}>{v2}</div>
                <div className="text-[10px] mt-0.5" style={dimText}>{note}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 mb-2 flex-wrap font-mono text-[10px]">
            <button onClick={() => setIpvCurve(null)} className="px-2 py-0.5 rounded"
              style={chip(ipvCurve === null, '#5eaab5')}>all curves</button>
            {ipvCurves.map(c => (
              <button key={c} onClick={() => setIpvCurve(c)} className="px-2 py-0.5 rounded"
                style={chip(ipvCurve === c, COLOUR[c] ?? '#8b8a97')}>{LABEL[c] ?? c}</button>
            ))}
          </div>
          <div className="rounded overflow-x-auto" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full font-mono text-[10.5px]">
              <thead>
                <tr style={dimText}>
                  <th className="text-left px-3 py-1.5 font-normal">Curve</th>
                  <th className="text-left px-3 py-1.5 font-normal">Instrument</th>
                  <th className="text-right px-3 py-1.5 font-normal">Mark</th>
                  <th className="text-right px-3 py-1.5 font-normal">Consensus mid</th>
                  <th className="text-right px-3 py-1.5 font-normal">Diff (bp)</th>
                  <th className="text-right px-3 py-1.5 font-normal">Half-BO (bp)</th>
                  <th className="text-right px-3 py-1.5 font-normal">Contributors</th>
                  <th className="text-right px-3 py-1.5 font-normal">Diff / half-BO</th>
                  <th className="text-left px-3 py-1.5 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {ipvRows.map((r: ConsensusRow) => {
                  const st = STATUS[r.status];
                  return (
                    <tr key={r.curve + r.q} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td className="px-3 py-1" style={{ color: COLOUR[r.curve] ?? 'var(--text-dim)' }}>
                        {LABEL[r.curve] ?? r.curve}
                      </td>
                      <td className="px-3 py-1" style={{ color: 'var(--text-secondary)' }}>{r.q}</td>
                      <td className="px-3 py-1 text-right" style={{ color: 'var(--text-secondary)' }}>{bp(r.markBp)}</td>
                      <td className="px-3 py-1 text-right" style={{ color: 'var(--text-secondary)' }}>{bp(r.midBp)}</td>
                      <td className="px-3 py-1 text-right" style={{ color: 'var(--text-primary)' }}>{bp(r.diffBp)}</td>
                      <td className="px-3 py-1 text-right" style={dimText}>{bp(r.halfBoBp)}</td>
                      <td className="px-3 py-1 text-right" style={dimText}>{r.contrib}</td>
                      <td className="px-3 py-1 text-right" style={{ color: st.colour }}>{r.ratio.toFixed(2)}x</td>
                      <td className="px-3 py-1" style={{ color: st.colour }}>{st.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] mt-2 max-w-3xl" style={dimText}>
            The ten widest of the {s.quotes} checks, marks and mids in basis points of
            each quote's own units. The tolerance is expressed in units of the
            consensus half bid-offer: inside 0.5x verifies, past 1x is flagged.
          </p>

          <div className="text-[10px] uppercase mt-4 mb-2" style={dimText}>
            Internal lanes, the second check
          </div>
          <div className="rounded overflow-x-auto" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full font-mono text-[10.5px]">
              <tbody>
                {rv.ipvLanes.map(l => (
                  <tr key={l.name} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>{l.name}</td>
                    <td className="px-3 py-1.5 text-right" style={dimText}>{millions(l.a)}</td>
                    <td className="px-3 py-1.5 text-right" style={dimText}>{millions(l.b)}</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-primary)' }}>
                      {l.kind === 'lane' ? l.diff.toExponential(2) : money(l.diff)}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {l.kind === 'lane'
                        ? <span style={{ color: l.pass ? '#5cb87a' : '#c86e6e' }}>{l.pass ? 'pass' : 'fail'}</span>
                        : <span style={dimText}>construction spread</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] mt-2 max-w-3xl" style={dimText}>
            The first lane prices the whole book two independent ways, trade by trade
            against the collapsed aggregation, and agrees to under a cent on a{' '}
            {millions(rv.meta.baseNpv)} book. The construction rows reprice the book
            with an alternative build of the same market as the discount source; that
            spread feeds the model-risk AVA below. The AUD row is zero because nothing
            prices on the AUD curves.
          </p>
        </PanelCard>
      </Group>}

      {/* ================= EXIT COSTS AND PRUDENT VALUATION ================= */}
      {panel === 'exit' && <Group title="Exit costs and prudent valuation"
        note="Two readings of the same consensus data: what leaving the book would cost, and what the regulation deducts for the uncertainty of staying.">
        <div className="grid lg:grid-cols-[2fr_3fr] gap-4 items-start">
          <PanelCard title="Close-out cost"
            intro="The cost of exiting at bid or offer instead of mid: the consensus half bid-offer per quote times the book's absolute market PV01 on that quote, summed. The spread input is the generated consensus set above; the PV01 ladder is the engine's own market-quote run on the final set.">
            <div className="rounded overflow-x-auto" style={{ border: '1px solid var(--border-subtle)' }}>
              <table className="w-full font-mono text-[11px]">
                <thead>
                  <tr style={dimText}>
                    <th className="text-left px-3 py-1.5 font-normal">Curve</th>
                    <th className="text-right px-3 py-1.5 font-normal">Quotes</th>
                    <th className="text-right px-3 py-1.5 font-normal">Close-out</th>
                    <th className="text-right px-3 py-1.5 font-normal">MPU at 90%</th>
                  </tr>
                </thead>
                <tbody>
                  {rv.closeout.byCurve.map(c => (
                    <tr key={c.curve} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td className="px-3 py-1.5" style={{ color: COLOUR[c.curve] ?? 'var(--text-secondary)' }}>
                        {LABEL[c.curve] ?? c.curve}
                      </td>
                      <td className="px-3 py-1.5 text-right" style={dimText}>{c.quotes}</td>
                      <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-primary)' }}>{money(c.closeOut)}</td>
                      <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-secondary)' }}>{money(c.mpu)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '1px solid var(--border-hover)' }}>
                    <td className="px-3 py-1.5" style={dimText}>Total</td>
                    <td className="px-3 py-1.5 text-right" style={dimText}>{rv.closeout.quotesCovered}</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-primary)' }}>{money(rv.closeout.total)}</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-secondary)' }}>{money(rv.closeout.mpuTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[11px] mt-2" style={dimText}>
              The MPU column is the same arithmetic at the 90% confidence width of
              the consensus dispersion instead of the half bid-offer; both feed the
              prudent valuation table beside this one.
            </p>
          </PanelCard>

          <PanelCard title="Prudent valuation, AVA"
            intro="Additional valuation adjustments in the EBA core approach, Commission Delegated Regulation (EU) 2016/101: nine categories at 90% confidence. Three are computed from this system's own data; the rest are listed with the reason they are not, so the table reads whole rather than cherry-picked.">
            <div className="rounded overflow-x-auto" style={{ border: '1px solid var(--border-subtle)' }}>
              <table className="w-full font-mono text-[10.5px]">
                <thead>
                  <tr style={dimText}>
                    <th className="text-left px-3 py-1.5 font-normal">Category</th>
                    <th className="text-left px-3 py-1.5 font-normal">RTS</th>
                    <th className="text-right px-3 py-1.5 font-normal">Raw</th>
                    <th className="text-right px-3 py-1.5 font-normal">AVA (50%)</th>
                  </tr>
                </thead>
                <tbody>
                  {rv.ava.rows.map(r => (
                    <tr key={r.category} title={r.note}
                      style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td className="px-3 py-1.5" style={{
                        color: r.status === 'computed' ? 'var(--text-secondary)' : 'var(--text-dim)',
                      }}>{r.category}</td>
                      <td className="px-3 py-1.5" style={dimText}>{r.article}</td>
                      <td className="px-3 py-1.5 text-right" style={dimText}>
                        {r.status === 'computed' && r.raw !== undefined ? money(r.raw) : ''}
                      </td>
                      <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-primary)' }}>
                        {r.status === 'computed' && r.ava !== undefined ? money(r.ava) : 'not modelled'}
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
                      {money(rv.ava.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[11px] mt-2" style={dimText}>
              Hover a row for its basis. Market price uncertainty reads the consensus
              dispersion, close-out costs the consensus half bid-offer, model risk
              the spread between the live meeting-dated EUR discount construction and
              its alternatives; each is aggregated at the 50% weighting of the RTS.
              The consensus inputs are generated and say so above.
            </p>
          </PanelCard>
        </div>
      </Group>}

      {/* ================= MODEL GOVERNANCE ================= */}
      {panel === 'inventory' && <Group title="Model governance"
        note="What is on the books methodologically, and what checks stand behind it.">
        <PanelCard title="Model inventory"
          intro="Every curve in the registry, its construction derived from the spec and the instruments actually quoted on it, and the verification checks the engine ran against the final set with their measured values. Nothing in this table is hand-typed where the registry can derive it.">
          <div className="space-y-2">
            {rv.inventory.map(e => (
              <div key={e.id} className="rounded px-3 py-2.5" style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                <div className="flex justify-between items-baseline gap-3 flex-wrap">
                  <span className="font-mono text-xs" style={{ color: COLOUR[e.id] ?? 'var(--text-primary)' }}>
                    {LABEL[e.id] ?? e.id}
                  </span>
                  <span className="font-mono text-[10px]" style={dimText}>
                    {e.currency}
                    {e.parents.length > 0 &&
                      <> &middot; built on {e.parents.map(p => LABEL[p] ?? p).join(', ')}</>}
                    {e.coupledWith && <> &middot; coupled with {LABEL[e.coupledWith] ?? e.coupledWith}</>}
                  </span>
                </div>
                <div className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {e.construction}. <span style={dimText}>Interpolation: {e.interpolation}.</span>
                </div>
                <div className="flex gap-1.5 mt-2 flex-wrap font-mono text-[10px]">
                  {e.checks.map(c => {
                    const colour = !c.ran ? 'var(--text-dim)' : c.pass ? '#5cb87a' : '#c86e6e';
                    const shown = c.value === undefined ? ''
                      : c.name.includes('co-publication') ? (c.value === 1 ? 'held' : 'broken')
                        : c.name.includes('coverage') ? (c.value * 100).toFixed(0) + '%'
                          : Math.abs(c.value) < 1e-2 && c.value !== 0
                            ? c.value.toExponential(2)
                            : String(c.value);
                    const text = !c.ran ? `${c.name}: not run`
                      : `${c.name}: ${shown}${c.pass ? '' : ' FLAG'}`;
                    return (
                      <span key={c.name} className="px-2 py-0.5 rounded"
                        title={(c.unit ? c.unit + '. ' : '') + (c.note ?? '')}
                        style={{ border: `1px solid ${colour}${c.ran ? '66' : '33'}`, color: colour }}>
                        {text}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] mt-2 max-w-3xl" style={dimText}>
            Hover a check for its unit and note. Checks marked not run are honest
            gaps: the comparison and AUD curves carry no positions, so there is no
            ladder to reconcile and no reason to bump their quotes. A FLAG is a
            measurement, not an apology: the BBSW 3M table gap is where the staged
            basis solve and the published spline disagree most, and it is printed
            rather than hidden.
          </p>
        </PanelCard>
      </Group>}
    </div>
  );
}
