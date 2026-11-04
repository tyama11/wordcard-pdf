import path from 'node:path';
import { test, expect } from '@playwright/test';
import en from '../../src/locales/en.js';

test.describe('i18n - English UI with en-US browser locale', () => {
  test.use({ locale: 'en-US' });

  test('UI shows English once translations exist, and lang attributes are set', async ({ page }) => {
    await page.goto('/');

    // Lang checks run regardless of translations
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#locale-select')).toHaveValue('en');

    // Content assertions run only when en.js has keys
    if (Object.keys(en).length > 0) {
      if (en['step1.browse']) {
        await expect(page.locator('#browse-btn')).toHaveText(en['step1.browse']);
      }
      if (en['app.title']) {
        await expect(page.locator('.app-title')).toHaveText(en['app.title']);
      }
      if (en['step2.title']) {
        await expect(page.locator('#step-2 h2')).toHaveText(en['step2.title']);
      }
      if (en['ai.copy']) {
        await expect(page.locator('#ai-prompt-copy')).toHaveText(en['ai.copy']);
      }
      if (en['step3.generate']) {
        await expect(page.locator('#generate-btn')).toHaveText(en['step3.generate']);
      }
    }
  });

  test('manual switch persists after reload', async ({ page }) => {
    await page.goto('/');

    // Switch to Spanish
    await page.selectOption('#locale-select', 'es');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.locator('#locale-select')).toHaveValue('es');

    // Reload page
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.locator('#locale-select')).toHaveValue('es');
  });

  test('switching with a loaded CSV keeps the cards and updates the summary', async ({ page }) => {
    await page.goto('/');

    const appCsvPath = path.resolve('tests/fixtures/app.csv');
    await page.setInputFiles('#file-input', appCsvPath);

    const summary = page.locator('#card-summary');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('23');

    // Switch locale
    await page.selectOption('#locale-select', 'es');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('23');
    await expect(page.locator('#generate-btn')).toBeEnabled();

    // Switch to English
    await page.selectOption('#locale-select', 'en');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('23');
    await expect(page.locator('#generate-btn')).toBeEnabled();

    if (Object.keys(en).length > 0 && en['summary.cardCount']) {
      const expectedSummary = en['summary.cardCount']
        .replace('{count}', '23')
        .replace('{sheets}', '3');
      await expect(summary).toHaveText(expectedSummary);
    }
  });

  test('automatic detection is not saved as a choice', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(await page.evaluate(() => localStorage.getItem('wordcard_locale'))).toBeNull();
  });

  test('invalid saved locale falls back to detection', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('wordcard_locale', 'unsupported_xyz');
      } catch {}
    });

    await page.goto('/');
    // With en-US browser locale, detection falls back to 'en'
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#locale-select')).toHaveValue('en');
  });
});

test.describe('i18n - Default locale detection per browser locale', () => {
  const cases = [
    { browserLocale: 'en-US', expectedLang: 'en' },
    { browserLocale: 'es-ES', expectedLang: 'es' },
    { browserLocale: 'zh-CN', expectedLang: 'zh-Hans' },
    { browserLocale: 'zh-TW', expectedLang: 'zh-Hant' },
    { browserLocale: 'ja-JP', expectedLang: 'ja' },
  ];

  for (const { browserLocale, expectedLang } of cases) {
    test(`detects ${expectedLang} for browser locale ${browserLocale}`, async ({ browser }) => {
      const context = await browser.newContext({ locale: browserLocale });
      const page = await context.newPage();
      await page.goto('/');

      await expect(page.locator('html')).toHaveAttribute('lang', expectedLang);
      await expect(page.locator('#locale-select')).toHaveValue(expectedLang);

      await context.close();
    });
  }
});
