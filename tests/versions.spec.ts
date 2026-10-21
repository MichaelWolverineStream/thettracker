import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page, type WebSocketRoute } from '@playwright/test';
import { memoryFrame } from './helpers/sni';
import { WIDGETS, buildPreviewUrl, determineBoxCount, type WidgetSettings } from '../src/preview/config';
import { buildLegacyUrl } from '../src/landing/legacyLaunch';
import { METRICS, TIMER_FONTS, TIMER_LANGUAGES, TIMER_VARIANTS, hexToRgb, resolveAppearance } from '../src/preview/appearance';
import { timerText } from '../src/preview/timerFormat';
import { PREVIEW_DEFAULTS_KEY, factoryPreviewDefaults } from '../src/landing/previewDefaults';
import { CUSTOM_FONTS_DATABASE, customFontFamily } from '../src/preview/customFonts';

const legacyQuery = '?tracker=true&checkCount=true&bonks=true&chestTurns=true&deaths=true&rupees=true&screens=true&damage=true&magic=true&boxes=4';
const responsive = { tag: '@responsive' };
const representativeLanguages = TIMER_LANGUAGES.filter(({ value }) => ['qya', 'ko', 'ru', 'emoji'].includes(value));

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

async function uploadCustomFont(page: Page) {
  const preview = page.getByRole('region', { name: 'v0.1.0-preview' });
  await preview.getByLabel('Timer color', { exact: true }).fill('#c43d52');
  await preview.getByLabel('Custom font file', { exact: true }).setInputFiles(customFontFile);
  await expect(preview.getByLabel('Timer font', { exact: true })).toHaveValue('custom');
  await expect(preview.getByLabel('Font status', { exact: true })).toHaveText('');
  const family = (await preview.getByLabel('Timer preview', { exact: true }).evaluate((element) => getComputedStyle(element).fontFamily)).split('"')[1];
  const id = family.replace('Tracker Custom ', '');
  expect(id).toMatch(/^[0-9a-f]{32}$/);
  return { family, id };
}

async function expectCustomFont(element: Locator, id: string) {
  const family = customFontFamily(id);
  await expect(element).toHaveCSS('font-family', `"${family}"`);
  expect(await element.evaluate(async (_, family) => {
    const faces = await document.fonts.load(`700 36px "${family}"`, '0123456789:');
    return faces.length === 1 && faces[0].status === 'loaded' && document.fonts.check(`700 36px "${family}"`, '0123456789:');
  }, family)).toBe(true);
}

