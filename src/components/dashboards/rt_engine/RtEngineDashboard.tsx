import { useEffect, useMemo, useState } from 'react';
import Workstation, { type Timeline } from './Workstation';

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
  const [probe, setProbe] = useState('EUR_ESTR');

  useEffect(() => {
    const v = `?v=${BUILD_ID}`;
    fetch(`/data/rt_engine/graph.json${v}`, { cache: 'no-store' })
      .then(r => r.json()).then(setG).catch(() => {});
    fetch(`/data/rt_engine/demo.json${v}`, { cache: 'no-store' })
      .then(r => r.json()).then(setDemo).catch(() => {});
    fetch(`/data/rt_engine/timeline.json${v}`, { cache: 'no-store' })
      .then(r => r.json()).then(setTl).catch(() => {});
  }, []);

  const rebuilds = useMemo(() => {
    const hit = g?.invalidation.find(i => i.tick === probe);
    return new Set(hit?.rebuilds ?? []);
  }, [g, probe]);

  const TABS: [string, string][] = [
    ['desk', 'Desk view'],
    ['why', 'Why events'],
    ['graph', 'What one price touches'],
    ['engine', 'Engine output'],
    ['trader', 'Trader output'],
  ];

  return (
    <div>
      <div className="flex gap-2 mb-6 font-mono text-[11px] flex-wrap">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className="px-3 py-1.5 rounded"
            style={chip(tab === k, '#5b8fc9')}>{label}</button>
        ))}
      </div>

      {tab === 'desk' && tl && (
        <div>
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            The desk
          </h3>
          <p className="text-xs mb-3 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
            This is a recording of the engine running, played back. The book is{' '}
            {tl.trades.toLocaleString()} trades on eight curves. When a price comes in, the
            curves that depend on it get rebuilt and the book gets repriced. Watch which
            curves light up and which ones don&apos;t.
          </p>
          <p className="text-xs mb-4 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
            The timings above come from the engine itself. Rebuilding the curves a price
            touched takes up to a third of a second, and repricing all{' '}
            {tl.trades.toLocaleString()} trades takes about a tenth of one, so both of
            those can run every time a new set is published. A full risk ladder takes
            about three seconds. That is why you have to ask for it, and why it stays
            labelled with the set it was run against.
          </p>
          <Workstation tl={tl} />
        </div>
      )}

      {tab === 'why' && (
        <div className="max-w-3xl">
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            Why not just recalculate everything on a timer
          </h3>
          <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>
            Most curve systems poll, and with good reason. A scheduled job wakes
            up every minute or so, rebuilds every curve from the latest prices,
            and publishes the lot. The work is bounded and the order is fixed.
            When something looks wrong there is one place to look. On plenty of
            desks that is the right answer.
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>
            The cost is that you have to pick an interval, and one interval has
            to serve every curve and every kind of day. Five minutes is cheap.
            In a fast move it puts a trader in front of a curve five minutes
            old. Ten seconds is fresh, and it rebuilds all eight curves six
            times a minute whether or not anything moved. A solve costs a few
            tenths of a second, so that is affordable. It is still eight curves
            when one of them moved. What suits a quiet morning does not suit a
            payrolls number.
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>
            Rebuilding on the event takes the choice away. It also costs you the
            bounded batch and the fixed order, which are the two things that made
            polling easy to operate. That is why it is less common. The hard part
            is the dependencies between curves.
          </p>

          <div className="rounded p-4 my-4 font-mono text-[11px]" style={{
            border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)',
            color: 'var(--text-secondary)', lineHeight: 1.8,
          }}>
            <div style={{ color: 'var(--text-dim)' }}>a price moves on SOFR</div>
            <div>&nbsp;</div>
            <div>SOFR ────────────┐</div>
            <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├──&gt; EUR/USD cross currency</div>
            <div>ESTR ──┬─────────┘</div>
            <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└──&gt; EURIBOR 6M</div>
            <div>&nbsp;</div>
            <div style={{ color: 'var(--text-dim)' }}>SONIA (nothing is built on it)</div>
          </div>

          <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>
            The cross currency curve is built from both SOFR and ESTR. Say a
            SOFR price and an ESTR price arrive together, and each one triggers a
            rebuild of whatever depends on it. The cross currency curve gets
            built twice. The first build used an ESTR curve that was about to be
            replaced. Publish that and someone prices a trade against a market
            state that never existed.
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>
            The work has to be collected before it is done, not done as it
            arrives: gather everything affected, order it so each curve is built
            after the curves it depends on, build each one once, and publish the
            whole set together. Get that wrong and the failure is quiet. Nothing
            crashes. A number is just slightly off, on one screen, for a few
            seconds, and nobody can reproduce it afterwards.
          </p>
          <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
            That is the part worth building carefully. It is also why polling
            stays popular. Rebuilding everything in dependency order every time
            is the brute force answer to the same question, and it has none of
            these problems. It just costs you either latency or hardware.
          </p>
        </div>
      )}

      {tab === 'graph' && g && (
        <div>
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            One price moves, and only some curves need rebuilding
          </h3>
          <p className="text-xs mb-4 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
            Curves are not independent. EURIBOR is discounted on ESTR, and the
            cross currency curve is built on both SOFR and ESTR, so a change to
            one can force others to rebuild. Rebuilding everything on every price
            would be simpler and far too slow. Too little, and a stale number
            sits on a screen someone is trading from.
          </p>
          <p className="text-xs mb-4 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
            Pick a curve below to see what a change to it forces. The answer comes
            from the same registry the batch engine reads, so the two cannot drift
            apart.
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
          <p className="text-xs max-w-3xl" style={{ color: 'var(--text-dim)' }}>
            {rebuilds.size === 1
              ? 'Nothing else depends on this one, so the work stops here.'
              : `${rebuilds.size} curves rebuild, in the order shown, each one at most once even when several of its inputs moved together.`}
          </p>
        </div>
      )}

      {(tab === 'engine' || tab === 'trader') && demo && (
        <div>
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            {tab === 'engine' ? 'A run of the engine' : 'The same run, from a trading view'}
          </h3>
          <p className="text-xs mb-4 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
            {tab === 'engine'
              ? 'The engine replaying a stream of price changes. Which curves rebuild, in what order, and what happens when a price repeats or arrives out of order. A solver fails, falls back to the last good curve, and recovers. A burst of 120 prices collapses into one rebuild, while two readers check that nothing they see is half updated.'
              : 'The same engine from the desk side. Positions and their values, risk per curve bucket, and what a sell off in ESTR does to both. Profit and loss split between market moves and carry. A hypothetical trade priced without disturbing anything published.'}
          </p>
          <pre className="rounded p-4 overflow-x-auto font-mono"
            style={{
              border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)',
              color: 'var(--text-secondary)', fontSize: 10.5, lineHeight: 1.55,
            }}>
            {tab === 'engine' ? demo.engineDemo : demo.traderDemo}
          </pre>
          <p className="text-xs mt-3 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
            This is the program&apos;s own output, not a recording. The curve solver
            and the pricing kernel are stubbed behind the same interfaces the
            batch engine implements. The timings here are the plumbing, not the
            mathematics.
          </p>
        </div>
      )}

      {!g && !demo && !tl && (
        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Loading.</p>
      )}
    </div>
  );
}
