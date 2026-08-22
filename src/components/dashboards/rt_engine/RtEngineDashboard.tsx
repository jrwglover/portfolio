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
            A session, replayed
          </h3>
          <p className="text-xs mb-4 max-w-3xl" style={{ color: 'var(--text-dim)' }}>
            Prices arrive, the curves that depend on them are rebuilt, and
            positions are revalued. Each step below is a real cycle of the
            engine, recorded as it ran and replayed here. Watch which curves
            light up when a price moves, and which are left alone.
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
            Most curve systems poll. A scheduled job wakes up every minute or
            every few minutes, rebuilds every curve from the latest prices, and
            publishes the lot. It is easy to write, easy to reason about, and it
            is what almost everyone does.
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>
            The cost is that you are always choosing between stale and wasteful.
            Poll every five minutes and a trader can be looking at a five minute
            old curve during a move. Poll every ten seconds and you rebuild eight
            curves six times a minute whether anything moved or not, and the
            bootstrap is not cheap: the batch engine measures a curve solve at
            roughly a second. Neither setting is right, because the correct
            frequency depends on which curve and what just happened.
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>
            Event driven rebuilding does the work when the work is needed. The
            reason it is less common is that it is genuinely harder, and the
            difficulty is not the events, it is the dependencies.
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
            The cross currency curve is built from both SOFR and ESTR. If a SOFR
            price and an ESTR price arrive together and each triggers a rebuild
            of what depends on it, the cross currency curve gets built twice, and
            the first build used an ESTR curve that was about to be replaced.
            Publish that first result and someone prices a trade against a set
            that never existed as a consistent market state.
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>
            So the work has to be collected before it is done, not done as it
            arrives: gather everything affected, order it so each curve is built
            after the curves it depends on, build each one once, and publish the
            whole set together. Get that wrong and the failure is quiet. Nothing
            crashes. A number is just slightly off, on one screen, for a few
            seconds, and nobody can reproduce it afterwards.
          </p>
          <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
            That is the part worth building carefully, and it is why polling
            stays popular. Polling has none of these problems, because rebuilding
            everything in dependency order every time is the brute force answer
            to the same question. It just costs you either latency or hardware.
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
            one can force others to be rebuilt. Rebuilding everything on every
            price would be simpler and far too slow. Rebuilding too little leaves
            a stale number on a screen someone is trading from.
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
              ? 'Output from the engine replaying a stream of price changes: which curves rebuild and in what order, repeated and out of order prices being rejected, a solver failure falling back to the last good curve and then recovering, and a burst of 120 prices collapsing into a single rebuild while two readers check that nothing they see is half updated.'
              : 'The same engine seen the way a desk would: positions and their values, risk per curve bucket, what a sell off in ESTR does to both, profit and loss split between market moves and carry, and a hypothetical trade priced without disturbing anything published.'}
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
            batch engine implements, so the timings here describe the plumbing
            rather than the mathematics.
          </p>
        </div>
      )}

      {!g && !demo && !tl && (
        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Loading.</p>
      )}
    </div>
  );
}
