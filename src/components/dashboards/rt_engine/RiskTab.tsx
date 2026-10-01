import { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  type RiskVal, LABEL, chip, money, millions, signedM, ms, pct,
  moveColour, dimText,
} from './riskval';
import { Group, PanelCard } from './PanelCard';

// Utilization status colours: inside the line, running hot, breached. The
// number is always printed beside the bar, so the state is never colour alone.
const utilColour = (util: number) =>
  util > 1.0 ? '#c86e6e' : util > 0.85 ? '#d4a853' : '#5eaab5';

export type RiskPanel = 'limits' | 'var' | 'stress';

export default function RiskTab({ rv, panel }: { rv: RiskVal; panel: RiskPanel }) {
  const v = rv.var;

  // The limit panel opens on the worst frame of the session, which is a
  // choice of what to show first, not a computed number.
  const worstFrame = useMemo(() => {
    let best = 0, bestU = -1;
    rv.limits.frames.forEach((f, k) => {
      for (const r of f.rows) if (r.util > bestU) { bestU = r.util; best = k; }
    });
    return best;
  }, [rv.limits.frames]);
  const [frameIdx, setFrameIdx] = useState(worstFrame);
  const lf = rv.limits.frames[frameIdx] ?? rv.limits.frames[0];
  const limitOf = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of rv.limits.config) m[c.key] = c.limit;
    return m;
  }, [rv.limits.config]);
  const breaches = lf.rows.filter(r => r.breach);

  // Histogram bars: position labels come off the exported bin origin and
  // width; counts are the engine's own binning.
  const histBars = useMemo(() => v.hist.counts.map((n, i) => ({
    mid: v.hist.lo + (i + 0.5) * v.hist.width,
    count: n,
  })), [v.hist]);
  // The axis is categorical (one slot per bin), so the VaR marker sits on
  // the bin that contains it: positioning only, the level is the engine's.
  const varBinMid = useMemo(() => {
    let best = histBars[0]?.mid ?? 0;
    for (const b of histBars)
      if (Math.abs(b.mid - -v.var99) < Math.abs(best - -v.var99)) best = b.mid;
    return best;
  }, [histBars, v.var99]);

  const pnlPts = useMemo(
    () => v.pnl.map((p, i) => ({ day: i, pnl: p })), [v.pnl]);
  const yearLabel = useMemo(() => {
    const m: Record<number, string> = {};
    for (const t of v.yearTicks) m[t.idx] = t.label;
    return m;
  }, [v.yearTicks]);
  // Every other year, so thirty ticks do not collide.
  const yearTickIdx = useMemo(
    () => v.yearTicks.filter((_, k) => k % 2 === 0).map(t => t.idx),
    [v.yearTicks]);

  const zoneColour = v.backtest.zone === 'green' ? 'var(--accent-green)'
    : v.backtest.zone === 'amber' ? '#d4a853' : '#c86e6e';

  return (
    <div className="space-y-8">
      {/* ================= LIMITS ================= */}
      {panel === 'limits' && <Group title="Limits"
        note="This compares what the desk is allowed to run with what it is running.">
        <PanelCard title="PV01 limits"
          intro="Each bar is a curve's net market PV01 on the chosen set, the sum of its market PV01 ladder, against a desk limit structure configured in the engine. Limits live in the quote space the desk deals in, so a set whose market run was skipped isn't evaluated. The levels are illustrative, but the utilization under them is measured.">
          <div className="flex gap-1.5 mb-3 flex-wrap font-mono text-[10px]">
            {rv.limits.frames.map((f, k) => (
              <button key={k} onClick={() => setFrameIdx(k)}
                title={f.label} className="px-2 py-0.5 rounded"
                style={chip(k === frameIdx, '#d4a853')}>
                {f.published ? `set ${f.epoch}` : 'no set'}
              </button>
            ))}
          </div>
          <div className="font-mono text-[11px] mb-3" style={{ color: 'var(--text-secondary)' }}>
            {lf.label}
          </div>
          <div className="space-y-2.5 mb-3">
            {lf.rows.map(r => {
              const colour = utilColour(r.util);
              const w = Math.min(r.util, 1.25) / 1.25 * 100;
              return (
                <div key={r.key} className="grid gap-2 items-center font-mono text-[11px]"
                  style={{ gridTemplateColumns: '110px 1fr 200px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{LABEL[r.key] ?? r.key}</span>
                  <div className="rounded-sm relative" style={{ height: 10, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <div className="rounded-sm" style={{ height: '100%', width: `${w}%`, background: colour }} />
                    <div style={{ position: 'absolute', top: -2, bottom: -2, left: `${100 / 1.25}%`, width: 1, background: 'var(--text-dim)' }} />
                  </div>
                  <span className="text-right" style={{ color: colour }}>
                    {pct(r.util)}
                    <span style={dimText}>
                      {' '}&middot; {money(r.dv01)} / {money(limitOf[r.key] ?? 0)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-sm max-w-4xl" style={dimText}>
            {breaches.length
              ? `${breaches.map(b => LABEL[b.key] ?? b.key).join(' and ')} ${breaches.length === 1 ? 'is' : 'are'} over the line on this set. The session's tickets run unhedged until the close, and the large EURIBOR receivers dealt on the gap set take that line through its limit. The mark past the end of each bar is 100%.`
              : 'Every line is inside its limit on this set. The mark past the end of each bar is 100%.'}
          </p>
        </PanelCard>
      </Group>}

      {/* ================= VALUE AT RISK ================= */}
      {panel === 'var' && <Group title="Value at Risk"
        note="Ordinary and stressed VaR both fully revalue the collapsed book.">
        <PanelCard title="Portfolio VaR, full revaluation"
          intro={<>
            Historical-simulation VaR in the CRR Art. 365 shape fully revalues the
            whole book under a dated business-day history of curve moves from{' '}
            {v.from} to{' '}
            {v.to}. Real market history can&apos;t ship with this site, so the history
            is generated from a factor model correlated across curves and tenors with
            Student-t tails, its volatility regimes calibrated to the actual stress
            chronology (2008-09 at 3.5x with fatter tails, March 2020 at 2.5x, the
            2022-23 hiking cycle at 1.8x). The revaluation under it is measured.
          </>}>

          {/* strictly matched horizons: one row, one horizon */}
          <div className="rounded overflow-x-auto mb-2" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full font-mono text-[11px]">
              <thead>
                <tr style={dimText}>
                  <th className="text-left px-3 py-1.5 font-normal">Horizon</th>
                  <th className="text-right px-3 py-1.5 font-normal">VaR 99%</th>
                  <th className="text-right px-3 py-1.5 font-normal">ES 99%</th>
                  <th className="text-right px-3 py-1.5 font-normal">Stressed VaR 99%</th>
                  <th className="text-right px-3 py-1.5 font-normal">Stressed ES 99%</th>
                </tr>
              </thead>
              <tbody>
                {v.rows.map(r => (
                  <tr key={r.horizon} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>{r.horizon}</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-primary)' }}>{millions(r.var99)}</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-secondary)' }}>{millions(r.es99)}</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-primary)' }}>{millions(r.svar99)}</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-secondary)' }}>{millions(r.ses99)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm mb-3 max-w-4xl" style={dimText}>
            Each measure uses exactly {v.window} scenarios, with ordinary VaR taking
            the {v.window} most recent days, {v.trailing.from} to {v.trailing.to}{' '}
            (1-day 95% {millions(v.var95)}). Stressed VaR takes the worst continuous{' '}
            {v.window}-day window for this portfolio, <span style={{ color: 'var(--text-secondary)' }}>
            {v.stressed.start} to {v.stressed.end}</span>, identified per Art.
            365(2) as the continuous period of significant stress relevant to the
            portfolio. It lands on the 2008-09 crisis and runs{' '}
            {v.svarRatio.toFixed(1)}x ordinary VaR. The 10-day row scales the 1-day
            row by sqrt-of-10, the internal-models convention, and both sides use the
            same estimator, linear interpolation between order statistics on the
            window&apos;s own 250 P&Ls.
          </p>

          <div className="rounded px-3 py-2 mb-3 font-mono text-[11px]"
            style={{ border: '1px solid #5eaab555', background: '#5eaab50a', color: 'var(--text-secondary)' }}>
            {v.scenarios.toLocaleString()} full revaluations of {rv.meta.trades.toLocaleString()} trades
            in {ms(v.timing.collapsedUs)}
            <span style={dimText}>
              {' '}&middot; {Math.round(v.timing.perScenarioUs)} µs a scenario through{' '}
              {rv.meta.terms.toLocaleString()} collapsed terms &middot; the whole
              history is run for the window search and the backtest &middot; trade by
              trade the same fan-out measures {ms(v.timing.tradeLevelPerScenarioUs)} a
              scenario, {ms(v.timing.equivalentTradeLevelMs * 1000)} for the set
            </span>
          </div>

          <div className="grid lg:grid-cols-2 gap-3">
            <div className="rounded p-2" style={{ border: '1px solid var(--border-subtle)' }}>
              <div className="text-[10px] uppercase px-1 pt-1 mb-1" style={dimText}>
                1-day P&L, the {v.window} most recent days
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={histBars} margin={{ left: 4, right: 12, top: 6, bottom: 4 }} barCategoryGap={1}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="mid" stroke="#55546a" tick={{ fontSize: 9 }}
                    tickFormatter={(x: number) => millions(x)} interval={4} />
                  <YAxis stroke="#55546a" tick={{ fontSize: 10 }} width={36} />
                  <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #1e1e2e', fontSize: 11 }}
                    labelFormatter={(x: any) => 'around ' + millions(Number(x))}
                    formatter={(n: any) => [n, 'days']} />
                  <ReferenceLine x={varBinMid} stroke="#c86e6e" strokeDasharray="4 3"
                    label={{ value: '99% VaR', fill: '#c86e6e', fontSize: 9, position: 'insideTopLeft' }} />
                  <Bar dataKey="count" isAnimationActive={false} fill="#5b8fc9" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded p-2" style={{ border: '1px solid var(--border-subtle)' }}>
              <div className="text-[10px] uppercase px-1 pt-1 mb-1" style={dimText}>
                The full history as daily P&L of the current book, {v.from} to {v.to}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={pnlPts} margin={{ left: 4, right: 12, top: 6, bottom: 4 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="day" type="number" domain={[0, v.pnl.length - 1]}
                    stroke="#55546a" tick={{ fontSize: 9 }}
                    ticks={yearTickIdx}
                    tickFormatter={(x: number) => yearLabel[x] ?? ''} />
                  <YAxis stroke="#55546a" tick={{ fontSize: 10 }} width={44}
                    tickFormatter={(x: number) => millions(x)} />
                  <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #1e1e2e', fontSize: 11 }}
                    labelFormatter={() => ''}
                    formatter={(n: any) => [millions(Number(n)), '1-day P&L']} />
                  {v.regimes.map(r => (
                    <ReferenceArea key={r.name} x1={r.startIdx} x2={r.endIdx}
                      fill="#d4a853" fillOpacity={0.03 + 0.03 * r.volMult} />
                  ))}
                  <ReferenceArea x1={v.stressed.startIdx} x2={v.stressed.endIdx}
                    fill="none" stroke="#c86e6e" strokeDasharray="4 3" strokeOpacity={0.6} />
                  <Line dataKey="pnl" dot={false} stroke="#5b8fc9" strokeWidth={1}
                    isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <p className="text-sm mt-2 max-w-4xl" style={dimText}>
            Amber bands mark the generated history&apos;s calibrated stress regimes
            ({v.regimes.map(r => `${r.name} ${r.volMult}x`).join(', ')}), darker
            where the multiple is higher, and the dashed box is the identified
            stressed period, {v.stressed.start} to {v.stressed.end}. The full history
            is there to find that window and run the backtest. Neither VaR figure is
            computed over it.
          </p>

          <div className="grid lg:grid-cols-2 gap-3 mt-3">
            <div className="rounded px-3 py-2 font-mono text-[11px]" style={{ border: '1px solid var(--border-subtle)' }}>
              <div className="text-[10px] uppercase mb-1" style={dimText}>Backtest, 99% VaR</div>
              <div style={{ color: 'var(--text-secondary)' }}>
                {v.backtest.exceptions} exceptions in {v.backtest.tested.toLocaleString()} tested
                days from {v.backtest.from}, rolling {v.window}-day calibration &middot;{' '}
                {v.backtest.last250Exceptions} in the last {v.backtest.last250Tested}{' '}
                &middot; <span style={{ color: zoneColour }}>{v.backtest.zone} zone</span>
              </div>
              <div className="text-[10px] mt-1" style={dimText}>
                The Basel traffic light uses the last 250 tested days, green up to 4
                exceptions, amber 5 to 9 and red from 10. Exceptions cluster where a
                regime starts, before the rolling window has seen it.
              </div>
            </div>
            <div className="rounded px-3 py-2 font-mono text-[11px]" style={{ border: '1px solid var(--border-subtle)' }}>
              <div className="text-[10px] uppercase mb-1" style={dimText}>
                Scenario reconciliation, collapsed vs trade level
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                {v.recon.length} sampled scenarios repriced trade by trade through the
                same shifted views &middot; worst absolute P&L difference{' '}
                <span style={{ color: 'var(--text-primary)' }}>
                  {v.worstScenAbsDiff.toExponential(2)}
                </span>
              </div>
              <div className="text-[10px] mt-1" style={dimText}>
                Sampled on {v.recon.map(r => r.date).join(', ')}: the worst loss, the
                best gain, the median, one stressed day and the last. Both routes give
                the same P&L to fractions of a cent on moves of millions.
              </div>
            </div>
          </div>
        </PanelCard>
      </Group>}

      {/* ================= STRESS ================= */}
      {panel === 'stress' && <Group title="Stress scenarios"
        note="These are the shocks a committee asks about, run through the same collapsed lane.">
        <PanelCard title="Stress scenarios"
          intro="Each named deterministic shock is revalued through the collapsed lane for the whole book and for each book, and its row states the shock in full.">
          <div className="rounded overflow-x-auto" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full font-mono text-[11px]">
              <thead>
                <tr style={dimText}>
                  <th className="text-left px-3 py-1.5 font-normal">Scenario</th>
                  {rv.stressScenarios[0]?.byBook.map(b => (
                    <th key={b.book} className="text-right px-3 py-1.5 font-normal">{b.book}</th>
                  ))}
                  <th className="text-right px-3 py-1.5 font-normal">Total</th>
                </tr>
              </thead>
              <tbody>
                {rv.stressScenarios.map(s => (
                  <tr key={s.name} style={{ borderTop: '1px solid var(--border-subtle)' }} title={s.note}>
                    <td className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>{s.name}</td>
                    {s.byBook.map(b => (
                      <td key={b.book} className="px-3 py-1.5 text-right"
                        style={{ color: moveColour(b.pnl, 1e3) }}>
                        {Math.abs(b.pnl) < 1e3 ? '0' : signedM(b.pnl)}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right" style={{ color: moveColour(s.total, 1e3) }}>
                      {Math.abs(s.total) < 1e3 ? '0' : signedM(s.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm mt-2 max-w-4xl" style={dimText}>
            Hover a row for the shock definition. Every row is a full revaluation of
            the closing book, with the session&apos;s tickets hedged at the close.
          </p>
        </PanelCard>
      </Group>}

      {/* ---- footnote ---- */}
      <p className="text-sm max-w-4xl" style={dimText}>
        Every figure on this panel was computed by the engine on the closing book
        ({rv.meta.trades.toLocaleString()} trades, {(rv.meta.cashflows / 1e6).toFixed(1)}m
        cashflows collapsed to {rv.meta.terms.toLocaleString()} terms) against set{' '}
        {rv.meta.epoch} and exported as JSON for the browser to draw.
      </p>
    </div>
  );
}
