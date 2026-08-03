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
      'Price and risk a multi-curve rates book on GPU with marks the desk can trust: every GPU number must match the QuantLib reference exactly, not approximately. Risk that does not reconcile does not go to the desk.',
    how: [
      'Bootstrap eight interdependent curves in dependency order (ESTR discounting, EURIBOR projection, SOFR, SONIA and the FX-implied EUR/USD curve) from ten instrument types including IMM strips, convexity-adjusted futures, ECB meeting-dated OIS, FX swaps and cross-currency basis.',
      'Build the short end as step-forwards between central bank meeting dates, joined to a smooth cubic spline beyond, the same construction the reference library uses.',
      'Evaluate on GPU with the exact spline coefficients, not a dense-grid approximation, then reprice all 220 calibration instruments down both paths and difference them.',
    ],
    results: [
      'GPU marks match QuantLib to 3×10⁻¹⁴ at any date on the curve',
      '220 calibration instruments repriced identically on CPU and GPU',
      'PV01 ladders per market quote: per ECB meeting, per futures contract, per basis pillar',
      'Seasoned and broken-dated trades priced off historical fixings, exact to machine precision',
    ],
    stack: ['C++17', 'QuantLib', 'CUDA', 'GlobalBootstrap', 'React'],
    link: '/learn/curve-data-model',
    linkLabel: 'Explore the curve framework',
  },
  {
    n: '02',
    title: 'Front-to-Back Trade Feed',
    target:
      'Cut the end-of-day trade feed from trade capture to the risk platform, where 25,000 rates and inflation trades shipped as a 700MB to 1GB extract taking 90 minutes, down to minutes, with zero trades lost or altered.',
    how: [
      'Diagnose the real cost: the extract serializes each trade once per cashflow period, so 25,000 structured trades become a million redundant rows crawling over a 0.19 MB/s link.',
      'Re-normalize in flight with Spark: schedules, exercise dates and inflation fixings nested back inside each trade, written as compressed Parquet, 15.3× smaller.',
      'Gate every trade for pricing readiness (strikes, settlement method, base fixings, LPI collars), load the risk database over eight parallel connections, and reconcile counts, notionals and id-hashes at every hop.',
    ],
    results: [
      'End-of-day feed: 89 minutes to 3.6 minutes, measured: 25× faster',
      'Database load 49× faster than the single-connection baseline, both lanes measured',
      'Extract 15.3× smaller once redundant headers are normalized away',
      'Zero breaks across 1,035,762 reconciled rows',
    ],
    stack: ['PySpark', 'Parquet', 'SQL Server', 'pyarrow', 'Docker'],
    link: '/learn/spark-trade-bridge',
    linkLabel: 'Pipeline & benchmarks',
  },
  {
    n: '03',
    title: 'Government Bond Curve & Credit Spread Engine',
    target:
      'Imply a zero curve from German government bond prices and decompose each bond’s all-in yield into risk-free, sovereign and credit spread, and rebuild the whole curve instantly when a trader overrides a spread.',
    how: [
      'Bootstrap the zero curve from 18 Bunds with full cashflow schedules in C++/QuantLib, on top of an OIS base curve built from ECB money-market rates.',
      'Layer a credit-spread waterfall of risk-free plus sovereign premium plus credit spread, so every basis point of yield is attributed to a source.',
      'Serve it to a React front end that re-bootstraps the curve on every spread edit, with a step-through mode that shows the curve forming bond by bond.',
    ],
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
