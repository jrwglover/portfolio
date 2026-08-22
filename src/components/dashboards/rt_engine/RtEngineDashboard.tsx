import { useEffect, useMemo, useState } from 'react';

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
  const [tab, setTab] = useState(defaultTab ?? 'graph');
  const [g, setG] = useState<GraphFile | null>(null);
  const [demo, setDemo] = useState<DemoFile | null>(null);
  const [probe, setProbe] = useState('EUR_ESTR');

  useEffect(() => {
    const v = `?v=${BUILD_ID}`;
    fetch(`/data/rt_engine/graph.json${v}`, { cache: 'no-store' })
      .then(r => r.json()).then(setG).catch(() => {});
    fetch(`/data/rt_engine/demo.json${v}`, { cache: 'no-store' })
      .then(r => r.json()).then(setDemo).catch(() => {});
  }, []);

  const rebuilds = useMemo(() => {
    const hit = g?.invalidation.find(i => i.tick === probe);
    return new Set(hit?.rebuilds ?? []);
  }, [g, probe]);

  const TABS: [string, string][] = [
    ['graph', 'What one price change touches'],
    ['engine', 'Engine run'],
    ['trader', 'Trader view'],
  ];

  return (
    <div>
      <div className="flex gap-2 mb-6 font-mono text-[11px] flex-wrap">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className="px-3 py-1.5 rounded"
            style={chip(tab === k, '#5b8fc9')}>{label}</button>
        ))}
      </div>

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

      {!g && !demo && (
        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Loading.</p>
      )}
    </div>
  );
}
