import { Link, useLocation } from 'react-router-dom';
import type { MouseEvent } from 'react';
import { findStage, stagePath, stages, project } from '../../config/workflow';

export default function Header() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  // On a stage page the nav shows the three stages, with the open one marked.
  const [, section, stageSlug] = location.pathname.split('/');
  const stage = !isHome && section === 'rates' && stageSlug ? findStage(stageSlug) : undefined;

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
              {navLink('#workflow', 'Workflow', true)}
            </>
          )}
          {stage && (
            <div className="flex items-center gap-3 text-sm">
              <Link to="/#workflow" className="hidden md:inline transition-colors" style={{ color: 'var(--text-dim)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}>
                {project.name}
              </Link>
              <span className="hidden md:inline" style={{ color: 'var(--border-subtle)' }}>/</span>
              {stages.map(s => (
                <Link key={s.slug} to={stagePath(s)} className="font-mono text-xs transition-colors"
                  style={{ color: s.slug === stage.slug ? 'var(--accent-warm)' : 'var(--text-dim)' }}
                  onMouseEnter={(e) => { if (s.slug !== stage.slug) e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={(e) => { if (s.slug !== stage.slug) e.currentTarget.style.color = 'var(--text-dim)'; }}>
                  {s.n} <span className="hidden sm:inline">{s.title}</span>
                </Link>
              ))}
            </div>
          )}
          {!isHome && !stage && navLink('/', 'Home')}
        </nav>
      </div>
    </header>
  );
}
