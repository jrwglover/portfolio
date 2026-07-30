import { useState, type ReactNode } from 'react';
import DashboardHeader from './DashboardHeader';

interface GuideSection {
  tab: string;
  color: string;
  summary: string;
  points: string[];
}

interface Props {
  label: string;
  title: string;
  subtitle: string;
  techBadges: string[];
  githubUrl?: string;
  accentColor?: string;
  appUrl: string;
  appTitle: string;
  whatItDoes: string;
  keyResults: [string, string][];
  guide: GuideSection[];
  extras?: ReactNode;
}

export default function EmbeddedApp({
  label, title, subtitle, techBadges, githubUrl, accentColor,
  appUrl, appTitle, whatItDoes, keyResults, guide, extras,
}: Props) {
  const [guideOpen, setGuideOpen] = useState(true);

  return (
    <div className="max-w-[1800px] mx-auto px-4 py-8">
      <div className="flex gap-4">
        {/* Guide sidebar */}
        {guideOpen && (
          <div className="w-[380px] shrink-0 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
            <DashboardHeader
              label={label}
              title={title}
              subtitle={subtitle}
              techBadges={techBadges}
              githubUrl={githubUrl}
              accentColor={accentColor}
            />

            <div className="glass-card rounded-lg p-4" style={{ cursor: 'default' }}>
              <h4 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>What this does</h4>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {whatItDoes}
              </p>
            </div>

            <div className="glass-card rounded-lg p-4" style={{ cursor: 'default' }}>
              <h4 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Key results</h4>
              <div className="space-y-1.5">
                {keyResults.map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-[10px]">
                    <span style={{ color: 'var(--accent-green)' }}>&#x2713;</span>
                    <span><strong style={{ color: 'var(--text-primary)' }}>{k}:</strong>{' '}
                    <span style={{ color: 'var(--text-dim)' }}>{v}</span></span>
                  </div>
                ))}
              </div>
            </div>

            {guide.length > 0 && (
              <div className="text-[10px] font-mono px-2" style={{ color: accentColor || 'var(--accent-warm)' }}>
                Navigate the app &darr;
              </div>
            )}

            {guide.map(s => (
              <details key={s.tab} className="glass-card rounded-lg overflow-hidden">
                <summary className="px-4 py-3 cursor-pointer flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{
                    background: `color-mix(in srgb, ${s.color} 15%, transparent)`,
                    color: s.color,
                    border: `1px solid color-mix(in srgb, ${s.color} 25%, transparent)`,
                  }}>
                    {s.tab}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.summary}</span>
                </summary>
                <div className="px-4 pb-4">
                  <ul className="space-y-1.5">
                    {s.points.map((p, i) => (
                      <li key={i} className="flex gap-2 text-[10px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                        <span className="font-mono shrink-0" style={{ color: 'var(--text-dim)' }}>{String(i + 1).padStart(2, '0')}</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            ))}

            {extras}
          </div>
        )}

        {/* App embed */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setGuideOpen(!guideOpen)}
              className="text-xs px-3 py-1 rounded transition-all"
              style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
            >
              {guideOpen ? 'Hide guide \u2190' : 'Show guide \u2192'}
            </button>
            <a href={appUrl} target="_blank" rel="noopener" className="text-xs font-mono" style={{ color: 'var(--text-dim)' }}>
              Open in new tab &rarr;
            </a>
          </div>
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)', height: 'calc(100vh - 160px)' }}>
            <iframe src={appUrl} className="w-full h-full" style={{ background: '#030712' }} title={appTitle} />
          </div>
        </div>
      </div>
    </div>
  );
}
