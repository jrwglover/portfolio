/* How the application was built and how its numbers are verified. The code was
   largely written by Claude under the author's direction, so the panel states
   who did what, the second method behind each published number, the errors the
   process caught, and what the checks do not cover. Figures match the
   Pipelines panel and the notes they are quoted from. */

const CARD = 'var(--bg-card)';
const EDGE = 'var(--border-subtle)';
const DIM = 'var(--text-dim)';
const SEC = 'var(--text-secondary)';
const PRI = 'var(--text-primary)';
const OK = '#5cb87a';
const AUTHOR = '#5b8fc9';
const MODEL = '#d9a441';

const ROLES: [string, string, string][] = [
  ['Scope',
   'Chose the three stages, the curves, the products and what a desk needs to see on each screen.',
   'Set out the options for each request and what each would cost.'],
  ['Methods and conventions',
   'Set the market conventions, the meeting-dated curves, the interpolation and the treatment of static data as events.',
   'Implemented each choice and reported where it had a consequence elsewhere.'],
  ['Code',
   'Directed each change and reviewed its result.',
   'Wrote the C++ engine, the exporters, the test suites, the pipelines and this site.'],
  ['Checks',
   'Required a second method behind every published number.',
   'Wrote the tests and the export gates, and runs them on every export and every push.'],
  ['Review',
   'Read every screen and note, questioned the numbers that looked wrong and sent work back.',
   'Traced each question to its cause and fixed it.'],
  ['Release',
   'Decides what is published.',
   'Deploys a build that passed to a staging address, then to the live one.'],
];

const EVIDENCE: [string, string, string][] = [
  ['A curve reprices its own quotes',
   'Every instrument is priced off the finished curve and compared with its quote.',
   'within 0.00001 bp'],
  ['The fast pricer agrees with the library',
   'The flattened CPU and GPU marks are compared with QuantLib on all 232 rate instruments.',
   'agree to 1e-14'],
  ['Bond yields and spreads',
   'Every bond on every set is priced a second time through QuantLib.',
   '867 comparisons within 0.000001 bp'],
  ['Only the affected curves rebuild',
   'The curves rebuilt after each quote are compared with the dependency graph.',
   'equal on every set'],
  ['Readers see one version',
   'Reader threads check each published set while a session is replayed.',
   '1.7 million reads, 0 incoherent'],
  ['Valuation adjustments',
   'The total from sensitivities is compared with full revaluation.',
   'within 1%'],
  ['Bond P&L attribution',
   'The curve part and the spread part are added and compared with the change in market value.',
   'within 1 euro'],
  ['Static data',
   'One record per bond is rebuilt from two sources and compared field by field with the terms the prices came from.',
   '52 bonds, 8 fields, 0 wrong'],
  ['Engine behaviour',
   'Three unit test suites run on every push, with compiler warnings on.',
   '59 tests, 6,407 checks, 0 warnings'],
];

const CAUGHT: [string, string, string][] = [
  ['Jagged forward curves',
   'The author, reading the chart',
   'Early builds showed forwards with a sawtooth. The interpolator was suspected first. The cause was the quotes, which had been written by hand and were inconsistent with each other. Every quote is now implied from one generating curve.'],
  ['A GPU speed-up of eight times',
   'A second CPU baseline',
   'An early headline compared the GPU with QuantLib objects. A flat loop over the same cashflows on one core closed most of that gap, and the headline was withdrawn. The Cost of a risk run panel now states the baseline for every figure.'],
  ['A bond curve dated two days early',
   'The QuantLib gate on the export',
   'The bond curve was dated on the valuation date while the EUR rate curves are dated at spot. Z-spreads differed from QuantLib by 0.26 bp, the export stopped, and the curve was moved to spot.'],
];

const LIMITS: [string, string][] = [
  ['One reference library',
   'QuantLib is the second method for most pricing checks. A convention that is wrong in both passes would agree with itself, so the conventions rest on the author’s review.'],
  ['Generated data',
   'The quotes, the book and the bonds are generated. No figure on this site has been reconciled to a real market or a real portfolio.'],
  ['The batch engine',
   'The curve and risk engine needs a GPU host. Its reconciliations run on the workstation and are outside the hosted pipelines.'],
];

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-sm mb-2 font-mono uppercase tracking-wider" style={{ color: DIM }}>{children}</p>;
}

