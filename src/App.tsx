import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Landing from './components/landing/Landing';
import TopicDashboard from './components/TopicDashboard';

export default function App() {
  return (
    <div className="noise-bg min-h-screen flex flex-col relative" style={{ background: 'var(--bg-primary)' }}>
      <Header />
      <main className="flex-1 relative z-10">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/learn/:slug" element={<TopicDashboard />} />
          {/* Legacy redirects */}
          <Route path="/dashboard/bondbootstrapper" element={<Navigate to="/learn/govt-bonds" replace />} />
          <Route path="/dashboard/cuda-curves" element={<Navigate to="/learn/ibor-rfr-curves" replace />} />
          <Route path="/dashboard/pricer" element={<Navigate to="/learn/swap-pricer-multi" replace />} />
          <Route path="/dashboard/swap-pricer" element={<Navigate to="/learn/realtime-swap-pricer" replace />} />
          <Route path="/dashboard/vega-reduction" element={<Navigate to="/learn/vega-pca" replace />} />
          <Route path="/dashboard/chat-scraper" element={<Navigate to="/learn/realtime-nlp" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
