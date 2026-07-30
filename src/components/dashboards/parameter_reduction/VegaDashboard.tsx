import React, { useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell,
} from 'recharts';
import DashboardHeader from '../DashboardHeader';

/* ── Types ── */
type Regime = 'Low' | 'Medium' | 'High';
type RunStatus = 'idle' | 'running' | 'done';
type Tab = 'overview' | 'analysis' | 'surface' | 'report';

const REGIMES: Regime[] = ['Low', 'Medium', 'High'];

interface Method {
  name: string;
  variant: string;
  description: string;
  vrt: Record<Regime, number>;
  ava: Record<Regime, number>;
  color: string;
}

/* ── Static data ── */
const METHODS: Method[] = [
  {
    name: 'Economic PCA',
    variant: 'Statistical',
    description: 'Eigenvectors of historical vega covariance matrix',
    vrt: { Low: 0.992, Medium: 0.981, High: 0.963 },
    ava: { Low: 0.06, Medium: 0.12, High: 0.24 },
    color: '#5eaab5',
  },
  {
    name: 'Heston PCA',
    variant: 'Model',
    description: 'Sensitivities from Heston stochastic volatility calibration',
    vrt: { Low: 0.985, Medium: 0.962, High: 0.931 },
    ava: { Low: 0.09, Medium: 0.18, High: 0.32 },
    color: '#d4a853',
  },
  {
    name: 'SVI PCA',
    variant: 'Smile',
    description: 'Sensitivities from SVI parameterisation of vol surface',
    vrt: { Low: 0.990, Medium: 0.973, High: 0.952 },
    ava: { Low: 0.07, Medium: 0.15, High: 0.27 },
    color: '#8b7ec8',
  },
];

const STRIKES = ['80%', '90%', '95%', '100%', '105%', '110%', '120%', '140%'];
const EXPIRIES = ['1M', '3M', '6M', '1Y', '2Y', '5Y'];

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'analysis', label: 'Analysis' },
  { key: 'surface', label: 'Surface' },
  { key: 'report', label: 'Report' },
];

const VARIANCE_COMPONENTS: Record<Regime, { label: string; pct: number }[]> = {
  Low: [
    { label: 'PC1 (level)', pct: 82 },
    { label: 'PC2 (slope)', pct: 12 },
    { label: 'PC3 (curve)', pct: 4 },
    { label: 'PC4 (wing)', pct: 1.2 },
  ],
  Medium: [
    { label: 'PC1 (level)', pct: 76 },
    { label: 'PC2 (slope)', pct: 14 },
    { label: 'PC3 (curve)', pct: 6 },
    { label: 'PC4 (wing)', pct: 2.1 },
  ],
  High: [
    { label: 'PC1 (level)', pct: 68 },
    { label: 'PC2 (slope)', pct: 17 },
    { label: 'PC3 (curve)', pct: 8 },
    { label: 'PC4 (wing)', pct: 3.3 },
  ],
};

/* ── Surface generation ── */
function generateSurface(regime: Regime, reduced: boolean): number[][] {
  const base = regime === 'Low' ? 0.15 : regime === 'Medium' ? 0.22 : 0.35;
  const grid: number[][] = [];
  for (let s = 0; s < STRIKES.length; s++) {
    const row: number[] = [];
    for (let e = 0; e < EXPIRIES.length; e++) {
      const moneyness = Math.abs(s - 3.5) / 4;
      const termStructure = (e + 1) / EXPIRIES.length;
      let val = base * (1 + moneyness * 0.8) * (0.5 + termStructure * 0.7);
      const seed = (s * 7 + e * 13 + (regime === 'Low' ? 0 : regime === 'Medium' ? 37 : 71));
      const pseudo = Math.sin(seed) * 0.5 + 0.5;
      val += (pseudo - 0.5) * base * 0.3;
      if (reduced) {
        val = val * 0.92 + base * (1 + moneyness * 0.6) * (0.5 + termStructure * 0.6) * 0.08;
      }
      row.push(Math.max(0.01, val));
    }
    grid.push(row);
  }
  return grid;
}

