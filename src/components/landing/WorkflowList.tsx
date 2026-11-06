import { Link } from 'react-router-dom';
import { stages, stagePath } from '../../config/workflow';

// The three stages and every panel in them, so a visitor can open the one
// they care about straight from the front page.
export default function WorkflowList() {
  return (
    <section id="workflow" className="max-w-[1320px] mx-auto px-8 py-20">
      <div className="mb-12">
        <p className="font-mono text-xs tracking-widest uppercase mb-3" style={{ color: 'var(--accent-warm)' }}>
          The workflow
        </p>
        <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Three stages
        </h2>
        <p className="text-sm mt-2 max-w-4xl" style={{ color: 'var(--text-secondary)' }}>
          Quotes become curves, the trade feed brings the book in, and the book then runs
          live on those curves. Each panel is the live tool with short notes above it.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {stages.map(s => (
          <div key={s.slug} className="rounded p-6" style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
            <Link to={stagePath(s)} className="block mb-4">
              <div className="font-mono text-[10px] tracking-widest uppercase" style={{ color: 'var(--accent-warm)' }}>Stage {s.n}</div>
              <h3 className="text-base font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>{s.title}</h3>
              <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text-dim)' }}>{s.lede}</p>
            </Link>
            <ol className="space-y-1.5">
              {s.panels.map((p, i) => (
                <li key={p.key}>
                  <Link to={stagePath(s, p.key)} className="flex gap-2.5 items-baseline text-sm transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
                    <span className="font-mono text-[11px] w-4 shrink-0 text-right" style={{ color: 'var(--text-dim)' }}>{i + 1}</span>
                    <span>{p.title}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
