import { useState } from 'react';
import runSrc from './diagrams/valuation-run.mmd?raw';
import buildSrc from './diagrams/construction.mmd?raw';
import curveSrc from './diagrams/curve-graph.mmd?raw';

/* Architecture panel for the curve-model dashboard.
   A schematic, not a chart: structure carries the meaning, so colour stays
   recessive and is used only to separate the two evaluation paths (CPU / GPU)
   whose reconciliation is the point of the design. All tokens are the site's. */

const CARD = 'var(--bg-card)';
const EDGE = 'var(--border-subtle)';
const DIM = 'var(--text-dim)';
const SEC = 'var(--text-secondary)';
const PRI = 'var(--text-primary)';
const CPU = '#5b8fc9';
const GPU = '#5cb87a';

function Arrow({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center" style={{ padding: '4px 0' }}>
      {label && <span className="font-mono text-[10px] mb-1" style={{ color: DIM }}>{label}</span>}
      <svg width="14" height="18" viewBox="0 0 14 18" aria-hidden="true">
        <line x1="7" y1="0" x2="7" y2="12" stroke={EDGE} strokeWidth="1.5" />
        <path d="M7 18 L3 11 L11 11 Z" fill={EDGE} />
      </svg>
    </div>
  );
}

function Layer({ kicker, title, children, accent }:
  { kicker: string; title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-lg px-4 py-3 w-full"
         style={{ background: CARD, border: `1px solid ${EDGE}`,
                  borderLeft: `2px solid ${accent ?? EDGE}` }}>
      <div className="flex items-baseline gap-2 mb-1.5 flex-wrap">
        <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: DIM }}>{kicker}</span>
        <span className="text-sm font-semibold" style={{ color: PRI }}>{title}</span>
      </div>
      <div className="text-xs leading-relaxed" style={{ color: SEC }}>{children}</div>
    </div>
  );
}


/* Diagrams are Mermaid source in ./diagrams, pre-rendered to SVG by
   `npm run diagrams` (mermaid-cli). Rendering at build time keeps mermaid out
   of the runtime bundle and makes a broken diagram a build failure rather than
   a blank box in production. The source is shown on demand because a diagram
   you cannot diff is a screenshot. */
function Figure({ src, source, alt, caption }:
  { src: string; source: string; alt: string; caption?: string }) {
  const [showSrc, setShowSrc] = useState(false);
  return (
    <figure className="my-3 rounded-lg overflow-hidden" style={{ border: `1px solid ${EDGE}` }}>
      <div className="px-3 py-1.5 flex items-center justify-between"
           style={{ background: 'var(--bg-surface)', borderBottom: `1px solid ${EDGE}` }}>
        <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: DIM }}>
          {src.split('/').pop()?.replace('.svg', '.mmd')} · mermaid
        </span>
        <button onClick={() => setShowSrc(v => !v)}
                className="font-mono text-[10px] px-2 py-0.5 rounded"
                style={{ color: showSrc ? PRI : DIM, border: `1px solid ${EDGE}` }}>
          {showSrc ? 'diagram' : 'source'}
        </button>
      </div>
      {showSrc ? (
        <pre className="text-[10.5px] leading-relaxed p-3 overflow-x-auto m-0"
             style={{ background: 'var(--bg-surface)', color: SEC }}>{source.trim()}</pre>
      ) : (
        <div className="p-3" style={{ background: CARD, overflowX: 'auto' }}>
          <img src={src} alt={alt} style={{ width: '100%', minWidth: 520, display: 'block' }} />
        </div>
      )}
      {caption && <figcaption className="px-3 py-2 text-[11px]"
                              style={{ color: DIM, borderTop: `1px solid ${EDGE}` }}>{caption}</figcaption>}
    </figure>
  );
}

