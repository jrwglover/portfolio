import { topics } from '../../config/topics';
import TopicCard from './TopicCard';

const topicNumbers: Record<string, string> = {
  Rates: '01',
  Credit: '02',
  Volatility: '03',
  Infrastructure: '04',
  'Market Data': '05',
};

export default function TopicTree() {
  return (
    <section id="modules" className="max-w-[1320px] mx-auto px-8 py-20">
      <div className="mb-12">
        <p
          className="font-mono text-xs tracking-widest uppercase mb-3"
          style={{ color: 'var(--accent-warm)' }}
        >
          Learning Modules
        </p>
        <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Explore by topic
        </h2>
      </div>

      {topics.map((topic) => (
        <div key={topic.label} className="mb-16 last:mb-0">
          {/* Topic header */}
          <div className="flex items-center gap-3 mb-8">
            <span
              className="font-mono text-xs font-bold w-7 h-7 rounded flex items-center justify-center"
              style={{
                background: 'rgba(192, 72, 0, 0.08)',
                color: 'var(--accent-warm-muted)',
                border: '1px solid rgba(192, 72, 0, 0.15)',
              }}
            >
              {topicNumbers[topic.label] ?? '??'}
            </span>
            <h3 className="text-base font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>
              {topic.label}
            </h3>
          </div>

          {/* Subtopics */}
          {topic.subtopics.map((sub) => (
            <div key={sub.label} className="mb-10 last:mb-0 ml-10">
              <h4
                className="text-xs font-mono tracking-widest uppercase mb-4"
                style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}
              >
                {sub.label}
              </h4>
              <div
                className={`grid gap-5 ${
                  sub.leaves.length === 1
                    ? 'grid-cols-1 max-w-lg'
                    : sub.leaves.length === 2
                    ? 'grid-cols-1 md:grid-cols-2'
                    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                }`}
              >
                {sub.leaves.map((leaf) => (
                  <TopicCard key={leaf.id} leaf={leaf} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
