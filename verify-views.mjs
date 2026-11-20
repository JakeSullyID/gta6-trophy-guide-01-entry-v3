import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { resolve, join, normalize } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/hatch/workspace/tools/shots/node_modules/playwright-core');

const appRoot = resolve('app');
const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const filePath = resolve(join(appRoot, normalize(pathname)));
  const stats = statSync(filePath);
  res.writeHead(200, { 'content-length': stats.size });
  createReadStream(filePath).pipe(res);
});

await new Promise(resolveServer => server.listen(0, '127.0.0.1', resolveServer));
const port = server.address().port;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });

async function waitForShot(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  let ready = false;
  for (let i = 0; i < 300; i++) {
    ready = await page.evaluate(() => !!window.__shotReady);
    if (ready) break;
    await new Promise(r => setTimeout(r, 50));
  }
  let applied = false;
  for (let i = 0; i < 300; i++) {
    applied = await page.evaluate(() => !!window.__shotApplied);
    if (applied) break;
    await new Promise(r => setTimeout(r, 50));
  }
  await new Promise(r => setTimeout(r, 200));
}

const p1 = await browser.newPage();
await waitForShot(p1, `http://127.0.0.1:${port}/?shot=missables`);
const missablesActive = await p1.evaluate(() => document.getElementById('section-missables').classList.contains('active'));
await p1.close();

const p2 = await browser.newPage();
await waitForShot(p2, `http://127.0.0.1:${port}/?shot=spoiler`);
const spoilerText = await p2.evaluate(() => document.getElementById('spoiler-toggle').textContent);
await p2.close();

await browser.close();
await new Promise(resolveClose => server.close(resolveClose));

console.log('Missables active:', missablesActive);
console.log('Spoiler toggle text:', spoilerText);
if (missablesActive && spoilerText.includes('on')) {
  process.exit(0);
} else {
  process.exit(1);
}
