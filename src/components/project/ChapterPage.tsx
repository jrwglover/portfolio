import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { findChapter, chapterPath, type ChapterRef, type Project } from '../../config/projects';
import CurveModelDashboard from '../dashboards/curve_model/CurveModelDashboard';
import RtEngineDashboard from '../dashboards/rt_engine/RtEngineDashboard';
import BridgeDashboard from '../dashboards/spark_bridge/BridgeDashboard';
import ChapterNav from './ChapterNav';
import chapterText from '../../content/rates';

function Figure({ cref }: { cref: ChapterRef }) {
  const c = cref.chapter;
  switch (c.component) {
    case 'CurveModelDashboard':
      return <CurveModelDashboard chapter={{ tab: c.tabs![0], curves: c.curves, domain: c.domain }} />;
    case 'RtEngineDashboard':
      return <RtEngineDashboard chapter={{ tabs: c.tabs! }} />;
    case 'BridgeDashboard':
      return <BridgeDashboard chapter />;
    case 'Talk':
      return <Talk />;
  }
}

// The talk is its own page, built to be screen-shared. Here it is embedded
// at 16:9 with a link to open it on its own.
function Talk() {
  return (
    <div>
      <div className="rounded overflow-hidden" style={{ border: '1px solid var(--border-subtle)', aspectRatio: '16 / 9' }}>
        <iframe src="/talks/prudent-valuation.html" title="From quotes to prudent value"
          style={{ width: '100%', height: '100%', border: 0, background: '#0a0a0f' }} />
      </div>
      <p className="text-sm mt-3 max-w-4xl" style={{ color: 'var(--text-dim)' }}>
        Arrow keys move between slides once the frame has focus. The{' '}
        <a href="/talks/prudent-valuation.html" style={{ color: 'var(--accent-warm)' }}>full-screen version</a>{' '}
        is the one I present from, with the speaker notes in a separate window on the p key.
      </p>
    </div>
  );
}

function Neighbour({ project, to, label, align }: { project: Project; to?: ChapterRef['prev']; label: string; align: 'left' | 'right' }) {
  if (!to) return <div />;
  return (
    <Link to={chapterPath(project, to)} className="block rounded px-4 py-3 transition-colors"
      style={{ border: '1px solid var(--border-subtle)', textAlign: align }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}>
      <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>{label}</div>
      <div className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{to.title}</div>
    </Link>
  );
}

export default function ChapterPage({ project }: { project: string }) {
  const { chapter } = useParams();
  const ref = findChapter(project, chapter ?? '');

  useEffect(() => {
    if (!ref) return;
    document.title = `${ref.chapter.title} | ${ref.project.name}`;
    // A new chapter starts at the top, unless the link carries an anchor.
    if (!window.location.hash) window.scrollTo(0, 0);
  }, [ref]);

  if (!ref) return <Navigate to="/" replace />;

  return (
    <div className="max-w-[1320px] mx-auto px-8 py-10 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
      <aside className="mb-8 lg:mb-0">
        <div className="lg:sticky lg:top-24">
          <ChapterNav current={ref} />
        </div>
      </aside>

      <main className="min-w-0">
        <p className="font-mono text-xs tracking-widest uppercase mb-3" style={{ color: 'var(--accent-warm)' }}>
          {ref.project.name} <span style={{ color: 'var(--border-hover)' }}>/</span> {ref.part.label}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
          <span className="font-mono text-base mr-3" style={{ color: 'var(--text-dim)' }}>{ref.index}</span>
          {ref.chapter.title}
        </h1>
        <p className="text-sm mb-8 max-w-4xl" style={{ color: 'var(--text-secondary)' }}>{ref.chapter.lede}</p>

        {chapterText[ref.chapter.slug]}

        <div className="font-mono text-[10px] uppercase tracking-widest mt-10 mb-4 pt-6" style={{ color: 'var(--text-dim)', borderTop: '1px solid var(--border-subtle)' }}>
          The panel
        </div>

        <div className="max-lg:overflow-x-auto">
          <Figure cref={ref} />
        </div>

        <nav className="grid sm:grid-cols-2 gap-3 mt-14">
          <Neighbour project={ref.project} to={ref.prev} label="Previous" align="left" />
          <Neighbour project={ref.project} to={ref.next} label="Next" align="right" />
        </nav>
      </main>
    </div>
  );
}
