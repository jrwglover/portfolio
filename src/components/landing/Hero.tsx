export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Gradient orb */}
      <div
        className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.04] pointer-events-none"
        style={{ background: 'radial-gradient(circle, var(--accent-warm), transparent 70%)' }}
      />

      <div className="max-w-[1320px] mx-auto px-8 pt-28 pb-20">
        <div className="max-w-2xl">
          <p
            className="font-mono text-xs tracking-widest uppercase mb-6"
            style={{ color: 'var(--accent-warm)' }}
          >
            ING Data Analytics
          </p>

          <h1
            className="text-[3.2rem] leading-[1.1] font-semibold mb-8 tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Market Data{' '}
            <span style={{ color: 'var(--accent-warm)' }}>Lab</span>
          </h1>

          <p
            className="text-base leading-relaxed mb-10 max-w-lg"
            style={{ color: 'var(--text-secondary)' }}
          >
            Interactive tools for understanding curve construction, derivatives pricing,
            risk analytics, and high-performance numerics. Built for traders, risk managers,
            and quantitative analysts.
          </p>

          <a
            href="#modules"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-all"
            style={{
              background: 'var(--accent-warm)',
              color: '#0a0a0f',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Explore modules
            <span className="text-xs">&darr;</span>
          </a>
        </div>

        {/* Stats strip */}
        <div
          className="mt-20 grid grid-cols-4 gap-px rounded-lg overflow-hidden"
          style={{ background: 'var(--border-subtle)' }}
        >
          {[
            { value: '17', label: 'Interactive modules' },
            { value: 'C++/CUDA', label: 'High-performance numerics' },
            { value: '9', label: 'Currencies covered' },
            { value: 'Live', label: 'Real-time pricing engines' },
          ].map((s) => (
            <div key={s.label} className="px-6 py-5" style={{ background: 'var(--bg-card)' }}>
              <div className="stat-value text-lg font-semibold" style={{ color: 'var(--accent-warm)' }}>
                {s.value}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
