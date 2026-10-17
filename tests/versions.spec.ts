import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type WebSocketRoute } from '@playwright/test';
import { memoryFrame } from './helpers/sni';
import { WIDGETS, buildPreviewUrl, determineBoxCount, type WidgetSettings } from '../src/preview/config';
import { buildLegacyUrl } from '../src/landing/legacyLaunch';
import { METRICS, TIMER_FONTS, TIMER_LANGUAGES, TIMER_VARIANTS, hexToRgb, resolveAppearance } from '../src/preview/appearance';
import { timerText } from '../src/preview/timerFormat';
import { PREVIEW_DEFAULTS_KEY, factoryPreviewDefaults } from '../src/landing/previewDefaults';
import { CUSTOM_FONTS_DATABASE, MAX_FONT_BYTES, customFontFamily } from '../src/preview/customFonts';

const legacyQuery = '?tracker=true&checkCount=true&bonks=true&chestTurns=true&deaths=true&rupees=true&screens=true&damage=true&magic=true&boxes=4';

function idleDevice(socket: WebSocketRoute) {
  socket.onMessage((message) => {
    const request = JSON.parse(String(message));
    if (request.Opcode === 'DeviceList') socket.send(JSON.stringify({ Results: ['Fixture'] }));
    if (request.Opcode === 'GetAddress') socket.send(Buffer.from([0]));
  });
}

function runningDevice(socket: WebSocketRoute) {
  socket.onMessage((message) => {
    const request = JSON.parse(String(message));
    if (request.Opcode === 'DeviceList') socket.send(JSON.stringify({ Results: ['Fixture'] }));
    if (request.Opcode === 'GetAddress') {
      socket.send(request.Operands[0] === 'f50010' ? Buffer.from([7]) : Buffer.from(memoryFrame({ checkCount: 55, bonks: 2, chestTurns: 11, deaths: 1, rupees: 500, screens: 120, damage: 127, magic: 240 })));
    }
  });
}

const customFontFile = {
  name: `${'personal-timer-'.repeat(12)}.woff2`,
  mimeType: 'font/woff2',
  buffer: readFileSync(new URL('../src/preview/fonts/jetbrains-mono-latin-700-normal.woff2', import.meta.url)),
};

async function expectCustomFont(element: Locator, id: string) {
  const family = customFontFamily(id);
  await expect(element).toHaveCSS('font-family', `"${family}"`);
  expect(await element.evaluate(async (_, family) => {
    const faces = await document.fonts.load(`700 36px "${family}"`, '0123456789:');
    return faces.length === 1 && faces[0].status === 'loaded' && document.fonts.check(`700 36px "${family}"`, '0123456789:');
  }, family)).toBe(true);
}

