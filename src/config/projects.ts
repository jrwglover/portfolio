// The site is organised as projects, each a reading order of chapters. A
// chapter is a page in the shared shell that shows one tab of an existing
// dashboard as its figure, so the dashboards are reused rather than rewritten.

export type Domain = 'fwd' | 'inst' | 'zero' | 'df' | 'fx';

export interface Chapter {
  slug: string;
  title: string;
  lede: string;
  component: 'CurveModelDashboard' | 'RtEngineDashboard' | 'BridgeDashboard' | 'Talk';
  // The dashboard tabs this chapter shows. One tab means no tab switch is
  // rendered; several means a small switch between them.
  tabs?: string[];
  // Initial state for the curve model's chart.
  curves?: string[];
  domain?: Domain;
}

export interface Part {
  label: string;
  chapters: Chapter[];
}

export interface Project {
  slug: string;
  name: string;
  subtitle: string;
  stack: string[];
  parts: Part[];
}

export const rates: Project = {
  slug: 'rates',
  name: 'Linear Rates Engine',
  subtitle: 'Curves, risk, real time and prudent valuation',
  stack: ['C++17', 'QuantLib', 'CUDA', 'PySpark', 'React'],
  parts: [
    {
      label: 'Inputs and construction',
      chapters: [
        {
          slug: 'market-data-model',
          title: 'Market data model',
          lede: 'The quotes every curve is built from, and the conventions behind each one.',
          component: 'CurveModelDashboard', tabs: ['inputs'],
        },
        {
          slug: 'bootstrapping',
          title: 'Bootstrapping and interpolation',
          lede: 'How the quotes become curves, and what the interpolation does between the pillars.',
          component: 'CurveModelDashboard', tabs: ['curves'],
          curves: ['ESTR_ECB', 'EURIBOR6M', 'SOFR', 'SONIA'], domain: 'inst',
        },
        {
          slug: 'meeting-dated-curves',
          title: 'Meeting-dated and IMM curves',
          lede: 'Four ESTR curves from the same overnight rate, each pinned by a different set of quotes.',
          component: 'CurveModelDashboard', tabs: ['curves'],
          curves: ['ESTR', 'ESTR_ECB', 'ESTR_IMM', 'ESTR_IMMFUT', 'EURIBOR6M'], domain: 'inst',
        },
        {
          slug: 'fx-and-cross-currency',
          title: 'FX and cross-currency curves',
          lede: 'Curves implied from FX swap points and basis, and the cheapest-to-deliver curve under a multi-currency CSA.',
          component: 'CurveModelDashboard', tabs: ['curves'],
          curves: ['EURUSD', 'AUDUSD', 'CSA_CTD', 'SOFR'], domain: 'fx',
        },
      ],
    },
    {
      label: 'Valuation and risk',
      chapters: [
        {
          slug: 'trade-risk',
          title: 'Trade risk and cashflows',
          lede: 'Market, Zero and Forward PV01 for each trade, and the cashflows they come from.',
          component: 'CurveModelDashboard', tabs: ['sensis'],
        },
        {
          slug: 'cost',
          title: 'Cost of a risk run',
          lede: 'What a full revaluation and risk run costs as the book grows, on the processor and on the GPU.',
          component: 'CurveModelDashboard', tabs: ['perf'],
        },
        {
          slug: 'trade-feed',
          title: 'Getting the book in',
          lede: 'The end-of-day trade feed from trade capture to the risk platform, rebuilt in Spark.',
          component: 'BridgeDashboard',
        },
      ],
    },
    {
      label: 'Real time',
      chapters: [
        {
          slug: 'why-events',
          title: 'Why rebuild on events',
          lede: 'What goes wrong with timer-driven curve rebuilds, and what an event-driven engine does instead.',
          component: 'RtEngineDashboard', tabs: ['why'],
        },
        {
          slug: 'what-one-price-touches',
          title: 'What one price touches',
          lede: 'Pick a curve and see which others a change to it forces to rebuild.',
          component: 'RtEngineDashboard', tabs: ['graph'],
        },
        {
          slug: 'session-replay',
          title: 'Trading session replay',
          lede: 'A recorded session played back. Curves rebuild as prices arrive, and the book, risk and VaR follow.',
          component: 'RtEngineDashboard', tabs: ['desk'],
        },
        {
          slug: 'limits',
          title: 'Limits',
          lede: 'Net DV01 by curve against desk limits, on every published set.',
          component: 'RtEngineDashboard', tabs: ['limits'],
        },
        {
          slug: 'engine-output',
          title: 'Engine and trader output',
          lede: 'The same run, as the engine logs it and as a trader would see it.',
          component: 'RtEngineDashboard', tabs: ['engine', 'trader'],
        },
      ],
    },
    {
      label: 'Marking and capital',
      chapters: [
        {
          slug: 'eod-marking',
          title: 'EOD marking and IPV',
          lede: 'End-of-day marks checked against generated Totem-style consensus, with the IPV result for each quote.',
          component: 'RtEngineDashboard', tabs: ['eod'],
        },
        {
          slug: 'prudent-valuation',
          title: 'Prudent valuation',
          lede: 'Market price uncertainty and close-out cost AVAs, by sensitivities and by full revaluation.',
          component: 'RtEngineDashboard', tabs: ['va'],
        },
        {
          slug: 'talk',
          title: 'Talk: from quotes to prudent value',
          lede: 'A ten-minute talk through the whole pipeline, and the regulation that changed it.',
          component: 'Talk',
        },
      ],
    },
    {
      label: 'Appendix',
      chapters: [
        {
          slug: 'architecture',
          title: 'Architecture',
          lede: 'C4 diagrams of the batch engine, the GPU boundary and the build order.',
          component: 'CurveModelDashboard', tabs: ['arch'],
        },
      ],
    },
  ],
};

