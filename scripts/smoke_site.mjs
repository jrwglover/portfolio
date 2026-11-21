// Smoke test for the built site, run against `vite preview` by
// scripts/ci-site.sh smoke:   node scripts/smoke_site.mjs http://localhost:4173
//
// The site is a single-page app, so every path, including a missing data file,
// comes back as index.html with status 200. Status codes prove nothing here.
// This script checks what a reader would get instead:
//   1. every data file a page fetches is served as JSON and parses;
//   2. every route below, opened in a headless browser, renders its stage
//      heading and the named tab's own content, selects that tab (the page
//      title carries the panel's name), and raises no page error, no console
//      error and no failed request on the site's own origin.
import puppeteer from 'puppeteer';

const BASE = (process.argv[2] || process.env.SMOKE_URL || 'http://localhost:4173').replace(/\/$/, '');
const WAIT_MS = Number(process.env.SMOKE_WAIT_MS || 60000);   // the machine can be slow

// Every file a dashboard fetches. Keep in step with REQUIRED in
// scripts/check_site_data.py.
const DATA_FILES = [
  'curve_model/bonds.json', 'curve_model/curves.json', 'curve_model/inputs.json',
  'curve_model/performance.json', 'curve_model/trades.json',
  'rt_engine/demo.json', 'rt_engine/eod_marking.json', 'rt_engine/graph.json',
  'rt_engine/risk_val.json', 'rt_engine/timeline.json', 'rt_engine/val_adjustments.json',
];

// path: what is opened. h1: the stage heading. title: the start of the
// document title, which names the selected panel; a tab key that no longer
// exists falls back to the first panel and fails here. headings: h2-h4 text
// the panel must show. text: strings the panel itself must show, outside the
// notes, chosen so that most of them need the panel's data to have loaded.
const ROUTES = [
  { path: '/', h1: 'Johnathon Glover', title: 'Johnathon Glover', headings: ['Three stages'] },
  { path: '/rates/curves', h1: 'Build the curves', title: 'Market data model', text: ['Pillar', 'EUR_ESTR', 'EUR_GOVT'] },
  { path: '/rates/book', h1: 'Get the book in', title: 'The problem', text: ['255 MB'] },
  { path: '/rates/live', h1: 'Run the book live', title: 'Trading session replay', headings: ['Trading session replay'] },
  { path: '/rates/curves?tab=pipelines', h1: 'Build the curves', title: 'Build and test pipelines', text: ['engine-ci'] },
  { path: '/rates/curves?tab=agents', h1: 'Build the curves', title: 'Agent workflow', text: ['test-writer'] },
  { path: '/rates/curves?tab=bonds', h1: 'Build the curves', title: 'Bond relative value', text: ['Universe', 'on the curve', 'Rich and cheap against the curve'] },
  { path: '/rates/book?tab=static', h1: 'Get the book in', title: 'Static data', text: ['Fields compared', 'Two sources of the same terms'] },
  // The bond desk heading is drawn only when timeline.json carries a bondDesk.
  { path: '/rates/live?tab=bonds', h1: 'Run the book live', title: 'Government bonds', headings: ['Government bonds'] },
];

let failures = 0;
const fail = (what, why) => { failures++; console.error(`FAIL ${what}: ${why}`); };

async function checkData() {
  for (const f of DATA_FILES) {
    const url = `${BASE}/data/${f}`;
    try {
      const r = await fetch(url);
      const type = r.headers.get('content-type') || '';
      if (r.status !== 200) { fail(url, `status ${r.status}`); continue; }
      if (!type.includes('json')) { fail(url, `served as ${type || 'no type'}, not JSON (missing file?)`); continue; }
      const body = await r.text();
      JSON.parse(body);
      console.log(`ok   /data/${f} (${body.length} bytes)`);
    } catch (e) {
      fail(url, e.message);
    }
  }
}

async function checkRoute(browser, route) {
  const page = await browser.newPage();
  const origin = new URL(BASE).origin;
  const problems = [];
  page.on('pageerror', e => problems.push(`page error: ${e.message}`));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const at = m.location()?.url || '';
    if (at && !at.startsWith(origin)) return;          // a third-party font or similar
    problems.push(`console error: ${m.text()}`);
  });
  page.on('requestfailed', r => {
    if (r.url().startsWith(origin)) problems.push(`request failed: ${r.url()} ${r.failure()?.errorText ?? ''}`);
  });
  page.on('response', r => {
    const u = r.url();
    if (!u.startsWith(origin)) return;
    if (r.status() >= 400) problems.push(`HTTP ${r.status()} for ${u}`);
    const path = new URL(u).pathname;
    if (path.startsWith('/data/') && path.endsWith('.json') && !(r.headers()['content-type'] || '').includes('json'))
      problems.push(`${path} came back as ${r.headers()['content-type']}, not JSON`);
    if (/\.(js|css)$/.test(path) && (r.headers()['content-type'] || '').includes('html'))
      problems.push(`${path} came back as HTML (missing bundle?)`);
  });

  const want = { h1: route.h1, headings: route.headings || [], text: route.text || [] };
  let seen = null;
  try {
    await page.goto(BASE + route.path, { waitUntil: 'networkidle0', timeout: WAIT_MS });
    try {
      await page.waitForFunction(w => {
        const h1 = document.querySelector('h1')?.textContent || '';
        const hs = [...document.querySelectorAll('h2,h3,h4')].map(h => h.textContent.trim());
        const host = document.querySelector('h1 ~ div') || document.body;
        const c = host.cloneNode(true);
        c.querySelectorAll('section').forEach(s => s.remove());     // the notes, not the panel
        const text = c.textContent || '';
        return h1.includes(w.h1) && w.headings.every(x => hs.some(h => h.includes(x))) && w.text.every(x => text.includes(x));
      }, { timeout: WAIT_MS, polling: 250 }, want);
    } catch {
      seen = await page.evaluate(w => {
        const h1 = document.querySelector('h1')?.textContent || '(no h1)';
        const hs = [...document.querySelectorAll('h2,h3,h4')].map(h => h.textContent.trim());
        const host = document.querySelector('h1 ~ div') || document.body;
        const c = host.cloneNode(true);
        c.querySelectorAll('section').forEach(s => s.remove());
        const text = c.textContent || '';
        return {
          h1,
          missingHeadings: w.headings.filter(x => !hs.some(h => h.includes(x))),
          missingText: w.text.filter(x => !text.includes(x)),
        };
      }, want);
      problems.push(`expected content did not render: ${JSON.stringify(seen)}`);
    }
    const title = await page.title();
    if (!title.startsWith(route.title)) problems.push(`page title "${title}", expected it to start with "${route.title}"`);
  } catch (e) {
    problems.push(`could not load: ${e.message}`);
  }
  await page.close();
  if (problems.length) problems.forEach(p => fail(route.path, p));
  else console.log(`ok   ${route.path}`);
}

await checkData();
const browser = await puppeteer.launch({
  headless: true,
  // The hosted runner's kernel blocks Chrome's user-namespace sandbox.
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  for (const r of ROUTES) await checkRoute(browser, r);
} finally {
  await browser.close();
}
console.log(`${DATA_FILES.length} data files, ${ROUTES.length} routes, ${failures} problems`);
process.exit(failures ? 1 : 0);
