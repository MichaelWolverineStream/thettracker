import { expect, test } from '@playwright/test';
import { buildPreviewUrl, DEFAULT_LAUNCH_SETTINGS } from '../src/preview/config';
import { resolveAppearance, TIMER_VARIANTS } from '../src/preview/appearance';

test('BeeBobble saves, restores and launches from beside BLAT', async ({ page }) => {
  await page.goto('./index.html');
  const preview = page.getByRole('region', { name: 'v0.1.0-preview' });
  const checkbox = preview.getByRole('checkbox', { name: 'BeeBobble' });
  const bee = preview.locator('img[src*="beebobble"]');
  await expect(checkbox).not.toBeChecked();
  await expect(bee).toHaveCount(0);
  await checkbox.check();
  await expect(bee).toBeVisible();
  await expect(bee).toHaveCSS('width', '112px');
  await expect(bee).toHaveCSS('height', '112px');
  const sample = await preview.getByLabel('Timer preview', { exact: true }).boundingBox();
  const bounds = await bee.boundingBox();
  expect(bounds!.y).toBeCloseTo(sample!.y + sample!.height - 36, 1);
  await preview.getByRole('switch', { name: 'BLAT' }).check();
  await expect(preview.locator('.timer-blat')).toBeVisible();
  await page.screenshot({ path: `test-results/beebobble-editor-${test.info().project.name}.png`, fullPage: true });
  await preview.getByRole('button', { name: 'Save Defaults' }).click();
  await page.reload();
  await expect(checkbox).toBeChecked();
  const opened = page.waitForEvent('popup');
  await preview.getByRole('button', { name: 'Launch', exact: true }).click();
  const popup = await opened;
  await expect(popup.locator('img[src*="beebobble"]')).toBeVisible();
  expect(JSON.parse(new URL(popup.url()).searchParams.get('appearance')!).timer.beebobble).toBe(true);
  await popup.close();
  await preview.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(checkbox).not.toBeChecked();
  await expect(bee).toHaveCount(0);
});

test('BeeBobble overlaps every timer style without blocking controls, including while paused', async ({ page }) => {
  await page.routeWebSocket('ws://localhost:23074', () => {});
  for (const { value: variant } of TIMER_VARIANTS) {
    const appearance = resolveAppearance({ timer: { variant, beebobble: true, blat: true } });
    await page.goto(buildPreviewUrl({ ...DEFAULT_LAUNCH_SETTINGS, boxes: '3', appearance }));
    const bee = page.locator('img[src*="beebobble"]');
    await expect(bee).toBeVisible();
    await expect.poll(() => bee.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(112);
    const heading = await page.locator('h2').boundingBox();
    const bounds = await bee.boundingBox();
    expect(bounds!.width).toBe(112);
    expect(bounds!.height).toBe(112);
    expect(bounds!.x + 56).toBeCloseTo(heading!.x + heading!.width / 2, 1);
    expect(bounds!.y).toBeCloseTo(heading!.y + heading!.height - 36, 1);
    const start = page.getByRole('button', { name: 'FORCE TIMER START' });
    const control = await start.boundingBox();
    expect(bounds!.y + 112).toBeLessThan(control!.y);
    await expect(bee).toHaveCSS('pointer-events', 'none');
    await start.click();
    await expect(page.locator('.timer-blat')).toBeVisible();
    const toggle = page.getByRole('button', { name: '', exact: true });
    await toggle.click();
    await expect(page.locator('.timer-blat')).toHaveCount(0);
    await expect(bee).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (variant === 'digital') {
      await page.screenshot({ path: `test-results/beebobble-timer-${test.info().project.name}.png`, fullPage: true });
    }
  }
});