test('custom font upload persists locally, preserves old links and fits both timer surfaces', async ({ page, context, browser }) => {
  let running = false;
  await context.routeWebSocket('ws://localhost:23074', (socket) => {
    socket.onMessage((message) => {
      const request = JSON.parse(String(message));
      if (request.Opcode === 'DeviceList') socket.send(JSON.stringify({ Results: ['Fixture'] }));
      if (request.Opcode === 'GetAddress') {
        socket.send(request.Operands[0] === 'f50010' ? Buffer.from([running ? 7 : 0]) : Buffer.from(memoryFrame()));
      }
    });
  });
  const errors: string[] = [];
  const externalFonts: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/\.(woff2?|ttf|otf)(\?|$)/.test(request.url()) && new URL(request.url()).origin !== new URL(page.url()).origin) externalFonts.push(request.url());
  });
  await page.goto('./index.html');
  const preview = page.getByRole('region', { name: 'v0.1.0-preview' });
  const sample = preview.getByLabel('Timer preview', { exact: true });
  const input = preview.getByLabel('Custom font file', { exact: true });
  await preview.getByLabel('Timer color', { exact: true }).fill('#c43d52');
  await input.setInputFiles(customFontFile);
  await expect(preview.getByLabel('Timer font', { exact: true })).toHaveValue('custom');
  await expect(preview.getByLabel('Font status', { exact: true })).toHaveText('');
  const family = (await sample.evaluate((element) => getComputedStyle(element).fontFamily)).split('"')[1];
  const id = family.replace('Tracker Custom ', '');
  expect(id).toMatch(/^[0-9a-f]{32}$/);
  await expectCustomFont(sample, id);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  const option = preview.getByRole('option', { name: /^Custom:/ });
  expect((await option.textContent())!.length).toBeLessThanOrEqual(128);
  await sample.evaluate((element) => { element.style.width = '80px'; });
  await expect.poll(() => sample.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeLessThan(30);
  expect(await sample.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await sample.evaluate((element) => { element.style.width = ''; });
  await expect(sample).toHaveCSS('font-size', '30px');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/custom-font-editor-${page.viewportSize()!.width}.png`, fullPage: true });
  await preview.getByRole('button', { name: 'Save Defaults' }).click();
  const raw = await page.evaluate((key) => localStorage.getItem(key)!, PREVIEW_DEFAULTS_KEY);
  expect(JSON.parse(raw).appearance.timer).toEqual({ color: '#C43D52', font: 'custom', customFontId: id });
  expect(raw).not.toContain('personal-timer');
  await page.reload();
  await expectCustomFont(sample, id);
  await expect(option).not.toHaveText('Custom: Custom font');
  const opened = page.waitForEvent('popup');
  await preview.getByRole('button', { name: 'Launch', exact: true }).click();
  const popup = await opened;
  popup.on('pageerror', (error) => errors.push(error.message));
  const timer = popup.locator('h2');
  await expectCustomFont(timer, id);
  await expect(timer).toHaveCSS('color', 'rgb(196, 61, 82)');
  await expect(popup.getByText('Connected to Fixture', { exact: true })).toBeVisible();
  expect(await popup.getByRole('button', { name: /^Checks/ }).locator('span').evaluate((element) => getComputedStyle(element).fontFamily)).not.toContain('Tracker Custom');
  await timer.evaluate((element) => { element.style.width = '80px'; });
  await expect.poll(() => timer.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeLessThan(36);
  expect(await timer.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await timer.evaluate((element) => { element.style.width = '100%'; });
  await expect(timer).toHaveCSS('font-size', '36px');
  const bounds = (await timer.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(popup.viewportSize()!.width);
  await expect(timer).toHaveText('00:00:00');
  running = true;
  await expect(timer).not.toHaveText('00:00:00');
  const controls = popup.getByRole('button', { name: 'DE-FLUFF' });
  await expect(controls).toBeVisible();
  const controlBounds = (await controls.boundingBox())!;
  const runningBounds = (await timer.boundingBox())!;
  expect(controlBounds.x).toBeGreaterThanOrEqual(0);
  expect(controlBounds.x + controlBounds.width).toBeLessThanOrEqual(popup.viewportSize()!.width);
  expect(runningBounds.y + runningBounds.height).toBeLessThanOrEqual(controlBounds.y);
  expect(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await popup.screenshot({ path: `test-results/custom-font-timer-${page.viewportSize()!.width}.png`, fullPage: true });
  running = false;
  await input.setInputFiles(customFontFile);
  await expect(sample).not.toHaveCSS('font-family', `"${family}"`);
  await expect(preview.getByLabel('Font status', { exact: true })).toHaveText('');
  await popup.reload();
  await expectCustomFont(timer, id);
  await preview.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(preview.getByLabel('Timer font', { exact: true })).toHaveValue('default');
  await popup.reload();
  await expectCustomFont(timer, id);
  await page.reload();
  await expectCustomFont(sample, id);
  const copied = await browser.newContext({ viewport: page.viewportSize()! });
  try {
    await copied.routeWebSocket('ws://localhost:23074', idleDevice);
    const copiedPage = await copied.newPage();
    copiedPage.on('pageerror', (error) => errors.push(error.message));
    await copiedPage.goto(popup.url());
    await expect(copiedPage.getByText('Connected to Fixture', { exact: true })).toBeVisible();
    await expect(copiedPage.locator('h2')).not.toHaveCSS('font-family', `"${family}"`);
    await expect(copiedPage.locator('h2')).toHaveCSS('color', 'rgb(196, 61, 82)');
    expect(await copiedPage.evaluate(async (name) => (await indexedDB.databases()).some((database) => database.name === name), CUSTOM_FONTS_DATABASE)).toBe(false);
  } finally { await copied.close(); }
  await popup.evaluate(({ name, id }) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('fonts', 'readwrite');
      transaction.objectStore('fonts').delete(id);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onabort = () => { database.close(); reject(transaction.error); };
    };
  }), { name: CUSTOM_FONTS_DATABASE, id });
  await popup.reload();
  await expect(popup.getByText('Connected to Fixture', { exact: true })).toBeVisible();
  await expect(timer).not.toHaveCSS('font-family', `"${family}"`);
  await page.reload();
  await expect(preview.getByLabel('Font status', { exact: true })).toHaveText('Custom font unavailable');
  expect(await page.evaluate((key) => localStorage.getItem(key), PREVIEW_DEFAULTS_KEY)).toBe(raw);
  expect(errors).toEqual([]);
  expect(externalFonts).toEqual([]);
});

test('custom font rejects invalid uploads and denied, quota or aborted storage without losing the draft', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./index.html');
  const preview = page.getByRole('region', { name: 'v0.1.0-preview' });
  const input = preview.getByLabel('Custom font file', { exact: true });
  await preview.getByLabel('Timer font', { exact: true }).selectOption('bungee');
  const cases = [
    { name: 'empty.woff2', buffer: Buffer.alloc(0), message: 'Invalid font file' },
    { name: 'oversized.woff2', buffer: Buffer.alloc(MAX_FONT_BYTES + 1), message: 'Font exceeds 5 MiB' },
    { name: 'font.css', buffer: customFontFile.buffer, message: 'Choose a WOFF2, WOFF, TTF, or OTF font' },
    { name: 'mismatch.ttf', buffer: customFontFile.buffer, message: 'Invalid font file' },
    { name: 'corrupt.woff2', buffer: Buffer.from('wOF2'), message: 'Invalid font file' },
  ];
  for (const upload of cases) {
    await input.setInputFiles({ name: upload.name, mimeType: 'font/woff2', buffer: upload.buffer });
    await expect(preview.getByLabel('Font status', { exact: true })).toHaveText(upload.message);
    await expect(preview.getByLabel('Timer font', { exact: true })).toHaveValue('bungee');
    await expect(preview.getByRole('button', { name: 'Launch', exact: true })).toBeEnabled();
  }
  for (const failure of ['denied', 'quota', 'abort'] as const) {
    await page.reload();
    await preview.getByLabel('Timer font', { exact: true }).selectOption('bungee');
    await page.evaluate((failure) => {
      if (failure === 'denied') Object.defineProperty(window, 'indexedDB', { configurable: true, get() { throw new DOMException('Denied', 'SecurityError'); } });
      if (failure === 'quota') IDBObjectStore.prototype.add = function () { throw new DOMException('Full', 'QuotaExceededError'); };
      if (failure === 'abort') {
        const add = IDBObjectStore.prototype.add;
        IDBObjectStore.prototype.add = function (...args) {
          const request = add.apply(this, args);
          this.transaction.abort();
          return request;
        };
      }
    }, failure);
    await input.setInputFiles(customFontFile);
    await expect(preview.getByLabel('Font status', { exact: true })).toHaveText(failure === 'quota' ? 'Font storage full' : 'Font storage unavailable');
    await expect(preview.getByLabel('Timer font', { exact: true })).toHaveValue('bungee');
    await expect(preview.getByRole('button', { name: 'Launch', exact: true })).toBeEnabled();
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
    await page.screenshot({ path: `test-results/custom-font-${failure}-${page.viewportSize()!.width}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});

