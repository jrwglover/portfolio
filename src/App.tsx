import { Routes, Route, Navigate, useParams, useSearchParams } from 'react-router-dom';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Landing from './components/landing/Landing';
import WorkflowPage from './components/project/WorkflowPage';
import { legacyPath } from './config/workflow';

// The old /learn/<slug> pages, kept as redirects so links that were shared
// still land somewhere sensible.
function LegacyRedirect() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  return <Navigate to={legacyPath(slug ?? '', params.get('tab')) + window.location.hash} replace />;
}

export default function App() {
  return (
    <div className="noise-bg min-h-screen flex flex-col relative" style={{ background: 'var(--bg-primary)' }}>
      <Header />
      <main className="flex-1 relative z-10">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/rates" element={<Navigate to="/rates/curves" replace />} />
            <Route path="/rates/:stage" element={<WorkflowPage />} />
            <Route path="/learn/:slug" element={<LegacyRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
      </main>
      <Footer />
    </div>
  );
}
