import EmbeddedApp from '../EmbeddedApp';

export default function PricerDashboard({ breadcrumb }: { defaultTab?: string; breadcrumb?: string[] } = {}) {
  return (
    <EmbeddedApp
      label={breadcrumb ? breadcrumb.slice(0, -1).join(' > ') : 'Trading & Risk'}
      title={breadcrumb ? breadcrumb[breadcrumb.length - 1] : 'TRM Pricing Toolkit'}
      subtitle="Multi-asset swap pricing with QuantLib curve construction, real-time market simulation, and DV01 risk analytics."
      techBadges={['Python', 'Flask', 'QuantLib', 'React', 'Material-UI', 'Chart.js']}
      appUrl="http://localhost:3018"
      appTitle="TRM Pricing Toolkit"
      whatItDoes="Professional trading and risk management toolkit with institutional-quality market data. Flask API generates yield curves on-the-fly using monotone convex interpolation (short end) and Nelson-Siegel (long end). ProfessionalMarketDataProvider has realistic EUR, USD, GBP rates with bid/ask spreads. Market simulation updates at instrument-specific frequencies. Supports 9 currencies with dual-curve framework (OIS discounting, IBOR forecasting)."
      keyResults={[
        ['9 currencies', 'Full OIS curve term structures with realistic market levels and bid/ask'],
        ['Dual-curve pricing', 'OIS for discounting, IBOR for cashflow forecasting (15bp EURIBOR-ESTR basis)'],
        ['DV01 risk ladder', 'Sensitivity to 1bp shift by tenor bucket, from 1M to 30Y'],
        ['Real-time simulation', 'Staggered updates by liquidity: liquid tenors tick faster than illiquid ones'],
        ['No database needed', 'All curves generated procedurally from embedded A+ quality market data'],
        ['GPU optional', 'CuPy/CUDA acceleration available but not required'],
      ]}
      guide={[
        {
          tab: 'Curve Charts',
          color: 'var(--accent-cool)',
          summary: 'Interactive yield curve visualisation',
          points: [
            'Multi-currency OIS curves (ESTR, SOFR, SONIA) plotted with forward and zero rate toggle',
            'Dual interpolation: step function for short end (<=2Y), monotone convex for long end',
            'Auto-refreshing every 30 seconds from the market simulator',
            'Bid/ask spread visualisation on curve chart',
          ],
        },
        {
          tab: 'Swap Pricer',
          color: 'var(--accent-warm)',
          summary: 'Price swaps with full analytics',
          points: [
            'Select currency, notional, tenor, fixed rate, and direction',
            'NPV calculated as Notional x Rate Spread x Annuity Factor with proper discounting',
            'DV01 risk ladder computed per tenor bucket showing where the rate sensitivity lives',
            'Cashflow schedule generation with semi-annual frequency and proper day count',
          ],
        },
        {
          tab: 'Market Data',
          color: 'var(--accent-green)',
          summary: 'Real-time rate sheet with basis spreads',
          points: [
            'Live rate sheet with animated cell highlighting for market updates',
            'OIS-IBOR basis spread display showing the relationship between discount and forecast curves',
            'Currency-specific rate structures with market regime detection',
          ],
        },
      ]}
    />
  );
}
