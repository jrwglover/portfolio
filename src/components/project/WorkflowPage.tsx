import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { findStage, legacyPath, stagePath, stages, project, type Stage } from '../../config/workflow';
import CurveModelDashboard from '../dashboards/curve_model/CurveModelDashboard';
import RtEngineDashboard from '../dashboards/rt_engine/RtEngineDashboard';
import BridgeDashboard from '../dashboards/spark_bridge/BridgeDashboard';
import notesText from '../../content/rates';

// The three stages in order, with the open one marked.
export function StageStrip({ current }: { current?: Stage }) {
  return (
    <ol className="grid sm:grid-cols-3 gap-3">
      {stages.map(s => {
        const on = s.slug === current?.slug;
        return (
          <li key={s.slug}>
            <Link to={stagePath(s)} className="block rounded px-4 py-3 h-full transition-colors"
              style={{
                border: `1px solid ${on ? 'var(--accent-warm)' : 'var(--border-subtle)'}`,
                background: on ? 'rgba(201, 143, 91, 0.06)' : 'transparent',
              }}
              onMouseEnter={e => { if (!on) e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
              onMouseLeave={e => { if (!on) e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}>
              <div className="font-mono text-[10px] tracking-widest uppercase" style={{ color: on ? 'var(--accent-warm)' : 'var(--text-dim)' }}>
                Stage {s.n}
              </div>
              <div className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{s.title}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>{s.panels.length} panels</div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

// The notes for the open panel, above it, with a switch to fold them away.
function Notes({ stage, tab }: { stage: Stage; tab: string }) {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem('notes') !== 'closed'; } catch { return true; }
  });
  const panel = stage.panels.find(p => p.key === tab);
  const keys = panel?.notes ?? [];
  const blocks = keys.map(k => notesText[k]).filter(Boolean) as ReactNode[];
  if (!blocks.length) return null;
  const toggle = () => setOpen(o => { try { localStorage.setItem('notes', o ? 'closed' : 'open'); } catch { /* fine */ } return !o; });
  return (
    <section className="mb-8 rounded" style={{ border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.015)' }}>
      <button onClick={toggle} className="w-full flex items-center justify-between px-5 py-3 text-left">
        <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: 'var(--accent-warm)' }}>
          Notes on this panel
        </span>
        <span className="font-mono text-[10px]" style={{ color: 'var(--text-dim)' }}>{open ? 'hide' : 'show'}</span>
      </button>
      {open && (
        <div className="px-5 pb-6 max-w-4xl">
          {blocks.map((b, i) => (
            <div key={keys[i] + i} className={i ? 'mt-8 pt-6' : ''} style={i ? { borderTop: '1px solid var(--border-subtle)' } : undefined}>
              {b}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function WorkflowPage() {
  const { stage: slug } = useParams();
  const [params, setParams] = useSearchParams();
  const stage = findStage(slug ?? '');
  const wanted = params.get('tab');
  const tab = stage && wanted && stage.panels.some(p => p.key === wanted) ? wanted : stage?.panels[0].key ?? '';

  useEffect(() => {
    if (!stage) return;
    const panel = stage.panels.find(p => p.key === tab);
    document.title = `${panel?.title ?? stage.title} | ${project.name}`;
  }, [stage, tab]);

  useEffect(() => { if (!window.location.hash) window.scrollTo(0, 0); }, [slug]);

  if (!stage) {
    // an old chapter address, or nothing we know
    return <Navigate to={legacyPath(slug ?? '', wanted)} replace />;
  }

  const onTab = (t: string) => {
    const next = new URLSearchParams(params);
    if (t === stage.panels[0].key) next.delete('tab'); else next.set('tab', t);
    setParams(next, { replace: true });
  };
  const intro = (t: string) => <Notes key={t} stage={stage} tab={t} />;

  return (
    <div className="max-w-[1320px] mx-auto px-8 py-10">
      <p className="font-mono text-xs tracking-widest uppercase mb-4" style={{ color: 'var(--accent-warm)' }}>
        {project.name}
      </p>
      <StageStrip current={stage} />

      <h1 className="text-3xl font-semibold tracking-tight mt-10 mb-2" style={{ color: 'var(--text-primary)' }}>
        <span className="font-mono text-base mr-3" style={{ color: 'var(--text-dim)' }}>{stage.n}</span>
        {stage.title}
      </h1>
      <p className="text-sm mb-8 max-w-4xl" style={{ color: 'var(--text-secondary)' }}>{stage.lede}</p>

      <div className="max-lg:overflow-x-auto">
        {stage.component === 'CurveModelDashboard' && (
          <CurveModelDashboard key={stage.slug} embedded defaultTab={tab} onTab={onTab} intro={intro} />
        )}
        {stage.component === 'RtEngineDashboard' && (
          <RtEngineDashboard key={stage.slug} embedded defaultTab={tab} onTab={onTab} intro={intro} />
        )}
        {stage.component === 'BridgeDashboard' && (
          <BridgeDashboard key={stage.slug} embedded defaultTab={tab} onTab={onTab} intro={intro} />
        )}
      </div>

      <nav className="grid sm:grid-cols-2 gap-3 mt-14">
        {[stages[stages.indexOf(stage) - 1], stages[stages.indexOf(stage) + 1]].map((s, i) => s ? (
          <Link key={s.slug} to={stagePath(s)} className="block rounded px-4 py-3 transition-colors"
            style={{ border: '1px solid var(--border-subtle)', textAlign: i ? 'right' : 'left' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}>
            <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>{i ? 'Next stage' : 'Previous stage'}</div>
            <div className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{s.n} {s.title}</div>
          </Link>
        ) : <div key={i} />)}
      </nav>
    </div>
  );
}
