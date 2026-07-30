import { Link } from 'react-router-dom';
import type { Project } from '../../config/projects';

export default function ProjectCard({ project }: { project: Project }) {
  const isLive = project.deploymentType === 'live';

  return (
    <Link to={project.route}>
      <article className="glass-card rounded-lg p-6 h-full flex flex-col cursor-pointer">
        {/* Top row */}
        <div className="flex items-center justify-between mb-4">
          <span
            className="text-[10px] tracking-widest uppercase font-mono font-medium px-2 py-0.5 rounded"
            style={{
              background: isLive ? 'rgba(92, 184, 122, 0.1)' : 'rgba(139, 126, 200, 0.1)',
              color: isLive ? 'var(--accent-green)' : 'var(--accent-purple)',
              border: `1px solid ${isLive ? 'rgba(92, 184, 122, 0.2)' : 'rgba(139, 126, 200, 0.2)'}`,
            }}
          >
            {isLive ? 'Live' : 'Analysis'}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
            {project.techBadges[0]}
            {project.techBadges[1] ? ` + ${project.techBadges[1]}` : ''}
          </span>
        </div>

        {/* Title */}
        <h3
          className="text-base font-semibold mb-1 transition-colors"
          style={{ color: 'var(--text-primary)' }}
        >
          {project.title}
        </h3>
        <p className="text-xs mb-4" style={{ color: 'var(--text-dim)' }}>
          {project.subtitle}
        </p>

        {/* Description */}
        <p
          className="text-sm leading-relaxed mb-5 flex-1"
          style={{ color: 'var(--text-secondary)' }}
        >
          {project.description}
        </p>

        {/* Tech row */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {project.techBadges.map((badge) => (
            <span
              key={badge}
              className="font-mono text-[10px] px-2 py-0.5 rounded"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-dim)',
              }}
            >
              {badge}
            </span>
          ))}
        </div>

        {/* Highlights */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4">
          {project.highlights.map((h) => (
            <span key={h} className="text-xs font-mono" style={{ color: 'var(--accent-warm-muted)' }}>
              {h}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div
          className="pt-3 mt-auto text-sm font-medium transition-colors"
          style={{
            borderTop: '1px solid var(--border-subtle)',
            color: 'var(--accent-warm)',
          }}
        >
          {isLive ? 'Open module \u2192' : 'View analysis \u2192'}
        </div>
      </article>
    </Link>
  );
}
