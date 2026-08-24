import { Link } from 'react-router-dom';

interface Case {
  n: string;
  title: string;
  target: string;
  how: string[];
  results: string[];
  stack: string[];
  link: string;
  linkLabel: string;
}

const CASES: Case[] = [
  {
    n: '01',
    title: 'Multi-Curve Pricing & Risk Engine',
    target:
      'Value and risk a rates book fast enough to use during the day, at full accuracy. The desk has to be able to tie every GPU number back to the reference library.',
    how: [
      'Build eight interdependent curves in the order those dependencies require, from the ten kinds of instrument a rates desk actually quotes.',
      'Hold the short end as step-forwards between central bank meeting dates, joined to a smooth cubic spline beyond. Same construction the reference library uses.',
      'Value the book on the GPU from the curve the processor built, not an approximation of it. Then reprice every instrument both ways and compare.',
    ],
    results: [
      'GPU marks match QuantLib to 10⁻¹⁴ on all eight curves',
      '227 calibration instruments repriced identically on CPU and GPU',
      'Risk shown against the instruments a desk would hedge with, one bar per quoted price',
      'Aged and broken-dated trades valued off their settled fixings, matching the reference to the last decimal',
    ],
    stack: ['C++17', 'QuantLib', 'CUDA', 'GlobalBootstrap', 'React'],
    link: '/learn/curve-data-model',
    linkLabel: 'Explore the curve framework',
  },
  {
    n: '02',
    title: 'Front-to-Back Trade Feed',
    target:
      'The end-of-day feed from trade capture to the risk platform shipped 25,000 rates and inflation trades as a 244 MB extract. It took 90 minutes. Get it down to minutes, with zero trades lost or altered.',
    how: [
      'Find where the time goes. The extract serializes each trade once per cashflow period, so 25,000 structured trades become a million rows crawling over a 0.19 MB/s link.',
      'Re-normalize in flight with Spark: schedules, exercise dates and inflation fixings nested back inside each trade, written as compressed Parquet, 15.3× smaller.',
      'Gate every trade for pricing readiness: strikes, settlement method, base fixings, LPI collars. Load the risk database over eight parallel connections and reconcile counts, notionals and id-hashes at every hop.',
    ],
    results: [
      'End-of-day feed: 89 minutes to 3.6 minutes, measured: 25× faster',
      'Database load 49× faster than the single-connection baseline, both lanes measured',
      'Extract 15.3× smaller once repeated headers are normalized away',
      'Zero breaks across 1,035,762 reconciled rows',
    ],
    stack: ['PySpark', 'Parquet', 'SQL Server', 'pyarrow', 'Docker'],
    link: '/learn/spark-trade-bridge',
    linkLabel: 'Pipeline & benchmarks',
  },
  {
    n: '03',
    title: 'Real-time curve engine',
    target:
      'Rebuild curves when prices arrive, not on a timer, and rebuild no more than the change requires. No trader should ever see a screen where half the numbers are from one moment and half from another.',
    how: [
      'Derive the dependency graph from the curve registry the batch engine already uses, so the two cannot disagree about which curve is built on which.',
      'On a price change, work out which curves genuinely need rebuilding and do them in dependency order. Each one at most once, even when several of its inputs moved together.',
      'Publish each set of curves as one immutable version, so whatever reads it gets a single coherent moment.',
    ],
    results: [
      'A SONIA change rebuilds SONIA alone; an ESTR change carries into EURIBOR and the cross currency curve',
      '120 prices arriving at once collapse into a single rebuild rather than 120',
      'Two readers checking continuously while curves rebuilt underneath them found no inconsistent set',
      'A failed solve keeps the last good curve, marks it stale, and lets the rest carry on',
    ],
    stack: ['C++17', 'Lock-free publication', 'OpenMP', 'Make'],
    link: '/learn/rt-engine',
    linkLabel: 'Open the engine',
  },
];

export default function CaseStudies() {
  return (
    <section id="projects" className="max-w-[1320px] mx-auto px-8 py-16">
      <div className="mb-10">
        <p className="font-mono text-xs tracking-widest uppercase mb-3" style={{ color: 'var(--accent-warm)' }}>
          Projects
        </p>
        <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          The problems, and the numbers that came out
        </h2>
      </div>

      <div className="space-y-8">
        {CASES.map(c => (
          <div key={c.n} className="rounded-lg p-8 grid md:grid-cols-[1.2fr_1fr] gap-8"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div>
              <div className="flex items-baseline gap-3 mb-4">
                <span className="font-mono text-xs" style={{ color: 'var(--accent-warm)' }}>{c.n}</span>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{c.title}</h3>
              </div>
              <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: 'var(--text-dim)' }}>Target</p>
              <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>{c.target}</p>
              <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: 'var(--text-dim)' }}>How</p>
              <ol className="space-y-2">
                {c.how.map((step, i) => (
                  <li key={i} className="text-sm leading-relaxed flex gap-2.5" style={{ color: 'var(--text-secondary)' }}>
                    <span className="font-mono text-xs shrink-0 pt-0.5" style={{ color: 'var(--text-dim)' }}>{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex flex-col">
              <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>Measured results</p>
              <ul className="space-y-2 mb-6">
                {c.results.map((r, i) => (
                  <li key={i} className="text-sm flex gap-2.5" style={{ color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--accent-green)' }}>&#9642;</span>{r}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2 mb-6">
                {c.stack.map(s => (
                  <span key={s} className="font-mono text-[10px] px-2 py-1 rounded"
                    style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-dim)' }}>{s}</span>
                ))}
              </div>
              <Link to={c.link} className="font-mono text-xs mt-auto self-start px-4 py-2 rounded transition-colors"
                style={{ border: '1px solid var(--accent-warm)', color: 'var(--accent-warm)' }}>
                {c.linkLabel} &rarr;
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
