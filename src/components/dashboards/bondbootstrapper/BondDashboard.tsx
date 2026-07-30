import EmbeddedApp from '../EmbeddedApp';

export default function BondDashboard({ defaultTab, breadcrumb }: { defaultTab?: string; breadcrumb?: string[] } = {}) {
  const tabParam = defaultTab ? `?tab=${defaultTab}` : '';
  return (
    <EmbeddedApp
      label={breadcrumb ? breadcrumb.slice(0, -1).join(' > ') : 'Curve Construction'}
      title={breadcrumb ? breadcrumb[breadcrumb.length - 1] : 'Bond Bootstrapper'}
      subtitle="Extracts zero-coupon rates from bond prices via coupon stripping. Decomposes credit curves into OIS + sovereign + credit layers."
      techBadges={['C++', 'QuantLib', 'React', 'Express', 'TypeScript']}
      appUrl={`http://localhost:5173${tabParam}`}
      appTitle="Bond Zero Curve Bootstrapper"
      whatItDoes="Takes 18 German Bund prices and extracts the zero-coupon yield curve (1D to 30Y) using QuantLib's PiecewiseYieldCurve with CubicSpline interpolation. Then decomposes any credit issuer's borrowing cost into three layers: risk-free (OIS), sovereign premium (Bund vs OIS), and credit spread. All in continuous compounding, Act/365 Fixed."
      keyResults={[
        ['Curve accuracy', 'Three independent builds match to sub-0.0001 bps across all 51 tenors'],
        ['Cashflow reprice', '128/128 individual cashflows validated to machine precision'],
        ['Schedule builder', 'Recalculates all cashflows from bond terms, detects newly-issued day count (Act/Act ICMA)'],
        ['Live decomposition', 'Edit any credit spread and the credit curve re-bootstraps instantly'],
        ['Demo mode', 'Watch the curve build bond-by-bond in animated step-by-step replay'],
      ]}
      guide={[
        {
          tab: 'Bond Data',
          color: 'var(--accent-cool)',
          summary: 'Browse the input universe',
          points: [
            'Click any of the 18 Bunds to see its full cashflow schedule: coupon dates, amounts per 100, principal, type (coupon/maturity/stub)',
            'Toggle "Schedule Inputs" to see what the C++ schedule builder needs: ISIN, maturity, coupon, clean price, accrued, dirty price, days accrued, newly-issued flag, day count convention',
            'Toggle "Issue Dates" for accrual start dates and newly-issued detection',
            'Toggle "CSV Schema" for column-level format reference or "Raw CSV" to see the raw Bloomberg-style file',
            'Bonds range from zero-coupon 3-week bills to 30Y coupon bonds with 31 cashflows',
          ],
        },
        {
          tab: 'Demo',
          color: 'var(--accent-warm)',
          summary: 'Animated step-by-step bootstrap',
          points: [
            'Click "Start Demo" to begin. 18 bonds are processed from shortest (1D zero-coupon) to longest (30Y)',
            'Previous curve shown in gray dashed, current in blue. Amber dot marks the latest bond\'s maturity on the curve',
            'Speed control: 0.5s to 5s per step. Play/pause/reset. Click timeline to jump to any step',
            'Each step shows: ISIN, maturity, coupon, dirty price, convergence error, number of tenor points',
            'The core bootstrap visualised: the curve grows from 1 point to 51 as each bond adds information at its maturity',
          ],
        },
        {
          tab: 'Bootstrap',
          color: 'var(--accent-green)',
          summary: 'Run C++ and validate three builds',
          points: [
            'Click "Run Bootstrap" to invoke the C++ exe. Or "Load Existing" for cached results',
            'Three curves overlaid: Reference (gray dashed), CSV Bootstrap (blue), Schedule Builder (amber). They\'re indistinguishable',
            '"Curve Comparison": 51-point table, basis-point diffs. Color-coded: green < 0.0001, yellow < 0.01, red >= 0.01',
            '"Schedule Comparison": 18-bond accrued interest validation with newly-issued detection',
            '"Cashflow Comparison": 128 cashflows, calculated vs CSV, with difference and type',
            '"Console Output": raw C++ stdout with execution time',
          ],
        },
        {
          tab: 'Spreads',
          color: 'var(--accent-purple)',
          summary: 'Credit waterfall decomposition',
          points: [
            'Click "Load Spread Data" to fetch OIS rates, Bund curve, and A-rated credit spreads',
            'Three curves: ESTR OIS (gray dashed), Bund (blue), A-rated credit (amber)',
            'Waterfall stacked area: OIS base (~1.9-2.9%) + Bund premium (~0-60 bps) + credit spread (~45-130 bps)',
            'Edit any credit spread (0-2000 bps) and the credit curve re-bootstraps live. Click "Reset" to restore defaults',
            'OIS bootstrapped from ECB MMSR par rates: Act/360 annual fixed converted to cc Act/365',
            '"Raw Data" tab shows ESTR conversion formula, OIS par-to-zero bootstrap, and credit par coupons',
          ],
        },
      ]}
    />
  );
}
