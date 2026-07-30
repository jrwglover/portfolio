import { Link } from 'react-router-dom';

interface Case {
  n: string;
  title: string;
  problem: string;
  solution: string;
  results: string[];
  stack: string[];
  link: string;
  linkLabel: string;
}

const CASES: Case[] = [
  {
    n: '01',
    title: 'Multi-Curve Pricing & Risk Engine',
    problem:
      'A rates business marks and risks its book off a family of interdependent curves — OIS discounting, IBOR projection, collateral-dependent discounting under CSA, and a short end that trades on central bank meeting dates. Any accelerated pricing path has to tie out to the reference library exactly; risk that does not reconcile does not go to the desk.',
    solution:
      'A C++/QuantLib and CUDA framework: dependency-ordered global bootstrap across eight curves and eleven instrument types — tenor OIS, IMM strips, convexity-adjusted futures, ECB meeting-dated OIS, dual-curve EURIBOR, FX swaps and cross-currency basis — with hybrid step-forward and minimum-curvature spline construction, and a spline-exact GPU evaluation layer that reproduces the reference interpolation rather than approximating it.',
    results: [
      'GPU marks tie out to QuantLib at 3×10⁻¹⁴, at any date on the curve',
      '174 calibration instruments repriced dual-path — CPU and GPU identical',
      'Market-quote PV01 ladders: per ECB meeting, per futures contract, per basis pillar',
      'Seasoned and broken-dated trades priced off historical fixings, exact to machine precision',
    ],
    stack: ['C++17', 'QuantLib', 'CUDA', 'GlobalBootstrap', 'React'],
    link: '/learn/curve-data-model',
    linkLabel: 'Explore the curve framework',
  },
  {
    n: '02',
    title: 'Front-to-Back Trade Feed',
    problem:
      'The end-of-day feed from trade capture to the rates and inflation risk platform shipped a non-linear book — swaps, caps and floors, swaptions, inflation structures — as a 700MB–1GB flat extract that took ninety minutes to land. Twenty-five thousand trades were serialized as a million redundant rows at 0.19 MB/s, and the overnight batch window absorbed the cost every day.',
    solution:
      'A Spark pipeline that re-normalizes the extract in flight: nested schedules and exercise data in place of exploded rows, a completeness gate confirming every trade can key its volatility surface and curves — strikes on unset caplets, settlement method, inflation base fixings, LPI collars — and a parallel batched load into the risk database, with control totals reconciled at every hop.',
    results: [
      'End-of-day feed: 89 minutes to 3.6 minutes, measured — a 25× reduction',
      'Database load 49× faster than single-connection loading, both lanes measured',
      'Extract 15.3× smaller once redundant headers are normalized away',
      'Zero breaks across 1,035,762 reconciled rows — counts, notionals and id-hashes',
    ],
    stack: ['PySpark', 'Parquet', 'SQL Server', 'pyarrow', 'Docker'],
    link: '/learn/spark-trade-bridge',
    linkLabel: 'Pipeline & benchmarks',
  },
  {
    n: '03',
    title: 'Government Bond Curve & Credit Spread Engine',
    problem:
      'Credit and treasury desks need issuer zero curves implied from bond prices, with the all-in yield decomposed into risk-free, sovereign and credit components — and the decomposition has to hold up when a trader overrides a spread and expects the curve to rebuild instantly.',
    solution:
      'A C++/QuantLib bootstrapper over the German Bund complex with full cashflow schedules, an OIS base curve built from ECB money-market rates, and a credit-spread waterfall — risk-free plus sovereign premium plus credit spread — served to an interactive front end with live re-bootstrap on every spread edit.',
    results: [
      '51-point zero curve implied from 18 Bunds, validated to below 0.0001 bps',
      '128 cashflows repriced to machine precision across three independent builds',
      'Spread overrides from 0 to 2,000 bps with instant curve rebuild',
      'Step-through construction: watch the curve form bond by bond',
    ],
    stack: ['C++', 'QuantLib', 'React', 'Express', 'TypeScript'],
    link: '/learn/govt-bonds',
    linkLabel: 'Open the curve engine',
  },
];

export default function CaseStudies() {
  return (
    <section id="projects" className="max-w-[1320px] mx-auto px-8 py-16">
      <div className="mb-10">
        <p className="font-mono text-xs tracking-widest uppercase mb-3" style={{ color: 'var(--accent-warm)' }}>
          Case Studies
        </p>
        <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Three institutional problems, solved and measured
        </h2>
      </div>

      <div className="space-y-8">
        {CASES.map(c => (
          <div key={c.n} className="rounded-lg p-8 grid md:grid-cols-[1fr_1.2fr] gap-8"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div>
              <div className="flex items-baseline gap-3 mb-4">
                <span className="font-mono text-xs" style={{ color: 'var(--accent-warm)' }}>{c.n}</span>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{c.title}</h3>
              </div>
              <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: 'var(--text-dim)' }}>Problem</p>
              <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>{c.problem}</p>
              <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: 'var(--text-dim)' }}>Approach</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{c.solution}</p>
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
