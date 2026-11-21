/* The agent workflow in the event-driven engine's repository: the stages, what
   each role may touch, how that is enforced, and the first change taken
   through it. The figures are from the run of 2026-11-21 and the files named
   are in the repository. */

const CARD = 'var(--bg-card)';
const EDGE = 'var(--border-subtle)';
const DIM = 'var(--text-dim)';
const SEC = 'var(--text-secondary)';
const PRI = 'var(--text-primary)';
const OK = '#5cb87a';
const NO = '#c86e6e';
const PERSON = '#5b8fc9';
const AGENT = '#d9a441';
const MACHINE = '#8b8a97';

type Kind = 'person' | 'agent' | 'machine';
const KIND: Record<Kind, [string, string]> = {
  person: ['a person', PERSON], agent: ['agent', AGENT], machine: ['no model', MACHINE],
};

const STAGES: { n: string; name: string; kind: Kind; who: string; may: string; cannot: string; exit: string }[] = [
  { n: '0', name: 'Spec', kind: 'person', who: 'specs/<name>.md',
    may: 'States the change, the function signatures and the acceptance criteria, each with the number it has to reconcile to.',
    cannot: '',
    exit: 'committed before the run starts' },
  { n: '1', name: 'Tests', kind: 'agent', who: 'test-writer',
    may: 'Reads the spec, the headers and the existing tests. Writes only under tests/.',
    cannot: 'Cannot read an implementation file or run a command.',
    exit: 'only tests/ changed' },
  { n: '2', name: 'Build', kind: 'agent', who: 'builder',
    may: 'Implements until the tests pass. Runs the pipeline script and read-only git.',
    cannot: 'Cannot edit tests, specs, pipeline scripts or agent configuration.',
    exit: 'tests unchanged since stage 1' },
  { n: '3', name: 'Pipeline', kind: 'machine', who: 'scripts/ci-engine.sh all',
    may: 'Build, three test suites, the static data reconciliation and the tick replay. The hosted pipeline runs the same script.',
    cannot: '',
    exit: 'green with 0 warnings' },
  { n: '4', name: 'Review', kind: 'agent', who: 'numerics-reviewer',
    may: 'Reads the spec and the diff, works the arithmetic and checks that no existing check was weakened.',
    cannot: 'Cannot edit anything.',
    exit: 'last line is VERDICT: PASS' },
  { n: '5', name: 'Release', kind: 'person', who: 'commit and push',
    may: 'Reads the diff and the review, commits, and the hosted pipeline runs again on the push.',
    cannot: '',
    exit: 'the runner does not commit' },
];

const GUARDS: [string, string][] = [
  ['A hook on every tool call',
   'The runner starts each session with its role. A hook reads every read, edit and command before it runs and blocks one outside that role. A call the hook cannot parse is blocked.'],
  ['A check from git after every stage',
   'The runner lists the files that changed. Stage 1 fails if anything outside tests/ changed. Stage 2 fails if the tests changed or a protected path was touched. The separation holds even if a call got past the hook.'],
  ['A dispute goes to a person',
   'A builder that believes a test is wrong stops and replies TEST DISPUTE with its arithmetic. It does not get to change the test.'],
  ['Each agent starts cold',
   'The three sessions share no context. The reviewer sees the spec and the diff, and has no record of how the builder reasoned.'],
];

const RUN: [string, string, string][] = [
  ['1 Tests', '181 s', 'One test of 200 lines and 41 checks. Each expected value has a second route: a closed form, a second difference with a derived tolerance, or a remainder bound.'],
  ['2 Build', '53 s', 'A 13-line function and its declaration. The tests were left unchanged.'],
  ['3 Pipeline', 'green', '60 tests, 6,448 checks, 0 warnings, 0 incoherent reads in the replay.'],
  ['4 Review', '88 s', 'Passed with nothing required and six suggestions.'],
];

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-sm mb-2 font-mono uppercase tracking-wider" style={{ color: DIM }}>{children}</p>;
}

