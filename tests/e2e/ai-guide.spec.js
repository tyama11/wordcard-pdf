import { test, expect } from '@playwright/test';
import { AI_CSV_PROMPT } from '../../src/ai-guide.js';

test.describe('AI guidance banner', () => {
  test('banner appears before #step-1 in DOM order and is visible', async ({ page }) => {
    await page.goto('/');

    const banner = page.locator('#ai-guide');
    await expect(banner).toBeVisible();

    const isBeforeStep1 = await page.evaluate(() => {
      const b = document.getElementById('ai-guide');
      const step1 = document.getElementById('step-1');
      if (!b || !step1) return false;
      return (b.compareDocumentPosition(step1) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    });
    expect(isBeforeStep1).toBe(true);
  });

  test('pre text equals the exact prompt', async ({ page }) => {
    await page.goto('/');

    const pre = page.locator('#ai-prompt-text');
    expect(await pre.textContent()).toBe(AI_CSV_PROMPT);

    // Open details and verify visible text matches as well
    const details = page.locator('#ai-prompt-details');
    await details.locator('summary').click();
    await expect(pre).toBeVisible();
    expect(await pre.textContent()).toBe(AI_CSV_PROMPT);
  });

  test('copy writes exact prompt to clipboard and shows success then reverts', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');

    const copyBtn = page.locator('#ai-prompt-copy');
    await expect(copyBtn).toHaveText('依頼文をコピー');

    await copyBtn.click();
    await expect(copyBtn).toHaveText('コピーしました');

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe(AI_CSV_PROMPT);

    // Reverts to original text after 2 seconds
    await expect(copyBtn).toHaveText('依頼文をコピー', { timeout: 3500 });
  });

  test('stubbed rejecting clipboard shows failure message and opens details', async ({ page }) => {
    await page.goto('/');

    const details = page.locator('#ai-prompt-details');
    await expect(details).not.toHaveAttribute('open');

    // Stub clipboard.writeText to reject
    await page.evaluate(() => {
      if (!navigator.clipboard) {
        Object.defineProperty(navigator, 'clipboard', {
          value: {},
          configurable: true,
        });
      }
      navigator.clipboard.writeText = () => Promise.reject(new Error('Permission denied'));
    });

    const copyBtn = page.locator('#ai-prompt-copy');
    await copyBtn.click();

    const status = page.locator('[role="status"]');
    await expect(status).toHaveText('コピーできませんでした。下の依頼文を選択してコピーしてください');
    await expect(details).toHaveAttribute('open', '');
  });

  test('no horizontal overflow at 360 px width', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    // Also verify when prompt details is opened
    const details = page.locator('#ai-prompt-details');
    await details.locator('summary').click();
    await expect(details).toHaveAttribute('open', '');

    const scrollWidthOpen = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidthOpen = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidthOpen).toBeLessThanOrEqual(clientWidthOpen);
  });
});