test('custom font launches an unsaved upload even when saving defaults fails', async ({ page, context }) => {
  await context.routeWebSocket('ws://localhost:23074', idleDevice);
  await page.goto('./index.html');
  const preview = page.getByRole('region', { name: 'v0.1.0-preview' });
  await page.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('Full', 'QuotaExceededError'); }; });
  await preview.getByLabel('Custom font file', { exact: true }).setInputFiles(customFontFile);
  await expect(preview.getByLabel('Timer font', { exact: true })).toHaveValue('custom');
  await expect(preview.getByLabel('Font status', { exact: true })).toHaveText('');
  await preview.getByRole('button', { name: 'Save Defaults' }).click();
  await expect(preview.getByRole('status', { name: 'Defaults status' })).toHaveText('Save failed');
  const opened = page.waitForEvent('popup');
  await preview.getByRole('button', { name: 'Launch', exact: true }).click();
  const popup = await opened;
  await expect(popup).toHaveTitle('Stonks Tracker - v0.1.0-preview');
  const id = JSON.parse(new URL(popup.url()).searchParams.get('appearance')!).timer.customFontId;
  await expectCustomFont(popup.locator('h2'), id);
  await popup.reload();
  await expectCustomFont(popup.locator('h2'), id);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test('launches independently configured preview and legacy popups', async ({ page, context }) => {
  const sockets: string[] = [];
  await context.routeWebSocket('ws://localhost:23074', (socket) => {
    sockets.push(socket.url());
    socket.onMessage((message) => {
      if (JSON.parse(String(message)).Opcode === 'DeviceList') socket.send(JSON.stringify({ Results: ['Fixture'] }));
    });
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./index.html');
  const preview = page.getByRole('region', { name: 'v0.1.0-preview' });
  const legacy = page.getByRole('region', { name: 'v0.0.43-legacy' });
  await expect(preview.getByRole('checkbox')).toHaveCount(9);
  await expect(legacy.getByRole('checkbox')).toHaveCount(8);
  expect(sockets).toHaveLength(0);
  expect((await preview.boundingBox())!.y).toBeLessThan((await legacy.boundingBox())!.y);
  await preview.getByRole('checkbox', { name: 'Bonks (milliBonks per minute)', exact: true }).uncheck();
  await expect(legacy.getByRole('checkbox', { name: 'Bonks (milliBonks per minute)', exact: true })).toBeChecked();
  const previewOpened = page.waitForEvent('popup');
  await preview.getByRole('button', { name: 'Launch', exact: true }).click();
  const previewPopup = await previewOpened;
  await expect(previewPopup).toHaveTitle('Stonks Tracker - v0.1.0-preview');
  const params = new URL(previewPopup.url()).searchParams;
  expect(params.get('version')).toBe('2');
  expect(params.get('bonks')).toBe('false');
  await expect(previewPopup.getByText('Bonks', { exact: true })).toHaveCount(0);
  await previewPopup.reload();
  await expect(previewPopup.getByText('Bonks', { exact: true })).toHaveCount(0);
  const legacyOpened = page.waitForEvent('popup');
  await legacy.getByRole('button', { name: 'Launch', exact: true }).click();
  const legacyPopup = await legacyOpened;
  await expect(legacyPopup).toHaveTitle('Stonks Tracker - Checks Go Brrrr');
  expect(new URL(legacyPopup.url()).search).toBe(legacyQuery);
  await expect(legacyPopup.getByText('Bonks', { exact: true })).toBeVisible();
  const viewport = page.viewportSize()!;
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.screenshot({ path: `test-results/landing-${viewport.width}.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('preserves the legacy bookmark and appearance', async ({ page }) => {
  await page.routeWebSocket('ws://localhost:23074', (socket) => {
    socket.onMessage((message) => {
      const request = JSON.parse(String(message));
      if (request.Opcode === 'DeviceList') socket.send(JSON.stringify({ Results: ['Fixture'] }));
      if (request.Opcode === 'GetAddress') socket.send(Buffer.from([0]));
    });
  });
  await page.goto(`./index.html${legacyQuery}`);
  await expect(page.getByText('Connected to Fixture', { exact: true })).toBeVisible();
  await expect(page).toHaveTitle('Stonks Tracker - Checks Go Brrrr');
  await expect(page).toHaveScreenshot('legacy-tracker.png', { fullPage: true });
  expect(new URL(page.url()).search).toBe(legacyQuery);
  const checks = page.getByRole('button', { name: /^Checks/ });
  await checks.click();
  await expect(checks.locator('span')).toHaveText('1');
  await checks.click({ button: 'right' });
  await expect(checks.locator('span')).toHaveText('0');
  await checks.hover();
  await page.mouse.wheel(0, 100);
  await expect(checks.locator('span')).toHaveText('-1');
});

test('renders live preview metrics, manual controls and valid colors', async ({ page }) => {
  let frames = 0;
  await page.clock.install({ time: new Date('2026-10-11T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-11T12:00:00Z'));
  await page.routeWebSocket('ws://localhost:23074', (socket) => {
    socket.onMessage((message) => {
      const request = JSON.parse(String(message));
      if (request.Opcode === 'DeviceList') socket.send(JSON.stringify({ Results: ['Fixture'] }));
      if (request.Opcode === 'GetAddress') {
        if (request.Operands[0] === 'f50010') socket.send(Buffer.from([7]));
        else {
          frames += 1;
          socket.send(Buffer.from(memoryFrame({ checkCount: 55, bonks: 2, chestTurns: 11, deaths: 1, rupees: 500, screens: 120, damage: 127, magic: 240 })));
        }
      }
    });
  });
  await page.goto(`./index.html${legacyQuery}&version=2`);
  await expect(page.getByText('Connected to Fixture', { exact: true })).toBeVisible();
  await expect(page.locator('h2')).toHaveText('00:00:00');
  await expect(page.getByRole('button', { name: 'DE-FLUFF' })).not.toBeVisible();
  await page.clock.runFor(125);
  await expect.poll(() => frames).toBe(1);
  await expect(page.locator('h2')).toHaveText('00:00:01');
  await expect(page.getByRole('button', { name: 'DE-FLUFF' })).toBeVisible();
  await page.clock.runFor(125);
  const checks = page.getByRole('button', { name: /^Checks/ });
  await expect(checks.locator('span')).toHaveText('55');
  await expect(page.getByText('1.9', { exact: true })).toBeVisible();
  await expect(page.getByText('16', { exact: true })).toBeVisible();
  await page.clock.runFor(875);
  await expect(page.locator('h2')).toHaveText('00:00:02');
  await page.clock.runFor(1125);
  await checks.click();
  await expect(checks.locator('span')).toHaveText('56');
  await page.getByRole('button', { name: 'DE-FLUFF' }).click();
  await expect(checks.locator('span')).toHaveText('55');
  await page.getByRole('button').nth(1).click();
  await expect(page.locator('h2')).toHaveText('00:00:03');
  const pausedTime = await page.locator('h2').textContent();
  await page.clock.runFor(2000);
  await expect(page.locator('h2')).toHaveText(pausedTime!);
  await page.getByRole('button').nth(1).click();
  await page.clock.runFor(875);
  await expect(page.locator('h2')).toHaveText('00:00:04');
  const content = await page.locator('body').textContent();
  expect(content).not.toMatch(/NaN|Infinity/);
  const colors = await page.locator('.beveled-box[style]').evaluateAll((boxes) => boxes.map((box) => (box as HTMLElement).style.backgroundColor));
  expect(colors).toHaveLength(8);
  expect(colors.every((color) => /^rgb\(/.test(color))).toBe(true);
  await page.screenshot({ path: `test-results/preview-live-${page.viewportSize()!.width}.png`, fullPage: true });
});

test('recovers when SNI and then a device become available', async ({ page }) => {
  let connections = 0;
  let discoveries = 0;
  let current: WebSocketRoute | undefined;
  await page.clock.install({ time: new Date('2026-10-11T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-11T12:00:00Z'));
  await page.routeWebSocket('ws://localhost:23074', (socket) => {
    connections += 1;
    if (connections < 3) {
      socket.close({ reason: 'SNI not running' });
      return;
    }
    current = socket;
    socket.onMessage((message) => {
      const request = JSON.parse(String(message));
      if (request.Opcode === 'DeviceList') {
        discoveries += 1;
        socket.send(JSON.stringify({ Results: discoveries === 1 ? [] : ['Later device'] }));
      }
      if (request.Opcode === 'GetAddress') socket.send(Buffer.from([0]));
    });
  });
  await page.goto('./index.html?tracker=true&version=2&checkCount=true&boxes=1');
  await expect(page.getByText('Disconnected: SNI not running', { exact: true })).toBeVisible();
  await page.clock.runFor(5000);
  await expect.poll(() => connections).toBe(2);
  await expect(page.getByText('Disconnected: SNI not running', { exact: true })).toBeVisible();
  await page.clock.runFor(5000);
  await expect(page.getByText('No devices found', { exact: true })).toBeVisible();
  await page.clock.runFor(4999);
  expect(discoveries).toBe(1);
  await page.clock.runFor(1);
  await expect(page.getByText('Connected to Later device', { exact: true })).toBeVisible();
  expect(connections).toBe(3);
  current!.close({ reason: 'SNI restarted' });
  await expect(page.getByText('Disconnected: SNI restarted', { exact: true })).toBeVisible();
  await page.clock.runFor(5000);
  await expect(page.getByText('Connected to Later device', { exact: true })).toBeVisible();
  expect(connections).toBe(4);
});

test('loads only the selected runtime and restores strict bookmark flags', async ({ page }) => {
  await page.routeWebSocket('ws://localhost:23074', (socket) => {
    socket.onMessage((message) => {
      if (JSON.parse(String(message)).Opcode === 'DeviceList') socket.send(JSON.stringify({ Results: ['Fixture'] }));
    });
  });
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('./index.html?tracker=true&checkCount=false&checkCount=true&bonks=TRUE&screens=true&boxes=2&version=unknown');
  await expect(page).toHaveTitle('Stonks Tracker - Checks Go Brrrr');
  await expect(page.getByText('Screens', { exact: true })).toBeVisible();
  await expect(page.getByText('Checks', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Bonks', { exact: true })).toHaveCount(0);
  expect(requests.some((request) => request.includes('/src/preview/'))).toBe(false);
  expect(requests.some((request) => request.includes('/src/landing/'))).toBe(false);
  expect(requests.some((request) => request.includes('.woff2'))).toBe(false);
  const css = await page.evaluate(() => Array.from(document.styleSheets).flatMap((sheet) => Array.from(sheet.cssRules).map((rule) => rule.cssText)).join('\n'));
  expect(css).not.toContain('--text:');
  expect(css).not.toContain('Tracker IBM Plex Mono');
  const favicon = await page.locator('link[rel="icon"]').getAttribute('href');
  expect((await page.request.get(new URL(favicon!, page.url()).href)).ok()).toBe(true);
  await page.goto('./index.html?tracker=true&version=0.1.0-preview&screens=true&boxes=1');
  await expect(page).toHaveTitle('Stonks Tracker - v0.1.0-preview');
  await expect(page.getByText('Screens', { exact: true })).toBeVisible();
});

test('edits and saves every palette stop and launches unsaved timer choices', async ({ page, context }) => {
  const sockets: string[] = [];
  await context.routeWebSocket('ws://localhost:23074', (socket) => { sockets.push(socket.url()); idleDevice(socket); });
  await page.goto('./index.html');
  const preview = page.getByRole('region', { name: 'v0.1.0-preview' });
  const appearance = resolveAppearance(undefined);
  const colors = ['#E63946', '#2A9D8F', '#F4A261', '#F1C40F', '#2A75B8', '#E76F51', '#5C946E', '#E879B2'];
  for (const [metricIndex, { name }] of WIDGETS.entries()) {
    const metric = METRICS[name];
    await preview.getByRole('button', { name: `${metric.title} colors`, exact: true }).click();
    appearance.palettes[name] = metric.colors.map((_, index) => colors[(metricIndex + index) % colors.length]);
    for (const [index, color] of appearance.palettes[name].entries()) await preview.getByLabel(`${metric.title} stop ${index + 1}`, { exact: true }).fill(color.toLowerCase());
  }
  await preview.getByLabel('Timer color', { exact: true }).fill('#c43d52');
  await preview.getByLabel('Timer font', { exact: true }).selectOption('jetbrains-mono');
  appearance.timer = { color: '#C43D52', font: 'jetbrains-mono' };
  await preview.getByRole('checkbox', { name: 'Bonks (milliBonks per minute)', exact: true }).uncheck();
  await expect(preview.getByRole('status')).toHaveText('Unsaved');
  expect(sockets).toHaveLength(0);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await expect(preview.getByLabel('Bonks stop 1', { exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: `test-results/appearance-editor-${page.viewportSize()!.width}.png`, fullPage: true });
  await preview.getByRole('button', { name: 'Save Defaults' }).click();
  await expect(preview.getByRole('status')).toHaveText('Saved');
  await page.reload();
  await expect(preview.getByLabel('Timer font', { exact: true })).toHaveValue('jetbrains-mono');
  await expect(preview.getByRole('checkbox', { name: 'Bonks (milliBonks per minute)', exact: true })).not.toBeChecked();
  for (const { name } of WIDGETS) {
    const metric = METRICS[name];
    await preview.getByRole('button', { name: `${metric.title} colors`, exact: true }).click();
    for (const [index, color] of appearance.palettes[name].entries()) await expect(preview.getByLabel(`${metric.title} stop ${index + 1}`, { exact: true })).toHaveValue(color.toLowerCase());
  }
  await preview.getByLabel('Timer color', { exact: true }).fill('#123456');
  const opened = page.waitForEvent('popup');
  await preview.getByRole('button', { name: 'Launch', exact: true }).click();
  const popup = await opened;
  await expect(popup).toHaveTitle('Stonks Tracker - v0.1.0-preview');
  await expect(popup.locator('h2')).toHaveCSS('color', 'rgb(18, 52, 86)');
  expect(JSON.parse(new URL(popup.url()).searchParams.get('appearance')!).palettes).toEqual(appearance.palettes);
  for (const { name } of WIDGETS.filter(({ name }) => name !== 'bonks')) {
    await expect(popup.getByText(METRICS[name].title, { exact: true }).locator('..').locator('.beveled-box[style]')).toHaveCSS('background-color', `rgb(${hexToRgb(appearance.palettes[name][0]).join(', ')})`);
  }
  await preview.getByLabel('Timer color', { exact: true }).fill('#654321');
  await preview.getByRole('button', { name: 'Save Defaults' }).click();
  await popup.reload();
  await expect(popup.locator('h2')).toHaveCSS('color', 'rgb(18, 52, 86)');
  await preview.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(preview.getByLabel('Timer color', { exact: true })).toHaveValue('#3b82f6');
  await page.reload();
  await expect(preview.getByLabel('Timer color', { exact: true })).toHaveValue('#654321');
});

test('restores appearance only from copied URLs, even with conflicting defaults or denied storage', async ({ page, context, browser }) => {
  await context.routeWebSocket('ws://localhost:23074', idleDevice);
  await page.goto('./index.html');
  const stored = factoryPreviewDefaults();
  stored.widgets.checkCount = false;
  stored.appearance.timer = { color: '#FFFFFF', font: 'space-mono' };
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify({ v: 1, ...value })), { key: PREVIEW_DEFAULTS_KEY, value: stored });
  const appearance = resolveAppearance(undefined);
  appearance.timer = { color: '#123456', font: 'ibm-plex-mono' };
  appearance.palettes.checkCount = ['#789ABC', '#789ABC', '#789ABC', '#789ABC', '#789ABC'];
  await page.goto(buildPreviewUrl({ ...stored.widgets, checkCount: true, boxes: '4', appearance }));
  await expect(page.locator('h2')).toHaveCSS('color', 'rgb(18, 52, 86)');
  await expect(page.getByRole('button', { name: /^Checks/ }).locator('.beveled-box[style]')).toHaveCSS('background-color', 'rgb(120, 154, 188)');
  const copied = await browser.newContext({ viewport: page.viewportSize()! });
  try {
    await copied.routeWebSocket('ws://localhost:23074', idleDevice);
    await copied.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError'); } }));
    const copiedPage = await copied.newPage();
    const errors: string[] = [];
    copiedPage.on('pageerror', (error) => errors.push(error.message));
    await copiedPage.goto(page.url());
    await expect(copiedPage.locator('h2')).toHaveCSS('color', 'rgb(18, 52, 86)');
    await expect(copiedPage.locator('h2')).toHaveCSS('font-family', '"Tracker IBM Plex Mono", monospace');
    await expect(copiedPage.getByRole('button', { name: /^Checks/ }).locator('.beveled-box[style]')).toHaveCSS('background-color', 'rgb(120, 154, 188)');
    await copiedPage.reload();
    await expect(copiedPage.locator('h2')).toHaveCSS('color', 'rgb(18, 52, 86)');
    const oldUrl = new URL(page.url());
    oldUrl.searchParams.delete('appearance');
    await copiedPage.goto(oldUrl.href);
    await expect(copiedPage.locator('h2')).toHaveCSS('color', 'rgb(59, 130, 246)');
    await expect(copiedPage.getByRole('button', { name: /^Checks/ }).locator('.beveled-box[style]')).toHaveCSS('background-color', 'rgb(58, 134, 255)');
    expect(errors).toEqual([]);
  } finally {
    await copied.close();
  }
});

test('loads all timer fonts locally and keeps the timer inside each viewport', async ({ page, context }) => {
  await context.routeWebSocket('ws://localhost:23074', idleDevice);
  const responses: { url: string; ok: boolean }[] = [];
  page.on('response', (response) => { if (response.url().includes('.woff2')) responses.push({ url: response.url(), ok: response.ok() }); });
  await page.route('https://**/*', (route) => route.abort());
  const fonts = TIMER_FONTS.filter(({ value }) => value !== 'default');
  for (const font of fonts) {
    const settings = factoryPreviewDefaults();
    settings.appearance.timer = { color: '#C43D52', font: font.value };
    await page.goto(buildPreviewUrl({ ...settings.widgets, boxes: '4', appearance: settings.appearance }));
    await expect(page.locator('h2')).toHaveCSS('font-family', font.family!);
    const family = font.family!.split('"')[1];
    const loaded = await page.evaluate(async (family) => {
      const faces = await document.fonts.load(`700 36px "${family}"`, '0123456789:');
      return faces.length === 1 && faces[0].status === 'loaded' && document.fonts.check(`700 36px "${family}"`, '0123456789:');
    }, family);
    expect(loaded).toBe(true);
    const timer = await page.locator('h2').boundingBox();
    expect(timer!.x).toBeGreaterThanOrEqual(0);
    expect(timer!.x + timer!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.screenshot({ path: `test-results/timer-${font.value}-${page.viewportSize()!.width}.png`, fullPage: true });
    await page.goto('./index.html');
    const select = page.getByLabel('Timer font', { exact: true });
    await expect(select.locator('option')).toHaveCount(TIMER_FONTS.length);
    await select.selectOption(font.value);
    const sample = page.getByLabel('Timer preview', { exact: true });
    await expect(sample).toHaveCSS('font-family', font.family!);
    await page.evaluate(() => document.fonts.ready);
    expect(await sample.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/timer-sample-${font.value}-${page.viewportSize()!.width}.png`, fullPage: true });
  }
  expect(new Set(responses.map(({ url }) => url)).size).toBe(fonts.length);
  expect(responses.every(({ url, ok }) => ok && new URL(url).origin === new URL(page.url()).origin)).toBe(true);
});

async function expectRomanAlignment(timer: Locator) {
  await expect.poll(() => timer.locator('.timer-face-roman').evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return Math.abs(range.getBoundingClientRect().right - element.getBoundingClientRect().right);
  })).toBeLessThanOrEqual(1);
  const geometry = await timer.locator('.timer-face-roman').evaluate((element) => {
    const area = element.getBoundingClientRect();
    const parent = element.parentElement!.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element);
    const text = range.getBoundingClientRect();
    return {
      leftInset: area.left - parent.left,
      rightInset: parent.right - area.right,
      right: area.right,
      width: area.width,
      textRight: text.right,
      textLeft: text.left,
      left: area.left,
      overflow: element.scrollWidth > element.clientWidth + 1,
    };
  });
  expect(geometry.leftInset).toBeGreaterThanOrEqual(15);
  expect(Math.abs(geometry.leftInset - geometry.rightInset)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.textRight - geometry.right)).toBeLessThanOrEqual(1);
  expect(geometry.textLeft).toBeGreaterThanOrEqual(geometry.left - 1);
  expect(geometry.overflow).toBe(false);
  return geometry;
}

