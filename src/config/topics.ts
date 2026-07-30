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
            id: 'ibor-rfr-curves',
            slug: 'ibor-rfr-curves',
            title: 'IBOR & RFR Curves',
            subtitle: 'Multi-curve bootstrapping across 4 currencies',
            description:
              'Learn how EURIBOR6M, ESTR, SOFR and SONIA yield curves are bootstrapped from deposits, FRAs and swaps in a dual-curve framework. Visualise pillar points, forward rates and zero rates across all curves.',
            techBadges: ['C++', 'CUDA', 'QuantLib', 'GPU'],
            highlights: ['4 currency curves', 'Dual-curve framework', 'Forward & zero rate domains'],
            status: 'live',
            dashboard: { component: 'CurveDashboard', defaultTab: 'curves' },
            breadcrumb: ['Rates', 'Curve Bootstrapping', 'IBOR & RFR Curves'],
          },
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
              'Compare four constructions of the same ESTR rate: a smooth tenor spline, quarterly IMM steps, IMM + convexity-adjusted futures, and flat forwards between ECB policy effective dates joined to a min-curvature spline. Overlay EURIBOR 6M and the xccy-implied EUR discount curve.',
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
          {
            id: 'imm-interpolation',
            slug: 'imm-interpolation',
            title: 'IMM Date Interpolation',
            subtitle: 'Curve construction on IMM dates across 9 currencies',
            description:
              'Explore how trading desks build curves on IMM dates using monotone convex interpolation (short end, <=2Y) and Nelson-Siegel modelling (long end). Auto-refresh every 30s with bid/ask spread visualisation across 9 currencies.',
            techBadges: ['Python', 'Flask', 'QuantLib', 'React'],
            highlights: ['9 currencies', 'IMM date grid', 'Nelson-Siegel + monotone convex'],
            status: 'live',
            dashboard: { component: 'PricerDashboard', defaultTab: 'curves' },
            breadcrumb: ['Rates', 'Curve Bootstrapping', 'IMM Date Interpolation'],
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
              'The same curve bootstrapped four ways — min-curvature spline on log-discount (production), linear on zeros, linear on forwards, flat forwards — overlaid in forward and zero space. All four reprice the calibration instruments; the differences between pillars are the interpolation model\'s freedom, and the forward domain shows why log-discount min-curvature is the desk choice.',
            techBadges: ['C++', 'QuantLib', 'GlobalBootstrap'],
            highlights: ['4 methods overlaid', 'Forward-smoothness comparison', 'Bootstrapped live from one instrument set'],
            status: 'live',
            dashboard: { component: 'CurveModelDashboard', defaultTab: 'methods' },
            breadcrumb: ['Rates', 'Interpolation Methods', 'Live Method Comparison'],
          },
          {
            id: 'interp-overview',
            slug: 'interp-overview',
            title: 'Method Comparison',
            subtitle: 'Cubic Spline Min Curvature vs ConvexMonotone vs NaturalSpline',
            description:
              'Compare three interpolation methods used in multi-curve frameworks: Cubic Spline Min Curvature (ING), Hagan-West ConvexMonotone, and Natural Cubic Spline. Understand how each method handles forward rate smoothness, monotonicity and curvature constraints.',
            techBadges: ['C++', 'CUDA', 'QuantLib'],
            highlights: ['3 interpolation methods', 'Forward & zero domains', 'GPU architecture pipeline'],
            status: 'live',
            dashboard: { component: 'CurveDashboard', defaultTab: 'overview' },
            breadcrumb: ['Rates', 'Interpolation Methods', 'Method Comparison'],
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
      {
        label: 'Pricing',
        leaves: [
          {
            id: 'swap-pricer-multi',
            slug: 'swap-pricer-multi',
            title: 'Swap Pricer',
            subtitle: 'Multi-currency pricing with DV01 risk ladders',
            description:
              'Price interest rate swaps across 9 currencies with dual-curve framework (OIS discounting + IBOR forecasting). View DV01 risk ladders by tenor from 1M to 30Y, with live market data simulation and bid/ask spreads.',
            techBadges: ['Python', 'Flask', 'QuantLib', 'React', 'Material-UI'],
            highlights: ['9 currencies', 'Dual-curve pricing', 'DV01 risk ladders'],
            status: 'live',
            dashboard: { component: 'PricerDashboard', defaultTab: 'pricer' },
            breadcrumb: ['Rates', 'Pricing', 'Swap Pricer'],
          },
          {
            id: 'market-data-live',
            slug: 'market-data-live',
            title: 'Live Market Data',
            subtitle: 'Real-time rate sheet with OIS-IBOR basis',
            description:
              'Live rate sheet with animated cell highlighting for updates, OIS-IBOR basis spread display, and currency-specific rate structures with market regime detection. 9 currencies with realistic bid/ask levels refreshing at instrument-specific frequencies.',
            techBadges: ['Python', 'Flask', 'QuantLib', 'React'],
            highlights: ['9 currencies', 'OIS-IBOR basis', 'Animated updates'],
            status: 'live',
            dashboard: { component: 'PricerDashboard', defaultTab: 'market-data' },
            breadcrumb: ['Rates', 'Pricing', 'Live Market Data'],
          },
          {
            id: 'realtime-swap-pricer',
            slug: 'realtime-swap-pricer',
            title: 'Real-Time Swap Pricer',
            subtitle: 'WebSocket-driven live pricing across 7 currencies',
            description:
              'Live swap pricing via WebSocket feeds across 7 RFR benchmarks (SOFR, ESTR, SONIA, TONAR, SARON, AONIA, CORRA). Configure notional, tenor, fixed rate, direction and product type (IRS, OIS, Basis, XCCY).',
            techBadges: ['Node.js', 'Express', 'WebSocket', 'React', 'TypeScript'],
            highlights: ['7 currencies', '4 swap types', 'WebSocket live feeds'],
            status: 'live',
            dashboard: { component: 'SwapDashboard', defaultTab: 'currency' },
            breadcrumb: ['Rates', 'Pricing', 'Real-Time Swap Pricer'],
          },
          {
            id: 'swap-greeks',
            slug: 'swap-greeks',
            title: 'Swap Greeks',
            subtitle: 'NPV, DV01, theta, convexity and fair rate',
            description:
              'Full Greeks output from the real-time pricer: NPV (present value), fair rate (zero-NPV fixed rate), DV01 (1bp parallel shift P&L), PV01 (per-year DV01), theta (daily time decay), convexity (second-order rate sensitivity), and spread vs par. Single and multi-currency curve visualisation.',
            techBadges: ['Node.js', 'WebSocket', 'React', 'TypeScript'],
            highlights: ['Full Greeks output', 'Fair rate calculation', 'Convexity & theta'],
            status: 'live',
            dashboard: { component: 'SwapDashboard', defaultTab: 'pricing' },
            breadcrumb: ['Rates', 'Pricing', 'Swap Greeks'],
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
              'Benchmark 6 interpolation methods across CPU and GPU: QuantLib ConvexMonotone, CUDA ConvexMonotone, CUDA Cubic Spline MinCurve, and linear interpolation variants. See how 150,000 swaps (6.3M cashflows) are priced in under 200ms on GPU versus seconds on CPU.',
            techBadges: ['C++', 'CUDA', 'QuantLib', 'GPU'],
            highlights: ['50-100x GPU speedup', '150k swaps in 200ms', '6 methods compared'],
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
              'Verify that GPU-accelerated interpolation exactly reproduces QuantLib CPU results. Compare CUDA ConvexMonotone vs QuantLib CM (near-zero error), CUDA Cubic Spline MinCurve vs QuantLib CS (1e-14 accuracy), and analyse where Natural Spline diverges from Min Curvature.',
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
            title: 'Spark Trade Bridge',
            subtitle: 'Position-keeping hand-off: 1.5 hours to 3.6 minutes',
            description:
              'A rates & inflation non-linear book of 25,000 trades was shipped between position-keeping systems as a million-row exploded text file taking ~1.5 hours to land. The bridge re-nests trades in flight, gates them for pricing readiness (strikes, exercise schedules, inflation base prints, LPI collars) and loads SQL Server over parallel connections.',
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
  {
    label: 'Market Data',
    subtopics: [
      {
        label: 'Analytics',
        leaves: [
          {
            id: 'realtime-instruments',
            slug: 'realtime-instruments',
            title: 'Real-Time Instrument Pricing',
            subtitle: '26 instruments across 7 asset classes',
            description:
              'Real-time price cards for 26 instruments across energy (BRN, WTI, TTF), rates, FX (EUR/USD, GBP/USD, USD/JPY), equities (ES, NQ, FTSE), softs (KC, CC), credit (CDX.IG, CDX.HY) and metals (XAU, XAG). Flash highlighting with bid/offer/mid/volume and per-card sentiment scores.',
            techBadges: ['Python', 'Flask', 'React', 'Socket.IO'],
            highlights: ['26 instruments', '7 asset classes', 'Real-time WebSocket feeds'],
            status: 'live',
            dashboard: { component: 'ChatDashboard', defaultTab: 'prices' },
            breadcrumb: ['Market Data', 'Analytics', 'Real-Time Instrument Pricing'],
          },
          {
            id: 'nlp-sentiment',
            slug: 'nlp-sentiment',
            title: 'NLP Sentiment Analysis',
            subtitle: 'Entity extraction and sentiment from trading chat',
            description:
              'See how NLP extracts entities and sentiment from trading chat messages. SpaCy performs entity extraction, TextBlob scores sentiment (-1.0 to +1.0), and a symbol mapper matches text to instruments using 40+ aliases (BRENT→BRN, CABLE→GBP/USD). Toggle between direct (100%) and pattern matching (~85%) extraction modes.',
            techBadges: ['Python', 'SpaCy', 'TextBlob', 'Socket.IO'],
            highlights: ['SpaCy + TextBlob pipeline', '40+ symbol aliases', 'Extraction mode comparison'],
            status: 'live',
            dashboard: { component: 'ChatDashboard', defaultTab: 'chat' },
            breadcrumb: ['Market Data', 'Analytics', 'NLP Sentiment Analysis'],
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
