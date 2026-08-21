const TARGETS = [
  {
    n: '01',
    goal: 'Make GPU pricing trustworthy',
    how: 'a multi-curve rates engine whose CUDA marks match QuantLib to 10⁻¹⁴, verified on 233 instruments',
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

          <h1 className="text-3xl font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
            Johnathon Glover
          </h1>

          <p className="text-lg leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
            I&apos;ve spent about twelve years in markets technology: front-office quant work,
            quant risk, and product ownership of a pricing engine. Most of it comes back to
            the same two questions. Is the number right, and does it stay right once it has
            moved between systems.
          </p>

          <p className="text-base leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
            Outside work I swim, spend time with my dog Charlie, and write code because I
            enjoy it. That&apos;s how this site started.
          </p>

          <p className="text-base leading-relaxed mb-8" style={{ color: 'var(--text-secondary)' }}>
            The three projects here are problems I wanted to understand properly, so I built
            them rather than read about them. They run end to end: the curves bootstrap with
            real market conventions, the benchmarks are timed on this machine, and every GPU
            number is reconciled against QuantLib. Where something is still wrong, or only
            half solved, I&apos;ve said so.
          </p>

          <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-dim)' }}>
            Each project targets one problem:
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
