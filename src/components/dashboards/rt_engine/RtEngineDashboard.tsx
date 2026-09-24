import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Workstation, { type Timeline } from './Workstation';
import EodMarkingTab, { type EodMarking } from './EodMarkingTab';
import ValAdjustmentsTab, { type ValAdjustments } from './ValAdjustmentsTab';
import RiskTab from './RiskTab';
import { type RiskVal } from './riskval';
// Of the parked panels (RiskTab, ValuationsTab, PanelCard), the RiskTab
// limits panel is wired back in as the Trading group's Limits tab; the
// rest stay parked until they are ready.

declare const __BUILD_ID__: string;
const BUILD_ID = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';

interface GraphNode { id: string; dependsOn: string[]; dependents: string[] }
interface Invalidation { tick: string; rebuilds: string[] }
interface GraphFile { graph: GraphNode[]; invalidation: Invalidation[]; curves: string[] }
interface DemoFile { engineDemo: string; traderDemo: string }

const LABEL: Record<string, string> = {
  EUR_ESTR: 'ESTR',
  EUR_ESTR_ECB: 'ESTR, meeting dated',
  EUR_ESTR_IMM: 'ESTR, IMM dated',
  EUR_ESTR_IMMFUT: 'ESTR, IMM futures',
  EUR_EURIBOR6M: 'EURIBOR 6M',
  USD_SOFR: 'SOFR',
  GBP_SONIA: 'SONIA',
  EUR_USD_XCCY: 'EUR/USD cross currency',
  AUD_AONIA: 'AONIA',
  AUD_AONIA_RBA: 'AONIA, meeting dated',
  AUD_BBSW3M: 'BBSW 3M',
  AUD_BBSW6M: 'BBSW 6M',
  AUD_USD_XCCY: 'AUD/USD cross currency',
  USD_CSA_CTD: 'USD CSA cheapest-to-deliver',
};

const chip = (on: boolean, colour: string) => ({
  border: `1px solid ${on ? colour : 'var(--border-subtle)'}`,
  background: on ? `${colour}1a` : 'transparent',
  color: on ? colour : 'var(--text-secondary)',
});

