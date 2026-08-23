import { useState } from 'react';
import ctxSrc from './diagrams/c4-context.mmd?raw';
import contSrc from './diagrams/c4-container.mmd?raw';
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
        C4 Level 1 · System Context
      </p>
      <Figure src="/diagrams/c4-context.svg" source={ctxSrc}
              alt="C4 system context: a quant reads marks and risk from the portfolio site; the rates engine takes instrument-typed quotes from market data, builds curves using QuantLib, and publishes frozen JSON to the site."
              caption="Who uses it and what it touches. Following C4 notation: every element carries a name, its [type] and a description, and every relationship states intent and the technology it uses." />

      <p className="text-xs mt-8 mb-2 font-mono uppercase tracking-wider" style={{ color: DIM }}>
        C4 Level 2 · Containers
      </p>
      <Figure src="/diagrams/c4-container.svg" source={contSrc}
              alt="C4 container diagram: inside the host process, curve construction writes eight term structures which feed coefficient extraction, the risk engine and reconciliation; coefficients cross to CUDA global memory by cudaMemcpy and are read by the evaluation kernels; both paths meet at reconciliation before results are exported."
              caption="Each container names its technology. The host/device split is a real boundary. One cudaMemcpy crosses it, and that copy is the only place the two paths can diverge, which is why reconciliation sits downstream of both." />

      <p className="text-xs mt-8 mb-2 font-mono uppercase tracking-wider" style={{ color: DIM }}>
        C4 supplementary · Dynamic view of one valuation run
      </p>
      <Figure src="/diagrams/valuation-run.svg" source={runSrc}
              alt="Sequence diagram of a valuation run: quotes are mapped to rate helpers; meeting- and IMM-dated curves take a two-stage path with a flat-forward strip pinned into a spline; all pillars are solved simultaneously; log discount factors are sampled per interval into cubic coefficients and copied to the device; CPU and GPU paths are then differenced over 227 instruments."
              caption="Sequence. The two-stage branch, the simultaneous pillar solve, and the fact that the coefficient upload is an identity rather than a fit are the three things that determine whether the numbers reconcile." />

      <p className="text-xs mt-8 mb-2 font-mono uppercase tracking-wider" style={{ color: DIM }}>
        How one curve gets built
      </p>
      <Figure src="/diagrams/construction.svg" source={buildSrc}
              alt="Flowchart of curve construction: each quote maps to a rate helper by instrument type; curves flagged short_end_step take a two-stage flat-forward-then-spline path composited at tCut, all others go straight to a log-cubic global bootstrap."
              caption="Construction. Every branch here exists because of a measured failure: the instrument-typed helper mapping, the two-stage build for policy-dated curves, and the log-discount-factor domain." />

      <div className="flex flex-col items-center max-w-3xl">
        <Layer kicker="1" title="Prices come in">
          The prices each curve is built from: deposits, OIS, futures, FRAs, swaps,
          FX swap points and cross currency basis, one file per valuation date. Each
          quote states what kind of instrument it is rather than leaving the builder
          to work it out from the tenor, which is where this usually goes wrong.
          The prices are synthetic, generated from a single arbitrage free forward
          path so the set is consistent with itself, and the file says so rather
          than leaving it to be assumed.
        </Layer>
        <Arrow />

        <Layer kicker="2" title="Curves are solved from them">
                    Each curve is solved from the instruments that pin it down, and a smooth
          shape is fitted between them. What that shape is fitted to matters more than
          which shape is used. Fitting it to discount factors keeps the forward rates
          smooth, because the forward is then the slope of the thing being fitted.
          Fitting it to zero rates instead leaves the forward depending on how fast the
          zero curve is bending, and that error grows with maturity: measured here it is
          seventeen to eighteen times worse at the long end. It is the kind of choice
          that is invisible until someone asks why the risk moved between buckets.
          <br /><br />
                    The curve is also solved as a whole rather than one point at a time. Because
          the fitted shape is smooth across the join, moving any one point changes the
          curve everywhere, so the points cannot be pinned down one after another.
        </Layer>
        <Arrow />

        <Layer kicker="3" title="Some curves are built on others">
          <Figure src="/diagrams/curve-graph.svg" source={curveSrc}
                  alt="Curve dependency graph: six curves build independently; EURIBOR 6M is discounted on ESTR; the EURUSD cross-currency curve takes SOFR as its USD leg; and the EUR/USD outright forwards are derived in the browser from that curve and SOFR." />
          <div className="mt-2">
                        Two of the curves are built in two parts. Out to the last policy or futures
            date the rate holds flat from one date to the next, then a smooth curve takes
            over beyond, joined so the two agree at the handover. A staircase is the right
            answer at the short end, because an overnight rate really does hold still
            between central bank meetings and then step. Smoothing through that would be
            describing something that does not happen.
            <br /><br />
            Two of the curves cannot be built until others exist. EURIBOR projects off
            its own prices but discounts on ESTR, so ESTR has to come first. The EUR
            under USD collateral curve is not built from EUR prices at all: it is implied
            from FX swap points and cross currency basis against the USD curve, so SOFR
            has to come first. Build them in the wrong order and it either fails outright
            or, worse, quietly builds on a curve that is out of date.
            <br /><br />
                        EURIBOR is built from the six month fixing and a run of overlapping forward
            rate agreements, which is how a desk quotes it: each one shares five of its
            six months with the next. Plot the most sensitive view of the curve and you
            can see a ripple of about 3bp between 6M and 2.5Y from that overlap. It is
            not an error in the curve. Recovering a rate at a point from a stack of
            near-identical six month averages means taking differences between numbers
            that barely differ, and the noise ends up there. The six month rate the
            agreements actually quote is smooth to within 0.63bp, which is why this never
            reaches a trading screen.
          </div>
        </Layer>
        <Arrow label="the same curve object, two ways" />

        <div className="grid gap-3 w-full" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
          <Layer kicker="4a" title="Valued on the processor" accent={CPU}>
                        Values and risk read straight off the curves as the library built them. For
            the hedging view, one quoted price is moved, the curve is rebuilt from
            scratch and the trade valued again, so the effect spreads through the curve
            the way it would on a desk.
          </Layer>
          <Layer kicker="4b" title="Valued on the GPU" accent={GPU}>
                        The GPU never rebuilds a curve. Each section of it is sent across as the
            handful of numbers that describe that section, and the GPU evaluates those
            directly. Because the curve genuinely <em>is</em> piecewise cubic in the
            interpolated quantity, that upload is an identity rather than a fit.
          </Layer>
        </div>
        <Arrow />

        <Layer kicker="5" title="The two are checked against each other">
          All 227 calibration instruments repriced down both paths and differenced, plus a
          direct curve-vs-curve comparison across every exported point. Current worst
          agreement 3.6 × 10⁻¹⁴. A separate check
          re-derives every input quote from the finished curve with its own conventions.
          All eight calibrate inside 0.01bp.
        </Layer>
        <Arrow />

        <Layer kicker="6" title="Results published to this site">
          Curves, trades, cashflows, risk ladders and benchmarks are written as static JSON
          and served with the page. The browser does no curve construction and no pricing: it
          renders what the engine produced. The one exception is the EUR/USD outright forward
          chart, which is computed client-side as spot times the ratio of the two discount
          factors, because it is a two-line identity off curves that are already published.
        </Layer>
      </div>

      <p className="text-xs mt-8 mb-3 font-mono uppercase tracking-wider" style={{ color: DIM }}>
        Decisions that cost the most to get wrong
      </p>
      <div className="rounded-lg overflow-hidden max-w-3xl" style={{ border: `1px solid ${EDGE}` }}>
        {[
          ['Interpolate log discount factors, not zeros',
           'On log-DF the forward is the spline derivative, so it is C¹ with no t-amplification. On zeros the forward inherits t·z‴ and rings at every knot.'],
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
