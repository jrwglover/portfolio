const topics = [
  'Rates Curve Bootstrapping',
  'IBOR & RFR Multi-Curve',
  'Credit Spread Decomposition',
  'Interpolation Methods',
  'Market PV01 Sensitivities',
  'Interest Rate Swaps',
  'DV01 & Risk Ladders',
  'Volatility Surfaces',
  'PCA Risk Compression',
  'Real-Time Market Data',
];

const techUsed = [
  'C++', 'CUDA', 'Python', 'QuantLib', 'TypeScript', 'React',
  'Flask', 'Express', 'NumPy/SciPy', 'WebSocket',
];

export default function About() {
  return (
    <section style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
      <div className="max-w-[1320px] mx-auto px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1px_1fr] gap-12">
          {/* Left */}
          <div>
            <h2 className="accent-line text-lg font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
              What you'll learn
            </h2>
            <div className="flex flex-wrap gap-2 mb-8">
              {topics.map((d) => (
                <span
                  key={d}
                  className="px-3 py-1.5 rounded text-xs font-medium"
                  style={{
                    background: 'rgba(192, 72, 0, 0.08)',
                    border: '1px solid rgba(192, 72, 0, 0.2)',
                    color: 'var(--accent-warm)',
                  }}
                >
                  {d}
                </span>
              ))}
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Each module covers a core area of market data and derivatives analytics,
              with interactive tools that let you explore real calculations — not just theory.
              Designed for traders, risk managers, and finance professionals at ING.
            </p>
          </div>

          {/* Divider */}
          <div className="hidden lg:block" style={{ background: 'var(--border-subtle)' }} />

          {/* Right */}
          <div>
            <h2 className="accent-line text-lg font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
              Technology under the hood
            </h2>
            <div className="flex flex-wrap gap-2 mb-8">
              {techUsed.map((t) => (
                <span
                  key={t}
                  className="font-mono px-3 py-1.5 rounded text-xs"
                  style={{
                    background: 'rgba(94, 170, 181, 0.08)',
                    border: '1px solid rgba(94, 170, 181, 0.15)',
                    color: 'var(--accent-cool)',
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Production-grade implementations using the same libraries and frameworks found in
              trading desk infrastructure: QuantLib for pricing, CUDA for GPU acceleration,
              and real-time WebSocket feeds for live market simulation.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