function vegaToColor(val: number, maxVal: number): string {
  const t = Math.min(1, val / maxVal);
  if (t < 0.25) {
    const u = t / 0.25;
    return `rgb(${Math.round(20 + u * 20)}, ${Math.round(30 + u * 60)}, ${Math.round(120 + u * 40)})`;
  } else if (t < 0.5) {
    const u = (t - 0.25) / 0.25;
    return `rgb(${Math.round(40 + u * 40)}, ${Math.round(90 + u * 80)}, ${Math.round(160 - u * 40)})`;
  } else if (t < 0.75) {
    const u = (t - 0.5) / 0.25;
    return `rgb(${Math.round(80 + u * 130)}, ${Math.round(170 - u * 40)}, ${Math.round(120 - u * 60)})`;
  } else {
    const u = (t - 0.75) / 0.25;
    return `rgb(${Math.round(210 + u * 35)}, ${Math.round(130 - u * 60)}, ${Math.round(60 - u * 30)})`;
  }
}

const tooltipStyle = {
  contentStyle: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 6, fontSize: 12 },
  labelStyle: { color: '#8b8a97' },
};

/* ── Run button ── */
function RunButton({ label, status, onClick }: { label: string; status: RunStatus; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={status === 'running'}
      className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
      style={{
        background: status === 'running' ? 'var(--border-subtle)' : status === 'done' ? 'rgba(92,184,122,0.15)' : 'rgba(139,126,200,0.15)',
        color: status === 'running' ? 'var(--text-dim)' : status === 'done' ? 'var(--accent-green)' : 'var(--accent-purple)',
        border: `1px solid ${status === 'running' ? 'var(--border-subtle)' : status === 'done' ? 'rgba(92,184,122,0.3)' : 'rgba(139,126,200,0.3)'}`,
        cursor: status === 'running' ? 'wait' : 'pointer',
      }}
    >
      {status === 'running' ? (
        <span className="font-mono tracking-wider">Processing<span className="animate-pulse">...</span></span>
      ) : status === 'done' ? (
        <span>Complete</span>
      ) : label}
    </button>
  );
}

