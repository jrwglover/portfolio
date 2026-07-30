import { Link, useLocation } from 'react-router-dom';
import { getLeafBySlug } from '../../config/topics';

export default function Header() {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isLearn = location.pathname.startsWith('/learn/');

  // Extract breadcrumb from topic config
  const slug = isLearn ? location.pathname.split('/learn/')[1] : '';
  const leaf = slug ? getLeafBySlug(slug) : undefined;
  const breadcrumb = leaf?.breadcrumb;

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

        <nav className="flex items-center gap-2">
          {isHome && (
            <>
              <a href="#projects" className="text-sm transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}>
                Projects
              </a>
              <a href="#modules" className="text-sm transition-colors ml-4"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}>
                Demos
              </a>
            </>
          )}
          {!isHome && breadcrumb && (
            <div className="flex items-center gap-1.5 text-sm">
              <Link
                to="/#modules"
                className="transition-colors"
                style={{ color: 'var(--text-dim)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
              >
                Modules
              </Link>
              {breadcrumb.map((segment, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span style={{ color: 'var(--border-subtle)' }}>/</span>
                  {i < breadcrumb.length - 1 ? (
                    <span style={{ color: 'var(--text-dim)' }}>{segment}</span>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)' }}>{segment}</span>
                  )}
                </span>
              ))}
            </div>
          )}
          {!isHome && !breadcrumb && (
            <Link
              to="/"
              className="text-sm transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              &larr; Modules
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