test('anchors Roman timers in a central area across ticks, fonts and style changes', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-11T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-11T12:00:00Z'));
  await page.routeWebSocket('ws://localhost:23074', (socket) => socket.close({ reason: 'SNI not running' }));
  await page.goto('./index.html');
  const preview = page.getByRole('region', { name: 'v0.1.0-preview' });
  const style = preview.getByLabel('Timer style', { exact: true });
  const font = preview.getByLabel('Timer font', { exact: true });
  const sample = preview.getByLabel('Timer preview', { exact: true });
  await preview.getByLabel('Custom font file', { exact: true }).setInputFiles(customFontFile);
  await expect(font).toHaveValue('custom');
  await expect(preview.getByLabel('Font status', { exact: true })).toHaveText('');
  const family = (await sample.evaluate((element) => getComputedStyle(element).fontFamily)).split('"')[1];
  const customFontId = family.replace('Tracker Custom ', '');
  for (const value of ['default', 'bungee', 'custom']) {
    await font.selectOption(value);
    await style.selectOption('roman');
    await expect(sample).toHaveText('I:IV:III');
    await page.evaluate(() => document.fonts.ready);
    await expectRomanAlignment(sample);
  }
  await page.screenshot({ path: `test-results/roman-sample-${page.viewportSize()!.width}.png`, fullPage: true });
  await style.selectOption('digital');
  await expect(sample.locator('.timer-face-roman')).toHaveCount(0);
  await style.selectOption('roman');
  await expectRomanAlignment(sample);

  for (const font of ['default', 'bungee', 'custom']) {
    const appearance = resolveAppearance({ timer: { font, customFontId, variant: 'roman' } });
    await page.goto(buildPreviewUrl({ ...factoryPreviewDefaults().widgets, boxes: '4', appearance }));
    await expect(page.getByText('Disconnected: SNI not running', { exact: true })).toBeVisible();
    const timer = page.locator('h2');
    await expect(timer).toHaveText('—:—:—');
    if (font === 'custom') await expectCustomFont(timer, customFontId);
    await page.evaluate(() => document.fonts.ready);
    const initial = await expectRomanAlignment(timer);
    const started = await page.evaluate(() => Date.now());
    await page.getByRole('button', { name: 'FORCE TIMER START' }).click();
    for (const seconds of [1, 3, 4, 8, 9, 58, 59, 60, 3599, 3600, 25 * 3600 + 48 * 60 + 38, 100000 * 3600]) {
      await page.clock.setSystemTime(started + (seconds - 1) * 1000);
      await page.clock.runFor(125);
      await expect(timer).toHaveText(timerText('roman', seconds * 1000));
      const current = await expectRomanAlignment(timer);
      expect(Math.abs(current.right - initial.right)).toBeLessThanOrEqual(1);
      expect(Math.abs(current.width - initial.width)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (seconds === 25 * 3600 + 48 * 60 + 38) {
        await page.screenshot({ path: `test-results/roman-${font}-${page.viewportSize()!.width}.png`, fullPage: true });
      }
    }
    expect(await timer.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeLessThan(36);
    const originalViewport = page.viewportSize()!;
    await page.setViewportSize({ ...originalViewport, width: 320 });
    await expectRomanAlignment(timer);
    await page.setViewportSize(originalViewport);
    await expectRomanAlignment(timer);
  }

  await page.addInitScript(() => { Math.random = () => 0; });
  const appearance = resolveAppearance({ timer: { variant: 'rotation', rotation: ['digital', 'roman'] } });
  await page.goto(buildPreviewUrl({ ...factoryPreviewDefaults().widgets, boxes: '4', appearance }));
  const timer = page.locator('h2');
  await page.getByRole('button', { name: 'FORCE TIMER START' }).click();
  await expect(timer.locator('.timer-face-roman')).toHaveCount(0);
  await page.clock.runFor(10000);
  await expect(timer.locator('.timer-face-roman')).toBeVisible();
  await expectRomanAlignment(timer);
  await page.clock.runFor(10000);
  await expect(timer.locator('.timer-face-roman')).toHaveCount(0);
  await expect(timer).toHaveCSS('font-size', '36px');
});

test('renders every timer style inside each viewport', async ({ page }) => {
  const elapsed = (3600 + 4 * 60 + 2) * 1000;
  await page.clock.install({ time: new Date('2026-10-11T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-11T12:00:00Z'));
  await page.routeWebSocket('ws://localhost:23074', runningDevice);
  const { width } = page.viewportSize()!;
  for (const { value, layout, usesFont } of TIMER_VARIANTS) {
    const appearance = resolveAppearance({ timer: { color: '#C43D52', font: 'bungee', variant: value } });
    await page.goto(buildPreviewUrl({ ...factoryPreviewDefaults().widgets, boxes: '4', appearance }));
    await expect(page.getByText('Connected to Fixture', { exact: true })).toBeVisible();
    const timer = page.locator('h2');
    if (layout === 'graphic') await expect(timer.getByRole('img', { name: '00:00:00' })).toBeVisible();
    else await expect(timer).toHaveText(timerText(value, 0));
    await page.clock.runFor(125);
    await expect(page.getByRole('button', { name: 'DE-FLUFF' })).toBeVisible();
    await page.clock.setSystemTime(await page.evaluate(() => Date.now()) + elapsed);
    await page.clock.runFor(125);
    if (layout === 'graphic') await expect(timer.getByRole('img', { name: '01:04:03' })).toBeVisible();
    else await expect(timer).toHaveText(timerText(value, elapsed + 1000));
    await expect(timer).toHaveCSS('color', 'rgb(196, 61, 82)');
    if (usesFont) await expect(timer).toHaveCSS('font-family', TIMER_FONTS.find(({ value }) => value === 'bungee')!.family!);
    await page.evaluate(() => document.fonts.ready);
    const box = (await timer.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(await timer.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/timer-variant-${value}-${width}.png`, fullPage: true, animations: 'disabled' });
  }
});

test('previews timer styles in the launcher and respects reduced motion', async ({ page, context }) => {
  await context.routeWebSocket('ws://localhost:23074', idleDevice);
  await page.goto('./index.html');
  const preview = page.getByRole('region', { name: 'v0.1.0-preview' });
  const style = preview.getByLabel('Timer style', { exact: true });
  const font = preview.getByLabel('Timer font', { exact: true });
  const sample = preview.getByLabel('Timer preview', { exact: true });
  await expect(style.locator('option')).toHaveCount(TIMER_VARIANTS.length + 1);
  await font.selectOption('bungee');
  for (const { value, layout, usesFont } of TIMER_VARIANTS) {
    await style.selectOption(value);
    if (layout === 'graphic') await expect(sample.getByRole('img', { name: '01:04:03' })).toBeVisible();
    else await expect(sample).toHaveText(timerText(value, value === 'digital' ? 0 : 3843000));
    await expect(font).toBeEnabled({ enabled: usesFont });
    await expect(preview.getByRole('button', { name: 'Upload timer font' })).toBeEnabled({ enabled: usesFont });
    await page.evaluate(() => document.fonts.ready);
    expect(await sample.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/timer-variant-sample-${value}-${page.viewportSize()!.width}.png`, fullPage: true, animations: 'disabled' });
  }
  await style.selectOption('flip');
  await expect(sample.locator('.timer-flip-digit').first()).toHaveCSS('animation-name', 'timer-flip');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(sample.locator('.timer-flip-digit').first()).toHaveCSS('animation-name', 'none');
  const opened = page.waitForEvent('popup');
  await preview.getByRole('button', { name: 'Launch', exact: true }).click();
  const popup = await opened;
  await expect(popup).toHaveTitle('Stonks Tracker - v0.1.0-preview');
  expect(JSON.parse(new URL(popup.url()).searchParams.get('appearance')!).timer).toEqual({ color: '#3B82F6', font: 'bungee', variant: 'flip' });
  await expect(popup.locator('h2 .timer-face-flip')).toHaveText('00:00:00');
});

test('configures Rotation and BLAT in the launcher and launches them', async ({ page, context }) => {
  await context.routeWebSocket('ws://localhost:23074', idleDevice);
  await page.goto('./index.html');
  const preview = page.getByRole('region', { name: 'v0.1.0-preview' });
  await preview.getByLabel('Timer style', { exact: true }).selectOption('rotation');
  const group = preview.getByRole('group', { name: 'Rotation styles' });
  await expect(group.getByRole('checkbox', { checked: true })).toHaveCount(TIMER_VARIANTS.length);
  for (const name of ['Digital', 'Words', 'Compact', 'Flip clock', 'Roman numerals', 'Seven-segment LCD', 'Progress rings']) await group.getByRole('checkbox', { name, exact: true }).uncheck();
  await expect(group.getByRole('checkbox', { name: 'Analog stopclock', exact: true })).toBeDisabled();
  await expect(group.getByRole('checkbox', { name: 'Binary clock', exact: true })).toBeDisabled();
  await preview.getByRole('switch', { name: 'BLAT' }).check();
  const blat = preview.locator('.timer-blat');
  await expect(blat).toHaveText('BLAT!!!');
  await expect(blat).toHaveCSS('font-family', /^Impact,/);
  await expect(blat).toHaveCSS('font-size', '15px');
  await expect(preview.getByRole('checkbox')).toHaveCount(9 + TIMER_VARIANTS.length);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/rotation-blat-editor-${page.viewportSize()!.width}.png`, fullPage: true, animations: 'disabled' });
  const opened = page.waitForEvent('popup');
  await preview.getByRole('button', { name: 'Launch', exact: true }).click();
  const popup = await opened;
  await expect(popup).toHaveTitle('Stonks Tracker - v0.1.0-preview');
  expect(JSON.parse(new URL(popup.url()).searchParams.get('appearance')!).timer).toEqual({ color: '#3B82F6', font: 'default', variant: 'rotation', rotation: ['analog', 'binary'], blat: true });
  await expect(popup.locator('h2 .timer-face')).toHaveClass(/timer-face-(analog|binary)$/);
});

test('force-starts a rotating BLAT timer without SNI, switching styles only while running', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-11T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-11T12:00:00Z'));
  await page.routeWebSocket('ws://localhost:23074', (socket) => socket.close({ reason: 'SNI not running' }));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const appearance = resolveAppearance({ timer: { color: '#C43D52', font: 'bungee', variant: 'rotation', rotation: ['lcd', 'binary'], blat: true } });
  await page.goto(buildPreviewUrl({ ...factoryPreviewDefaults().widgets, boxes: '4', appearance }));
  await expect(page.getByText('Disconnected: SNI not running', { exact: true })).toBeVisible();
  const face = page.locator('h2 .timer-face');
  const blat = page.locator('.timer-blat');
  const force = page.getByRole('button', { name: 'FORCE TIMER START' });
  const initial = (await face.getAttribute('class'))!;
  const other = initial.endsWith('lcd') ? 'timer-face timer-face-binary' : 'timer-face timer-face-lcd';
  expect(initial).toMatch(/^timer-face timer-face-(lcd|binary)$/);
  await expect(force).toBeVisible();
  await expect(blat).toHaveCount(0);
  await page.clock.runFor(100_000);
  await expect(face).toHaveAttribute('class', initial);
  await expect(face).toHaveAttribute('aria-label', '00:00:00');
  await force.click();
  await page.clock.runFor(1000);
  await expect(face).toHaveAttribute('aria-label', '00:00:02');
  await expect(force).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'DE-FLUFF' })).toBeVisible();
  await expect(blat).toHaveText('BLAT!!!');
  await expect(blat).toHaveCSS('font-family', /^Impact,/);
  await expect(blat).toHaveCSS('font-size', '18px');
  await expect(blat).toHaveCSS('color', 'rgb(196, 61, 82)');
  await expect(blat).toHaveAttribute('aria-hidden', 'true');
  await expect(blat).toHaveCSS('-webkit-text-stroke-width', '2px');
  await expect(blat).toHaveCSS('-webkit-text-stroke-color', 'rgb(0, 0, 0)');
  await expect(blat).toHaveCSS('paint-order', 'stroke');
  for (let move = 0; move < 20; move += 1) {
    const before = await blat.getAttribute('style');
    await page.clock.runFor(300);
    await expect(blat).not.toHaveAttribute('style', before!);
    const placement = await blat.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const frame = element.parentElement!.getBoundingClientRect();
      return {
        angle: Number((element as HTMLElement).style.transform.match(/rotate\((-?[\d.e-]+)deg\)/)![1]),
        inside: box.left >= frame.left && box.right <= frame.right && box.top >= frame.top && box.bottom <= frame.bottom,
      };
    });
    expect(Math.abs(placement.angle)).toBeLessThanOrEqual(80);
    expect(placement.inside).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: `test-results/rotation-blat-timer-${page.viewportSize()!.width}.png`, fullPage: true });
  let elapsed = 2000;
  while (await face.getAttribute('class') === initial && elapsed < 101_000) {
    await page.clock.runFor(1000);
    elapsed += 1000;
  }
  expect(elapsed).toBeGreaterThanOrEqual(10_000);
  await expect(face).toHaveAttribute('class', other);
  await page.getByRole('button', { name: 'DE-FLUFF' }).locator('xpath=preceding-sibling::button').click();
  await expect(blat).toHaveCount(0);
  const paused = (await face.getAttribute('aria-label'))!;
  await page.clock.runFor(200_000);
  await expect(face).toHaveAttribute('class', other);
  await expect(face).toHaveAttribute('aria-label', paused);
  await expect(force).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('writes the words timer in every language inside each viewport', async ({ page }) => {
  const elapsed = (3600 + 4 * 60 + 2) * 1000;
  await page.clock.install({ time: new Date('2026-10-11T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-11T12:00:00Z'));
  await page.routeWebSocket('ws://localhost:23074', runningDevice);
  const { width } = page.viewportSize()!;
  for (const { value, lang } of TIMER_LANGUAGES) {
    const appearance = resolveAppearance({ timer: { color: '#C43D52', font: 'bungee', variant: 'words', language: value } });
    await page.goto(buildPreviewUrl({ ...factoryPreviewDefaults().widgets, boxes: '4', appearance }));
    await expect(page.getByText('Connected to Fixture', { exact: true })).toBeVisible();
    const timer = page.locator('h2');
    await expect(timer.locator('.timer-face-words')).toHaveAttribute('lang', lang);
    await expect(timer).toHaveText(timerText('words', 0, value));
    await page.clock.runFor(125);
    await expect(page.getByRole('button', { name: 'DE-FLUFF' })).toBeVisible();
    await page.clock.setSystemTime(await page.evaluate(() => Date.now()) + elapsed);
    await page.clock.runFor(125);
    await expect(timer).toHaveText(timerText('words', elapsed + 1000, value));
    await page.evaluate(() => document.fonts.ready);
    const box = (await timer.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(await timer.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/timer-words-${value}-${width}.png`, fullPage: true });
  }
});

