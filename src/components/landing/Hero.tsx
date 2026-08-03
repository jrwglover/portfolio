const TARGETS = [
  {
    n: '01',
    goal: 'Make GPU pricing trustworthy',
    how: 'a multi-curve rates engine whose CUDA marks match QuantLib to 10⁻⁹ or better, verified on 240 instruments',
  },
  {
    n: '02',
    goal: 'Fix a 90-minute trade feed',
    how: 'the end-of-day feed from trade capture to risk, rebuilt in Spark and measured at 3.6 minutes, 25× faster',
  },
  {
    n: '03',
    goal: 'Explain a bond’s yield',
    how: 'Bund zero curves bootstrapped from prices, with yield split into risk-free, sovereign and credit spread, rebuilt live on every edit',
  },
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

          <p className="text-lg leading-relaxed mb-8" style={{ color: 'var(--text-secondary)' }}>
            I solve front-office problems in pricing, risk and trade flow, and
            prove the solutions with numbers. Three projects, each targeting one problem:
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
            Everything on this site runs. The curves are bootstrapped, the benchmarks
            are measured, and the reconciliations are exact. Nothing is quoted that
            the systems did not produce.
          </p>

          <div className="flex gap-3 mt-9">
            <a href="#projects" className="font-mono text-xs px-5 py-2.5 rounded"
              style={{ background: 'var(--accent-warm)', color: '#0a0a0f' }}>
              The three projects &darr;
            </a>
            <a href="#modules" className="font-mono text-xs px-5 py-2.5 rounded"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Interactive demos
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
