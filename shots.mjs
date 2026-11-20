// Automated screenshot generation and verification pipeline for Leonida Trophy Guide v3.
// Spins up a local static server, launches headless Chromium via Playwright,
// renders each target view, validates offline integrity, and asserts tracker functionality.

import { createServer } from 'node:http';
import { createReadStream, statSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve, join, extname, normalize, sep } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/home/hatch/workspace/tools/shots/node_modules/playwright-core');

const appRoot = resolve('app');
const screenshotsDir = resolve('screenshots');
mkdirSync(screenshotsDir, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer((req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const filePath = resolve(join(appRoot, normalize(pathname)));
    if (filePath !== appRoot && !filePath.startsWith(appRoot + sep)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    const stats = statSync(filePath);
    if (!stats.isFile()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'content-length': stats.size,
      'cache-control': 'no-store',
    });
    createReadStream(filePath).pipe(res);
  } catch (err) {
    res.writeHead(404).end('not found');
  }
});

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  
  let browser;
  let hasErrors = false;
  const requests = [];

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const shotsConfig = JSON.parse(readFileSync('shots.json', 'utf8'));
    const results = [];

    for (const shot of shotsConfig) {
      const context = await browser.newContext({
        viewport: shot.viewport
      });
      const page = await context.newPage();

      page.on('request', req => {
        requests.push(req.url());
      });

      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.error('Console error:', msg.text());
          hasErrors = true;
        }
      });

      page.on('pageerror', err => {
        console.error('Page error:', err);
        hasErrors = true;
      });

      const targetUrl = `${baseUrl}${shot.path}`;
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

      // Wait for __shotReady (up to 15s)
      const readyStart = Date.now();
      let isReady = false;
      while (Date.now() - readyStart < 15000) {
        isReady = await page.evaluate(() => !!window.__shotReady);
        if (isReady) break;
        await new Promise(r => setTimeout(r, 100));
      }
      if (!isReady) {
        console.error(`Timeout waiting for __shotReady on ${shot.file}`);
        hasErrors = true;
        await context.close();
        continue;
      }

      // Wait for __shotApplied (up to 15s)
      const appliedStart = Date.now();
      let isApplied = false;
      while (Date.now() - appliedStart < 15000) {
        isApplied = await page.evaluate(() => !!window.__shotApplied);
        if (isApplied) break;
        await new Promise(r => setTimeout(r, 100));
      }
      if (!isApplied) {
        console.error(`Timeout waiting for __shotApplied on ${shot.file}`);
        hasErrors = true;
        await context.close();
        continue;
      }

      // Additional paint wait
      await new Promise(r => setTimeout(r, 300));

      const outFilePath = join(screenshotsDir, shot.file);
      await page.screenshot({ path: outFilePath, type: 'jpeg', quality: 82 });
      await context.close();

      const fileBuf = readFileSync(outFilePath);
      const sizeBytes = fileBuf.length;
      const dims = getJpegDimensions(fileBuf) || { width: shot.viewport.width, height: shot.viewport.height };
      results.push({ file: shot.file, size: sizeBytes, width: dims.width, height: dims.height });
    }

    // Tracker proof
    const proofContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const proofPage = await proofContext.newPage();
    
    proofPage.on('request', req => requests.push(req.url()));
    proofPage.on('console', msg => { if (msg.type() === 'error') hasErrors = true; });
    proofPage.on('pageerror', () => { hasErrors = true; });

    await proofPage.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
    
    // Wait for ready
    let proofReady = false;
    const pStart = Date.now();
    while (Date.now() - pStart < 15000) {
      proofReady = await proofPage.evaluate(() => !!window.__shotReady);
      if (proofReady) break;
      await new Promise(r => setTimeout(r, 100));
    }
    if (!proofReady) {
      console.error('Tracker proof failed: not ready');
      hasErrors = true;
    } else {
      // Click first trophy checkbox
      await proofPage.click('.trophy-checkbox');
      const isCheckedBefore = await proofPage.isChecked('.trophy-checkbox');
      if (!isCheckedBefore) {
        console.error('Tracker proof failed: checkbox not checked');
        hasErrors = true;
      }

      // Reload page and verify survival
      await proofPage.reload({ waitUntil: 'domcontentloaded' });
      while (!(await proofPage.evaluate(() => !!window.__shotReady))) {
        await new Promise(r => setTimeout(r, 100));
      }
      const isCheckedAfterReload = await proofPage.isChecked('.trophy-checkbox');
      if (!isCheckedAfterReload) {
        console.error('Tracker proof failed: state did not survive reload');
        hasErrors = true;
      }

      // Export progress
      const [download] = await Promise.all([
        proofPage.waitForEvent('download', { timeout: 10000 }),
        proofPage.click('#export-btn')
      ]);
      const downloadPath = await download.path();

      // Clear localStorage and import
      await proofPage.evaluate(() => localStorage.clear());
      await proofPage.reload({ waitUntil: 'domcontentloaded' });
      while (!(await proofPage.evaluate(() => !!window.__shotReady))) {
        await new Promise(r => setTimeout(r, 100));
      }
      
      const isCheckedCleared = await proofPage.isChecked('.trophy-checkbox');
      if (isCheckedCleared) {
        console.error('Tracker proof failed: clear localStorage did not uncheck');
        hasErrors = true;
      }

      await proofPage.setInputFiles('#import-input', downloadPath);
      await new Promise(r => setTimeout(r, 500));

      const isCheckedImported = await proofPage.isChecked('.trophy-checkbox');
      if (!isCheckedImported) {
        console.error('Tracker proof failed: import did not restore checked state');
        hasErrors = true;
      }
    }
    await proofContext.close();

    await browser.close();
    server.close();

    // Check external requests
    for (const reqUrl of requests) {
      try {
        const parsed = new URL(reqUrl);
        if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1' && parsed.protocol !== 'data:') {
          console.error(`External request detected: ${reqUrl}`);
          hasErrors = true;
        }
      } catch (e) {
        // ignore invalid urls
      }
    }

    if (hasErrors) {
      process.exit(1);
    }

    for (const r of results) {
      console.log(`${r.file} size=${r.size} bytes dims=${r.width}x${r.height}`);
    }
    process.exit(0);

  } catch (err) {
    console.error('Error in screenshot harness:', err);
    if (browser) await browser.close();
    server.close();
    process.exit(1);
  }
});

function getJpegDimensions(buffer) {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xFF) return null;
    const marker = buffer[offset + 1];
    if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return { width, height };
    }
    const length = buffer.readUInt16BE(offset + 2);
    offset += 2 + length;
  }
  return null;
}