test('picks a words language in the launcher and launches it', async ({ page, context }) => {
  await context.routeWebSocket('ws://localhost:23074', idleDevice);
  await page.goto('./index.html');
  const preview = page.getByRole('region', { name: 'v0.1.0-preview' });
  const sample = preview.getByLabel('Timer preview', { exact: true });
  await preview.getByLabel('Timer font', { exact: true }).selectOption('bungee');
  await expect(preview.getByLabel('Words language', { exact: true })).toHaveCount(0);
  await preview.getByLabel('Timer style', { exact: true }).selectOption('words');
  const language = preview.getByLabel('Words language', { exact: true });
  await expect(language.locator('option')).toHaveCount(TIMER_LANGUAGES.length);
  for (const { value, lang } of TIMER_LANGUAGES) {
    await language.selectOption(value);
    await expect(sample).toHaveText(timerText('words', 3843000, value));
    await expect(sample.locator('.timer-face-words')).toHaveAttribute('lang', lang);
    await page.evaluate(() => document.fonts.ready);
    expect(await sample.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/timer-words-sample-${value}-${page.viewportSize()!.width}.png`, fullPage: true });
  }
  await language.selectOption('ko');
  const opened = page.waitForEvent('popup');
  await preview.getByRole('button', { name: 'Launch', exact: true }).click();
  const popup = await opened;
  await expect(popup).toHaveTitle('Stonks Tracker - v0.1.0-preview');
  expect(JSON.parse(new URL(popup.url()).searchParams.get('appearance')!).timer).toEqual({ color: '#3B82F6', font: 'bungee', variant: 'words', language: 'ko' });
  await expect(popup.locator('h2 .timer-face-words')).toHaveText('아직 시간이 있어요');
});

test('keeps the launcher usable when storage access is blocked', async ({ page, context }) => {
  await context.routeWebSocket('ws://localhost:23074', idleDevice);
  await context.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError'); } }));
  await page.goto('./index.html');
  const preview = page.getByRole('region', { name: 'v0.1.0-preview' });
  await preview.getByLabel('Timer color', { exact: true }).fill('#654321');
  await preview.getByRole('button', { name: 'Save Defaults' }).click();
  await expect(preview.getByRole('status')).toHaveText('Save failed');
  const opened = page.waitForEvent('popup');
  await preview.getByRole('button', { name: 'Launch', exact: true }).click();
  const popup = await opened;
  await expect(popup.locator('h2')).toHaveCSS('color', 'rgb(101, 67, 33)');
});

test('renders every zero-to-eight-widget column layout in both versions', async ({ page }) => {
  await page.routeWebSocket('ws://localhost:23074', (socket) => {
    socket.onMessage((message) => {
      if (JSON.parse(String(message)).Opcode === 'DeviceList') socket.send(JSON.stringify({ Results: ['Fixture'] }));
    });
  });
  for (const preview of [false, true]) {
    for (let count = 0; count <= WIDGETS.length; count += 1) {
      const settings = Object.fromEntries(WIDGETS.map(({ name }, index) => [name, index < count])) as WidgetSettings;
      const boxes = determineBoxCount(settings);
      await page.goto(preview ? buildPreviewUrl({ ...settings, boxes }) : buildLegacyUrl(settings));
      await expect(page.getByText('Connected to Fixture', { exact: true })).toBeVisible();
      const grid = page.locator('.inline-grid');
      expect(await grid.evaluate((element) => element.children.length)).toBe(count);
      expect(await grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(Number(boxes));
    }
  }
});