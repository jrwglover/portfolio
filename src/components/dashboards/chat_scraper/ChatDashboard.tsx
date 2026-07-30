import EmbeddedApp from '../EmbeddedApp';

export default function ChatDashboard({ breadcrumb }: { defaultTab?: string; breadcrumb?: string[] } = {}) {
  return (
    <EmbeddedApp
      label={breadcrumb ? breadcrumb.slice(0, -1).join(' > ') : 'Market Data & NLP'}
      title={breadcrumb ? breadcrumb[breadcrumb.length - 1] : 'Chat Analytics'}
      subtitle="Real-time market data for 26 instruments across 7 asset classes with NLP-powered trading chat analysis."
      techBadges={['Python', 'Flask', 'SpaCy', 'TextBlob', 'Socket.IO', 'React', 'Vite']}
      accentColor="var(--accent-purple)"
      appUrl="http://localhost:3002"
      appTitle="Market Data & Chat Analytics"
      whatItDoes="Real-time WebSocket price feeds for 26 instruments across energy, rates, FX, equities, softs, credit, and metals. Trading chat messages are processed through a SpaCy NLP pipeline that extracts entities (companies, locations, instruments), scores sentiment via TextBlob (-1.0 bearish to +1.0 bullish), and maps text to instruments using 40+ symbol aliases. Dual extraction mode: 100% accuracy direct assignment or real NLP pattern matching (~85%)."
      keyResults={[
        ['26 instruments', 'BRN, WTI, TTF, EUR/USD, GBP/USD, USD/JPY, DXY, ES, NQ, FTSE, XAU, XAG, CDX.IG, CDX.HY, KC, CC, and more'],
        ['7 asset classes', 'Energy, Rates, FX, Equities, Softs, Credit, Metals'],
        ['NLP entity extraction', 'SpaCy en_core_web_sm identifies companies, locations, instruments, dates in chat messages'],
        ['Sentiment scoring', 'TextBlob per-message sentiment aggregated by symbol and time window'],
        ['Dual NLP mode', 'Switch between 100% direct assignment and ~85% pattern matching at runtime'],
        ['Demo mode', 'Generates realistic synthetic market data and chat messages automatically'],
      ]}
      guide={[
        {
          tab: 'Price Cards',
          color: 'var(--accent-warm)',
          summary: 'Live instrument pricing grid',
          points: [
            '26 instrument cards showing bid, offer, mid price, and volume',
            'Flash highlighting on price updates (green for up, red for down)',
            'NLP sentiment score integrated per card, derived from recent chat mentions',
            'Asset class grouping: energy/rates/FX/equities/softs/credit/metals',
          ],
        },
        {
          tab: 'Chat Feed',
          color: 'var(--accent-purple)',
          summary: 'NLP-processed trading chat stream',
          points: [
            'Real-time chat messages with sender, timestamp, and text content',
            'Each message tagged with sentiment badge: bullish (green), bearish (red), neutral (gray)',
            'Extracted entities highlighted in the message text (instruments, companies, locations)',
            'Sentiment score shown per message (-1.0 to +1.0)',
            'Messages are real trading chat style: "BRN offered at 74.80, Saudi cut looking unlikely"',
          ],
        },
        {
          tab: 'NLP Pipeline',
          color: 'var(--accent-cool)',
          summary: 'How text becomes structured data',
          points: [
            'Step 1: Chat message arrives via Socket.IO',
            'Step 2: SpaCy NLP pipeline extracts named entities and context',
            'Step 3: TextBlob scores sentiment for each message',
            'Step 4: Symbol mapper matches text to instruments using 40+ aliases (BRENT→BRN, CRUDE OIL→WTI, CABLE→GBP/USD)',
            'Switch between direct (100% accuracy) and NLP pattern matching (~85%) modes via API',
            'Accuracy metrics tracked: correct/incorrect/failed extractions per method',
          ],
        },
        {
          tab: 'Controls',
          color: 'var(--accent-green)',
          summary: 'Demo and configuration',
          points: [
            'Toggle demo mode to generate synthetic market data and chat messages',
            'Switch NLP extraction method between direct and pattern matching',
            'View NLP accuracy metrics in real-time',
            'Clear backend cache and restart data generation',
          ],
        },
      ]}
    />
  );
}
