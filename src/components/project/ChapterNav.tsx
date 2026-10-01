import { useState } from 'react';
import { Link } from 'react-router-dom';
import { chapterPath, type ChapterRef } from '../../config/projects';

// The reading order. On wide screens it is a sidebar; on narrow ones it folds
// into a single line that opens on tap.
export default function ChapterNav({ current }: { current: ChapterRef }) {
  const [open, setOpen] = useState(false);
  const { project } = current;
  let n = 0;

  const list = (
    <ol className="space-y-5">
      {project.parts.map(part => (
        <li key={part.label}>
          <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--text-dim)' }}>
            {part.label}
          </div>
          <ol className="space-y-1">
            {part.chapters.map(ch => {
              n += 1;
              const active = ch.slug === current.chapter.slug;
              return (
                <li key={ch.slug}>
                  <Link to={chapterPath(project, ch)} onClick={() => setOpen(false)}
                    className="flex gap-2.5 items-baseline text-sm rounded px-2 py-1 -mx-2 transition-colors"
                    style={{
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                      background: active ? 'rgba(91, 143, 201, 0.10)' : 'transparent',
                    }}>
                    <span className="font-mono text-[11px] w-4 shrink-0 text-right"
                      style={{ color: active ? 'var(--accent-warm)' : 'var(--text-dim)' }}>{n}</span>
                    <span>{ch.title}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </li>
      ))}
    </ol>
  );

  return (
    <div>
      <Link to="/" className="block text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        {project.name}
      </Link>
      <p className="text-xs mb-5" style={{ color: 'var(--text-dim)' }}>{project.subtitle}</p>

      <button onClick={() => setOpen(o => !o)}
        className="lg:hidden font-mono text-xs px-3 py-2 rounded mb-3 w-full text-left"
        style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
        {open ? 'Hide chapters' : `Chapter ${current.index} of ${project.parts.reduce((a, p) => a + p.chapters.length, 0)}. Show all chapters`}
      </button>
      <div className={open ? '' : 'hidden lg:block'}>{list}</div>
    </div>
  );
}
