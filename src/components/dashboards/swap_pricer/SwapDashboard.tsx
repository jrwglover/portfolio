import EmbeddedApp from '../EmbeddedApp';

export default function SwapDashboard({ breadcrumb }: { defaultTab?: string; breadcrumb?: string[] } = {}) {
  return (
    <EmbeddedApp
      label={breadcrumb ? breadcrumb.slice(0, -1).join(' > ') : 'Real-Time Pricing'}
      title={breadcrumb ? breadcrumb[breadcrumb.length - 1] : 'WebSocket Swap Pricer'}
      subtitle="Live interest rate swap pricing across 7 currencies with full Greeks via WebSocket market data feeds."
      techBadges={['Node.js', 'Express', 'WebSocket', 'React', 'TypeScript', 'Recharts']}
      accentColor="var(--accent-cool)"
      appUrl="http://localhost:3021"
      appTitle="Real-Time Swap Pricer"
      whatItDoes="Prices interest rate swaps (IRS, OIS, basis, cross-currency) across USD, EUR, GBP, JPY, CHF, AUD, CAD using a pure Node.js engine. Market data is pushed to all connected clients via WebSocket every 10 seconds with correlated random walks. Zero Python dependency - the entire pricing stack runs in JavaScript."
      keyResults={[
        ['7 currencies', 'USD (SOFR), EUR (ESTR), GBP (SONIA), JPY (TONAR), CHF (SARON), AUD (AONIA), CAD (CORRA)'],
        ['4 product types', 'IRS, OIS, Basis, Cross-Currency swaps with FX notional exchange'],
        ['Full Greeks', 'NPV, DV01, PV01, theta (daily decay), convexity, fair rate, spread vs par'],
        ['Stateless design', 'No database, in-memory curves, horizontal scaling behind load balancer'],
        ['WebSocket feeds', 'Live market data broadcast to all clients with realistic correlated dynamics'],
      ]}
      guide={[
        {
          tab: 'Currency',
          color: 'var(--accent-cool)',
          summary: 'Select from 7 global OIS curves',
          points: [
            'Click any currency button to switch. The curve chart, pricing, and all Greeks update immediately',
            'Each currency maps to its RFR benchmark: SOFR, ESTR, SONIA, TONAR, SARON, AONIA, CORRA',
            'Curve data is realistic (early 2026 levels): USD inverted ~5.3% short to 4.2% long, EUR normal ~3.9% to 2.9%',
          ],
        },
        {
          tab: 'Swap Parameters',
          color: 'var(--accent-warm)',
          summary: 'Configure the swap to price',
          points: [
            'Set notional (10M to 500M), tenor (1M to 30Y), fixed rate, and PAY/REC direction',
            'Select product type: IRS (fixed vs float), OIS (overnight compounding), BASIS (float vs float), XCCY (cross-currency)',
            'All inputs update the pricing output in real-time',
          ],
        },
        {
          tab: 'Pricing Output',
          color: 'var(--accent-green)',
          summary: 'NPV, Greeks, and risk metrics',
          points: [
            'NPV: present value of the swap at current market rates',
            'Fair rate: the fixed rate that makes NPV zero (interpolated from the OIS curve)',
            'DV01: P&L from a 1bp parallel shift. PV01: DV01 per year of tenor',
            'Theta: daily time decay. Convexity: second-order rate sensitivity',
            'Spread vs par: how far your fixed rate is from fair value',
          ],
        },
        {
          tab: 'Charts',
          color: 'var(--accent-purple)',
          summary: 'Curve visualisation',
          points: [
            'Single currency OIS curve with tenor reference line marking your swap maturity',
            'All 7 curves overlaid on one chart for cross-currency comparison',
            'WebSocket updates move the curves every 10 seconds',
          ],
        },
      ]}
    />
  );
}