export const projects: Project[] = [rates];

export interface ChapterRef {
  project: Project;
  part: Part;
  chapter: Chapter;
  index: number;        // 1-based position in the reading order
  prev?: Chapter;
  next?: Chapter;
}

export function chapterList(project: Project): Chapter[] {
  return project.parts.flatMap(p => p.chapters);
}

export function findChapter(projectSlug: string, chapterSlug: string): ChapterRef | undefined {
  const project = projects.find(p => p.slug === projectSlug);
  if (!project) return undefined;
  const all = chapterList(project);
  const i = all.findIndex(c => c.slug === chapterSlug);
  if (i < 0) return undefined;
  const part = project.parts.find(p => p.chapters.includes(all[i]))!;
  return { project, part, chapter: all[i], index: i + 1, prev: all[i - 1], next: all[i + 1] };
}

export function chapterPath(project: Project, chapter: Chapter): string {
  return `/${project.slug}/${chapter.slug}`;
}

// Where the old /learn/<slug> pages went. The RT engine page used ?tab= to
// pick a panel, so those map by tab.
export function legacyPath(slug: string, tab: string | null): string {
  const rtTabs: Record<string, string> = {
    desk: 'session-replay', limits: 'limits', eod: 'eod-marking', va: 'prudent-valuation',
    why: 'why-events', graph: 'what-one-price-touches', engine: 'engine-output', trader: 'engine-output',
  };
  const map: Record<string, string> = {
    'curve-data-model': 'market-data-model',
    'meeting-dated-curves': 'meeting-dated-curves',
    'curve-domains': 'fx-and-cross-currency',
    'market-pv01': 'trade-risk',
    'spark-trade-bridge': 'trade-feed',
    'bridge-benchmarks': 'trade-feed',
    'rt-engine': rtTabs[tab ?? ''] ?? 'session-replay',
  };
  const target = map[slug];
  return target ? `/rates/${target}` : '/';
}