export default function VerificationPanel() {
  return (
    <div>
      <p className="text-sm mb-6 max-w-4xl" style={{ color: SEC }}>
        Most of the code behind this site was written by Claude, Anthropic&apos;s coding model,
        to the author&apos;s specification. Machine-written code is easy to produce and easy
        to get wrong, so each published number has a second method behind it and a tolerance
        that stops the run.
      </p>

      <Label>Who did what</Label>
      <div className="rounded-lg overflow-x-auto max-w-5xl" style={{ border: `1px solid ${EDGE}` }}>
        <table className="w-full text-xs" style={{ background: CARD }}>
          <thead>
            <tr>
              <th className="text-left font-mono font-normal uppercase tracking-wider text-[10px] px-4 py-2"
                  style={{ borderBottom: `1px solid ${EDGE}`, color: DIM }}>Work</th>
              <th className="text-left font-mono font-normal uppercase tracking-wider text-[10px] px-4 py-2"
                  style={{ borderBottom: `1px solid ${EDGE}`, color: AUTHOR }}>The author</th>
              <th className="text-left font-mono font-normal uppercase tracking-wider text-[10px] px-4 py-2"
                  style={{ borderBottom: `1px solid ${EDGE}`, color: MODEL }}>Claude</th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map(([w, a, c], i) => (
              <tr key={w} style={{ borderTop: i ? `1px solid ${EDGE}` : undefined }}>
                <td className="px-4 py-2.5 font-semibold whitespace-nowrap align-top" style={{ color: PRI }}>{w}</td>
                <td className="px-4 py-2.5 leading-relaxed align-top" style={{ color: SEC }}>{a}</td>
                <td className="px-4 py-2.5 leading-relaxed align-top" style={{ color: SEC }}>{c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-10">
        <Label>The second method behind each number</Label>
        <p className="text-sm mb-3 max-w-4xl" style={{ color: SEC }}>
          A check here compares two independent routes to the same number. The export gates
          stop the run before a file is written, and the test suites fail the pipeline.
        </p>
        <div className="rounded-lg overflow-x-auto max-w-5xl" style={{ border: `1px solid ${EDGE}` }}>
          <table className="w-full text-xs" style={{ background: CARD }}>
            <thead>
              <tr style={{ color: DIM }}>
                {['Claim', 'Second method', 'Result'].map(h => (
                  <th key={h} className="text-left font-mono font-normal uppercase tracking-wider text-[10px] px-4 py-2"
                      style={{ borderBottom: `1px solid ${EDGE}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EVIDENCE.map(([c, m, r], i) => (
                <tr key={c} style={{ borderTop: i ? `1px solid ${EDGE}` : undefined }}>
                  <td className="px-4 py-2.5 font-semibold align-top" style={{ color: PRI }}>{c}</td>
                  <td className="px-4 py-2.5 leading-relaxed align-top" style={{ color: SEC }}>{m}</td>
                  <td className="px-4 py-2.5 font-mono whitespace-nowrap align-top" style={{ color: OK }}>{r}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-10">
        <Label>Errors the process caught</Label>
        <div className="rounded-lg overflow-hidden max-w-4xl" style={{ border: `1px solid ${EDGE}` }}>
          {CAUGHT.map(([h, by, b], i) => (
            <div key={h} className="px-4 py-3"
                 style={{ borderTop: i ? `1px solid ${EDGE}` : undefined, background: CARD }}>
              <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
                <span className="text-xs font-semibold" style={{ color: PRI }}>{h}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: DIM }}>caught by {by}</span>
              </div>
              <div className="text-xs leading-relaxed" style={{ color: SEC }}>{b}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <Label>What the checks do not cover</Label>
        <div className="rounded-lg overflow-hidden max-w-4xl" style={{ border: `1px solid ${EDGE}` }}>
          {LIMITS.map(([h, b], i) => (
            <div key={h} className="px-4 py-3"
                 style={{ borderTop: i ? `1px solid ${EDGE}` : undefined, background: CARD }}>
              <div className="text-xs font-semibold mb-1" style={{ color: PRI }}>{h}</div>
              <div className="text-xs leading-relaxed" style={{ color: SEC }}>{b}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
