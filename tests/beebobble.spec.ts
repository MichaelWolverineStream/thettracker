import { expect, test } from '@playwright/test';
import { buildPreviewUrl, DEFAULT_LAUNCH_SETTINGS } from '../src/preview/config';
import { resolveAppearance } from '../src/preview/appearance';

test('BeeBobble overlaps text and graphic timer styles without blocking controls, including while paused', { tag: '@responsive' }, async ({ page }) => {
  await page.routeWebSocket('ws://localhost:23074', () => {});
  for (const variant of ['words', 'rings'] as const) {
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
    await page.screenshot({ path: `test-results/beebobble-timer-${variant}-${test.info().project.name}.png`, fullPage: true });
  }
});
