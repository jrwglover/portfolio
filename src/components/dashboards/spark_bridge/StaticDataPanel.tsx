import { useEffect, useState } from 'react';

/* Bond static data: the vendor feed against the manually kept record. The
   reconciliation and the cost of each break are read from bonds.json, which
   the engine writes. Both sources are generated, and the feed is a file in a
   vendor-style layout. No vendor connection is involved. */

const CARD = 'var(--bg-card)';
const EDGE = 'var(--border-subtle)';
const DIM = 'var(--text-dim)';
const SEC = 'var(--text-secondary)';
const PRI = 'var(--text-primary)';
const FEED = '#5b8fc9';
const MANUAL = '#d9a441';
const WARN = '#c86e6e';

interface Break {
  id: string; name: string; field: string; label: string; feed: string; manual: string;
  used: 'feed' | 'manual' | 'override'; pricing: boolean; reason: string; reviewBy?: string | null;
  onCurve: boolean; yieldBp: number | null; curveBp: number | null; curveAt: number | null;
}
interface StaticData {
  summary: { feedRecords: number; manualRecords: number; bonds: number; fieldsCompared: number;
             breaks: number; pricingBreaks: number; overrides: number; expiredOverrides: number;
             feedOnly: number; manualOnly: number };
  fields: string[];
  breaks: Break[];
}

const SOURCES: [string, string, string][] = [
  ['Arrives', 'As a file every morning, for every line the vendor lists.', 'When someone types it in from the terms of the issue.'],
  ['Covers', 'New lines on the day they are announced.', 'Only the bonds the desk has set up.'],
  ['Goes wrong when', 'The vendor is late with a tap, or carries a wrong convention.', 'A digit or a month is keyed wrongly, or a date is rolled by hand.'],
  ['Needed for', 'The default value of every field.', 'Corrections to the feed, and lines the feed does not carry.'],
];

const RULES = [
  'An approved override that has not passed its review date wins.',
  'Otherwise the feed value is used wherever the feed has the bond.',
  'A bond that only the manual record has is taken from the manual record.',
  'Every difference is logged as a break, whichever side wins.',
];

