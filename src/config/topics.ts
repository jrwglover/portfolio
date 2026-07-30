export interface TopicLeaf {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  techBadges: string[];
  highlights: string[];
  status: 'live' | 'analysis';
  dashboard: {
    component: string;
    defaultTab?: string;
  };
  breadcrumb: string[];
}

export interface SubTopic {
  label: string;
  leaves: TopicLeaf[];
}

export interface Topic {
  label: string;
  subtopics: SubTopic[];
}

export const topics: Topic[] = [
  {
    label: 'Rates',
    subtopics: [
      {
        label: 'Curve Bootstrapping',
        leaves: [
          {
            id: 'curve-data-model',
            slug: 'curve-data-model',
            title: 'Curve Market Data Model',
            subtitle: '8 curves, 11 instrument types: quotes in, curves out',
            description:
              'Explore the full market data model behind the multi-curve framework: tenor OIS, IMM-dated OIS strips, price-quoted futures with convexity adjustment, ECB meeting-dated OIS, dual-curve EURIBOR (deposits, FRAs, IMM FRAs, IRS) and the FX/xccy-implied EUR-under-USD-collateral curve. Every quote is a bootstrap constraint and a PV01 bucket.',
            techBadges: ['C++', 'QuantLib', 'GlobalBootstrap', 'CUDA'],
            highlights: ['8 curves incl. 4 ESTR variants', 'IMM + ECB meeting-dated strips', 'FX swaps + xccy basis'],
            status: 'live',
            dashboard: { component: 'CurveModelDashboard', defaultTab: 'inputs' },
            breadcrumb: ['Rates', 'Curve Bootstrapping', 'Curve Market Data Model'],
          },
          {
            id: 'meeting-dated-curves',
            slug: 'meeting-dated-curves',
            title: 'Meeting-Dated & IMM Curves',
            subtitle: 'Step-forward short ends: ECB policy dates vs IMM dates',
            description:
              'Compare four constructions of the same ESTR rate: a smooth tenor spline, quarterly IMM steps, IMM + convexity-adjusted futures, and flat forwards between ECB policy effective dates joined to a smooth cubic spline. Overlay EURIBOR 6M and the xccy-implied EUR discount curve.',
            techBadges: ['C++', 'QuantLib', 'GlobalBootstrap'],
            highlights: ['Per-ECB-meeting forwards', 'Hybrid step + spline', 'DF-continuous boundary'],
            status: 'live',
            dashboard: { component: 'CurveModelDashboard', defaultTab: 'curves' },
            breadcrumb: ['Rates', 'Curve Bootstrapping', 'Meeting-Dated & IMM Curves'],
          },
          {
            id: 'govt-bonds',
            slug: 'govt-bonds',
            title: 'Government Bonds',
            subtitle: 'German Bund zero-curve bootstrapping',
            description:
              'Browse 18 German Bund constituents with full cashflow schedules: coupon dates, amounts, principal, day count conventions. See the raw input universe that feeds the zero-curve bootstrap.',
            techBadges: ['C++', 'QuantLib', 'React', 'Express', 'TypeScript'],
            highlights: ['18 Bund constituents', 'Cashflow schedules', 'Day count conventions'],
            status: 'live',
            dashboard: { component: 'BondDashboard', defaultTab: 'bond-data' },
            breadcrumb: ['Rates', 'Curve Bootstrapping', 'Government Bonds'],
          },
          {
            id: 'bond-demo',
            slug: 'bond-demo',
            title: 'Bootstrap Demo',
            subtitle: 'Animated bond-by-bond curve construction',
            description:
              'Watch the zero curve grow from 1 point to 51 as 18 bonds are processed shortest-to-longest. See each bond\'s ISIN, maturity, coupon, dirty price, convergence error and tenor count in real time. Adjustable playback speed from 0.5s to 5s per step.',
            techBadges: ['C++', 'QuantLib', 'React'],
            highlights: ['Animated step-by-step', 'Bond-by-bond growth', 'Convergence tracking'],
            status: 'live',
            dashboard: { component: 'BondDashboard', defaultTab: 'demo' },
            breadcrumb: ['Rates', 'Curve Bootstrapping', 'Bootstrap Demo'],
          },
          {
            id: 'bond-validation',
            slug: 'bond-validation',
            title: 'Bootstrap Validation',
            subtitle: 'Three-curve comparison with sub-basis-point accuracy',
            description:
              'Run the C++ bootstrapper and overlay three independently built curves (Reference, CSV Bootstrap, Schedule Builder). Validate 51-point curve comparison, 18-bond accrual comparison and 128-cashflow reprice to machine precision.',
            techBadges: ['C++', 'QuantLib', 'TypeScript'],
            highlights: ['Sub-0.0001 bps accuracy', '128 cashflow validation', '3 independent curves'],
            status: 'live',
            dashboard: { component: 'BondDashboard', defaultTab: 'bootstrap' },
            breadcrumb: ['Rates', 'Curve Bootstrapping', 'Bootstrap Validation'],
          },
        ],
      },
      {
        label: 'Interpolation Methods',
        leaves: [
          {
            id: 'interp-live-compare',
            slug: 'interp-live-compare',
            title: 'Live Method Comparison',
            subtitle: 'Same instruments, four interpolations, overlaid',
            description:
              'The same curve bootstrapped four ways — cubic spline on log-discount (production), linear on zeros, linear on forwards, flat forwards — overlaid in forward and zero space. All four reprice the calibration instruments; the differences between pillars are the interpolation model\'s freedom, and the forward domain shows why the log-discount cubic spline is the desk choice.',
            techBadges: ['C++', 'QuantLib', 'GlobalBootstrap'],
            highlights: ['4 methods overlaid', 'Forward-smoothness comparison', 'Bootstrapped live from one instrument set'],
            status: 'live',
            dashboard: { component: 'CurveModelDashboard', defaultTab: 'methods' },
            breadcrumb: ['Rates', 'Interpolation Methods', 'Live Method Comparison'],
          },
        ],
      },
      {
        label: 'Sensitivities',
        leaves: [
          {
            id: 'market-pv01',
            slug: 'market-pv01',
            title: 'Market PV01',
            subtitle: 'Instrument-level bump-and-rebuild sensitivities',
            description:
              'Compute market quote PV01 by bumping each deposit, FRA and IRS instrument, re-bootstrapping the curve, and repricing. Explore per-cashflow sensitivities, dual-curve projection/discount decomposition, and interpolation method impact on risk distribution.',
            techBadges: ['C++', 'CUDA', 'QuantLib'],
            highlights: ['Per-cashflow PV01', 'Multiple interpolation methods', 'Dual-curve decomposition'],
            status: 'live',
            dashboard: { component: 'CurveDashboard', defaultTab: 'sensitivities' },
            breadcrumb: ['Rates', 'Sensitivities', 'Market PV01'],
          },
        ],
      },
    ],
  },
  {
    label: 'Credit',
    subtopics: [
      {
        label: 'Curve Bootstrapping',
        leaves: [
          {
            id: 'credit-decomposition',
            slug: 'credit-decomposition',
            title: 'Credit Curve & Decomposition',
            subtitle: 'OIS + sovereign + credit spread waterfall',
            description:
              'Decompose borrowing costs into OIS risk-free rate, sovereign spread and credit spread layers. Interactive stacked area waterfall chart. Edit any credit spread (0-2000 bps) for live re-bootstrap. View raw ESTR conversion and OIS par-to-zero bootstrap.',
            techBadges: ['C++', 'QuantLib', 'React', 'Express', 'TypeScript'],
            highlights: ['Credit spread waterfall', 'OIS/sovereign/credit layers', 'Live re-bootstrap'],
            status: 'live',
            dashboard: { component: 'BondDashboard', defaultTab: 'spreads' },
            breadcrumb: ['Credit', 'Curve Bootstrapping', 'Credit Curve & Decomposition'],
          },
        ],
      },
    ],
  },
  {
    label: 'Volatility',
    subtopics: [
      {
        label: 'Parameter Reduction',
        leaves: [
          {
            id: 'vega-pca',
            slug: 'vega-pca',
            title: 'Vega PCA Compression',
            subtitle: 'PCA-based options vega risk reduction under CRR2/FRTB',
            description:
              'Understand how PCA compresses 5 vega risk factors (ATM level, skew, convexity, term slope, wing decay) to 4 observables for regulatory capital. Compare Statistical PCA, Heston basis and SVI basis methods.',
            techBadges: ['Python', 'NumPy', 'SciPy', 'scikit-learn', 'Plotly'],
            highlights: ['3 PCA methods', 'Regulatory context', '5 → 4 parameter compression'],
            status: 'analysis',
            dashboard: { component: 'VegaDashboard', defaultTab: 'overview' },
            breadcrumb: ['Volatility', 'Parameter Reduction', 'Vega PCA Compression'],
          },
          {
            id: 'vega-analysis',
            slug: 'vega-analysis',
            title: 'VRT & AVA Validation',
            subtitle: 'Variance Ratio Test and Additional Valuation Adjustment',
            description:
              'Run PCA decomposition across low, medium and high volatility regimes. Compare VRT pass/fail status (>95% variance retained), AVA residual risk percentage, and compression ratios across all three basis methods.',
            techBadges: ['Python', 'NumPy', 'scikit-learn', 'Recharts'],
            highlights: ['VRT >95% threshold', 'AVA residual metrics', '3 volatility regimes'],
            status: 'analysis',
            dashboard: { component: 'VegaDashboard', defaultTab: 'analysis' },
            breadcrumb: ['Volatility', 'Parameter Reduction', 'VRT & AVA Validation'],
          },
          {
            id: 'vol-surface',
            slug: 'vol-surface',
            title: 'Volatility Surface',
            subtitle: 'Original vs PCA-reduced surface heatmaps',
            description:
              'Generate and compare original (5-parameter) vs PCA-reduced (4-parameter) volatility surface heatmaps across 8 strikes (80%-140%) and 6 expiries (1M-5Y). Analyse compression residuals colour-coded by magnitude.',
            techBadges: ['Python', 'Plotly', 'Recharts'],
            highlights: ['8 strikes x 6 expiries', 'Surface heatmaps', 'Residual analysis'],
            status: 'analysis',
            dashboard: { component: 'VegaDashboard', defaultTab: 'surface' },
            breadcrumb: ['Volatility', 'Parameter Reduction', 'Volatility Surface'],
          },
        ],
      },
    ],
  },
  {
    label: 'Infrastructure',
    subtopics: [
      {
        label: 'GPU Acceleration',
        leaves: [
          {
            id: 'gpu-performance',
            slug: 'gpu-performance',
            title: 'Performance Benchmarks',
            subtitle: 'GPU vs CPU curve pricing: 50-100x speedup',
            description:
              'Benchmark curve pricing across CPU and GPU: QuantLib ConvexMonotone against its CUDA replication and linear interpolation variants. See how 150,000 swaps (6.3M cashflows) are priced in under 200ms on GPU versus seconds on CPU — every number a measured run.',
            techBadges: ['C++', 'CUDA', 'QuantLib', 'GPU'],
            highlights: ['50-100x GPU speedup', '150k swaps in 200ms', 'CPU baseline measured'],
            status: 'live',
            dashboard: { component: 'CurveDashboard', defaultTab: 'performance' },
            breadcrumb: ['Infrastructure', 'GPU Acceleration', 'Performance Benchmarks'],
          },
          {
            id: 'gpu-accuracy',
            slug: 'gpu-accuracy',
            title: 'Interpolation Accuracy',
            subtitle: 'CUDA replication accuracy to 1e-14',
            description:
              'Verify that GPU-accelerated interpolation exactly reproduces QuantLib CPU results. Compare CUDA ConvexMonotone vs QuantLib CM (near-zero error), CUDA Cubic Spline vs QuantLib CS (1e-14 accuracy), and analyse where Natural Spline diverges from the production spline.',
            techBadges: ['C++', 'CUDA', 'QuantLib'],
            highlights: ['1e-14 accuracy', 'Method divergence analysis', 'Zero & forward domain comparison'],
            status: 'live',
            dashboard: { component: 'CurveDashboard', defaultTab: 'accuracy' },
            breadcrumb: ['Infrastructure', 'GPU Acceleration', 'Interpolation Accuracy'],
          },
        ],
      },
    ],
  },
  {
    label: 'Data Engineering',
    subtopics: [
      {
        label: 'Trade Transfer',
        leaves: [
          {
            id: 'spark-trade-bridge',
            slug: 'spark-trade-bridge',
            title: 'Front-to-Back Trade Feed',
            subtitle: 'End-of-day feed from trade capture to risk: 1.5 hours to 3.6 minutes',
            description:
              'The end-of-day feed for a rates & inflation non-linear book shipped 25,000 trades from trade capture to the risk platform as a million-row exploded text extract taking ~1.5 hours to land. The pipeline re-normalizes trades in flight, gates them for pricing readiness (strikes, exercise schedules, inflation base fixings, LPI collars) and loads the risk database over parallel connections.',
            techBadges: ['PySpark', 'Parquet', 'SQL Server', 'Docker'],
            highlights: ['25x end-to-end (measured)', '15.3x payload compression', 'Pricing-readiness quarantine gate'],
            status: 'live',
            dashboard: { component: 'BridgeDashboard', defaultTab: 'problem' },
            breadcrumb: ['Data Engineering', 'Trade Transfer', 'Spark Trade Bridge'],
          },
          {
            id: 'bridge-benchmarks',
            slug: 'bridge-benchmarks',
            title: 'Bridge Benchmarks',
            subtitle: 'Every speedup measured and attributed to its cause',
            description:
              'Honest benchmarking: the transfer leg measured through a real 0.19 MB/s throttle (25x), the SQL Server write leg measured single-connection vs 8 parallel connections (49x), and the prepare leg where careful single-threaded code beats Spark at small file sizes. Compression, parallelism and compute each credited separately.',
            techBadges: ['PySpark', 'SQL Server', 'pymssql', 'pyarrow'],
            highlights: ['49x DB write (measured)', 'Throttle-measured transfer', 'Single-thread baseline included'],
            status: 'live',
            dashboard: { component: 'BridgeDashboard', defaultTab: 'benchmarks' },
            breadcrumb: ['Data Engineering', 'Trade Transfer', 'Bridge Benchmarks'],
          },
        ],
      },
    ],
  },
];

export function getAllLeaves(): TopicLeaf[] {
  return topics.flatMap(t => t.subtopics.flatMap(st => st.leaves));
}

export function getLeafBySlug(slug: string): TopicLeaf | undefined {
  return getAllLeaves().find(l => l.slug === slug);
}
