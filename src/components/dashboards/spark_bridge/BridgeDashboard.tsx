import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import DashboardHeader from '../DashboardHeader';

type Tab = 'problem' | 'pipeline' | 'benchmarks';
const TABS: { key: Tab; label: string }[] = [
  { key: 'problem', label: 'The Problem' },
  { key: 'pipeline', label: 'The Pipeline' },
  { key: 'benchmarks', label: 'Measured Benchmarks' },
];

const chartGrid = '#1a1a28';
const chartAxis = '#55546a';
const tt = {
  contentStyle: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 6, fontSize: 12 },
  labelStyle: { color: '#8b8a97' },
};

/* All numbers below are MEASURED (see spark_trade_bridge/BENCHMARKS*.md) */
const E2E = [
  { name: 'Legacy monolithic hand-off', mins: 89.4, color: '#c86e6e' },
  { name: 'Spark bridge (measured throttle)', mins: 3.6, color: '#5cb87a' },
];
const DBWRITE = [
  { name: '1 thread, 1 connection', rps: 2137, secs: 484.8, color: '#c86e6e' },
  { name: 'Spark: 8 connections x 10k batches', rps: 105000, secs: 9.9, color: '#5cb87a' },
];
const SIZES = [
  { name: 'Exploded legacy file', mb: 244, color: '#c86e6e' },
  { name: 'Nested Parquet', mb: 16, color: '#5cb87a' },
];

function Stat({ v, l, accent }: { v: string; l: string; accent?: string }) {
  return (
    <div className="rounded p-4" style={{ background: '#12121a', border: '1px solid var(--border-subtle)' }}>
      <div className="font-mono text-xl" style={{ color: accent ?? 'var(--text-primary)' }}>{v}</div>
      <div className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>{l}</div>
    </div>
  );
}

function Stage({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded p-5" style={{ background: '#12121a', border: '1px solid var(--border-subtle)' }}>
      <div className="font-mono text-xs mb-2" style={{ color: '#5b8fc9' }}>{n}</div>
      <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{title}</div>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{body}</p>
    </div>
  );
}

