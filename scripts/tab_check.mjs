// Opens the stage 03 tabs that read the bond figures and reports page errors
// and whether each shows the strings named. Usage:
//   node scripts/tab_check.mjs http://localhost:4173 [screenshot-dir]
import puppeteer from 'puppeteer';

const BASE = (process.argv[2] || 'http://localhost:4173').replace(/\/$/, '');
const SHOTS = process.argv[3];
const TABS = [
  ['desk', ['GOVT_RV']],
  ['limits', ['Govt bonds', 'Bond net']],
  ['var', ['Bonds', 'Swaps']],
  ['stress', ['Sovereign spread widening', 'GOVT_RV']],
  ['eod', ['Government bond']],
  ['va', ['Bonds']],
  ['exit', ['Government bonds']],
  ['bonds', ['BOND_NET']],
];

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
let problems = 0;
for (const [tab, needs] of TABS) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1100 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  await page.goto(`${BASE}/rates/live?tab=${tab}`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise(r => setTimeout(r, 1500));
  const text = await page.evaluate(() => document.body.innerText);
  const missing = needs.filter(n => !text.includes(n));
  const bad = /NaN|undefined|Infinity/.exec(text);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${tab}.png`, fullPage: true });
  const ok = !errors.length && !missing.length && !bad;
  if (!ok) problems++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${tab}  missing=${JSON.stringify(missing)} errors=${JSON.stringify(errors)} bad=${bad ? bad[0] : ''}`);
  await page.close();
}
await browser.close();
console.log(`${TABS.length} tabs, ${problems} problems`);
process.exit(problems ? 1 : 0);
