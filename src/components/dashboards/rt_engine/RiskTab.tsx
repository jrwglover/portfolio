import { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  type RiskVal, LABEL, chip, money, millions, signedM, ms, pct,
  moveColour, panelHead, dimText,
} from './riskval';

// Utilization status colours: inside the line, running hot, breached. The
// number is always printed beside the bar, so the state is never colour alone.
const utilColour = (util: number) =>
  util > 1.0 ? '#c86e6e' : util > 0.85 ? '#d4a853' : '#5eaab5';

export default function RiskTab({ rv }: { rv: RiskVal }) {
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

  const pnlPts = useMemo(
    () => v.pnl.map((p, i) => ({ day: i, pnl: p })), [v.pnl]);

  const zoneColour = v.backtest.zone === 'green' ? 'var(--accent-green)'
    : v.backtest.zone === 'amber' ? '#d4a853' : '#c86e6e';

  return (
    <div className="space-y-8">
      {/* ---- PV01 limits ---- */}
      <div>
        <h3 className="text-base font-semibold mb-1" style={panelHead}>PV01 limits</h3>
        <p className="text-xs mb-3 max-w-3xl" style={dimText}>
          Net DV01 per curve on each published set, from the zero-bucket ladders the
          engine publishes, against a desk limit structure configured in the engine.
          The limit levels are illustrative calibration; the utilization under them
          is measured.
        </p>
        <div className="flex gap-1.5 mb-3 flex-wrap font-mono text-[10px]">
          {rv.limits.frames.map((f, k) => (
            <button key={k} onClick={() => setFrameIdx(k)}
              title={f.label} className="px-2 py-0.5 rounded"
              style={chip(k === frameIdx, '#d4a853')}>
              {f.published ? `set ${f.epoch}` : 'no set'}
            </button>
          ))}
        </div>
        <div className="rounded px-4 py-3 mb-2" style={{ border: '1px solid var(--border-subtle)' }}>
          <div className="font-mono text-[11px] mb-3" style={{ color: 'var(--text-secondary)' }}>
            {lf.label}
          </div>
          <div className="space-y-2.5">
            {lf.rows.map(r => {
              const colour = utilColour(r.util);
              const w = Math.min(r.util, 1.25) / 1.25 * 100;
              return (
                <div key={r.key} className="grid gap-2 items-center font-mono text-[11px]"
                  style={{ gridTemplateColumns: '110px 1fr 200px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{LABEL[r.key] ?? r.key}</span>
                  <div className="rounded-sm relative" style={{ height: 10, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <div className="rounded-sm" style={{ height: '100%', width: `${w}%`, background: colour }} />
                    {/* the 100% line inside the track */}
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
        </div>
        <p className="text-[11px] max-w-3xl" style={dimText}>
          {breaches.length
            ? `${breaches.map(b => LABEL[b.key] ?? b.key).join(' and ')} ${breaches.length === 1 ? 'is' : 'are'} over the line on this set: the book runs a structural short in EUR discount DV01 against a limit set below it, and the ESTR sell-off pushes it further. The mark past the end of each bar is 100%.`
            : 'Every line is inside its limit on this set. The mark past the end of each bar is 100%.'}
        </p>
      </div>

      {/* ---- portfolio VaR ---- */}
      <div>
        <h3 className="text-base font-semibold mb-1" style={panelHead}>
          Portfolio VaR, full revaluation
        </h3>
        <p className="text-xs mb-2 max-w-3xl" style={dimText}>
          Historical-simulation VaR in the CRR Art. 365 shape: the whole book is
          fully revalued through the collapsed-book lane under {v.scenarios.toLocaleString()}{' '}
          daily curve scenarios, five years of them. The scenario set is generated
          (factor model, correlated across curves and tenors, Student-t tails, one
          250-day high-volatility regime) because real market history cannot ship
          with this site; the revaluation under it is real and measured.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3 font-mono text-[11px]">
          {([
            ['1-day 99% VaR', millions(v.var99), `95%: ${millions(v.var95)}`],
            ['1-day 99% ES', millions(v.es99), `95%: ${millions(v.es95)}`],
            ['10-day 99% VaR', millions(v.var99TenDay), 'sqrt-of-10 scaling, the CRR internal-models convention'],
            ['Stressed VaR 99%', millions(v.stressed.var99), `10-day ${millions(v.stressed.var99TenDay)}, worst 250-day window`],
          ] as [string, string, string][]).map(([k, val, note]) => (
            <div key={k} className="rounded px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
              <div className="text-[10px] uppercase" style={dimText}>{k}</div>
              <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{val}</div>
              <div className="text-[10px] mt-0.5" style={dimText}>{note}</div>
            </div>
          ))}
        </div>

        <div className="rounded px-3 py-2 mb-3 font-mono text-[11px]"
          style={{ border: '1px solid #5eaab555', background: '#5eaab50a', color: 'var(--text-secondary)' }}>
          {v.scenarios.toLocaleString()} full revaluations of {rv.meta.trades.toLocaleString()} trades
          in {ms(v.timing.collapsedUs)}
          <span style={dimText}>
            {' '}&middot; {Math.round(v.timing.perScenarioUs)} µs a scenario through{' '}
            {rv.meta.terms.toLocaleString()} collapsed terms &middot; the same fan-out
            trade by trade measures {ms(v.timing.tradeLevelPerScenarioUs)} a scenario,{' '}
            {ms(v.timing.equivalentTradeLevelMs * 1000)} for the set
          </span>
        </div>

        <div className="grid lg:grid-cols-2 gap-3">
          <div className="rounded p-2" style={{ border: '1px solid var(--border-subtle)' }}>
            <div className="text-[10px] uppercase px-1 pt-1 mb-1" style={dimText}>
              1-day P&L distribution, {v.scenarios.toLocaleString()} scenarios
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={histBars} margin={{ left: 4, right: 12, top: 6, bottom: 4 }} barCategoryGap={1}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="mid" stroke="#55546a" tick={{ fontSize: 9 }}
                  tickFormatter={(x: number) => millions(x)} interval={9} />
                <YAxis stroke="#55546a" tick={{ fontSize: 10 }} width={36} />
                <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #1e1e2e', fontSize: 11 }}
                  labelFormatter={(x: any) => 'around ' + millions(Number(x))}
                  formatter={(n: any) => [n, 'days']} />
                <ReferenceLine x={-v.var99} stroke="#c86e6e" strokeDasharray="4 3"
                  label={{ value: '99% VaR', fill: '#c86e6e', fontSize: 9, position: 'insideTopLeft' }} />
                <Bar dataKey="count" isAnimationActive={false} fill="#5b8fc9" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded p-2" style={{ border: '1px solid var(--border-subtle)' }}>
            <div className="text-[10px] uppercase px-1 pt-1 mb-1" style={dimText}>
              The scenario history as daily P&L of the current book
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={pnlPts} margin={{ left: 4, right: 12, top: 6, bottom: 4 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" stroke="#55546a" tick={{ fontSize: 9 }} interval={249} />
                <YAxis stroke="#55546a" tick={{ fontSize: 10 }} width={44}
                  tickFormatter={(x: number) => millions(x)} />
                <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #1e1e2e', fontSize: 11 }}
                  labelFormatter={(x: any) => 'day ' + x}
                  formatter={(n: any) => [millions(Number(n)), '1-day P&L']} />
                <ReferenceArea x1={v.stress.start} x2={v.stress.end} fill="#d4a853" fillOpacity={0.08} />
                <ReferenceArea x1={v.stressed.start} x2={v.stressed.end}
                  fill="none" stroke="#c86e6e" strokeDasharray="4 3" strokeOpacity={0.6} />
                <Line dataKey="pnl" dot={false} stroke="#5b8fc9" strokeWidth={1.2}
                  isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <p className="text-[11px] mt-2 max-w-3xl" style={dimText}>
          The amber band is the generated history's high-volatility regime, at{' '}
          {v.stress.volMult}x daily volatility. The dashed box is the stressed-VaR
          window the engine selected: the worst continuous 250 days for this
          portfolio, days {v.stressed.start} to {v.stressed.end}, per the CRR Art.
          365(2) stressed-period idea.
        </p>

        <div className="grid lg:grid-cols-2 gap-3 mt-3">
          <div className="rounded px-3 py-2 font-mono text-[11px]" style={{ border: '1px solid var(--border-subtle)' }}>
            <div className="text-[10px] uppercase mb-1" style={dimText}>Backtest, 99% VaR</div>
            <div style={{ color: 'var(--text-secondary)' }}>
              {v.backtest.exceptions} exceptions in {v.backtest.tested.toLocaleString()} tested
              days, rolling 250-day calibration &middot;{' '}
              {v.backtest.last250Exceptions} in the last {v.backtest.last250Tested}{' '}
              &middot; <span style={{ color: zoneColour }}>{v.backtest.zone} zone</span>
            </div>
            <div className="text-[10px] mt-1" style={dimText}>
              Basel traffic light on the last 250 tested days: green to 4, amber 5 to
              9, red from 10. The regime edges are what drives the exceptions here.
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
              Sampled days {v.recon.map(r => r.day).join(', ')}: the worst loss, the
              best gain, the median, one stressed day, the last. Same P&L both
              routes, to fractions of a cent on moves of millions.
            </div>
          </div>
        </div>
      </div>

      {/* ---- stress scenarios ---- */}
      <div>
        <h3 className="text-base font-semibold mb-1" style={panelHead}>Stress scenarios</h3>
        <p className="text-xs mb-3 max-w-3xl" style={dimText}>
          Named deterministic shocks, revalued through the same collapsed lane, whole
          book and per book. The shock definitions are stated in each row; nothing
          else is assumed.
        </p>
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
        <p className="text-[11px] mt-2 max-w-3xl" style={dimText}>
          Hover a row for the shock definition. The AUD row is measured at zero
          because nothing in this book prices on the AUD curves; the shock reaches
          every curve it names and finds no position there.
        </p>
      </div>

      {/* ---- footnote ---- */}
      <p className="text-[11px] max-w-3xl" style={dimText}>
        Every figure on this tab was computed by the engine on the closing book
        ({rv.meta.trades.toLocaleString()} trades, {(rv.meta.cashflows / 1e6).toFixed(1)}m
        cashflows collapsed to {rv.meta.terms.toLocaleString()} terms) against set{' '}
        {rv.meta.epoch}, and exported as JSON. The browser draws it and adds nothing.
      </p>
    </div>
  );
}
