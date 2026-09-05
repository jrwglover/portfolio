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
      <div className="text-sm leading-relaxed" style={{ color: SEC }}>{children}</div>
    </div>
  );
}


/* Diagrams are Mermaid source in ./diagrams, pre-rendered to SVG by
   `npm run diagrams` (mermaid-cli). Rendering at build time keeps mermaid out
   of the runtime bundle and makes a broken diagram a build failure rather than
   a blank box in production. The source is shown on demand because a diagram
   you cannot diff is a screenshot. */
function Figure({ src, source, alt, caption, minWidth }:
  { src: string; source: string; alt: string; caption?: string; minWidth?: number }) {
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
          <img src={src} alt={alt} style={{ width: '100%', minWidth: minWidth ?? 520, display: 'block' }} />
        </div>
      )}
      {caption && <figcaption className="px-3 py-2 text-xs"
                              style={{ color: DIM, borderTop: `1px solid ${EDGE}` }}>{caption}</figcaption>}
    </figure>
  );
}

export default function ArchitecturePanel() {
  return (
    <div>
      <p className="text-sm mb-6 max-w-4xl" style={{ color: SEC }}>
        How the engine is put together. Everything priced is worked out twice, once
        through QuantLib and once on the GPU, and every run subtracts one answer from
        the other. A difference bigger than rounding fails the run.
      </p>

      <p className="text-sm mb-2 font-mono uppercase tracking-wider" style={{ color: DIM }}>
        C4 Level 1 · System Context
      </p>
      <Figure src="/diagrams/c4-context.svg" source={ctxSrc}
              alt="C4 system context: a quant reads marks and risk from the portfolio site; the rates engine takes instrument-typed quotes from market data, builds curves using QuantLib, and publishes frozen JSON to the site."
              caption="Who uses it and what it touches. C4 notation throughout, so every element carries a name, its [type] and a description, and every relationship states what it is for and what it runs on." />

      <p className="text-sm mt-8 mb-2 font-mono uppercase tracking-wider" style={{ color: DIM }}>
        C4 Level 2 · Containers
      </p>
      <Figure src="/diagrams/c4-container.svg" source={contSrc}
              alt="C4 container diagram: inside the host process, curve construction writes fourteen term structures which feed coefficient extraction, the risk engine and reconciliation; coefficients cross to CUDA global memory by cudaMemcpy and are read by the evaluation kernels; both paths meet at reconciliation before results are exported."
              caption="Each container names its technology. The host/device split is a real boundary. One cudaMemcpy crosses it, and that copy is the only place the two paths can diverge, which is why reconciliation sits downstream of both." />

      <p className="text-sm mt-8 mb-2 font-mono uppercase tracking-wider" style={{ color: DIM }}>
        C4 supplementary · Dynamic view of one valuation run
      </p>
      <Figure src="/diagrams/valuation-run.svg" source={runSrc}
              alt="Sequence diagram of a valuation run: quotes are mapped to rate helpers; curves are built in dependency order, with dual-curve and cross-currency builds attaching an already-built foreign curve; all pillars are solved simultaneously; per-interval coefficients are copied to the device; CPU and GPU paths are then differenced over 348 instruments."
              caption="Watch the build order and the simultaneous pillar solve. The device is sent the coefficients the curve is already made of, so the upload is exact, which is what lets the two paths reconcile." />

      <p className="text-sm mt-8 mb-2 font-mono uppercase tracking-wider" style={{ color: DIM }}>
        How one curve gets built
      </p>
      <Figure src="/diagrams/construction.svg" source={buildSrc}
              alt="Flowchart of curve construction: each quote maps to a rate helper chosen by its instrument type, including a float versus float basis swap helper for the 3s6s strip, and all of the helpers for a curve go into one global bootstrap that produces the calibrated term structure and its pillar dates, times and zeros."
              caption="Each instrument type gets its own helper, and one solve takes all of them together." />

      <div className="flex flex-col items-center max-w-4xl">
        <Layer kicker="1" title="Prices come in">
          Deposits, OIS, futures, FRAs, swaps, tenor basis swaps, FX swap points and
          cross currency basis, one file per valuation date. Each quote states its instrument type, so the
          builder never guesses from the tenor.
        </Layer>
        <Arrow />

        <Layer kicker="2" title="Curves are solved from them">
          Every pillar is solved at once, so a quote is repriced by the same finished
          curve it helped build. An earlier pillar-by-pillar version stopped converging
          on the long end, which is what put the global solve in.
        </Layer>
        <Arrow />

        <Layer kicker="3" title="Some curves are built on others">
          <Figure src="/diagrams/curve-graph.svg" source={curveSrc} minWidth={1000}
                  alt="Curve dependency graph: four pricing curves build independently, one per currency; EURIBOR 6M and the two BBSW curves are discounted on their currency's meeting-dated curve; the two BBSW curves are additionally linked by the 3s6s tenor basis strip and solve as a staged pair; each cross-currency curve takes SOFR as its USD leg and its own currency's meeting-dated curve as the other; the derived cheapest-to-deliver curve takes SOFR and both cross-currency curves as parents; the four comparison builds carry nothing; and the FX outright forwards are derived in the browser." />
          <div className="mt-2">
            EURIBOR discounts on the meeting-dated ESTR curve, and each cross currency
            curve is implied against SOFR, so those curves must exist first. Get the
            order wrong and the build fails or, worse, quietly runs on a stale curve.
            Two structures go further. The BBSW pair is a curve level cycle: each
            side's 3s6s basis swaps read the other curve, so the engine stages the
            pair and iterates the joint solve to a fixed point. The CTD curve is
            derived after everything: the pointwise max of its three parents'
            instantaneous forwards, zero volatility, no switch option value.
          </div>
        </Layer>
        <Arrow label="the same curve object, two ways" />

        <div className="grid gap-3 w-full" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
          <Layer kicker="4a" title="Valued on the processor" accent={CPU}>
            Values and risk read straight off the curves as the library built them.
            For the hedging view, one quoted price is moved, the curve rebuilt, the
            trade revalued.
          </Layer>
          <Layer kicker="4b" title="Valued on the GPU" accent={GPU}>
            The GPU never rebuilds a curve. It receives the numbers the curve is
            already made of and evaluates them directly; nothing is approximated on
            the way across.
          </Layer>
        </div>
        <Arrow />

        <Layer kicker="5" title="The two are checked against each other">
          All 348 calibration instruments repriced down both paths and differenced;
          worst agreement 5.4 × 10⁻¹⁴. A separate check re-derives every input quote
          from the finished curve; the worst residual is 0.04 of a basis point.
        </Layer>
        <Arrow />

        <Layer kicker="6" title="Results published to this site">
          Curves, trades, risk ladders and benchmarks are written as static JSON and
          served with the page. The browser prices nothing: it renders what the engine
          produced. The one exception is the FX forward chart, a two-line identity off
          curves already published.
        </Layer>
      </div>

      <p className="text-sm mt-8 mb-3 font-mono uppercase tracking-wider" style={{ color: DIM }}>
        Decisions that cost the most to get wrong
      </p>
      <div className="rounded-lg overflow-hidden max-w-4xl" style={{ border: `1px solid ${EDGE}` }}>
        {[
          ['Solve every pillar at once',
           'Pinning the pillars down one after another silently failed to converge on the long end. Solving them together fixed it.'],
          ['Pin the short end with instruments',
           'A region with no instrument in it leaves the curve free to take whatever shape it likes there. Synthetic deposits derived from OIS plus basis removed a 7.4bp kink at the deposit/FRA join.'],
          ['Ship coefficients to the GPU, not a curve',
           'The device evaluates numbers it did not produce, which keeps the kernel branch-free and makes CPU/GPU agreement something to verify rather than a tolerance to argue about.'],
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