function Tile({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div className="rounded-lg px-4 py-3" style={{ background: CARD, border: `1px solid ${EDGE}` }}>
      <div className="font-mono text-[10px] uppercase tracking-wider" style={{ color: DIM }}>{title}</div>
      <div className="text-lg font-semibold mt-1" style={{ color: PRI }}>{value}</div>
      <div className="text-xs mt-0.5" style={{ color: SEC }}>{note}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-sm mb-2 font-mono uppercase tracking-wider" style={{ color: DIM }}>{children}</p>;
}

const fmtBp = (v: number) => (Math.abs(v) < 0.005 ? '0.00' : (v > 0 ? '+' : '') + v.toFixed(2)) + ' bp';

function effect(b: Break): { text: string; strong: boolean } {
  if (b.field === 'record') return { text: b.used === 'feed' ? 'Not priced yet' : 'Priced from the manual record', strong: false };
  if (!b.pricing || b.yieldBp === null) return { text: 'No effect on price', strong: false };
  if (b.curveBp !== null && b.curveAt !== null)
    return { text: `Curve ${fmtBp(b.curveBp)} at ${b.curveAt.toFixed(1)}Y`, strong: Math.abs(b.curveBp) >= 0.1 };
  return { text: `Yield ${fmtBp(b.yieldBp)}`, strong: Math.abs(b.yieldBp) >= 1 };
}

export default function StaticDataPanel() {
  const [sd, setSd] = useState<StaticData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch('/data/curve_model/bonds.json', { cache: 'no-store' })
      .then(r => r.json()).then(d => setSd(d.staticData)).catch(() => setFailed(true));
  }, []);

  if (failed) return <p className="text-sm" style={{ color: DIM }}>The static data could not be loaded.</p>;
  if (!sd) return <p className="text-sm" style={{ color: DIM }}>Loading the reconciliation.</p>;

  const s = sd.summary;
  const worst = [...sd.breaks].filter(b => b.yieldBp !== null)
    .sort((a, b) => Math.abs(b.yieldBp ?? 0) - Math.abs(a.yieldBp ?? 0))[0];
  const usedColour = (u: Break['used']) => (u === 'feed' ? FEED : MANUAL);
  const usedText = (u: Break['used']) => (u === 'feed' ? 'Feed' : u === 'override' ? 'Manual override' : 'Manual record');

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Tile title="Records" value={`${s.feedRecords} feed, ${s.manualRecords} manual`}
          note={`${s.feedOnly} only on the feed, ${s.manualOnly} only in the manual record`} />
        <Tile title="Fields compared" value={s.fieldsCompared.toLocaleString()}
          note={`${sd.fields.length} fields on each bond both sources hold`} />
        <Tile title="Breaks" value={`${s.breaks}`}
          note={`${s.pricingBreaks} on a field that changes a price, ${s.overrides} settled by override`} />
        <Tile title="Largest effect" value={worst ? `${fmtBp(worst.yieldBp ?? 0)}` : '-'}
          note={worst ? `${worst.label.toLowerCase()} on ${worst.name}` : ''} />
      </div>

      <Label>Two sources of the same terms</Label>
      <div className="rounded-lg overflow-x-auto max-w-5xl mb-8" style={{ border: `1px solid ${EDGE}` }}>
        <table className="w-full text-xs" style={{ background: CARD }}>
          <thead>
            <tr>
              <th className="px-4 py-2" style={{ borderBottom: `1px solid ${EDGE}` }} />
              <th className="text-left font-mono font-normal uppercase tracking-wider text-[10px] px-4 py-2"
                  style={{ borderBottom: `1px solid ${EDGE}`, color: FEED }}>Reference feed</th>
              <th className="text-left font-mono font-normal uppercase tracking-wider text-[10px] px-4 py-2"
                  style={{ borderBottom: `1px solid ${EDGE}`, color: MANUAL }}>Manual record</th>
            </tr>
          </thead>
          <tbody>
            {SOURCES.map(([k, f, m], i) => (
              <tr key={k} style={{ borderTop: i ? `1px solid ${EDGE}` : undefined }}>
                <td className="px-4 py-2.5 font-semibold whitespace-nowrap" style={{ color: PRI }}>{k}</td>
                <td className="px-4 py-2.5 leading-relaxed" style={{ color: SEC }}>{f}</td>
                <td className="px-4 py-2.5 leading-relaxed" style={{ color: SEC }}>{m}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Label>How a difference is settled</Label>
      <ol className="space-y-1.5 mb-8 max-w-4xl">
        {RULES.map((r, i) => (
          <li key={r} className="flex gap-2.5 items-baseline text-sm" style={{ color: SEC }}>
            <span className="font-mono text-[11px] w-4 shrink-0 text-right" style={{ color: DIM }}>{i + 1}</span>
            <span>{r}</span>
          </li>
        ))}
      </ol>

      <Label>Every break, and what the losing value would have cost</Label>
      <p className="text-sm mb-3 max-w-4xl" style={{ color: SEC }}>
        For a break on a pricing field, the engine puts the losing value back and reprices. A bond
        off the curve shows the change in its own yield at the same market price. A bond on the
        curve shows the largest move in the curve after it is solved again with the wrong terms.
      </p>
      <div className="rounded-lg overflow-x-auto" style={{ border: `1px solid ${EDGE}` }}>
        <table className="w-full text-xs" style={{ background: CARD }}>
          <thead>
            <tr style={{ color: DIM }}>
              {['Bond', 'Field', 'Feed', 'Manual', 'Used', 'Reason', 'Effect of the losing value'].map(h => (
                <th key={h} className="text-left font-mono font-normal uppercase tracking-wider text-[10px] px-3 py-2"
                    style={{ borderBottom: `1px solid ${EDGE}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sd.breaks.map((b, i) => {
              const e = effect(b);
              return (
                <tr key={b.id + b.field} style={{ borderTop: i ? `1px solid ${EDGE}` : undefined }}>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: PRI }}>
                    {b.name}{b.onCurve && <span className="font-mono text-[10px] ml-2" style={{ color: DIM }}>on the curve</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: SEC }}>{b.label}</td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: b.used === 'feed' ? PRI : DIM }}>{b.feed}</td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: b.used === 'feed' ? DIM : PRI }}>{b.manual}</td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: usedColour(b.used) }}>{usedText(b.used)}</td>
                  <td className="px-3 py-2 leading-relaxed" style={{ color: SEC, minWidth: 220 }}>
                    {b.reason}{b.reviewBy ? ` Review by ${b.reviewBy}.` : ''}
                  </td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: e.strong ? WARN : SEC }}>{e.text}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs mt-2 max-w-4xl" style={{ color: DIM }}>
        Both sources are generated, with the differences planted. The feed is a file in a vendor-style
        layout, and no vendor connection is involved. The reconciled record is tested against the terms
        the prices were generated from, on {s.bonds} bonds and {sd.fields.length} fields.
      </p>
    </div>
  );
}
