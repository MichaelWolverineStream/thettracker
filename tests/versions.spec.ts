import { expect, test, type WebSocketRoute } from '@playwright/test';
import { memoryFrame } from './helpers/sni';
import { WIDGETS, buildPreviewUrl, determineBoxCount, type WidgetSettings } from '../src/preview/config';
import { buildLegacyUrl } from '../src/landing/legacyLaunch';

const legacyQuery = '?tracker=true&checkCount=true&bonks=true&chestTurns=true&deaths=true&rupees=true&screens=true&damage=true&magic=true&boxes=4';

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
  await expect(preview.getByRole('checkbox')).toHaveCount(8);
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
  expect(params.get('version')).toBe('0.1.0-preview');
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
  await page.goto(`./index.html${legacyQuery}&version=0.1.0-preview`);
  await expect(page.getByText('Connected to Fixture', { exact: true })).toBeVisible();
  await page.clock.runFor(500);
  await expect.poll(() => frames).toBe(1);
  await page.clock.runFor(500);
  const checks = page.getByRole('button', { name: /^Checks/ });
  await expect(checks.locator('span')).toHaveText('55');
  await expect(page.getByText('1.9', { exact: true })).toBeVisible();
  await expect(page.getByText('16', { exact: true })).toBeVisible();
  await page.clock.runFor(2000);
  await expect(page.getByRole('button', { name: 'DE-FLUFF' })).toBeVisible();
  await checks.click();
  await expect(checks.locator('span')).toHaveText('56');
  await page.getByRole('button', { name: 'DE-FLUFF' }).click();
  await expect(checks.locator('span')).toHaveText('55');
  await page.getByRole('button').nth(1).click();
  await expect(page.locator('h2')).toHaveText('00:00:04');
  const pausedTime = await page.locator('h2').textContent();
  await page.clock.runFor(2000);
  await expect(page.locator('h2')).toHaveText(pausedTime!);
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
  await page.goto('./index.html?tracker=true&version=0.1.0-preview&checkCount=true&boxes=1');
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
  const css = await page.evaluate(() => Array.from(document.styleSheets).flatMap((sheet) => Array.from(sheet.cssRules).map((rule) => rule.cssText)).join('\n'));
  expect(css).not.toContain('--text:');
  const favicon = await page.locator('link[rel="icon"]').getAttribute('href');
  expect((await page.request.get(new URL(favicon!, page.url()).href)).ok()).toBe(true);
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