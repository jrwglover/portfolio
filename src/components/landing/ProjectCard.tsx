import { Link } from 'react-router-dom';
import { rates, chapterList, chapterPath } from '../../config/projects';

// The three systems used to be three case studies. They are one platform now,
// so the card describes the platform and the chapters carry the detail.
const TARGET =
  'Value and risk a rates book during the day at full accuracy, keep the curves current as prices arrive, and take the same numbers through to the end-of-day marks and the capital deduction. Every GPU or real-time number has to tie back to the reference library.';

const HOW = [
  'Build the curves in the order their dependencies require, from the instruments a rates desk quotes, solving every pillar on a curve at once.',
  'Value the book on the GPU from the coefficients the processor built, then reprice every instrument both ways and compare.',
  'On a price change, rebuild only the curves that depend on it, in dependency order, and publish each set as one immutable version.',
  'Mark the same book against generated Totem-style consensus, then compute the prudent valuation AVAs by sensitivities and by full revaluation.',
];

const RESULTS = [
  'GPU marks match QuantLib to 10⁻¹⁴ on all fourteen curves, 348 instruments repriced identically both ways',
  '120 prices arriving at once collapse into a single rebuild, and two readers checking continuously never saw a half-updated set',
  'MPU and CoC AVAs by sensitivities and by full revaluation agree to within 0.3%, with 449 real curve rebuilds behind the check',
  'The end-of-day trade feed measured 127× faster at the production transfer rate, with zero breaks across 1,035,762 reconciled rows',
];

export default function ProjectCard() {
  const first = chapterList(rates)[0];
  return (
    <section id="project" className="max-w-[1320px] mx-auto px-8 py-16">
      <div className="mb-10">
        <p className="font-mono text-xs tracking-widest uppercase mb-3" style={{ color: 'var(--accent-warm)' }}>
          Project
        </p>
        <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          {rates.name}
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{rates.subtitle}</p>
      </div>

      <div className="rounded-lg p-8 grid md:grid-cols-[1.2fr_1fr] gap-8"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div>
          <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: 'var(--text-dim)' }}>Target</p>
          <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>{TARGET}</p>
          <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: 'var(--text-dim)' }}>How</p>
          <ol className="space-y-2">
            {HOW.map((step, i) => (
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
            {RESULTS.map((r, i) => (
              <li key={i} className="text-sm flex gap-2.5" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent-green)' }}>&#9642;</span>{r}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 mb-6">
            {rates.stack.map(s => (
              <span key={s} className="font-mono text-[10px] px-2 py-1 rounded"
                style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-dim)' }}>{s}</span>
            ))}
          </div>
          <Link to={chapterPath(rates, first)} className="font-mono text-xs mt-auto self-start px-4 py-2 rounded transition-colors"
            style={{ border: '1px solid var(--accent-warm)', color: 'var(--accent-warm)' }}>
            Start at chapter 1 &rarr;
          </Link>
        </div>
      </div>

      <p className="text-sm mt-6 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
        A second project, a rates volatility engine covering vol surfaces, swaptions, CMS,
        Bermudans and model risk, is in progress and will appear here chapter by chapter
        as each part is built and checked.
      </p>
    </section>
  );
}