export default function RtEngineDashboard({ defaultTab }: { defaultTab?: string }) {
  const [tab, setTab] = useState(defaultTab ?? 'desk');
  const [g, setG] = useState<GraphFile | null>(null);
  const [demo, setDemo] = useState<DemoFile | null>(null);
  const [tl, setTl] = useState<Timeline | null>(null);
  const [em, setEm] = useState<EodMarking | null>(null);
  const [va, setVa] = useState<ValAdjustments | null>(null);
  const [rv, setRv] = useState<RiskVal | null>(null);
  const [probe, setProbe] = useState('EUR_ESTR_ECB');

  useEffect(() => {
    const v = `?v=${BUILD_ID}`;
    fetch(`/data/rt_engine/graph.json${v}`, { cache: 'no-store' })
      .then(r => r.json()).then(setG).catch(() => {});
    fetch(`/data/rt_engine/demo.json${v}`, { cache: 'no-store' })
      .then(r => r.json()).then(setDemo).catch(() => {});
    fetch(`/data/rt_engine/timeline.json${v}`, { cache: 'no-store' })
      .then(r => r.json()).then(setTl).catch(() => {});
    fetch(`/data/rt_engine/eod_marking.json${v}`, { cache: 'no-store' })
      .then(r => r.json()).then(setEm).catch(() => {});
    fetch(`/data/rt_engine/val_adjustments.json${v}`, { cache: 'no-store' })
      .then(r => r.json()).then(setVa).catch(() => {});
    fetch(`/data/rt_engine/risk_val.json${v}`, { cache: 'no-store' })
      .then(r => r.json()).then(setRv).catch(() => {});
  }, []);

  const rebuilds = useMemo(() => {
    const hit = g?.invalidation.find(i => i.tick === probe);
    return new Set(hit?.rebuilds ?? []);
  }, [g, probe]);

  // Group headings are labels only; the sub-heading chips open the panels.
  const GROUPS: { label: string; tabs: [string, string][] }[] = [
    {
      label: 'Trading',
      tabs: [['desk', 'Trading session replay'], ['limits', 'Limits']],
    },
    {
      label: 'Valuations',
      tabs: [
        ['eod', 'Independent Price Verification'],
        ['va', 'Close-out Cost and Mid-Price Uncertainty'],
      ],
    },
    {
      label: 'Design',
      tabs: [['why', 'Why events'], ['graph', 'What one price touches']],
    },
    {
      label: 'System Outputs',
      tabs: [['engine', 'Engine output'], ['trader', 'Trader output']],
    },
  ];

  return (
    <div>
      <div className="flex gap-x-8 gap-y-3 mb-6 font-mono text-[11px] flex-wrap items-start">
        {GROUPS.map(g => (
          <div key={g.label}>
            <div className="text-[10px] uppercase mb-1.5" style={{ color: 'var(--text-dim)', letterSpacing: '0.08em' }}>
              {g.label}
            </div>
            <div className="flex gap-2 flex-wrap">
              {g.tabs.map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)}
                  className={'px-3 py-1.5 rounded' + (tab === k ? '' : ' navchip')}
                  style={chip(tab === k, '#5b8fc9')}>{label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {tab === 'desk' && tl && (
        <div>
          <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            Trading session replay
          </h3>
          <p className="text-sm mb-3 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
            A recording of the engine, played back. The book comes to{' '}
            {tl.trades.toLocaleString()} trades at the open; each currency discounts on
            one meeting-dated curve, with projection and cross currency curves built on
            those. The AUD curves are published on every set with nothing priced on them.
          </p>
          <p className="text-sm mb-3 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
            When a price arrives, the curves built on it are re-solved and everything
            below recalculates. Trades arrive during the session too, pending until
            confirmed; the blotter toggle puts pending tickets into the totals.
          </p>
          <p className="text-sm mb-4 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
            The performance behind real-time VaR and PV01 comes from collapsing the
            book&apos;s cashflow schedules to curve-level coefficients. The{' '}
            <Link to="/learn/curve-data-model#collapse" style={{ color: 'var(--accent-warm)' }}>
              collapse analysis
            </Link>{' '}
            on the curve model page shows where the time goes.
          </p>
          <Workstation tl={tl} />
        </div>
      )}

      {tab === 'limits' && rv && <RiskTab rv={rv} panel="limits" />}
      {tab === 'limits' && !rv && (
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading.</p>
      )}

      {tab === 'eod' && em && <EodMarkingTab em={em} />}
      {tab === 'eod' && !em && (
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading.</p>
      )}

      {tab === 'va' && va && <ValAdjustmentsTab va={va} />}
      {tab === 'va' && !va && (
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading.</p>
      )}

      {tab === 'why' && (
        <div className="max-w-4xl">
          <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            Why not just recalculate everything on a timer
          </h3>
          <p className="text-sm mb-3" style={{ color: 'var(--text-dim)' }}>
            Most curve systems rebuild everything on a timer. Set the interval long and
            a trader can be looking at a stale curve while the market moves; set it
            short and all fourteen curves rebuild whether or not anything happened.
            Rebuilding on the event removes that choice. The hard part is that the
            curves are built on each other.
          </p>

          <div className="rounded p-4 my-4 font-mono text-[11px]" style={{
            border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)',
            color: 'var(--text-secondary)', lineHeight: 1.8,
          }}>
            <div style={{ color: 'var(--text-dim)' }}>a price moves on SOFR</div>
            <div>&nbsp;</div>
            <div>SOFR ────────────────┬──&gt; EUR/USD cross currency</div>
            <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└──&gt; AUD/USD cross currency</div>
            <div>ESTR ECB ──┬──&gt; EUR/USD cross currency</div>
            <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└──&gt; EURIBOR 6M</div>
            <div>AONIA RBA ─┬──&gt; BBSW 3M and BBSW 6M</div>
            <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└──&gt; AUD/USD cross currency</div>
            <div>&nbsp;</div>
            <div style={{ color: 'var(--text-dim)' }}>SONIA (nothing is built on it)</div>
          </div>

          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
            If SOFR and ESTR prices arrive together and each triggers its own rebuild,
            the cross currency curve builds twice, the first time against an ESTR
            curve about to be replaced, a market state that never existed. So the work
            is collected first: everything affected, ordered by dependency, built once,
            published as one set.
          </p>
        </div>
      )}

      {tab === 'graph' && g && (
        <div>
          <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            What one price forces to rebuild
          </h3>
          <p className="text-sm mb-4 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
            Pick a curve to see what a change to it forces. The dependencies come from
            the same registry the batch engine reads, so the two cannot drift apart.
          </p>

          <div className="flex gap-2 mb-4 font-mono text-[11px] flex-wrap">
            {g.invalidation.map(i => (
              <button key={i.tick} onClick={() => setProbe(i.tick)} className="px-2.5 py-1 rounded"
                style={chip(probe === i.tick, '#d4a853')}>
                {LABEL[i.tick] ?? i.tick} moves
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-3 mb-4">
            {g.graph.map(n => {
              const on = rebuilds.has(n.id);
              return (
                <div key={n.id} className="rounded px-3 py-2" style={{
                  border: `1px solid ${on ? '#d4a853' : 'var(--border-subtle)'}`,
                  background: on ? '#d4a8530f' : 'transparent',
                }}>
                  <div className="flex justify-between items-baseline gap-3">
                    <span className="font-mono text-xs" style={{ color: on ? '#d4a853' : 'var(--text-primary)' }}>
                      {LABEL[n.id] ?? n.id}
                    </span>
                    <span className="text-[10px] uppercase" style={{ color: 'var(--text-dim)' }}>
                      {on ? 'rebuilt' : 'untouched'}
                    </span>
                  </div>
                  <div className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>
                    {n.dependsOn.length
                      ? 'built on ' + n.dependsOn.map(d => LABEL[d] ?? d).join(' and ')
                      : 'built on its own quotes'}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-sm max-w-4xl" style={{ color: 'var(--text-dim)' }}>
            {rebuilds.size === 1
              ? 'Nothing else depends on this one, so the work stops here.'
              : `${rebuilds.size} curves rebuild, in the order shown, each one at most once even when several of its inputs moved together.`}
          </p>
        </div>
      )}

      {(tab === 'engine' || tab === 'trader') && demo && (
        <div>
          <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            {tab === 'engine' ? 'A run of the engine' : 'The same run, from a trading view'}
          </h3>
          <p className="text-sm mb-4 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
            {tab === 'engine'
              ? 'A replayed stream of price changes, with repeats and out-of-order arrivals. A solver fails and the last good curve is served; a burst of 120 prices collapses into one rebuild while two readers check nothing is half updated.'
              : 'The same engine from the desk side. It shows position values and risk per curve bucket, and what a sell off in ESTR does to each. Profit and loss is split between market moves and carry. A hypothetical trade is priced without disturbing anything published.'}
          </p>
          <pre className="rounded p-4 overflow-x-auto font-mono"
            style={{
              border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)',
              color: 'var(--text-secondary)', fontSize: 10.5, lineHeight: 1.55,
            }}>
            {tab === 'engine' ? demo.engineDemo : demo.traderDemo}
          </pre>
          <p className="text-sm mt-3 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
            This is the program&apos;s own output, not a recording. The curve solver
            and the pricing kernel are stubbed behind the same interfaces the
            batch engine implements, so the timings here measure the plumbing
            alone.
          </p>
        </div>
      )}

      {!g && !demo && !tl && (
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading.</p>
      )}
    </div>
  );
}
