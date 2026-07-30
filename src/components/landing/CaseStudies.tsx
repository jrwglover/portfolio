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
      'Rates desks need one consistent framework for discounting and projection across OIS, IBOR, FX-collateral and policy-dated curves — where the GPU-accelerated path must agree with the reference library exactly, or its risk numbers cannot be trusted.',
    solution:
      'A C++/QuantLib + CUDA framework: dependency-ordered global bootstrap over 8 curves and 11 instrument types (tenor OIS, IMM strips, convexity-adjusted futures, ECB meeting-dated OIS, dual-curve EURIBOR, FX swaps and xccy basis), hybrid step-forward + min-curvature spline construction, and a spline-exact GPU evaluation layer.',
    results: [
      'GPU reproduces the QuantLib curve to 3×10⁻¹⁴ at any date',
      '174 calibration instruments priced dual-path, CPU vs GPU identical',
      'Per-instrument PV01 buckets: per ECB meeting, per futures contract, per basis pillar',
      'Aged and broken-dated positions priced with historical fixings, machine-exact',
    ],
    stack: ['C++17', 'QuantLib', 'CUDA', 'GlobalBootstrap', 'React'],
    link: '/learn/curve-data-model',
    linkLabel: 'Explore the curve model',
  },
  {
    n: '02',
    title: 'Trade Transfer Bridge',
    problem:
      'A deal-capture system hands a rates & inflation non-linear book to the risk engine as a 700MB–1GB exploded text file taking ~1.5 hours to land — 25,000 trades shipped as a million redundant rows at 0.19 MB/s.',
    solution:
      'A PySpark pipeline that re-normalizes trades in flight — nested period and exercise schedules, a pricing-readiness gate for normal-vol lookups (strikes, settlement methods, inflation base prints, LPI collars) — and loads SQL Server parent/child tables over parallel batched connections, reconciling counts, notionals and id-hashes at every hop.',
    results: [
      'End-to-end hand-off: 89.4 min → 3.6 min (25×, throttle-measured)',
      'DB write leg: 49× vs single-connection loading (measured both lanes)',
      'Payload 15.3× smaller — repeated headers dedup away in nested Parquet',
      'Zero reconciliation breaks across 1,035,762 rows',
    ],
    stack: ['PySpark', 'Parquet', 'SQL Server', 'pyarrow', 'Docker'],
    link: '/learn/spark-trade-bridge',
    linkLabel: 'See the pipeline & benchmarks',
  },
  {
    n: '03',
    title: 'Bond Curve Bootstrapper',
    problem:
      'Credit and treasury desks need issuer-level zero curves from bond prices — with the discount rate decomposed into risk-free, sovereign and credit components that can be edited and re-bootstrapped live.',
    solution:
      'A C++ QuantLib bootstrapper over German Bund constituents with full cashflow schedules, an ECB-sourced OIS base curve, and a credit-spread waterfall (OIS + sovereign premium + corporate spread) served to an interactive React front end with animated bond-by-bond construction.',
    results: [
      '51-point zero curve from 18 Bunds, validated to sub-0.0001 bps',
      '128-cashflow reprice to machine precision across 3 independent builds',
      'Live credit-spread editing (0–2000 bps) with instant re-bootstrap',
      'Animated construction demo: watch the curve grow bond by bond',
    ],
    stack: ['C++', 'QuantLib', 'React', 'Express', 'TypeScript'],
    link: '/learn/govt-bonds',
    linkLabel: 'Open the bootstrapper',
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
