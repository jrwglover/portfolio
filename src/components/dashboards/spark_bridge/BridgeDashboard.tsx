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

/* All numbers below are MEASURED on the same 25,000-trade file
   (see spark_trade_bridge/BENCHMARKS_CPU.md), except where a figure is
   labelled derived on the page. Transfer leg re-measured 2026-08-25. */
const XFER = [
  { name: 'Legacy file (255 MB), 1 stream', secs: 1342, color: '#c86e6e' },
  { name: 'Bridge Parquet (16 MB), 8 streams', secs: 10.6, color: '#5cb87a' },
];
const fmtSecs = (v: number) => (v >= 90 ? `${(v / 60).toFixed(1)} min` : `${v}s`);
const DBWRITE = [
  { name: '1 thread, 1 connection', rps: 2137, secs: 484.8, color: '#c86e6e' },
  { name: 'Spark: 8 connections x 10k batches', rps: 105000, secs: 9.9, color: '#5cb87a' },
];
const SIZES = [
  { name: 'Flat legacy file', mb: 255, color: '#c86e6e' },
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
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{body}</p>
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
        subtitle="Finding the fastest way to move an end-of-day trade file from capture into the risk database"
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
            <Stat v="255 MB" l="daily trade export of the full book" />
            <Stat v="40 rows" l="shipped per trade, the header repeated on every one" accent="#c86e6e" />
            <Stat v="0.19 MB/s" l="rate the old export moved at" accent="#c86e6e" />
            <Stat v="25,000" l="trades in the book, shipped as 1,010,762 rows" />
          </div>
          <div className="max-w-4xl text-sm leading-relaxed space-y-4" style={{ color: 'var(--text-secondary)' }}>
            <p>
              I wanted the fastest way to load trades from trade capture into the
              risk database, because the end-of-day load took a long time for a
              book of this size. The trades themselves are structured, with long
              schedules, per-period detail on every one and optional exercise
              dates on some.
            </p>
            <p>
              The time went on the file format. The old export wrote one row per
              period and one per exercise date, repeating the whole trade header
              each time, so a 25,000-trade book became a million-row file that a
              faster network would not have fixed. The feed needed a format that
              stores each header once, plus enough parallel connections at the far
              end to write the rows.
            </p>
          </div>
        </div>
      )}

      {tab === 'pipeline' && (
        <div>
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <Stage n="01 · PICK UP" title="Typed parallel ingest"
              body="Spark reads the flat pipe-delimited export with an explicit schema, so there is no inference pass over the file. Malformed rows are held in quarantine for review and never dropped." />
            <Stage n="02 · PREPARE" title="Re-nest + pricing-readiness gate"
              body="Trades are re-nested to one record each, with period and exercise schedules held as array<struct> columns and the header stored once. A readiness gate quarantines any trade that is missing a field the pricing step requires." />
            <Stage n="03 · WRITE" title="Parallel batched MSSQL load"
              body="Parent/child tables (trades, periods, exercises) load over 8 parallel JDBC connections in 10k-row batches, and delta days stage into a MERGE by trade id and version. Counts and notional totals reconcile after every load, with id-hashes to catch any row changed in flight." />
          </div>
          <pre className="rounded p-4 font-mono text-[11px] overflow-x-auto"
            style={{ background: '#0d0d14', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
{`LEGACY (trade capture ships):                1,010,762 rows
  N0000001 |...full header.......| PERIOD   | 1 | dates | notional | strike | fixing
  N0000001 |...same header again.| PERIOD   | 2 | ...       <- 30Y quarterly schedule = 120 rows
  N0000001 |...same header again.| EXERCISE | 1 | ...       <- optional exercise dates

NESTED (the bridge outputs):                 exactly 25,000 rows
  one row per trade:
    header (once)
    periods:   array<struct{num, start, end, pay, notional, strike, fixing, fixed}>
    exercises: array<struct{num, exercise_date, settle_date, fee}>`}
          </pre>
          <p className="text-sm mt-4" style={{ color: 'var(--text-dim)' }}>
            Reconciled on every run: 25,000 = 25,000 trades · 1,004,652 = 1,004,652 periods ·
            6,110 = 6,110 exercises · notional diff 0.0000
          </p>
        </div>
      )}

      {tab === 'benchmarks' && (
        <div className="space-y-10">
          <div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Moving the file at the production rate
            </h3>
            <p className="text-sm mb-3" style={{ color: 'var(--text-dim)' }}>
              I measured the transfer leg by copying both payloads through a
              token-bucket throttle set to the 0.19 MB/s production rate. The 255 MB
              legacy file took 22.4 minutes as a single stream, and the 16 MB
              partitioned Parquet took 10.6 seconds over 8 parallel streams.
            </p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={XFER} layout="vertical" margin={{ left: 10, right: 60 }}>
                <CartesianGrid stroke={chartGrid} horizontal={false} />
                <XAxis type="number" stroke={chartAxis} tick={{ fontSize: 11 }}
                  tickFormatter={(v: any) => `${Math.round(v / 60)} min`} />
                <YAxis type="category" dataKey="name" stroke={chartAxis} tick={{ fontSize: 11 }} width={230} />
                <Tooltip {...tt} formatter={(v: any) => [fmtSecs(v), '']} />
                <Bar dataKey="secs" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                  {XFER.map((d, i) => <Cell key={i} fill={d.color} />)}
                  <LabelList dataKey="secs" position="right" formatter={(v: any) => fmtSecs(v)}
                    style={{ fill: '#8b8a97', fontSize: 11, fontFamily: 'monospace' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="font-mono text-xs" style={{ color: '#5cb87a' }}>127x on the transfer leg, measured at the actual file sizes</p>
            <p className="text-sm mt-2" style={{ color: 'var(--text-dim)' }}>
              Adding the measured transfer and file-to-database legs puts the whole
              hand-off at 30.6 minutes on the legacy path and 33.5 seconds on the bridge.
              I didn&apos;t time the hand-off as one run, so those two totals are sums
              of legs measured separately.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Writing 1,035,762 rows to SQL Server
            </h3>
            <p className="text-sm mb-3" style={{ color: 'var(--text-dim)' }}>
              Both lanes load the same file into the same three tables and reconcile
              exactly. A single connection is bounded by per-batch round trips and log
              flushes, so adding connections is what raises the rate.
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
            <p className="font-mono text-xs" style={{ color: '#5cb87a' }}>49x on the database write · 21.5x from file to database, transfer leg excluded</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                Payload: flat text vs nested Parquet
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
              <p className="font-mono text-xs" style={{ color: '#5cb87a' }}>15.9x smaller with the header stored once per trade</p>
            </div>
            <div className="text-xs leading-relaxed space-y-3 pt-1" style={{ color: 'var(--text-secondary)' }}>
              <p>
                <span style={{ color: 'var(--text-primary)' }}>What was measured:</span> on
                the <em>prepare</em> leg a careful single-threaded parser beats Spark at this
                size, 8.3s against 11.9s, because of JVM startup and shuffle overhead.
                The transfer gain comes from compression and the database gain from the
                parallel connections.
              </p>
              <p>
                Delta mode ships only the trades that changed since the last run, so the
                steady-state daily feed is far smaller than the full file.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
