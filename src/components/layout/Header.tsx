import { Link, useLocation } from 'react-router-dom';
import type { MouseEvent } from 'react';
import { findChapter } from '../../config/projects';

export default function Header() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  // On a chapter page the nav shows where the reader is in the project.
  const [, projectSlug, chapterSlug] = location.pathname.split('/');
  const ref = !isHome && projectSlug && chapterSlug ? findChapter(projectSlug, chapterSlug) : undefined;

  const navLink = (to: string, label: string, hash = false) => {
    const style = { color: 'var(--text-secondary)' };
    const over = (e: MouseEvent<HTMLElement>) => (e.currentTarget.style.color = 'var(--text-primary)');
    const out = (e: MouseEvent<HTMLElement>) => (e.currentTarget.style.color = 'var(--text-secondary)');
    return hash
      ? <a href={to} className="text-sm transition-colors" style={style} onMouseEnter={over} onMouseLeave={out}>{label}</a>
      : <Link to={to} className="text-sm transition-colors" style={style} onMouseEnter={over} onMouseLeave={out}>{label}</Link>;
  };

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: 'rgba(10, 10, 15, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div className="max-w-[1320px] mx-auto px-8 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-md flex items-center justify-center font-mono text-sm font-bold"
            style={{
              background: 'linear-gradient(135deg, var(--accent-warm), var(--accent-warm-muted))',
              color: '#0a0a0f',
            }}
          >
            JG
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Johnathon Glover
            </div>
            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
              Financial Markets Engineering
            </div>
          </div>
        </Link>

        <nav className="flex items-center gap-4">
          {isHome && (
            <>
              {navLink('#project', 'Project', true)}
              {navLink('#chapters', 'Chapters', true)}
            </>
          )}
          {ref && (
            <div className="flex items-center gap-1.5 text-sm">
              <Link to="/#chapters" className="transition-colors" style={{ color: 'var(--text-dim)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}>
                {ref.project.name}
              </Link>
              <span style={{ color: 'var(--border-subtle)' }}>/</span>
              <span className="hidden md:inline" style={{ color: 'var(--text-dim)' }}>{ref.part.label}</span>
              <span className="hidden md:inline" style={{ color: 'var(--border-subtle)' }}>/</span>
              <span style={{ color: 'var(--text-secondary)' }}>{ref.chapter.title}</span>
            </div>
          )}
          {!isHome && !ref && navLink('/', 'Home')}
        </nav>
      </div>
    </header>
  );
}