export default function ArchitecturePanel() {
  return (
    <div>
      <p className="text-sm mb-6 max-w-3xl" style={{ color: SEC }}>
        Eight curves, one construction, two evaluation paths that must agree. The design
        exists to make that last clause checkable: every number the GPU produces is
        differenced against the QuantLib reference on the same inputs, and the engine is
        only useful if that difference stays at round-off.
      </p>

      <p className="text-xs mb-2 font-mono uppercase tracking-wider" style={{ color: DIM }}>
        What happens on a valuation run
      </p>
      <Figure src="/diagrams/valuation-run.svg" source={runSrc}
              alt="Sequence diagram of a valuation run: quotes are mapped to rate helpers; meeting- and IMM-dated curves take a two-stage path with a flat-forward strip pinned into a spline; all pillars are solved simultaneously; log discount factors are sampled per interval into cubic coefficients and copied to the device; CPU and GPU paths are then differenced over 240 instruments."
              caption="Sequence. The two-stage branch, the simultaneous pillar solve, and the fact that the coefficient upload is an identity rather than a fit are the three things that determine whether the numbers reconcile." />

      <p className="text-xs mt-8 mb-2 font-mono uppercase tracking-wider" style={{ color: DIM }}>
        How one curve gets built
      </p>
      <Figure src="/diagrams/construction.svg" source={buildSrc}
              alt="Flowchart of curve construction: each quote maps to a rate helper by instrument type; curves flagged short_end_step take a two-stage flat-forward-then-spline path composited at tCut, all others go straight to a log-cubic global bootstrap."
              caption="Construction. Every branch here exists because of a measured failure: the instrument-typed helper mapping, the two-stage build for policy-dated curves, and the log-discount-factor domain." />

      <div className="flex flex-col items-center max-w-3xl">
        <Layer kicker="input" title="Market quotes">
          One JSON file per valuation date: deposits, OIS, meeting-dated and IMM-dated OIS,
          futures, FRAs, swaps, FX swap points and cross-currency basis. Every quote carries
          its instrument type, so the builder picks the helper rather than guessing from the
          tenor. Provenance is recorded in the file: these are synthetic, derived from one
          arbitrage-free forward path so the whole set stays mutually consistent.
        </Layer>
        <Arrow />

        <Layer kicker="construction" title="Bootstrap — QuantLib GlobalBootstrap">
          Each curve is solved in the domain its own instruments pin, and interpolated as a
          natural minimum-curvature cubic spline on <strong style={{ color: PRI }}>log
          discount factors</strong>. That choice is the load-bearing one: on log-DF the
          instantaneous forward is the spline&apos;s own first derivative, so it is C¹ with no
          maturity amplification. Interpolating zero rates instead leaves f = z + t·z′, where a
          cubic&apos;s third derivative jumps at every knot and is multiplied by t — measured
          here at 17–18× amplification by the long end.
          <br /><br />
          The bootstrap is <em>global</em>, not pillar-by-pillar: a min-curvature spline is a
          global interpolator, so every pillar reshapes the whole curve and a sequential solve
          cannot bracket the long end.
        </Layer>
        <Arrow />

        <Layer kicker="curves" title="Eight curves, two of them dependent">
          <Figure src="/diagrams/curve-graph.svg" source={curveSrc}
                  alt="Curve dependency graph: six curves build independently; EURIBOR 6M is discounted on ESTR and EUR under USD collateral takes SOFR as its USD leg." />
          <div className="mt-2">
            The meeting-dated and IMM curves are built in two stages: flat forwards between
            policy or IMM dates out to the last strip date, then the spline beyond, joined by
            pinning the strip zeros. A staircase is the correct shape there — the overnight
            rate is expected to be constant between policy meetings — so the interpolation is
            deliberately not smooth below the cut.
          </div>
        </Layer>
        <Arrow label="the same curve object, two ways" />

        <div className="grid gap-3 w-full" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
          <Layer kicker="path A" title="CPU — QuantLib reference" accent={CPU}>
            Prices and risks directly off the bootstrapped term structures. Market PV01 bumps
            one quote, re-runs the whole bootstrap and reprices, so the shock propagates
            through the interpolation the way it would on a desk.
          </Layer>
          <Layer kicker="path B" title="GPU — CUDA kernels" accent={GPU}>
            The device never rebuilds a curve. Each pillar interval is uploaded as four cubic
            coefficients plus its bounds; the kernel does a binary search and one Horner
            evaluation. Because the curve genuinely <em>is</em> piecewise cubic in the
            interpolated quantity, that upload is an identity rather than a fit.
          </Layer>
        </div>
        <Arrow />

        <Layer kicker="the check" title="Reconcile both paths">
          All 240 calibration instruments repriced down both paths and differenced, plus a
          direct curve-vs-curve comparison across every exported point. Current worst
          agreement <strong style={{ color: PRI }}>3.6 × 10⁻¹⁴</strong>. A separate check
          re-derives every input quote from the finished curve with its own conventions —
          all eight calibrate inside 0.01bp.
        </Layer>
        <Arrow />

        <Layer kicker="output" title="Exported JSON → this site">
          Curves, trades, cashflows, risk ladders and benchmarks are written as static JSON
          and served with the page. Nothing on this site computes a curve in the browser; it
          renders what the engine produced.
        </Layer>
      </div>

      <p className="text-xs mt-8 mb-3 font-mono uppercase tracking-wider" style={{ color: DIM }}>
        Decisions that cost the most to get wrong
      </p>
      <div className="rounded-lg overflow-hidden max-w-3xl" style={{ border: `1px solid ${EDGE}` }}>
        {[
          ['Interpolate log discount factors, not zeros',
           'On log-DF the forward is the spline derivative — C¹, no t-amplification. On zeros the forward inherits t·z‴ and rings at every knot.'],
          ['Use the library spline, not a bespoke one',
           'A hand-rolled minimum-curvature spline transposed the two off-diagonal weights in its tridiagonal system. Identical on uniform spacing, C²-discontinuous wherever spacing changes — 9 spurious turning points inside 10Y against the market path’s 1.'],
          ['Solve globally, not pillar-by-pillar',
           'A global interpolator has no bracketing sequential solve; the iterative bootstrap silently failed to converge on the long end.'],
          ['Pin the short end with instruments',
           'FRAs starting inside an uninstrumented region let the spline invent that shape. Synthetic deposits derived from OIS plus basis removed a 7.4bp kink at the deposit/FRA join.'],
          ['Ship coefficients to the GPU, not a curve',
           'The device evaluates a polynomial it did not build. Keeps the kernel branch-free and makes CPU/GPU agreement an identity to verify rather than a tolerance to argue about.'],
        ].map(([h, b], i) => (
          <div key={h} className="px-4 py-3"
               style={{ borderTop: i ? `1px solid ${EDGE}` : undefined, background: CARD }}>
            <div className="text-xs font-semibold mb-1" style={{ color: PRI }}>{h}</div>
            <div className="text-xs leading-relaxed" style={{ color: SEC }}>{b}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
