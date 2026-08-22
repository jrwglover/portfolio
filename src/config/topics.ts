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
            subtitle: '8 curves, 10 instrument types: quotes in, curves out',
            description:
              'Explore the full market data model behind the multi-curve framework: tenor OIS, IMM-dated OIS strips, price-quoted futures with convexity adjustment, ECB meeting-dated OIS, dual-curve EURIBOR (deposits, FRAs, IMM FRAs, IRS) and the FX/xccy-implied EUR-under-USD-collateral curve. Every quote is a bootstrap constraint and a PV01 bucket.',
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
              'Curves are built on each other, so one price can force several rebuilds and leave the rest untouched. This shows which curves move, why, and how a reader is kept from seeing a set where half the numbers are from one moment and half from another.',
            techBadges: ['C++17', 'Event driven', 'Lock-free publish'],
            highlights: ['Dependency scoped rebuilds', 'One coherent set at a time', 'Bursts collapse into one rebuild'],
            status: 'live',
            dashboard: { component: 'RtEngineDashboard', defaultTab: 'graph' },
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
            subtitle: 'All eight curves, in whichever domain answers the question',
            description:
              'One chart over the whole curve set. Pick curves, then read them as discrete forwards (the 3M or 6M rate a FRA or future actually pays), as zero rates, or as raw discount factors, out to 2.5, 10 or 30 years. Each curve is solved in the domain its own instruments pin: OIS strips on zero rates, the meeting-dated and IMM curves as flat forwards between policy or IMM dates joined to a min-curvature spline, EURIBOR off its FRA and swap strip, and EUR/USD as an implied zero curve against USD collateral. All eight share one interpolation: a minimum-curvature cubic spline on LOG DISCOUNT FACTORS, which makes the forward the spline first derivative rather than leaving it to inherit t times the third derivative of a spline through zero rates.',
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
              'Market-quote PV01 trade by trade: eight example trades covering every curve in the framework: a seasoned broken-dated EURIBOR swap, swaps discounted on the ECB meeting-dated and IMM ESTR curves, ESTR/SOFR/SONIA OIS, and EUR/USD forwards on the xccy curve. Each ladder is a 1bp bump and full re-bootstrap, with per-ECB-meeting and per-futures-contract buckets, followed by the trade\'s complete cashflow schedule: accrual periods, projected rates, discount factors and present values.',
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