test('custom font upload persists, launches and fits', async ({ page, context }) => {
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
  const { id } = await uploadCustomFont(page);
  await expectCustomFont(sample, id);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/custom-font-editor-${page.viewportSize()!.width}.png`, fullPage: true });
  await preview.getByRole('button', { name: 'Save Defaults' }).click();
  const raw = await page.evaluate((key) => localStorage.getItem(key)!, PREVIEW_DEFAULTS_KEY);
  expect(JSON.parse(raw).appearance.timer).toEqual({ color: '#C43D52', font: 'custom', customFontId: id });
  expect(raw).not.toContain('personal-timer');
  await page.reload();
  await expectCustomFont(sample, id);
  const opened = page.waitForEvent('popup');
  await preview.getByRole('button', { name: 'Launch', exact: true }).click();
  const popup = await opened;
  popup.on('pageerror', (error) => errors.push(error.message));
  const timer = popup.locator('h2');
  await expectCustomFont(timer, id);
  await expect(timer).toHaveCSS('color', 'rgb(196, 61, 82)');
  await expect(popup.getByText('Connected to Fixture', { exact: true })).toBeVisible();
  await expect(timer).toHaveText('00:00:00');
  running = true;
  await expect(timer).not.toHaveText('00:00:00');
  const controls = popup.getByRole('button', { name: 'DE-FLUFF' });
  await expect(controls).toBeVisible();
  const { width } = popup.viewportSize()!;
  const timerBounds = (await timer.boundingBox())!;
  const controlBounds = (await controls.boundingBox())!;
  expect(timerBounds.x).toBeGreaterThanOrEqual(0);
  expect(timerBounds.x + timerBounds.width).toBeLessThanOrEqual(width);
  expect(controlBounds.x).toBeGreaterThanOrEqual(0);
  expect(controlBounds.x + controlBounds.width).toBeLessThanOrEqual(width);
  expect(timerBounds.y + timerBounds.height).toBeLessThanOrEqual(controlBounds.y);
  expect(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await popup.screenshot({ path: `test-results/custom-font-timer-${page.viewportSize()!.width}.png`, fullPage: true });
  expect(errors).toEqual([]);
  expect(externalFonts).toEqual([]);
});

test('missing custom font falls back', async ({ page, context, browser }) => {
  await context.routeWebSocket('ws://localhost:23074', idleDevice);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./index.html');
  const preview = page.getByRole('region', { name: 'v0.1.0-preview' });
  const sample = preview.getByLabel('Timer preview', { exact: true });
  const { family, id } = await uploadCustomFont(page);
  await preview.getByRole('button', { name: 'Save Defaults' }).click();
  await expect(preview.getByRole('status', { name: 'Defaults status' })).toHaveText('Saved');
  const raw = await page.evaluate((key) => localStorage.getItem(key), PREVIEW_DEFAULTS_KEY);
  const opened = page.waitForEvent('popup');
  await preview.getByRole('button', { name: 'Launch', exact: true }).click();
  const popup = await opened;
  popup.on('pageerror', (error) => errors.push(error.message));
  const timer = popup.locator('h2');
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
});

test('custom font rejects a corrupt upload and a full font store without losing the draft', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./index.html');
  const preview = page.getByRole('region', { name: 'v0.1.0-preview' });
  const input = preview.getByLabel('Custom font file', { exact: true });
  const font = preview.getByLabel('Timer font', { exact: true });
  const status = preview.getByLabel('Font status', { exact: true });
  await font.selectOption('bungee');
  await input.setInputFiles({ name: 'corrupt.woff2', mimeType: 'font/woff2', buffer: Buffer.from('wOF2') });
  await expect(status).toHaveText('Invalid font file');
  await expect(font).toHaveValue('bungee');
  await expect(preview.getByRole('button', { name: 'Launch', exact: true })).toBeEnabled();
  await page.evaluate(() => { IDBObjectStore.prototype.add = function () { throw new DOMException('Full', 'QuotaExceededError'); }; });
  await input.setInputFiles(customFontFile);
  await expect(status).toHaveText('Font storage full');
  await expect(font).toHaveValue('bungee');
  await expect(preview.getByRole('button', { name: 'Launch', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await page.screenshot({ path: `test-results/custom-font-quota-${page.viewportSize()!.width}.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('launches independently configured preview and legacy popups', responsive, async ({ page, context }) => {
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

test('preserves the legacy bookmark and appearance', responsive, async ({ page }) => {
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
  await page.clock.install({ time: new Date('2026-10-11T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-11T12:00:00Z'));
  await page.routeWebSocket('ws://localhost:23074', runningDevice);
  await page.goto(`./index.html${legacyQuery}&version=2`);
  await expect(page.getByText('Connected to Fixture', { exact: true })).toBeVisible();
  const timer = page.locator('h2');
  await expect(timer).toHaveText('00:00:00');
  await page.clock.runFor(125);
  await expect(page.getByRole('button', { name: 'DE-FLUFF' })).toBeVisible();
  await page.clock.runFor(125);
  const checks = page.getByRole('button', { name: /^Checks/ });
  await expect(checks.locator('span')).toHaveText('55');
  await expect(page.getByText('1.9', { exact: true })).toBeVisible();
  await expect(page.getByText('16', { exact: true })).toBeVisible();
  await checks.click();
  await expect(checks.locator('span')).toHaveText('56');
  await page.getByRole('button', { name: 'DE-FLUFF' }).click();
  await expect(checks.locator('span')).toHaveText('55');
  const pause = page.getByRole('button').nth(1);
  await pause.click();
  const paused = (await timer.textContent())!;
  await page.clock.runFor(2000);
  await expect(timer).toHaveText(paused);
  await pause.click();
  await page.clock.runFor(1000);
  await expect(timer).not.toHaveText(paused);
  expect(await page.locator('body').textContent()).not.toMatch(/NaN|Infinity/);
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
  await page.clock.runFor(5000);
  await expect(page.getByText('Connected to Later device', { exact: true })).toBeVisible();
  await expect.poll(() => connections).toBe(3);
  current!.close({ reason: 'SNI restarted' });
  await expect(page.getByText('Disconnected: SNI restarted', { exact: true })).toBeVisible();
  await page.clock.runFor(5000);
  await expect(page.getByText('Connected to Later device', { exact: true })).toBeVisible();
  await expect.poll(() => connections).toBe(4);
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

test('edits and saves palette stops and launches unsaved timer choices', responsive, async ({ page, context }) => {
  const sockets: string[] = [];
  await context.routeWebSocket('ws://localhost:23074', (socket) => { sockets.push(socket.url()); idleDevice(socket); });
  await page.goto('./index.html');
  const preview = page.getByRole('region', { name: 'v0.1.0-preview' });
  const appearance = resolveAppearance(undefined);
  const edits = [['checkCount', '#E63946'], ['deaths', '#2A9D8F']] as const;
  for (const [name, color] of edits) {
    const { title } = METRICS[name];
    appearance.palettes[name] = [color, ...appearance.palettes[name].slice(1)];
    await preview.getByRole('button', { name: `${title} colors`, exact: true }).click();
    await preview.getByLabel(`${title} stop 1`, { exact: true }).fill(color.toLowerCase());
  }
  await preview.getByLabel('Timer color', { exact: true }).fill('#c43d52');
  await preview.getByLabel('Timer font', { exact: true }).selectOption('jetbrains-mono');
  await preview.getByRole('checkbox', { name: 'Bonks (milliBonks per minute)', exact: true }).uncheck();
  await expect(preview.getByRole('status')).toHaveText('Unsaved');
  expect(sockets).toHaveLength(0);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: `test-results/appearance-editor-${page.viewportSize()!.width}.png`, fullPage: true });
  await preview.getByRole('button', { name: 'Save Defaults' }).click();
  await expect(preview.getByRole('status')).toHaveText('Saved');
  await page.reload();
  await expect(preview.getByLabel('Timer font', { exact: true })).toHaveValue('jetbrains-mono');
  await expect(preview.getByRole('checkbox', { name: 'Bonks (milliBonks per minute)', exact: true })).not.toBeChecked();
  for (const [name, color] of edits) {
    const { title } = METRICS[name];
    await preview.getByRole('button', { name: `${title} colors`, exact: true }).click();
    await expect(preview.getByLabel(`${title} stop 1`, { exact: true })).toHaveValue(color.toLowerCase());
  }
  await preview.getByLabel('Timer color', { exact: true }).fill('#123456');
  const opened = page.waitForEvent('popup');
  await preview.getByRole('button', { name: 'Launch', exact: true }).click();
  const popup = await opened;
  await expect(popup).toHaveTitle('Stonks Tracker - v0.1.0-preview');
  await expect(popup.locator('h2')).toHaveCSS('color', 'rgb(18, 52, 86)');
  expect(JSON.parse(new URL(popup.url()).searchParams.get('appearance')!).palettes).toEqual(appearance.palettes);
  for (const [name, color] of edits) {
    await expect(popup.getByText(METRICS[name].title, { exact: true }).locator('..').locator('.beveled-box[style]')).toHaveCSS('background-color', `rgb(${hexToRgb(color).join(', ')})`);
  }
  await preview.getByLabel('Timer color', { exact: true }).fill('#654321');
  await preview.getByRole('button', { name: 'Save Defaults' }).click();
  await popup.reload();
  await expect(popup.locator('h2')).toHaveCSS('color', 'rgb(18, 52, 86)');
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

test('loads all timer fonts locally and keeps the timer inside each viewport', responsive, async ({ page, context }) => {
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
  }
  expect(new Set(responses.map(({ url }) => url)).size).toBe(fonts.length);
  expect(responses.every(({ url, ok }) => ok && new URL(url).origin === new URL(page.url()).origin)).toBe(true);
});

async function expectRomanAlignment(timer: Locator) {
  const face = timer.locator('.timer-face-roman');
  await expect.poll(() => face.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return Math.abs(range.getBoundingClientRect().right - element.getBoundingClientRect().right);
  })).toBeLessThanOrEqual(1);
  const geometry = await face.evaluate((element) => {
    const area = element.getBoundingClientRect();
    const parent = element.parentElement!.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element);
    return {
      leftInset: area.left - parent.left,
      rightInset: parent.right - area.right,
      right: area.right,
      width: area.width,
      overflow: element.scrollWidth > element.clientWidth + 1 || range.getBoundingClientRect().left < area.left - 1,
    };
  });
  expect(geometry.leftInset).toBeGreaterThanOrEqual(15);
  expect(Math.abs(geometry.leftInset - geometry.rightInset)).toBeLessThanOrEqual(1);
  expect(geometry.overflow).toBe(false);
  return { right: geometry.right, width: geometry.width };
}

test('anchors the Roman timer in a central area across ticks', responsive, async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-11T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-11T12:00:00Z'));
  await page.routeWebSocket('ws://localhost:23074', (socket) => socket.close({ reason: 'SNI not running' }));
  const appearance = resolveAppearance({ timer: { variant: 'roman' } });
  await page.goto(buildPreviewUrl({ ...factoryPreviewDefaults().widgets, boxes: '4', appearance }));
  await expect(page.getByText('Disconnected: SNI not running', { exact: true })).toBeVisible();
  const timer = page.locator('h2');
  await expect(timer).toHaveText('—:—:—');
  await page.evaluate(() => document.fonts.ready);
  const initial = await expectRomanAlignment(timer);
  const started = await page.evaluate(() => Date.now());
  await page.getByRole('button', { name: 'FORCE TIMER START' }).click();
  for (const seconds of [1, 8, 3599, 25 * 3600 + 48 * 60 + 38]) {
    await page.clock.setSystemTime(started + (seconds - 1) * 1000);
    await page.clock.runFor(125);
    await expect(timer).toHaveText(timerText('roman', seconds * 1000));
    const current = await expectRomanAlignment(timer);
    expect(Math.abs(current.right - initial.right)).toBeLessThanOrEqual(1);
    expect(Math.abs(current.width - initial.width)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: `test-results/roman-default-${page.viewportSize()!.width}.png`, fullPage: true });
});

test('renders every timer style inside each viewport', responsive, async ({ page }) => {
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

test('fits timer style, words language and Rotation/BLAT previews in the launcher and respects reduced motion', responsive, async ({ page, context }) => {
  await context.routeWebSocket('ws://localhost:23074', idleDevice);
  await page.goto('./index.html');
  const { width } = page.viewportSize()!;
  const preview = page.getByRole('region', { name: 'v0.1.0-preview' });
  const style = preview.getByLabel('Timer style', { exact: true });
  const sample = preview.getByLabel('Timer preview', { exact: true });
  const expectFits = async () => {
    await page.evaluate(() => document.fonts.ready);
    expect(await sample.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  };
  await expect(style.locator('option')).toHaveCount(TIMER_VARIANTS.length + 1);
  await preview.getByLabel('Timer font', { exact: true }).selectOption('bungee');
  for (const { value, layout } of TIMER_VARIANTS) {
    await style.selectOption(value);
    if (layout === 'graphic') await expect(sample.getByRole('img', { name: '01:04:03' })).toBeVisible();
    else await expect(sample).toHaveText(timerText(value, value === 'digital' ? 0 : 3843000));
    await expectFits();
    await page.screenshot({ path: `test-results/timer-variant-sample-${value}-${width}.png`, fullPage: true, animations: 'disabled' });
  }
  await style.selectOption('flip');
  await expect(sample.locator('.timer-flip-digit').first()).toHaveCSS('animation-name', 'timer-flip');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(sample.locator('.timer-flip-digit').first()).toHaveCSS('animation-name', 'none');
  await page.emulateMedia({ reducedMotion: null });
  await style.selectOption('words');
  const language = preview.getByLabel('Words language', { exact: true });
  await expect(language.locator('option')).toHaveCount(TIMER_LANGUAGES.length);
  for (const { value, lang } of representativeLanguages) {
    await language.selectOption(value);
    await expect(sample).toHaveText(timerText('words', 3843000, value));
    await expect(sample.locator('.timer-face-words')).toHaveAttribute('lang', lang);
    await expectFits();
    await page.screenshot({ path: `test-results/timer-words-sample-${value}-${width}.png`, fullPage: true });
  }
  await style.selectOption('rotation');
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
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/rotation-blat-editor-${width}.png`, fullPage: true, animations: 'disabled' });
});

test('force-starts a rotating BLAT timer without SNI and keeps the overlay inside the frame', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-11T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-11T12:00:00Z'));
  await page.routeWebSocket('ws://localhost:23074', (socket) => socket.close({ reason: 'SNI not running' }));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const appearance = resolveAppearance({ timer: { color: '#C43D52', font: 'bungee', variant: 'rotation', rotation: ['lcd', 'binary'], blat: true } });
  await page.goto(buildPreviewUrl({ ...factoryPreviewDefaults().widgets, boxes: '4', appearance }));
  await expect(page.getByText('Disconnected: SNI not running', { exact: true })).toBeVisible();
  const blat = page.locator('.timer-blat');
  const force = page.getByRole('button', { name: 'FORCE TIMER START' });
  await expect(blat).toHaveCount(0);
  await force.click();
  await page.clock.runFor(1000);
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
  for (let move = 0; move < 5; move += 1) {
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
  expect(errors).toEqual([]);
});

test('writes the words timer in representative scripts inside each viewport', responsive, async ({ page }) => {
  const elapsed = (3600 + 4 * 60 + 2) * 1000;
  await page.clock.install({ time: new Date('2026-10-11T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-11T12:00:00Z'));
  await page.routeWebSocket('ws://localhost:23074', runningDevice);
  const { width } = page.viewportSize()!;
  for (const { value, lang } of representativeLanguages) {
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

test('renders the one-to-four-widget column layouts in both versions', responsive, async ({ page }) => {
  await page.routeWebSocket('ws://localhost:23074', (socket) => {
    socket.onMessage((message) => {
      if (JSON.parse(String(message)).Opcode === 'DeviceList') socket.send(JSON.stringify({ Results: ['Fixture'] }));
    });
  });
  for (const preview of [false, true]) {
    for (let count = 1; count <= 4; count += 1) {
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
