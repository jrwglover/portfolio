import type { ReactNode } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Reading-column primitives for the chapter explanations. Prose is a size up
// from the panels, in a column about seventy characters wide, with equations
// rendered by KaTeX from TeX strings written in the chapter files.

export function P({ children }: { children: ReactNode }) {
  return (
    <p className="text-[15px] leading-relaxed mb-4 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
      {children}
    </p>
  );
}

export function H({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-base font-semibold mt-8 mb-3" style={{ color: 'var(--text-primary)' }}>
      {children}
    </h3>
  );
}

// Display equation.
export function Eq({ tex }: { tex: string }) {
  const html = katex.renderToString(tex, { displayMode: true, throwOnError: false });
  return (
    <div className="my-4 max-w-3xl overflow-x-auto text-[15px]" style={{ color: 'var(--text-primary)' }}
      dangerouslySetInnerHTML={{ __html: html }} />
  );
}

// Inline maths.
export function M({ tex }: { tex: string }) {
  const html = katex.renderToString(tex, { displayMode: false, throwOnError: false });
  return <span style={{ color: 'var(--text-primary)' }} dangerouslySetInnerHTML={{ __html: html }} />;
}

// A measured figure quoted in the text, set in mono so it reads as data.
export function N({ children }: { children: ReactNode }) {
  return <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{children}</span>;
}
