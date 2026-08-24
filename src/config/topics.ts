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
            subtitle: '8 curves, 10 instrument types, and the quotes behind them',
            description:
              'The prices every curve is built from, curve by curve: overnight index swaps, futures, forward rate agreements, swaps, FX swap points and cross currency basis. Every one of them is a price the curve has to reprice correctly, and a place risk can sit.',
            techBadges: ['C++', 'QuantLib', 'GlobalBootstrap', 'CUDA'],
            highlights: ['8 curves incl. 4 ESTR variants', 'IMM + ECB meeting-dated strips', 'FX swaps + xccy basis'],
            status: 'live',
            dashboard: { component: 'CurveModelDashboard', defaultTab: 'inputs' },
            breadcrumb: ['Rates', 'Curve Bootstrapping', 'Curve Market Data Model'],
          },
          {
            id: 'rt-engine',
            slug: 'rt-engine',
            title: 'Real-time curve engine',
            subtitle: 'Rebuilding only what a price change affects',
            description:
              'Curves are built on each other, so one price can force several rebuilds and leave the rest alone. This shows which ones move and why, and how a reader is kept from seeing a set that is half old and half new.',
            techBadges: ['C++17', 'Event driven', 'Lock-free publish'],
            highlights: ['Dependency scoped rebuilds', 'One coherent set at a time', 'Bursts collapse into one rebuild'],
            status: 'live',
            dashboard: { component: 'RtEngineDashboard', defaultTab: 'desk' },
            breadcrumb: ['Rates', 'Curve Bootstrapping', 'Real-time engine'],
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
        ],
      },
      {
        label: 'Curve Views',
        leaves: [
          {
            id: 'curve-domains',
            slug: 'curve-domains',
            title: 'Bootstrapped Curves',
            subtitle: 'All eight curves, read as forwards, zeros or discount factors',
            description:
              'One chart over the whole curve set. Pick curves, then read them as discrete forwards (the 3M or 6M rate a FRA or future actually pays), as zero rates, or as raw discount factors, out to 2.5, 10 or 30 years. Each curve is solved in the domain its own instruments pin: OIS strips on zero rates, the meeting-dated and IMM curves as flat forwards between policy or IMM dates joined to a min-curvature spline, EURIBOR off its FRA and swap strip, and EUR/USD as an implied zero curve against USD collateral. All eight share one interpolation, a minimum-curvature cubic spline on log discount factors. That makes the forward the first derivative of the spline. Spline the zero rates instead and the forward inherits t times the third derivative.',
            techBadges: ['C++', 'QuantLib', 'GlobalBootstrap', 'CUDA'],
            highlights: ['Discrete forwards, zeros or DFs', 'Per-curve solve domain', 'Every quote repriced under 0.21bp'],
            status: 'live',
            dashboard: { component: 'CurveModelDashboard', defaultTab: 'curves' },
            breadcrumb: ['Rates', 'Curve Views', 'Bootstrapped Curves'],
          },
        ],
      },
      {
        label: 'Sensitivities',
        leaves: [
          {
            id: 'market-pv01',
            slug: 'market-pv01',
            title: 'Trade Risk & Cashflows',
            subtitle: 'Bump-and-rebuild ladders and full cashflow schedules, 8 trades',
            description:
              'Where the risk of each trade sits, and what a desk would trade to hedge it. Eight examples covering every curve in the framework: an aged broken-dated swap, the meeting-dated and futures-dated variants, overnight index swaps in three currencies, and an FX forward.',
            techBadges: ['C++', 'CUDA', 'QuantLib', 'GlobalBootstrap'],
            highlights: ['8 trades, 8 curves', 'Per-meeting & per-future buckets', 'Cashflow-level PV breakdown'],
            status: 'live',
            dashboard: { component: 'CurveModelDashboard', defaultTab: 'sensis' },
            breadcrumb: ['Rates', 'Sensitivities', 'Market PV01'],
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
              'The end-of-day feed for a rates & inflation non-linear book shipped 25,000 trades from trade capture to the risk platform as a million-row exploded text extract. It took ~1.5 hours to land. The pipeline re-normalizes the trades in flight, gates them for pricing readiness (strikes, exercise schedules, inflation base fixings, LPI collars) and loads the risk database over parallel connections.',
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
            subtitle: 'Where each speedup actually came from',
            description:
              'The transfer leg was measured through a real 0.19 MB/s throttle: 25x. The SQL Server write leg, single connection against 8 parallel ones: 49x. On the prepare leg careful single-threaded code beats Spark at small file sizes, and that result is here too.',
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