export default function AgentFlowPanel() {
  return (
    <div>
      <p className="text-sm mb-6 max-w-4xl" style={{ color: SEC }}>
        A change to the event-driven engine goes from a written spec to a reviewed diff through
        three Claude Code agents and one stage with no model in it. Each agent is a separate
        headless session with one job, and the agent that writes the code cannot change the
        tests that judge it.
      </p>

      <div className="rounded-lg overflow-x-auto mb-8 max-w-4xl" style={{ border: `1px solid ${EDGE}`, background: CARD }}>
        <img src="/diagrams/agent-flow.svg" style={{ width: '100%', maxWidth: 520, display: 'block', margin: '0 auto', padding: '12px 0' }}
          alt="Flowchart of the agent workflow. A person writes a spec. Inside the runner script, a test-writer agent writes tests from the spec and the headers, a builder agent implements until those tests pass, a pipeline stage with no model runs the build, the test suites, the static data reconciliation and the tick replay, and a read-only reviewer agent ends in a verdict. A hook guards every tool call and a git check follows every stage. On a pass a person reads the diff and the review, commits and pushes, and the hosted pipeline runs again." />
      </div>

      <Label>Stages</Label>
      <div className="rounded-lg overflow-hidden max-w-5xl" style={{ border: `1px solid ${EDGE}`, background: CARD }}>
        {STAGES.map((s, i) => (
          <div key={s.n} className="px-4 py-3 flex gap-3" style={{ borderTop: i ? `1px solid ${EDGE}` : undefined }}>
            <span className="font-mono text-[11px] w-4 shrink-0 pt-0.5 text-right" style={{ color: DIM }}>{s.n}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-sm font-semibold" style={{ color: PRI }}>{s.name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: KIND[s.kind][1] }}>{KIND[s.kind][0]}</span>
                  <span className="font-mono text-[11px]" style={{ color: SEC }}>{s.who}</span>
                </div>
                <span className="font-mono text-[11px]" style={{ color: OK }}>{s.exit}</span>
              </div>
              <div className="text-xs leading-relaxed mt-1" style={{ color: SEC }}>
                {s.may}{s.cannot && <span style={{ color: NO }}> {s.cannot}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <Label>How the separation is enforced</Label>
        <div className="rounded-lg overflow-hidden max-w-4xl" style={{ border: `1px solid ${EDGE}` }}>
          {GUARDS.map(([h, b], i) => (
            <div key={h} className="px-4 py-3" style={{ borderTop: i ? `1px solid ${EDGE}` : undefined, background: CARD }}>
              <div className="text-xs font-semibold mb-1" style={{ color: PRI }}>{h}</div>
              <div className="text-xs leading-relaxed" style={{ color: SEC }}>{b}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <Label>First run: bond convexity at a yield</Label>
        <p className="text-sm mb-3 max-w-4xl" style={{ color: SEC }}>
          The spec asked for one function, the second derivative of price in yield over the
          price, with five acceptance criteria. The run took 5 minutes 23 seconds on
          2026-11-21 and the result is in the engine.
        </p>
        <div className="rounded-lg overflow-x-auto max-w-4xl" style={{ border: `1px solid ${EDGE}` }}>
          <table className="w-full text-xs" style={{ background: CARD }}>
            <thead>
              <tr style={{ color: DIM }}>
                {['Stage', 'Time', 'Result'].map(h => (
                  <th key={h} className="text-left font-mono font-normal uppercase tracking-wider text-[10px] px-4 py-2"
                      style={{ borderBottom: `1px solid ${EDGE}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RUN.map(([s, t, r], i) => (
                <tr key={s} style={{ borderTop: i ? `1px solid ${EDGE}` : undefined }}>
                  <td className="px-4 py-2.5 font-semibold whitespace-nowrap align-top" style={{ color: PRI }}>{s}</td>
                  <td className="px-4 py-2.5 font-mono whitespace-nowrap align-top" style={{ color: OK }}>{t}</td>
                  <td className="px-4 py-2.5 leading-relaxed align-top" style={{ color: SEC }}>{r}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-lg overflow-hidden max-w-4xl mt-3" style={{ border: `1px solid ${EDGE}` }}>
          {[
            ['What the review found',
             'The spec gave the units as years squared, but the yield compounds per coupon period. The two agree for annual bonds, which is every bond in the engine today, and would not for a semi-annual one. The reviewer also noted that a yield at or below minus one was left undefined. Both were gaps in the spec, and the spec and the header comment were corrected by hand before the commit.'],
            ['What the guard blocked',
             'The test writer tried to read a file outside the repository and was refused.'],
          ].map(([h, b], i) => (
            <div key={h} className="px-4 py-3" style={{ borderTop: i ? `1px solid ${EDGE}` : undefined, background: CARD }}>
              <div className="text-xs font-semibold mb-1" style={{ color: PRI }}>{h}</div>
              <div className="text-xs leading-relaxed" style={{ color: SEC }}>{b}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <Label>What it does not do yet</Label>
        <div className="rounded-lg overflow-hidden max-w-4xl" style={{ border: `1px solid ${EDGE}` }}>
          {[
            ['One model in three roles',
             'The reviewer is a second context on the same model as the builder. It catches what a fresh reading catches. The result rests on the tests and the pipeline, which involve no model.'],
            ['No agent in the hosted pipeline',
             'The agents run on the workstation. The hosted pipeline runs the deterministic stages on every push, and a review step on pull requests is the next addition.'],
            ['One real run',
             'The workflow has taken one small change through. The failure paths have not come up in a run with a model. The pipeline tests them on every push with a stub that edits a test, touches a protected file or disputes a test, 18 cases in all.'],
          ].map(([h, b], i) => (
            <div key={h} className="px-4 py-3" style={{ borderTop: i ? `1px solid ${EDGE}` : undefined, background: CARD }}>
              <div className="text-xs font-semibold mb-1" style={{ color: PRI }}>{h}</div>
              <div className="text-xs leading-relaxed" style={{ color: SEC }}>{b}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
