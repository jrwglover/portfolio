export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.04] pointer-events-none"
        style={{ background: 'radial-gradient(circle, var(--accent-warm), transparent 70%)' }}
      />

      <div className="max-w-[1320px] mx-auto px-8 pt-28 pb-16">
        <div className="max-w-2xl">
          <p className="font-mono text-xs tracking-widest uppercase mb-6" style={{ color: 'var(--accent-warm)' }}>
            Financial Markets Engineering
          </p>

          <h1 className="text-[3.2rem] leading-[1.1] font-semibold mb-6 tracking-tight"
            style={{ color: 'var(--text-primary)' }}>
            Johnathon Glover
          </h1>

          <p className="text-lg leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
            Front-office pricing, risk and trade-flow infrastructure, built end to
            end and proven with numbers: a multi-curve framework whose GPU marks tie
            out to the reference library at machine precision; an end-of-day trade
            feed cut from ninety minutes to under four; a government bond curve
            engine validated to a hundredth of a basis point.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>
            Everything on this site runs. The curves are bootstrapped, the benchmarks
            are measured, and the reconciliations are exact — nothing is quoted that
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
