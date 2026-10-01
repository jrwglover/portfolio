import { Link } from 'react-router-dom';
import { rates, chapterPath } from '../../config/projects';

// The reading order, so a visitor can go straight to the chapter they care
// about rather than starting at the beginning.
export default function ChapterList() {
  let n = 0;
  return (
    <section id="chapters" className="max-w-[1320px] mx-auto px-8 py-20">
      <div className="mb-12">
        <p className="font-mono text-xs tracking-widest uppercase mb-3" style={{ color: 'var(--accent-warm)' }}>
          Chapters
        </p>
        <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          The platform in reading order
        </h2>
        <p className="text-sm mt-2 max-w-4xl" style={{ color: 'var(--text-secondary)' }}>
          Each chapter is a short explanation with the live panel behind it. The parts
          follow the data: quotes in, curves built, the book valued and risked, then
          marked and taken through to capital.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-x-12 gap-y-10">
        {rates.parts.map(part => (
          <div key={part.label}>
            <h3 className="text-sm font-semibold tracking-wide mb-4" style={{ color: 'var(--text-primary)' }}>
              {part.label}
            </h3>
            <ol className="space-y-3">
              {part.chapters.map(ch => {
                n += 1;
                return (
                  <li key={ch.slug}>
                    <Link to={chapterPath(rates, ch)} className="group flex gap-3 items-baseline">
                      <span className="font-mono text-xs w-5 shrink-0 text-right" style={{ color: 'var(--accent-warm)' }}>{n}</span>
                      <span>
                        <span className="text-sm transition-colors" style={{ color: 'var(--text-primary)' }}>{ch.title}</span>
                        <span className="block text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{ch.lede}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
