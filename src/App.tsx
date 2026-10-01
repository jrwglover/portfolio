import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Landing from './components/landing/Landing';
import ChapterPage from './components/project/ChapterPage';
import { legacyPath } from './config/projects';

// The old /learn/<slug> pages, kept as redirects so links that were shared
// still land somewhere sensible.
function LegacyRedirect() {
  const { slug } = useParams();
  const { search, hash } = useLocation();
  const tab = new URLSearchParams(search).get('tab');
  return <Navigate to={legacyPath(slug ?? '', tab) + hash} replace />;
}

export default function App() {
  return (
    <div className="noise-bg min-h-screen flex flex-col relative" style={{ background: 'var(--bg-primary)' }}>
      <Header />
      <main className="flex-1 relative z-10">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/rates/:chapter" element={<ChapterPage project="rates" />} />
          <Route path="/learn/:slug" element={<LegacyRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
