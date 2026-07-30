export interface Project {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  techBadges: string[];
  route: string;
  githubUrl?: string;
  highlights: string[];
}

export const categories = [
  'Curve Construction & Interpolation',
  'Pricing & Risk',
  'Market Data & Analytics',
] as const;

export const projects: Project[] = [
  {
    id: 'bondbootstrapper',
    title: 'Bond Zero Curve Bootstrapper',
    subtitle: 'Sovereign & credit curve construction from bond prices',
    description:
      'Learn how zero curves are built from German Bund prices using QuantLib bootstrapping. Explore how borrowing costs decompose into OIS, sovereign, and credit spread layers through an interactive waterfall chart.',
    category: 'Curve Construction & Interpolation',
    techBadges: ['C++', 'QuantLib', 'React', 'Express', 'TypeScript'],
    route: '/dashboard/bondbootstrapper',
    highlights: ['30+ Bund constituents', 'Credit spread waterfall', 'Sub-basis-point accuracy'],
  },
  {
    id: 'mc-interp-cuda',
    title: 'GPU Interpolation Methods',
    subtitle: 'ConvexMonotone vs CubicSpline on GPU',
    description:
      'Compare interpolation methods used in multi-curve frameworks: Hagan-West ConvexMonotone vs CubicSpline MinCurve. See how CUDA acceleration delivers 50-100x speedups for large-scale curve construction.',
    category: 'Curve Construction & Interpolation',
    techBadges: ['C++', 'CUDA', 'QuantLib', 'GPU'],
    route: '/dashboard/cuda-curves',
    highlights: ['50-100x GPU speedup', '1e-14 accuracy', '150k swaps in 200ms'],
  },
  {
    id: 'pricer',
    title: 'TRM Pricing Toolkit',
    subtitle: 'Multi-asset swap pricing with curve construction',
    description:
      'Explore how trading desks price interest rate swaps. QuantLib-based curve construction with Nelson-Siegel modelling, real-time market simulation, and DV01 risk ladders across 9 currencies.',
    category: 'Pricing & Risk',
    techBadges: ['Python', 'Flask', 'QuantLib', 'React', 'Material-UI'],
    route: '/dashboard/pricer',
    highlights: ['9 currencies', 'Real-time simulation', 'DV01 risk ladders'],
  },
  {
    id: 'swap-pricer',
    title: 'Real-Time Swap Pricer',
    subtitle: 'WebSocket-driven interest rate swap pricing',
    description:
      'See how live swap pricing works with WebSocket feeds across 7 currencies. Price IRS, OIS, basis, and cross-currency swaps with full Greeks output: DV01, theta, convexity.',
    category: 'Pricing & Risk',
    techBadges: ['Node.js', 'Express', 'WebSocket', 'React', 'TypeScript'],
    route: '/dashboard/swap-pricer',
    highlights: ['7 currencies', 'WebSocket live feeds', 'Full Greeks output'],
  },
  {
    id: 'parameter-reduction',
    title: 'Vega Parameter Reduction',
    subtitle: 'PCA-based options risk compression',
    description:
      'Understand how PCA reduces vega risk parameters for regulatory capital. Compare Statistical PCA, Heston basis, and SVI basis methods validated with VRT and AVA across volatility regimes.',
    category: 'Pricing & Risk',
    techBadges: ['Python', 'NumPy', 'SciPy', 'scikit-learn', 'Plotly'],
    route: '/dashboard/vega-reduction',
    highlights: ['3 PCA methods', 'VRT validation', 'CRR2/FRTB compliant'],
  },
  {
    id: 'chat-scraper',
    title: 'Market Data & Chat Analytics',
    subtitle: 'Real-time pricing with NLP sentiment analysis',
    description:
      'Explore real-time market data for 26 instruments across 7 asset classes. See how NLP extracts entities and sentiment from trading chat, with price-sentiment overlays for market context.',
    category: 'Market Data & Analytics',
    techBadges: ['Python', 'Flask', 'SpaCy', 'React', 'Socket.IO'],
    route: '/dashboard/chat-scraper',
    highlights: ['26 instruments', '7 asset classes', 'NLP entity extraction'],
  },
];
