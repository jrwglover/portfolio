const TARGETS = [
  {
    n: '01',
    goal: 'Make GPU pricing trustworthy',
    how: 'a multi-curve rates engine whose CUDA marks match QuantLib to 10⁻¹⁴, verified on 348 instruments',
  },
  {
    n: '02',
    goal: 'Speed up a slow trade feed',
    how: 'the end-of-day trade feed from trade capture to the risk platform, rebuilt in Spark, with the file-to-database load measured 21.5× faster',
  },
  {
    n: '03',
    goal: 'Keep curves current as prices move',
    how: 'an event driven engine that rebuilds only the curves a price change affects, and never shows a half updated set',
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
            I&apos;ve spent about twelve years in markets technology, across front-office
            quant work, quant risk and product ownership of a pricing engine. Most of that
            work comes back to whether a number is right, and whether it stays right once
            it has moved between systems.
          </p>

          <p className="text-base leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
            Outside work I swim and spend time with my dog Charlie. I also write code for
            the fun of it, and that&apos;s how this site started.
          </p>

          <p className="text-base leading-relaxed mb-8" style={{ color: 'var(--text-secondary)' }}>
            Below is the platform I built, a linear rates engine, written up as chapters
            you can read in order. The curves follow real market conventions, and I timed
            every benchmark on this machine. Where something is still wrong or unfinished,
            I say so on the page.
          </p>

          <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-dim)' }}>
            Three problems it set out to solve:
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
            Every result quoted on the site was produced by these systems.
          </p>

          <div className="flex gap-3 mt-9">
            <a href="#project" className="font-mono text-xs px-5 py-2.5 rounded"
              style={{ background: 'var(--accent-warm)', color: '#0a0a0f' }}>
              The project &darr;
            </a>
            <a href="#chapters" className="font-mono text-xs px-5 py-2.5 rounded"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Chapters
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
