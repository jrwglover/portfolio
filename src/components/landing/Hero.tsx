const TARGETS = [
  { n: '01', goal: 'Live risk and P&L', how: 'an event-driven engine that rebuilds the curves a price change touches, then refreshes value, risk, VaR and limits on every set, with P&L attribution between marks' },
  { n: '02', goal: 'Curve construction and risk', how: 'multi-curve bootstrapping in C++ on QuantLib, with a CUDA lane that matches the reference library to 1e-14' },
  { n: '03', goal: 'Valuation control', how: 'end-of-day marking, IPV and the prudent valuation AVAs, all on the same book' },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.04] pointer-events-none"
        style={{ background: 'radial-gradient(circle, var(--accent-warm), transparent 70%)' }}
      />

      <div className="max-w-[1320px] mx-auto px-8 pt-28 pb-16">
        <div className="max-w-3xl">
          <p className="font-mono text-xs tracking-widest uppercase mb-6" style={{ color: 'var(--accent-warm)' }}>
            Financial Markets Engineering
          </p>

          <h1 className="text-3xl font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
            Johnathon Glover
          </h1>

          <p className="text-lg leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
            Quant developer and engineer in interest rate derivatives. Twelve years across front-office
            quant work, quant risk and product ownership of a pricing engine.
          </p>

          <p className="text-base leading-relaxed mb-8" style={{ color: 'var(--text-secondary)' }}>
            This site is one working project, a linear rates engine, which you can open and
            use. It covers three areas:
          </p>

          <ul className="space-y-4 mb-8">
            {TARGETS.map(t => (
              <li key={t.n} className="flex gap-4 items-baseline">
                <span className="font-mono text-xs shrink-0" style={{ color: 'var(--accent-warm)' }}>{t.n}</span>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t.goal}</span>
                  <span style={{ color: 'var(--text-dim)' }}>: </span>
                  {t.how}
                </p>
              </li>
            ))}
          </ul>

          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>
            All data on the site is generated, and every number comes from a run of the engine.
          </p>

          <div className="flex gap-3 mt-9">
            <a href="#project" className="font-mono text-xs px-5 py-2.5 rounded"
              style={{ background: 'var(--accent-warm)', color: '#0a0a0f' }}>
              The project &darr;
            </a>
            <a href="#workflow" className="font-mono text-xs px-5 py-2.5 rounded"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              The workflow
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