/* ── Heatmap grid component ── */
function HeatmapGrid({ label, data, maxVega }: { label: string; data: number[][]; maxVega: number }) {
  return (
    <div>
      <div className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>{label}</div>
      <div className="overflow-x-auto">
        <div className="flex gap-0.5 mb-0.5 pl-12">
          {EXPIRIES.map(exp => (
            <div key={exp} className="flex-1 min-w-[40px] text-center text-[9px] font-mono py-1" style={{ color: 'var(--text-dim)' }}>
              {exp}
            </div>
          ))}
        </div>
        {STRIKES.map((strike, s) => (
          <div key={strike} className="flex gap-0.5 mb-0.5">
            <div className="w-12 shrink-0 text-right pr-2 text-[9px] font-mono flex items-center justify-end" style={{ color: 'var(--text-dim)' }}>
              {strike}
            </div>
            {EXPIRIES.map((exp, e) => {
              const val = data[s][e];
              return (
                <div
                  key={exp}
                  className="flex-1 min-w-[40px] h-8 rounded-sm flex items-center justify-center transition-all duration-300"
                  style={{ background: vegaToColor(val, maxVega) }}
                  title={`${strike} x ${exp}: ${val.toFixed(3)}`}
                >
                  <span className="text-[8px] font-mono" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {val.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[9px]" style={{ color: 'var(--text-dim)' }}>Low</span>
        <div className="flex-1 h-2 rounded-full" style={{
          background: 'linear-gradient(90deg, rgb(20,30,120), rgb(40,90,160), rgb(80,170,120), rgb(210,130,60), rgb(245,70,30))',
        }} />
        <span className="text-[9px]" style={{ color: 'var(--text-dim)' }}>High</span>
      </div>
    </div>
  );
}

export default function VegaDashboard({ breadcrumb }: { defaultTab?: string; breadcrumb?: string[] } = {}) {
  /* ── UI state ── */
  const [tab, setTab] = useState<Tab>('overview');
  const [regime, setRegime] = useState<Regime>('Medium');
  const [pcaStatus, setPcaStatus] = useState<RunStatus>('idle');
  const [surfStatus, setSurfStatus] = useState<RunStatus>('idle');
  const [reportStatus, setReportStatus] = useState<RunStatus>('idle');

  /* ── Derived data ── */
  const vrtData = useMemo(() =>
    METHODS.map(m => ({ name: m.name, VRT: m.vrt[regime], color: m.color })),
  [regime]);

  const avaData = useMemo(() =>
    METHODS.map(m => ({ name: m.name, 'AVA%': m.ava[regime], color: m.color })),
  [regime]);

  const originalSurface = useMemo(() => generateSurface(regime, false), [regime]);
  const reducedSurface = useMemo(() => generateSurface(regime, true), [regime]);

  const maxVega = useMemo(() => {
    let mx = 0;
    originalSurface.forEach(row => row.forEach(v => { if (v > mx) mx = v; }));
    reducedSurface.forEach(row => row.forEach(v => { if (v > mx) mx = v; }));
    return mx;
  }, [originalSurface, reducedSurface]);

  /* ── Run handlers ── */
  const runPca = useCallback(() => {
    setPcaStatus('running');
    setTimeout(() => setPcaStatus('done'), 2000);
  }, []);
  const runSurface = useCallback(() => {
    setSurfStatus('running');
    setTimeout(() => setSurfStatus('done'), 2000);
  }, []);
  const runReport = useCallback(() => {
    setReportStatus('running');
    setTimeout(() => setReportStatus('done'), 2000);
  }, []);

  const downloadReport = useCallback(() => {
    const lines: string[] = [
      'VEGA PARAMETER REDUCTION REPORT',
      '================================',
      `Generated: ${new Date().toISOString()}`,
      '',
      'Compression: 5 parameters -> 4 observables',
      '',
    ];
    for (const r of REGIMES) {
      lines.push(`--- ${r} Volatility Regime ---`);
      lines.push('');
      for (const m of METHODS) {
        const vrt = m.vrt[r];
        const pass = vrt >= 0.95;
        lines.push(`  ${m.name} (${m.variant})`);
        lines.push(`    VRT:  ${vrt.toFixed(3)}  ${pass ? 'PASS' : 'FAIL'}`);
        lines.push(`    AVA:  ${m.ava[r].toFixed(2)}%`);
        lines.push('');
      }
    }
    lines.push('--- Variance Explained per Component ---');
    for (const r of REGIMES) {
      lines.push(`  ${r}: ${VARIANCE_COMPONENTS[r].map(c => `${c.label}=${c.pct}%`).join(', ')}`);
    }
    lines.push('');
    lines.push('Methodology: PCA-based compression of options vega risk across three basis choices (Economic, Heston, SVI) under CRR2/FRTB regulatory framework.');
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'vega_parameter_reduction_report.txt'; a.click();
    URL.revokeObjectURL(url);
  }, []);

  /* ── Regime selector component ── */
  const regimeSelector = (
    <div className="flex items-center gap-4 mb-8">
      <span className="text-xs font-mono" style={{ color: 'var(--text-dim)' }}>Volatility Regime</span>
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        {REGIMES.map(r => (
          <button
            key={r}
            onClick={() => setRegime(r)}
            className="px-4 py-1.5 rounded text-xs font-medium transition-all"
            style={{
              background: regime === r ? 'var(--accent-purple)' : 'transparent',
              color: regime === r ? '#0a0a0f' : 'var(--text-secondary)',
            }}
          >
            {r} Vol
          </button>
        ))}
      </div>
      <span className="text-[10px] font-mono ml-2" style={{
        color: regime === 'High' ? 'var(--accent-red)' : regime === 'Medium' ? 'var(--accent-warm)' : 'var(--accent-green)',
      }}>
        {regime === 'High' ? 'Stress scenario - compression degrades' : regime === 'Medium' ? 'Normal market conditions' : 'Benign environment'}
      </span>
    </div>
  );

  return (
    <div className="max-w-[1320px] mx-auto px-8 py-14">
      <DashboardHeader
        label={breadcrumb ? breadcrumb.slice(0, -1).join(' > ') : 'Quantitative Research'}
        title={breadcrumb ? breadcrumb[breadcrumb.length - 1] : 'Vega Parameter Reduction'}
        subtitle="PCA-based compression of options vega risk: comparing three basis choices across volatility regimes under CRR2/FRTB"
        techBadges={['Python', 'NumPy', 'SciPy', 'Heston', 'SVI', 'PCA', 'Recharts']}
        accentColor="var(--accent-purple)"
      />

      {/* Tab bar */}
      <div className="flex gap-1 mb-8 p-1 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', width: 'fit-content' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded text-sm font-medium transition-all"
            style={{
              background: tab === t.key ? 'var(--accent-purple)' : 'transparent',
              color: tab === t.key ? '#0a0a0f' : 'var(--text-secondary)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════ OVERVIEW TAB ═══════════ */}
      {tab === 'overview' && (
        <>
          {/* Intro */}
          <div className="glass-card rounded-lg p-6 mb-8" style={{ cursor: 'default' }}>
            <h3 className="accent-line text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>What is vega parameter reduction?</h3>
            <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <p>
                Options trading desks hold positions across a grid of strikes and expiries, creating a
                high-dimensional vega surface. Each point on this surface represents the portfolio's sensitivity
                to a 1% change in implied volatility at that strike/expiry combination.
              </p>
              <p>
                For regulatory capital calculations under CRR2/FRTB, this risk must be expressed in terms of
                a reduced set of observable market parameters. Principal Component Analysis (PCA) compresses
                the original 5 risk factors (ATM level, skew, convexity, term slope, wing decay) down to
                4 observable principal components while preserving &gt;95% of variance.
              </p>
              <p>
                The key challenge is choosing the right basis for PCA decomposition. This project compares
                three approaches to determine which provides the best compression with the lowest residual
                risk (AVA) across different volatility regimes.
              </p>
            </div>
          </div>

          {/* Key metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Input parameters', value: '5', sub: 'risk factors per surface' },
              { label: 'Output observables', value: '4', sub: 'PCA components retained' },
              { label: 'VRT threshold', value: '0.95', sub: 'minimum variance explained' },
              { label: 'Methods compared', value: '3', sub: 'Economic, Heston, SVI' },
            ].map(m => (
              <div key={m.label} className="glass-card rounded-lg p-6" style={{ cursor: 'default' }}>
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-dim)' }}>{m.label}</p>
                <p className="stat-value font-mono text-xl" style={{ color: 'var(--accent-purple)' }}>{m.value}</p>
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-dim)' }}>{m.sub}</p>
              </div>
            ))}
          </div>

          {/* Method descriptions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {METHODS.map(m => (
              <div key={m.name} className="glass-card rounded-lg p-6" style={{ cursor: 'default' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                  <h4 className="text-sm font-semibold" style={{ color: m.color }}>{m.name}</h4>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{
                    background: 'rgba(255,255,255,0.03)', color: 'var(--text-dim)', border: '1px solid var(--border-subtle)',
                  }}>
                    {m.variant}
                  </span>
                </div>
                <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{m.description}</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'var(--text-dim)' }}>Best VRT (Low vol)</span>
                    <span className="font-mono" style={{ color: 'var(--accent-green)' }}>{m.vrt.Low.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'var(--text-dim)' }}>Worst VRT (High vol)</span>
                    <span className="font-mono" style={{ color: m.vrt.High >= 0.95 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{m.vrt.High.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'var(--text-dim)' }}>Best AVA (Low vol)</span>
                    <span className="font-mono" style={{ color: 'var(--accent-cool)' }}>{m.ava.Low.toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Methodology */}
          <div className="glass-card rounded-lg p-6" style={{ cursor: 'default' }}>
            <h3 className="accent-line text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Regulatory context</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <p>
                  Under CRR2 and FRTB, banks must hold capital against the residual risk that arises when
                  a high-dimensional risk surface is compressed to a smaller set of hedgeable parameters.
                </p>
                <p>
                  The Additional Valuation Adjustment (AVA) quantifies the expected P&amp;L leakage from this
                  compression. Lower AVA means better hedge quality and reduced capital requirements.
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex gap-3 p-3 rounded" style={{ background: 'rgba(92,184,122,0.05)', border: '1px solid rgba(92,184,122,0.1)' }}>
                  <span className="text-lg font-bold font-mono" style={{ color: 'var(--accent-green)' }}>&ge;0.95</span>
                  <div>
                    <div className="text-xs font-medium" style={{ color: 'var(--accent-green)' }}>Variance Ratio Test</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Explained variance must exceed 95%</div>
                  </div>
                </div>
                <div className="flex gap-3 p-3 rounded" style={{ background: 'rgba(94,170,181,0.05)', border: '1px solid rgba(94,170,181,0.1)' }}>
                  <span className="text-lg font-bold font-mono" style={{ color: 'var(--accent-cool)' }}>AVA</span>
                  <div>
                    <div className="text-xs font-medium" style={{ color: 'var(--accent-cool)' }}>Additional Valuation Adjustment</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Residual P&amp;L from compression under CRR2</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══════════ ANALYSIS TAB ═══════════ */}
      {tab === 'analysis' && (
        <>
          {regimeSelector}

          <div className="flex items-center gap-4 mb-8">
            <RunButton label="Run PCA Analysis" status={pcaStatus} onClick={runPca} />
            {pcaStatus === 'done' && (
              <span className="text-xs font-mono" style={{ color: 'var(--text-dim)' }}>
                PCA decomposition complete -- {regime} volatility regime
              </span>
            )}
          </div>

          {pcaStatus === 'done' && (
            <>
              {/* Method comparison cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                {METHODS.map(m => {
                  const vrt = m.vrt[regime];
                  const ava = m.ava[regime];
                  const pass = vrt >= 0.95;
                  return (
                    <div key={m.name} className="glass-card rounded-lg p-6" style={{ cursor: 'default' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{m.name}</h3>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{
                          background: 'rgba(255,255,255,0.03)', color: 'var(--text-dim)', border: '1px solid var(--border-subtle)',
                        }}>
                          {m.variant}
                        </span>
                      </div>
                      <p className="text-xs mb-5" style={{ color: 'var(--text-dim)' }}>{m.description}</p>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>VRT</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold" style={{ color: pass ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                              {vrt.toFixed(3)}
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{
                              background: pass ? 'rgba(92,184,122,0.1)' : 'rgba(199,95,95,0.1)',
                              color: pass ? 'var(--accent-green)' : 'var(--accent-red)',
                              border: `1px solid ${pass ? 'rgba(92,184,122,0.2)' : 'rgba(199,95,95,0.2)'}`,
                            }}>
                              {pass ? 'PASS' : 'FAIL'}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>AVA (%)</span>
                          <span className="font-mono text-sm font-bold" style={{ color: 'var(--accent-cool)' }}>{ava.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Compression</span>
                          <span className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>5 &rarr; 4</span>
                        </div>
                      </div>

                      {/* VRT bar */}
                      <div className="mt-4 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${vrt * 100}%`,
                            background: pass ? `linear-gradient(90deg, ${m.color}, var(--accent-green))` : 'var(--accent-red)',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Charts: VRT + AVA */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
                <div className="glass-card rounded-lg p-6" style={{ cursor: 'default' }}>
                  <h3 className="accent-line text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Variance Ratio Test</h3>
                  <p className="text-xs mb-4" style={{ color: 'var(--text-dim)' }}>
                    Explained variance after PCA reduction ({regime} vol regime)
                  </p>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={vrtData} margin={{ top: 10, right: 10, bottom: 5, left: 10 }}>
                      <CartesianGrid stroke="#1a1a28" strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fill: '#55546a', fontSize: 11 }} />
                      <YAxis domain={[0.9, 1.0]} tick={{ fill: '#55546a', fontSize: 11 }} tickFormatter={(v: number) => v.toFixed(2)} />
                      <Tooltip {...tooltipStyle} formatter={(v: any) => [v.toFixed(3), 'VRT']} />
                      <ReferenceLine y={0.95} stroke="var(--accent-red)" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: '0.95 threshold', position: 'right', fill: 'var(--accent-red)', fontSize: 10 }} />
                      <Bar dataKey="VRT" radius={[4, 4, 0, 0]}>
                        {vrtData.map((entry, i) => (
                          <Cell key={i} fill={entry.VRT >= 0.95 ? entry.color : '#c75f5f'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="glass-card rounded-lg p-6" style={{ cursor: 'default' }}>
                  <h3 className="accent-line text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Additional Valuation Adjustment</h3>
                  <p className="text-xs mb-4" style={{ color: 'var(--text-dim)' }}>
                    Residual P&amp;L from compression ({regime} vol regime) -- lower is better
                  </p>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={avaData} margin={{ top: 10, right: 10, bottom: 5, left: 10 }}>
                      <CartesianGrid stroke="#1a1a28" strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fill: '#55546a', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#55546a', fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} />
                      <Tooltip {...tooltipStyle} formatter={(v: any) => [`${v.toFixed(2)}%`, 'AVA']} />
                      <Bar dataKey="AVA%" radius={[4, 4, 0, 0]}>
                        {avaData.map((_, i) => (
                          <Cell key={i} fill={METHODS[i].color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ═══════════ SURFACE TAB ═══════════ */}
      {tab === 'surface' && (
        <>
          {regimeSelector}

          <div className="flex items-center gap-4 mb-8">
            <RunButton label="Generate Vega Surfaces" status={surfStatus} onClick={runSurface} />
            {surfStatus === 'done' && (
              <span className="text-xs font-mono" style={{ color: 'var(--text-dim)' }}>
                {STRIKES.length}x{EXPIRIES.length} surface generated -- {regime} vol regime
              </span>
            )}
          </div>

          {surfStatus === 'done' && (
            <>
              <div className="glass-card rounded-lg p-6 mb-8" style={{ cursor: 'default' }}>
                <h3 className="accent-line text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Vega Surface Comparison</h3>
                <p className="text-xs mb-5" style={{ color: 'var(--text-dim)' }}>
                  Original (5-param) vs PCA-reduced (4-param) vega surface -- {regime} volatility regime
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <HeatmapGrid label="Original Surface (5 parameters)" data={originalSurface} maxVega={maxVega} />
                  <HeatmapGrid label="Reduced Surface (4 parameters)" data={reducedSurface} maxVega={maxVega} />
                </div>
              </div>

              {/* Residual analysis */}
              <div className="glass-card rounded-lg p-6" style={{ cursor: 'default' }}>
                <h3 className="accent-line text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Compression residuals</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <th className="text-left py-2 px-2 font-medium">Strike</th>
                        {EXPIRIES.map(e => (
                          <th key={e} className="text-right py-2 px-2 font-medium">{e}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {STRIKES.map((strike, s) => (
                        <tr key={strike} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td className="py-2 px-2 font-mono" style={{ color: 'var(--text-secondary)' }}>{strike}</td>
                          {EXPIRIES.map((_, e) => {
                            const diff = Math.abs(originalSurface[s][e] - reducedSurface[s][e]);
                            return (
                              <td key={e} className="py-2 px-2 text-right font-mono" style={{
                                color: diff < 0.005 ? 'var(--accent-green)' : diff < 0.01 ? 'var(--accent-warm)' : 'var(--accent-red)',
                              }}>
                                {diff.toFixed(4)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ═══════════ REPORT TAB ═══════════ */}
      {tab === 'report' && (
        <>
          <div className="flex items-center gap-4 mb-8">
            <RunButton label="Generate Full Report" status={reportStatus} onClick={runReport} />
            {reportStatus === 'done' && (
              <button
                onClick={downloadReport}
                className="px-4 py-2 rounded-lg text-xs font-mono transition-all"
                style={{
                  background: 'rgba(94,170,181,0.1)',
                  color: 'var(--accent-cool)',
                  border: '1px solid rgba(94,170,181,0.2)',
                  cursor: 'pointer',
                }}
              >
                Download Report
              </button>
            )}
          </div>

          {reportStatus === 'done' && (
            <>
              {/* Compression summary */}
              <div className="glass-card rounded-lg p-6 mb-8" style={{ cursor: 'default' }}>
                <h3 className="accent-line text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Compression summary</h3>
                <div className="flex items-center justify-center gap-4 py-4 mb-6">
                  <div className="text-center">
                    <div className="flex flex-col gap-1.5">
                      {['ATM level', 'Skew', 'Convexity', 'Term slope', 'Wing decay'].map(p => (
                        <div key={p} className="px-3 py-1.5 rounded text-[10px] font-mono" style={{
                          background: 'rgba(139,126,200,0.1)', color: 'var(--accent-purple)', border: '1px solid rgba(139,126,200,0.2)',
                        }}>
                          {p}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>5 parameters</div>
                  </div>
                  <div className="flex flex-col items-center gap-1 px-4">
                    <div className="text-2xl" style={{ color: 'var(--accent-purple)' }}>&rarr;</div>
                    <div className="text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>PCA</div>
                  </div>
                  <div className="text-center">
                    <div className="flex flex-col gap-1.5">
                      {['PC1 (level)', 'PC2 (slope)', 'PC3 (curve)', 'PC4 (wing)'].map(p => (
                        <div key={p} className="px-3 py-1.5 rounded text-[10px] font-mono" style={{
                          background: 'rgba(92,184,122,0.1)', color: 'var(--accent-green)', border: '1px solid rgba(92,184,122,0.2)',
                        }}>
                          {p}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>4 observables</div>
                  </div>
                </div>

                {/* Variance explained bars for each regime */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {REGIMES.map(r => (
                    <div key={r} className="p-4 rounded-lg" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                      <div className="text-xs font-semibold mb-3" style={{
                        color: r === 'High' ? 'var(--accent-red)' : r === 'Medium' ? 'var(--accent-warm)' : 'var(--accent-green)',
                      }}>
                        {r} Volatility
                      </div>
                      <div className="space-y-1.5">
                        {VARIANCE_COMPONENTS[r].map(c => (
                          <div key={c.label} className="flex items-center gap-2">
                            <span className="text-[10px] font-mono w-20 shrink-0" style={{ color: 'var(--text-dim)' }}>{c.label}</span>
                            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${c.pct}%`, background: 'var(--accent-purple)' }} />
                            </div>
                            <span className="text-[10px] font-mono w-10 text-right" style={{ color: 'var(--text-secondary)' }}>{c.pct}%</span>
                          </div>
                        ))}
                        <div className="flex items-center gap-2 pt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <span className="text-[10px] font-mono w-20 shrink-0" style={{ color: 'var(--text-dim)' }}>Total</span>
                          <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--accent-green)' }}>
                            {VARIANCE_COMPONENTS[r].reduce((s, c) => s + c.pct, 0).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pass/fail summary per method per regime */}
              <div className="glass-card rounded-lg p-6 mb-8" style={{ cursor: 'default' }}>
                <h3 className="accent-line text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Pass / fail summary</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <th className="text-left py-2 px-3 font-medium">Method</th>
                        {REGIMES.map(r => (
                          <th key={r} className="text-center py-2 px-3 font-medium" colSpan={2}>{r} Vol</th>
                        ))}
                      </tr>
                      <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <th className="py-1 px-3"></th>
                        {REGIMES.map(r => (
                          <React.Fragment key={r}>
                            <th className="text-center py-1 px-2 font-medium text-[10px]">VRT</th>
                            <th className="text-center py-1 px-2 font-medium text-[10px]">AVA%</th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {METHODS.map(m => (
                        <tr key={m.name} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: m.color }} />
                              <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{m.name}</span>
                            </div>
                          </td>
                          {REGIMES.map(r => {
                            const vrt = m.vrt[r];
                            const pass = vrt >= 0.95;
                            return (
                              <React.Fragment key={r}>
                                <td className="py-2.5 px-2 text-center">
                                  <span className="font-mono font-bold" style={{ color: pass ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                    {vrt.toFixed(3)}
                                  </span>
                                  <span className="text-[9px] font-mono ml-1 px-1 py-0.5 rounded" style={{
                                    background: pass ? 'rgba(92,184,122,0.1)' : 'rgba(199,95,95,0.1)',
                                    color: pass ? 'var(--accent-green)' : 'var(--accent-red)',
                                  }}>
                                    {pass ? 'PASS' : 'FAIL'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-2 text-center font-mono" style={{ color: 'var(--accent-cool)' }}>
                                  {m.ava[r].toFixed(2)}%
                                </td>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Full results card */}
              <div className="glass-card rounded-lg p-6" style={{ cursor: 'default' }}>
                <h3 className="accent-line text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Detailed results</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {REGIMES.map(r => (
                    <div key={r} className="p-4 rounded-lg" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                      <div className="text-xs font-semibold mb-3" style={{
                        color: r === 'High' ? 'var(--accent-red)' : r === 'Medium' ? 'var(--accent-warm)' : 'var(--accent-green)',
                      }}>
                        {r} Volatility Regime
                      </div>
                      <div className="space-y-3">
                        {METHODS.map(m => {
                          const vrt = m.vrt[r];
                          const pass = vrt >= 0.95;
                          return (
                            <div key={m.name} className="p-2 rounded" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} />
                                <span className="text-[11px] font-medium" style={{ color: m.color }}>{m.name}</span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span style={{ color: 'var(--text-dim)' }}>VRT</span>
                                <span className="font-mono font-bold" style={{ color: pass ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                  {vrt.toFixed(3)} {pass ? 'PASS' : 'FAIL'}
                                </span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span style={{ color: 'var(--text-dim)' }}>AVA</span>
                                <span className="font-mono" style={{ color: 'var(--accent-cool)' }}>{m.ava[r].toFixed(2)}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
