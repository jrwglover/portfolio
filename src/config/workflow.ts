// The site is one project shown as a workflow of three stages. Each stage is
// one of the dashboards with its own tab bar, and every panel carries the
// notes that explain it (src/content/rates.tsx, keyed by the old page slugs).

export type Domain = 'fwd' | 'inst' | 'zero' | 'df' | 'fx';

export interface Panel {
  key: string;        // the dashboard's tab key
  title: string;
  notes: string[];    // keys into src/content/rates.tsx, shown above the panel
}

export interface Stage {
  slug: string;
  n: string;
  title: string;
  lede: string;
  component: 'CurveModelDashboard' | 'RtEngineDashboard' | 'BridgeDashboard';
  panels: Panel[];
}

export const project = {
  name: 'Linear Rates Engine',
  subtitle: 'Curves, risk, real time and prudent valuation',
  stack: ['C++17', 'QuantLib', 'CUDA', 'Python', 'PySpark', 'React'],
};

export const stages: Stage[] = [
  {
    slug: 'curves', n: '01', title: 'Build the curves', component: 'CurveModelDashboard',
    lede: 'The quotes every curve is built from, the curves themselves, a government bond curve with relative value, the risk of a trade against them, what a run costs, and the pipelines that build and test the code.',
    panels: [
      { key: 'inputs', title: 'Market data model', notes: ['market-data-model'] },
      { key: 'curves', title: 'Bootstrapped curves', notes: ['bootstrapping', 'meeting-dated-curves', 'fx-and-cross-currency'] },
      { key: 'bonds', title: 'Government bonds and relative value', notes: ['bond-curve'] },
      { key: 'sensis', title: 'Trade risk and cashflows', notes: ['trade-risk'] },
      { key: 'perf', title: 'Cost of a risk run', notes: ['cost'] },
      { key: 'arch', title: 'Architecture', notes: ['architecture'] },
      { key: 'pipelines', title: 'Build and test pipelines', notes: ['pipelines'] },
    ],
  },
  {
    slug: 'book', n: '02', title: 'Get the book in', component: 'BridgeDashboard',
    lede: 'The end-of-day trade feed from trade capture to the risk platform, rebuilt in Spark and measured.',
    panels: [
      { key: 'problem', title: 'The problem', notes: ['trade-feed'] },
      { key: 'pipeline', title: 'The pipeline', notes: ['trade-feed'] },
      { key: 'benchmarks', title: 'Measured benchmarks', notes: ['trade-feed'] },
    ],
  },
  {
    slug: 'live', n: '03', title: 'Run the book live', component: 'RtEngineDashboard',
    lede: 'Curves rebuilt on events as prices arrive, with value and risk on the whole book refreshed in a median of 178 ms. The desk view of a recorded session, limits, VaR and stress follow, then the end-of-day marks and the capital deduction.',
    panels: [
      { key: 'desk', title: 'Trading session replay', notes: ['session-replay'] },
      { key: 'limits', title: 'Limits', notes: ['limits'] },
      { key: 'eod', title: 'Independent price verification', notes: ['eod-marking'] },
      { key: 'va', title: 'Close-out cost and mid-price uncertainty', notes: ['prudent-valuation'] },
      { key: 'why', title: 'Why events', notes: ['why-events'] },
      { key: 'graph', title: 'What one price touches', notes: ['what-one-price-touches'] },
      { key: 'engine', title: 'Engine output', notes: ['engine-output'] },
      { key: 'trader', title: 'Trader output', notes: ['engine-output'] },
      { key: 'var', title: 'Value at risk', notes: ['value-at-risk'] },
      { key: 'stress', title: 'Stress scenarios', notes: ['stress-scenarios'] },
      { key: 'ipv', title: 'Trading-curve IPV', notes: ['eod-marking'] },
      { key: 'exit', title: 'The nine AVA categories', notes: ['ava-table'] },
      { key: 'inventory', title: 'Model inventory', notes: ['model-inventory'] },
    ],
  },
];

export function findStage(slug: string): Stage | undefined {
  return stages.find(s => s.slug === slug);
}

export function stagePath(stage: Stage, tab?: string): string {
  return `/rates/${stage.slug}${tab && tab !== stage.panels[0].key ? `?tab=${tab}` : ''}`;
}

// Where the earlier pages went: the chapter pages at /rates/<slug> and the
// older /learn/<slug>?tab= pages. Links that were shared keep working.
const OLD_PAGES: Record<string, [string, string]> = {
  'market-data-model': ['curves', 'inputs'], 'bootstrapping': ['curves', 'curves'],
  'meeting-dated-curves': ['curves', 'curves'], 'fx-and-cross-currency': ['curves', 'curves'],
  'trade-risk': ['curves', 'sensis'], 'cost': ['curves', 'perf'], 'architecture': ['curves', 'arch'],
  'why-events': ['live', 'why'], 'what-one-price-touches': ['live', 'graph'], 'session-replay': ['live', 'desk'],
  'limits': ['live', 'limits'], 'value-at-risk': ['live', 'var'], 'stress-scenarios': ['live', 'stress'],
  'eod-marking': ['live', 'eod'], 'prudent-valuation': ['live', 'va'], 'ava-table': ['live', 'exit'],
  'engine-output': ['live', 'engine'], 'model-inventory': ['live', 'inventory'], 'trade-feed': ['book', 'problem'],
  'curve-data-model': ['curves', 'inputs'], 'curve-domains': ['curves', 'curves'], 'market-pv01': ['curves', 'sensis'],
  'spark-trade-bridge': ['book', 'problem'], 'bridge-benchmarks': ['book', 'benchmarks'], 'rt-engine': ['live', 'desk'],
};

export function legacyPath(slug: string, tab: string | null): string {
  const hit = OLD_PAGES[slug];
  if (!hit) return '/';
  const stage = findStage(hit[0])!;
  const key = slug === 'rt-engine' && tab && stage.panels.some(p => p.key === tab) ? tab : hit[1];
  return stagePath(stage, key);
}
