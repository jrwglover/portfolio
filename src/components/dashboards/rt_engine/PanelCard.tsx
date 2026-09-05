import type { ReactNode } from 'react';

// The two layers of the Risk and Valuations tabs: group headings that
// organise, and one bordered card per risk or valuation item, in the site's
// card idiom. Presentation only; every number inside comes from the export.

export function Group({ title, note, children }: {
  title: string; note?: string; children: ReactNode;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h3>
      {note && (
        <p className="text-sm mb-3 max-w-4xl" style={{ color: 'var(--text-dim)' }}>{note}</p>
      )}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export function PanelCard({ title, intro, children }: {
  title: string; intro: ReactNode; children: ReactNode;
}) {
  return (
    <div className="rounded px-4 py-3.5" style={{
      border: '1px solid var(--border-subtle)', background: 'var(--bg-card)',
    }}>
      <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        {title}
      </div>
      <p className="text-sm mb-3 max-w-4xl" style={{ color: 'var(--text-dim)' }}>{intro}</p>
      {children}
    </div>
  );
}
