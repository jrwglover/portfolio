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

/* Which curve needs which. The two dependencies are the whole reason this is a
   framework rather than eight independent bootstraps: EURIBOR cannot be built
   without ESTR, and EUR/USD cannot be built without SOFR. */
function DependencyGraph() {
  const node = (x: number, y: number, w: number, label: string, sub: string, stroke: string) => (
    <g key={label}>
      <rect x={x} y={y} width={w} height="42" rx="5" fill={CARD} stroke={stroke} strokeWidth="1" />
      <text x={x + w / 2} y={y + 18} textAnchor="middle" fontSize="11.5" fill={PRI}
            fontFamily="ui-monospace, monospace">{label}</text>
      <text x={x + w / 2} y={y + 32} textAnchor="middle" fontSize="9.5" fill={DIM}>{sub}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 720 250" width="100%" role="img"
         aria-label="Curve dependency graph: EURIBOR 6M is projected on its own curve but discounted on ESTR; EUR under USD collateral is implied from SOFR plus FX swaps and cross-currency basis. The six other curves are independent.">
      <text x="0" y="12" fontSize="10" fill={DIM} fontFamily="ui-monospace, monospace">INDEPENDENT</text>
      {node(0, 22, 132, 'ESTR', 'tenor OIS', EDGE)}
      {node(146, 22, 132, 'ESTR ECB', 'meeting-dated', EDGE)}
      {node(292, 22, 132, 'ESTR IMM', 'IMM-dated', EDGE)}
      {node(438, 22, 132, 'ESTR IMM+fut', 'IMM + futures', EDGE)}
      {node(584, 22, 132, 'SOFR', 'USD OIS', EDGE)}
      {node(0, 96, 132, 'SONIA', 'GBP OIS', EDGE)}

      <text x="0" y="160" fontSize="10" fill={DIM} fontFamily="ui-monospace, monospace">DEPENDENT</text>
      {node(0, 170, 200, 'EURIBOR 6M', 'projection', '#8b7ec8')}
      {node(300, 170, 240, 'EUR under USD collateral', 'implied zero, xccy', '#4a9a68')}

      {/* ESTR discounts EURIBOR */}
      <path d="M66 64 L66 120 L100 120 L100 170" fill="none" stroke="#8b7ec8"
            strokeWidth="1.2" strokeDasharray="3 3" />
      <text x="106" y="124" fontSize="9.5" fill="#8b7ec8">discounts</text>

      {/* SOFR is the USD leg of the xccy build */}
      <path d="M650 64 L650 120 L420 120 L420 170" fill="none" stroke="#4a9a68"
            strokeWidth="1.2" strokeDasharray="3 3" />
      <text x="430" y="114" fontSize="9.5" fill="#4a9a68">USD leg</text>
    </svg>
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
          <DependencyGraph />
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