export default function BridgeDashboard({ defaultTab, breadcrumb }: { defaultTab?: string; breadcrumb?: string[] }) {
  const [tab, setTab] = useState<Tab>((defaultTab as Tab) ?? 'problem');
  const chip = (active: boolean) => ({
    border: `1px solid ${active ? '#5b8fc9' : 'var(--border-subtle)'}`,
    color: active ? '#5b8fc9' : 'var(--text-dim)',
    background: active ? '#5b8fc918' : 'transparent',
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <DashboardHeader
        label={(breadcrumb ?? ['Data Engineering']).join(' / ')}
        title="Spark Trade Bridge"
        subtitle="End-of-day trade feed for a rates & inflation non-linear book: capture extract, pricing preparation, risk database load"
        techBadges={['PySpark', 'Parquet', 'SQL Server', 'Docker']}
      />
      <div className="flex gap-2 mb-8 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="font-mono text-xs px-4 py-2 rounded" style={chip(tab === t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'problem' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <Stat v="700MB–1GB" l="daily trade export (swaps, caps, floors, swaptions, inflation)" />
            <Stat v="~1.5 hours" l="observed write to cloud virtual disk" accent="#c86e6e" />
            <Stat v="0.19 MB/s" l="effective throughput — a format problem, not bandwidth" accent="#c86e6e" />
            <Stat v="25,000" l="trades in the book — shipped as 1,010,762 rows" />
          </div>
          <div className="max-w-3xl text-sm leading-relaxed space-y-4" style={{ color: 'var(--text-secondary)' }}>
            <p>
              The trade capture system feeds the risk and valuation platform for a
              rates and inflation non-linear business. Non-linear books are <em>low
              trade count, high structure</em>: each trade carries full schedules,
              per-caplet strike steps, Bermudan exercise dates, inflation base index
              fixings and LPI collars — everything the platform needs to key its
              normal volatility surfaces and discount and projection curves.
            </p>
            <p>
              The legacy export explodes every trade to one row per period and
              exercise, repeating the entire 33-field header on every row — a 25k-trade
              book becomes a million-row quarter-GB file, and the feed crawls at a
              rate no network explains. The fix is not a faster disk: it is a format,
              a normalization step, and parallel database connections.
            </p>
          </div>
        </div>
      )}

      {tab === 'pipeline' && (
        <div>
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <Stage n="01 · PICK UP" title="Typed parallel ingest"
              body="Spark reads the exploded pipe-delimited export with an explicit schema — no inference pass over a GB of text. Malformed rows are quarantined, never silently dropped." />
            <Stage n="02 · PREPARE" title="Re-nest + pricing-readiness gate"
              body="One record per trade with array<struct> period and exercise schedules — the header stored once. A readiness gate quarantines any trade that cannot key a vol lookup: missing strikes on unset caplets, missing settlement method, missing inflation base print, missing LPI collars." />
            <Stage n="03 · WRITE" title="Parallel batched MSSQL load"
              body="Parent/child tables (trades, periods, exercises) over 8 parallel JDBC connections with 10k-row batches. Delta days stage into a MERGE by trade id and version. Counts, notionals and id-hashes reconcile after every load." />
          </div>
          <pre className="rounded p-4 font-mono text-[11px] overflow-x-auto"
            style={{ background: '#0d0d14', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
{`LEGACY (trade capture ships):                1,010,762 rows
  N0000001 |...33-field header...| PERIOD   | 1 | dates | notional | strike | fixing
  N0000001 |...same header again.| PERIOD   | 2 | ...       <- 30Y quarterly cap = 120 rows
  N0000001 |...same header again.| EXERCISE | 1 | ...       <- Bermudan exercise dates

NESTED (the bridge outputs):                 exactly 25,000 rows
  one row per trade:
    header (once)
    periods:   array<struct{num, start, end, pay, notional, strike, fixing, fixed}>
    exercises: array<struct{num, exercise_date, settle_date, fee}>`}
          </pre>
          <p className="text-xs mt-4" style={{ color: 'var(--text-dim)' }}>
            Reconciled on every run: 25,000 = 25,000 trades · 1,004,652 = 1,004,652 periods ·
            6,110 = 6,110 exercises · notional diff 0.0000
          </p>
        </div>
      )}

      {tab === 'benchmarks' && (
        <div className="space-y-10">
          <div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              End-of-day feed at production transfer rates (1 GB scale)
            </h3>
            <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>
              Transfer leg physically measured through a 0.19 MB/s token-bucket throttle
              (legacy 927s at file size — within 0.03% of arithmetic — vs 11s for the
              partitioned Parquet over 8 streams)
            </p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={E2E} layout="vertical" margin={{ left: 10, right: 60 }}>
                <CartesianGrid stroke={chartGrid} horizontal={false} />
                <XAxis type="number" stroke={chartAxis} tick={{ fontSize: 11 }} unit=" min" />
                <YAxis type="category" dataKey="name" stroke={chartAxis} tick={{ fontSize: 11 }} width={230} />
                <Tooltip {...tt} formatter={(v: any) => [`${v} min`, '']} />
                <Bar dataKey="mins" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                  {E2E.map((d, i) => <Cell key={i} fill={d.color} />)}
                  <LabelList dataKey="mins" position="right" formatter={(v: any) => `${v} min`}
                    style={{ fill: '#8b8a97', fontSize: 11, fontFamily: 'monospace' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="font-mono text-xs" style={{ color: '#5cb87a' }}>25x end-to-end</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              The decisive leg: writing 1,035,762 rows to SQL Server
            </h3>
            <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>
              Same file, same three tables, both lanes reconciled exactly. Single-connection
              inserts are bounded by round-trips and log flushes — the measured shape of why
              single-threaded loaders take hours.
            </p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={DBWRITE} layout="vertical" margin={{ left: 10, right: 70 }}>
                <CartesianGrid stroke={chartGrid} horizontal={false} />
                <XAxis type="number" stroke={chartAxis} tick={{ fontSize: 11 }} unit="s" />
                <YAxis type="category" dataKey="name" stroke={chartAxis} tick={{ fontSize: 11 }} width={230} />
                <Tooltip {...tt} formatter={(v: any, _n: any, p: any) => [`${v}s  (${(p.payload as any).rps.toLocaleString()} rows/s)`, '']} />
                <Bar dataKey="secs" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                  {DBWRITE.map((d, i) => <Cell key={i} fill={d.color} />)}
                  <LabelList dataKey="secs" position="right" formatter={(v: any) => `${v}s`}
                    style={{ fill: '#8b8a97', fontSize: 11, fontFamily: 'monospace' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="font-mono text-xs" style={{ color: '#5cb87a' }}>49x on the DB write · 21.5x end-to-end</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                Payload: exploded text vs nested Parquet
              </h3>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={SIZES} layout="vertical" margin={{ left: 10, right: 60 }}>
                  <CartesianGrid stroke={chartGrid} horizontal={false} />
                  <XAxis type="number" stroke={chartAxis} tick={{ fontSize: 11 }} unit=" MB" />
                  <YAxis type="category" dataKey="name" stroke={chartAxis} tick={{ fontSize: 11 }} width={150} />
                  <Tooltip {...tt} formatter={(v: any) => [`${v} MB`, '']} />
                  <Bar dataKey="mb" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                    {SIZES.map((d, i) => <Cell key={i} fill={d.color} />)}
                    <LabelList dataKey="mb" position="right" formatter={(v: any) => `${v} MB`}
                      style={{ fill: '#8b8a97', fontSize: 11, fontFamily: 'monospace' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="font-mono text-xs" style={{ color: '#5cb87a' }}>15.3x — repeated headers dedup away</p>
            </div>
            <div className="text-xs leading-relaxed space-y-3 pt-1" style={{ color: 'var(--text-secondary)' }}>
              <p>
                <span style={{ color: 'var(--text-primary)' }}>The honest benchmark:</span> on
                the <em>prepare</em> leg a careful single-threaded parser beats Spark at this
                size (8.3s vs 11.9s — JVM startup and shuffle overhead are real). Every claim
                is attributed to its cause: compression wins the transfer, connection
                parallelism wins the database, and single-thread code wins small-file compute.
              </p>
              <p>
                Delta mode ships only new/amended/cancelled trades — a 20k-trade delta staged
                and MERGE'd server-side in 0.8s, leaving the steady-state daily feed at MBs, not GBs.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
