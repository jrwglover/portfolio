import { useEffect, useMemo, useRef, useState } from 'react';

interface Row { id: string; book: string; npv: number; dv01: number; degraded: boolean }
interface Frame {
  label: string; note: string; ticks: string[];
  epoch: number; published: boolean;
  rebuilt: string[]; failed: string[];
  applied: number; duplicate: number; cycleUs: number;
  status: Record<string, string>;
  rows: Row[]; deskNpv: number; deskDv01: number;
}
export interface Timeline { curves: string[]; frames: Frame[] }

const LABEL: Record<string, string> = {
  EUR_ESTR: 'ESTR', EUR_ESTR_ECB: 'ESTR meeting', EUR_ESTR_IMM: 'ESTR IMM',
  EUR_ESTR_IMMFUT: 'ESTR IMM fut', EUR_EURIBOR6M: 'EURIBOR 6M',
  USD_SOFR: 'SOFR', GBP_SONIA: 'SONIA', EUR_USD_XCCY: 'EUR/USD xccy',
};

const money = (v: number) =>
  (v < 0 ? '-' : '') + Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 });

export default function Workstation({ tl }: { tl: Timeline }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  // Curves that rebuilt on the current frame are held lit briefly, so the
  // cascade is visible rather than instantaneous.
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const timer = useRef<number | null>(null);

  const f = tl.frames[i];
  const prev = i > 0 ? tl.frames[i - 1] : null;

  useEffect(() => {
    setFlash(new Set(f.rebuilt));
    const t = window.setTimeout(() => setFlash(new Set()), 1100);
    return () => window.clearTimeout(t);
  }, [i, f.rebuilt]);

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setTimeout(
      () => setI(x => (x + 1) % tl.frames.length), 2600);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [i, playing, tl.frames.length]);

  const feed = useMemo(() => {
    const out: { label: string; ticks: string[]; rebuilt: number; dup: number }[] = [];
    for (let k = i; k >= 0 && out.length < 6; k--) {
      const fr = tl.frames[k];
      out.push({ label: fr.label, ticks: fr.ticks, rebuilt: fr.rebuilt.length, dup: fr.duplicate });
    }
    return out;
  }, [i, tl.frames]);

  const delta = (r: Row) => {
    const p = prev?.rows.find(x => x.id === r.id);
    return p ? r.npv - p.npv : 0;
  };
  const deskDelta = prev ? f.deskNpv - prev.deskNpv : 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button onClick={() => setPlaying(p => !p)} className="px-3 py-1.5 rounded font-mono text-[11px]"
          style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <div className="flex gap-1">
          {tl.frames.map((_, k) => (
            <button key={k} onClick={() => { setI(k); setPlaying(false); }}
              className="w-6 h-1.5 rounded-sm"
              style={{ background: k === i ? '#d4a853' : 'var(--border-subtle)' }} />
          ))}
        </div>
        <span className="font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>
          set {f.epoch} &middot; rebuilt in {(f.cycleUs / 1000).toFixed(2)} ms
        </span>
      </div>

      <div className="rounded px-4 py-3 mb-4" style={{ border: '1px solid #d4a85355', background: '#d4a8530a' }}>
        <div className="font-mono text-xs mb-1" style={{ color: '#d4a853' }}>{f.label}</div>
        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{f.note}</div>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.1fr] gap-4">
        {/* ---- curve board ---- */}
        <div>
          <div className="text-[10px] uppercase mb-2" style={{ color: 'var(--text-dim)' }}>Curves</div>
          <div className="grid grid-cols-2 gap-2">
            {tl.curves.map(c => {
              const st = f.status[c] ?? 'OK';
              const lit = flash.has(c);
              const stale = st !== 'OK';
              const colour = stale ? '#c86e6e' : lit ? '#d4a853' : 'var(--border-subtle)';
              return (
                <div key={c} className="rounded px-2.5 py-2" style={{
                  border: `1px solid ${colour}`,
                  background: lit ? '#d4a85314' : stale ? '#c86e6e10' : 'transparent',
                  transition: 'background 350ms, border-color 350ms',
                }}>
                  <div className="font-mono text-[11px]" style={{
                    color: stale ? '#c86e6e' : lit ? '#d4a853' : 'var(--text-primary)',
                  }}>{LABEL[c] ?? c}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>
                    {stale ? 'stale, last good' : lit ? 'rebuilt' : 'current'}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-[10px] uppercase mt-4 mb-2" style={{ color: 'var(--text-dim)' }}>Incoming prices</div>
          <div className="rounded p-2.5 font-mono text-[10.5px]" style={{
            border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)',
            minHeight: 132,
          }}>
            {feed.map((e, k) => (
              <div key={k} className="flex justify-between gap-3 py-0.5"
                style={{ color: k === 0 ? 'var(--text-secondary)' : 'var(--text-dim)', opacity: 1 - k * 0.14 }}>
                <span className="truncate">{e.ticks.length ? e.ticks[0] : e.label}</span>
                <span style={{ color: e.dup ? '#c86e6e' : e.rebuilt ? '#d4a853' : 'var(--text-dim)' }}>
                  {e.dup ? 'rejected' : e.rebuilt ? `${e.rebuilt} rebuilt` : 'no change'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ---- blotter ---- */}
        <div>
          <div className="text-[10px] uppercase mb-2" style={{ color: 'var(--text-dim)' }}>Positions</div>
          <div className="rounded overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full font-mono text-[11px]">
              <thead>
                <tr style={{ color: 'var(--text-dim)' }}>
                  <th className="text-left px-3 py-1.5 font-normal">Trade</th>
                  <th className="text-right px-3 py-1.5 font-normal">Value</th>
                  <th className="text-right px-3 py-1.5 font-normal">Change</th>
                  <th className="text-right px-3 py-1.5 font-normal">DV01</th>
                </tr>
              </thead>
              <tbody>
                {f.rows.map(r => {
                  const d = delta(r);
                  return (
                    <tr key={r.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td className="px-3 py-1.5" style={{ color: r.degraded ? '#c86e6e' : 'var(--text-secondary)' }}>
                        {r.id}{r.degraded ? ' *' : ''}
                      </td>
                      <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-primary)' }}>{money(r.npv)}</td>
                      <td className="px-3 py-1.5 text-right" style={{
                        color: Math.abs(d) < 1 ? 'var(--text-dim)' : d > 0 ? 'var(--accent-green)' : '#c86e6e',
                      }}>{Math.abs(d) < 1 ? '' : (d > 0 ? '+' : '') + money(d)}</td>
                      <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-dim)' }}>{money(r.dv01)}</td>
                    </tr>
                  );
                })}
                <tr style={{ borderTop: '1px solid var(--border-hover)' }}>
                  <td className="px-3 py-1.5" style={{ color: 'var(--text-dim)' }}>Desk</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-primary)' }}>{money(f.deskNpv)}</td>
                  <td className="px-3 py-1.5 text-right" style={{
                    color: Math.abs(deskDelta) < 1 ? 'var(--text-dim)' : deskDelta > 0 ? 'var(--accent-green)' : '#c86e6e',
                  }}>{Math.abs(deskDelta) < 1 ? '' : (deskDelta > 0 ? '+' : '') + money(deskDelta)}</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-dim)' }}>{money(f.deskDv01)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {f.rows.some(r => r.degraded) && (
            <p className="text-[11px] mt-2" style={{ color: '#c86e6e' }}>
              * priced on a curve that failed to rebuild and is serving its last
              good version. The value is not wrong, it is old, and it says so
              rather than going blank or quietly carrying on.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
