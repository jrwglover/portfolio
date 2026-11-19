/* Pipelines panel for the curve-model dashboard. It lists what each pipeline
   runs and what the last local run of the same scripts produced, then the
   gates the data export applies before anything reaches the site. The figures
   come from scripts/ci-engine.sh and scripts/ci-site.sh, run on 2026-11-19. */

const CARD = 'var(--bg-card)';
const EDGE = 'var(--border-subtle)';
const DIM = 'var(--text-dim)';
const SEC = 'var(--text-secondary)';
const PRI = 'var(--text-primary)';
const OK = '#5cb87a';

interface Step { name: string; does: string; result: string }
interface Pipeline { name: string; repo: string; script: string; runner: string; steps: Step[] }

const PIPELINES: Pipeline[] = [
  {
    name: 'engine-ci', repo: 'Event-driven engine, C++17', script: 'scripts/ci-engine.sh',
    runner: 'ubuntu-22.04, g++ 11.4',
    steps: [
      { name: 'Build', does: 'Compiles the engine, both test suites and the replay with -Wall -Wextra.',
        result: '0 warnings' },
      { name: 'Unit tests', does: 'Runs the engine suite and the trader platform suite. A failed check in either suite fails the pipeline.',
        result: '41 tests, 6,120 checks passed' },
      { name: 'Tick replay', does: 'Replays a scripted session with duplicate and stale ticks, a failed solve and a burst of 120 prices, while reader threads check every published curve set.',
        result: '1.6 million reads, 0 incoherent' },
      { name: 'Logs kept', does: 'The build log, both test logs and the replay log are stored with the run.',
        result: '4 files' },
    ],
  },
  {
    name: 'site-ci', repo: 'This site, TypeScript and React', script: 'scripts/ci-site.sh',
    runner: 'ubuntu-latest, Node 24',
    steps: [
      { name: 'Lint', does: 'ESLint over every source file, with the warning count capped at its present level.',
        result: '0 errors' },
      { name: 'Type-check and build', does: 'tsc over the whole project, then the production bundle.',
        result: 'built' },
      { name: 'Data checks', does: 'Every exported file parses, fits the host limit and holds the fields the panels read.',
        result: '10 files, 0 problems' },
      { name: 'Smoke test', does: 'Serves the built site and requests the front page, each stage and the recorded session.',
        result: '6 requests answered' },
    ],
  },
];

const GATES: [string, string, string][] = [
  ['Round trip', 'Every rebuilt curve family re-implies the quotes it was built from.', 'within 0.00001 bp'],
  ['Rebuild count', 'Each shifted quote rebuilds the curves that depend on it and no others.', 'equal to the dependency graph'],
  ['Reconciliation', 'The valuation adjustments from sensitivities agree with full revaluation in total.', 'within 1%'],
  ['Positivity', 'Every valuation adjustment and the headline deduction are zero or positive.', 'no negative value'],
];

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-sm mb-2 font-mono uppercase tracking-wider" style={{ color: DIM }}>{children}</p>;
}

export default function PipelinesPanel() {
  return (
    <div>
      <p className="text-sm mb-6 max-w-4xl" style={{ color: SEC }}>
        Each repository has one pipeline, defined as a GitHub Actions workflow. Every stage
        calls a script that lives in the repository, so the commands on the runner are the
        commands a developer runs before a push. The results shown are from a local run of
        those scripts on 2026-11-19.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {PIPELINES.map(p => (
          <div key={p.name} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${EDGE}`, background: CARD }}>
            <div className="px-4 py-3" style={{ borderBottom: `1px solid ${EDGE}` }}>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="font-mono text-sm font-semibold" style={{ color: PRI }}>{p.name}</span>
                <span className="text-xs" style={{ color: SEC }}>{p.repo}</span>
              </div>
              <div className="font-mono text-[10px] mt-1" style={{ color: DIM }}>
                {p.script}, {p.runner}, on push and pull request
              </div>
            </div>
            {p.steps.map((s, i) => (
              <div key={s.name} className="px-4 py-3 flex gap-3"
                   style={{ borderTop: i ? `1px solid ${EDGE}` : undefined }}>
                <span className="font-mono text-[11px] w-4 shrink-0 pt-0.5 text-right" style={{ color: DIM }}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: PRI }}>{s.name}</span>
                    <span className="font-mono text-[11px]" style={{ color: OK }}>{s.result}</span>
                  </div>
                  <div className="text-xs leading-relaxed mt-1" style={{ color: SEC }}>{s.does}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-10">
        <Label>Gates on the data export</Label>
        <p className="text-sm mb-3 max-w-4xl" style={{ color: SEC }}>
          The numbers on this site are written by an export run on the workstation. The export
          applies the gates below to the valuation adjustments. When one fails, the export
          prints the value that failed and stops before it writes a file.
        </p>
        <div className="rounded-lg overflow-x-auto max-w-4xl" style={{ border: `1px solid ${EDGE}` }}>
          <table className="w-full text-xs" style={{ background: CARD }}>
            <thead>
              <tr style={{ color: DIM }}>
                {['Gate', 'Check', 'Tolerance'].map(h => (
                  <th key={h} className="text-left font-mono font-normal uppercase tracking-wider text-[10px] px-4 py-2"
                      style={{ borderBottom: `1px solid ${EDGE}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GATES.map(([g, c, t], i) => (
                <tr key={g} style={{ borderTop: i ? `1px solid ${EDGE}` : undefined }}>
                  <td className="px-4 py-2.5 font-semibold whitespace-nowrap" style={{ color: PRI }}>{g}</td>
                  <td className="px-4 py-2.5 leading-relaxed" style={{ color: SEC }}>{c}</td>
                  <td className="px-4 py-2.5 font-mono whitespace-nowrap" style={{ color: SEC }}>{t}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-10">
        <Label>Outside the pipelines today</Label>
        <div className="rounded-lg overflow-hidden max-w-4xl" style={{ border: `1px solid ${EDGE}` }}>
          {[
            ['The batch engine',
             'The curve and risk engine links QuantLib and CUDA and needs a GPU host. It is built and reconciled on the workstation, and its checks are the ones on the Architecture tab.'],
            ['Publishing',
             'A release is a manual deploy of a build that passed, first to a staging address and then to the live one.'],
            ['Monitoring',
             'The site is static files, so there is no service to alert on. The engine records the timing of every cycle, and the session replay shows those timings.'],
          ].map(([h, b], i) => (
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
