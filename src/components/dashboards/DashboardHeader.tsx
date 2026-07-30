interface Props {
  label: string;
  title: string;
  subtitle: string;
  techBadges: string[];
  githubUrl?: string;
  accentColor?: string;
}

export default function DashboardHeader({ label, title, subtitle, techBadges, githubUrl, accentColor = 'var(--accent-warm)' }: Props) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-3">
        <p className="font-mono text-xs tracking-widest uppercase" style={{ color: accentColor }}>
          {label}
        </p>
        {githubUrl && (
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener"
            className="font-mono text-[10px] tracking-widest uppercase px-2 py-0.5 rounded transition-colors"
            style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-dim)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-dim)'; }}
          >
            Source &rarr;
          </a>
        )}
      </div>
      <h1 className="text-3xl font-semibold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h1>
      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>
      <div className="flex flex-wrap gap-2">
        {techBadges.map((b) => (
          <span key={b} className="font-mono text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(94,170,181,0.08)', border: '1px solid rgba(94,170,181,0.15)', color: 'var(--accent-cool)' }}>
            {b}
          </span>
        ))}
      </div>
    </div>
  );
}
