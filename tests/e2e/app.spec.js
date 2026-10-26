import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const STANDARD_FONTS_DIR = path.resolve('node_modules/pdfjs-dist/standard_fonts/') + '/';

test.describe('Wordcards PDF App E2E', () => {
  test('full app workflow: upload, generate, settings, calibration, viewport, and Shift_JIS', async ({ page }) => {
    await page.goto('/');

    // 1. Upload tests/fixtures/app.csv
    const appCsvPath = path.resolve('tests/fixtures/app.csv');
    await page.setInputFiles('#file-input', appCsvPath);

    // Summary shows 「23枚のカード（A4 3枚・両面）」
    const summary = page.locator('#card-summary');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('23枚のカード');
    await expect(summary).toContainText('A4 3枚');
    await expect(summary).toContainText('両面');

    // TeX warning visible (row 3, back side: \frac{1})
    const warning = page.locator('.alert-warning');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('3行目・裏面：\\frac{1}');

    // 2. Click generate, confirm dialog on TeX errors, capture download, verify file name pattern and PDF pages
    const downloadPromise = page.waitForEvent('download');
    await page.click('#generate-btn');
    const proceedBtn = page.locator('#dialog-proceed-btn');
    if (await proceedBtn.isVisible()) {
      await proceedBtn.click();
    }
    const download = await downloadPromise;

    const filename = download.suggestedFilename();
    expect(filename).toMatch(/^wordcards-\d{8}-\d{4}\.pdf$/);

    const downloadPath = await download.path();
    const pdfBytes = fs.readFileSync(downloadPath);
    const pdfDoc = await pdfjsLib.getDocument({
      data: new Uint8Array(pdfBytes),
      standardFontDataUrl: STANDARD_FONTS_DIR,
    }).promise;

    expect(pdfDoc.numPages).toBe(6);
    for (let p = 1; p <= 6; p++) {
      const pageObj = await pdfDoc.getPage(p);
      const [x1, y1, x2, y2] = pageObj.view;
      const widthPt = x2 - x1;
      const heightPt = y2 - y1;
      expect(Math.abs(widthPt - 595.28)).toBeLessThan(0.01);
      expect(Math.abs(heightPt - 841.89)).toBeLessThan(0.01);
    }

    // 3. Settings persist across reload
    await page.selectOption('#flip-select', 'short');
    await page.fill('#offset-x', '1.2');
    await page.dispatchEvent('#offset-x', 'change');
    await page.fill('#offset-y', '-0.5');
    await page.dispatchEvent('#offset-y', 'change');
    await page.uncheck('#crop-marks');

    await page.reload();

    await expect(page.locator('#flip-select')).toHaveValue('short');
    await expect(page.locator('#offset-x')).toHaveValue('1.2');
    await expect(page.locator('#offset-y')).toHaveValue('-0.5');
    await expect(page.locator('#crop-marks')).not.toBeChecked();

    // 4. Calibration download works (2 pages)
    const calibPromise = page.waitForEvent('download');
    await page.click('#calibration-btn');
    const calibDownload = await calibPromise;
    expect(calibDownload.suggestedFilename()).toBe('wordcards-calibration.pdf');

    const calibPath = await calibDownload.path();
    const calibBytes = fs.readFileSync(calibPath);
    const calibDoc = await pdfjsLib.getDocument({
      data: new Uint8Array(calibBytes),
      standardFontDataUrl: STANDARD_FONTS_DIR,
    }).promise;
    expect(calibDoc.numPages).toBe(2);

    // 5. At viewport 360x740, no horizontal scroll
    await page.setViewportSize({ width: 360, height: 740 });
    const scrollWidth = await page.evaluate(() => document.scrollingElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(360);

    // 6. Shift_JIS upload works
    const sjisCsvPath = path.resolve('tests/fixtures/app_sjis.csv');
    await page.setInputFiles('#file-input', sjisCsvPath);
    await expect(page.locator('#card-summary')).toContainText('4枚のカード');
    await expect(page.locator('.alert-error')).not.toBeVisible();
  });
});
