import { projects, categories } from '../../config/projects';
import ProjectCard from './ProjectCard';

const categoryIcons: Record<string, string> = {
  'Curve Construction & Interpolation': '01',
  'Pricing & Risk': '02',
  'Market Data & Analytics': '03',
};

export default function ProjectGrid() {
  return (
    <section id="modules" className="max-w-[1320px] mx-auto px-8 py-20">
      <div className="mb-12">
        <p
          className="font-mono text-xs tracking-widest uppercase mb-3"
          style={{ color: 'var(--accent-warm)' }}
        >
          Learning Modules
        </p>
        <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Explore by topic
        </h2>
      </div>

      {categories.map((cat) => {
        const catProjects = projects.filter((p) => p.category === cat);
        if (catProjects.length === 0) return null;
        return (
          <div key={cat} className="mb-16 last:mb-0">
            <div className="flex items-center gap-3 mb-6">
              <span
                className="font-mono text-xs font-bold w-7 h-7 rounded flex items-center justify-center"
                style={{
                  background: 'rgba(192, 72, 0, 0.08)',
                  color: 'var(--accent-warm-muted)',
                  border: '1px solid rgba(192, 72, 0, 0.15)',
                }}
              >
                {categoryIcons[cat]}
              </span>
              <h3 className="text-sm font-medium tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                {cat}
              </h3>
            </div>
            <div
              className={`grid gap-5 ${
                catProjects.length === 1
                  ? 'grid-cols-1 max-w-lg'
                  : catProjects.length === 2
                  ? 'grid-cols-1 md:grid-cols-2'
                  : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              }`}
            >
              {catProjects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
