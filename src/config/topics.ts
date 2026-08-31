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
            subtitle: 'The instruments each curve is built from, and the quotes behind them',
            description:
              'These are the prices every curve is built from: overnight index swaps, futures, forward rate agreements, swaps, tenor basis swaps, FX swap points and cross currency basis. Every one of them is a price the curve has to reprice correctly, and a place risk can sit.',
            techBadges: ['C++', 'QuantLib', 'GlobalBootstrap', 'CUDA'],
            highlights: ['Meeting-dated ESTR, SOFR, SONIA and AONIA strips', 'AUD 3s6s tenor basis strip linking the BBSW pair', 'FX swaps + xccy basis in two pairs'],
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
            subtitle: 'The same ESTR rate, built from four different quote sets',
            description:
              'Four ESTR curves are built off the same overnight rate, each pinned by a different set of quotes: tenor OIS, quarterly IMM-dated OIS, IMM-dated OIS with convexity-adjusted futures, and OIS dated to ECB policy effective dates. The ECB-dated build is the curve the book prices on; the other three are kept as a comparison of construction choices. Add EURIBOR 6M and the EUR curve implied under USD collateral to the chart to see where the four disagree.',
            techBadges: ['C++', 'QuantLib', 'GlobalBootstrap'],
            highlights: ['Four ESTR quote sets compared', 'Per-meeting and per-future pillars', 'Futures convexity adjustment'],
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
            subtitle: 'All fourteen curves, read as forwards, zeros or discount factors',
            description:
              'One chart covers the whole curve set. Pick curves, then read them as discrete forwards (the 3M or 6M rate a FRA or future pays), as zero rates, or as raw discount factors, out to 2.5, 10 or 30 years. Each curve is pinned by the instruments a desk quotes for it, and every pillar on a curve is solved at once, so a quote is repriced by the same finished curve it helped build. EURIBOR 6M projects off its own quotes and discounts on the meeting-dated ESTR curve, and the BBSW curves discount on the RBA-dated AONIA curve. Each FX curve is implied from FX swap points and cross currency basis against the USD curve.',
            techBadges: ['C++', 'QuantLib', 'GlobalBootstrap', 'CUDA'],
            highlights: ['Discrete forwards, zeros or DFs', 'Dual-curve and cross-currency builds', 'Every quote repriced inside a tenth of a basis point'],
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
              'Eight example trades cover the curves the book prices on: an aged broken-dated swap, a 2Y swap on the meeting-dated discount curve, a 7Y swap against 6M BBSW, overnight index swaps in four currencies, and an FX forward. Each shows where its risk sits and what a desk would trade to hedge it.',
            techBadges: ['C++', 'CUDA', 'QuantLib', 'GlobalBootstrap'],
            highlights: ['Eight trades on the curves in use', 'Per-meeting policy-date buckets', 'Cashflow-level PV breakdown'],
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
            subtitle: 'Finding the fastest way to load an end-of-day trade file into the risk database',
            description:
              'The end-of-day feed shipped a 25,000-trade book from trade capture to the risk platform as a million-row flat text extract, and the load took a long time. This pipeline re-nests the trades in flight and writes them as compressed Parquet. Any trade missing a field the pricing step needs is quarantined. The load into the risk database runs over parallel connections and reconciles after every run.',
            techBadges: ['PySpark', 'Parquet', 'SQL Server', 'Docker'],
            highlights: ['21.5x file to database (measured)', '15.9x payload compression', 'Pricing-readiness quarantine gate'],
            status: 'live',
            dashboard: { component: 'BridgeDashboard', defaultTab: 'problem' },
            breadcrumb: ['Data Engineering', 'Trade Transfer', 'Spark Trade Bridge'],
          },
          {
            id: 'bridge-benchmarks',
            slug: 'bridge-benchmarks',
            title: 'Bridge Benchmarks',
            subtitle: 'Where each speedup came from',
            description:
              'The transfer leg was measured by copying both payloads through a 0.19 MB/s throttle, the legacy file as one stream and the Parquet over eight. The SQL Server write was measured with one connection and again with 8 parallel ones, a 49x difference. The prepare leg is here too, where single-threaded code comes out ahead of Spark at this file size.',
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
