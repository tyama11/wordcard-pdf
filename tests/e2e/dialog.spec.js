import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const STANDARD_FONTS_DIR = path.resolve('node_modules/pdfjs-dist/standard_fonts/') + '/';

test.describe('TeX Error Features and Confirmation Dialog E2E', () => {
  test('(a) CSV with errors: Step 1 warning lists entries with Japanese explanations', async ({ page }) => {
    await page.goto('/');

    const csvPath = path.resolve('tests/fixtures/dialog-errors.csv');
    await page.setInputFiles('#file-input', csvPath);

    const warning = page.locator('#alert-container .alert-warning');
    await expect(warning).toBeVisible();

    // Check row/side formatting and Japanese explanations
    // Including unclosed '$x^2' and '$\foo{x}$'
    await expect(warning).toContainText('2行目・裏面：$x^2 — $ が閉じられていません（数式は $ と $ ではさみます）');
    await expect(warning).toContainText('3行目・裏面：\\foo{x} — \\foo という命令はありません（つづりを確認してください）');
  });

  test('(b) clicking generate opens dialog with correct count and entries, cancel/Esc closes without download and returns focus to file-select button', async ({ page }) => {
    await page.goto('/');

    const csvPath = path.resolve('tests/fixtures/dialog-errors.csv');
    await page.setInputFiles('#file-input', csvPath);

    const dialog = page.locator('#confirm-dialog');
    const title = page.locator('#confirm-dialog-title');
    const list = page.locator('#confirm-dialog-list');
    const cancelBtn = page.locator('#dialog-cancel-btn');
    const browseBtn = page.locator('#browse-btn');

    let downloadTriggered = false;
    page.on('download', () => {
      downloadTriggered = true;
    });

    // Click generate opens dialog
    await page.click('#generate-btn');
    await expect(dialog).toBeVisible();
    await expect(title).toContainText('数式の書き方に誤りが2件あります');

    // Check entries in dialog list: row, side, source in <code>, ja explanation
    await expect(list).toContainText('2行目・裏面：$x^2 — $ が閉じられていません（数式は $ と $ ではさみます）');
    await expect(list).toContainText('3行目・裏面：\\foo{x} — \\foo という命令はありません（つづりを確認してください）');
    const codeElements = list.locator('code');
    await expect(codeElements).toHaveCount(2);
    await expect(codeElements.nth(0)).toHaveText('$x^2');
    await expect(codeElements.nth(1)).toHaveText('\\foo{x}');

    // Initial focus on 「戻って直す」
    await expect(cancelBtn).toBeFocused();
    expect(downloadTriggered).toBe(false);

    // Click 「戻って直す」: closes dialog, no download, focus returns to browseBtn
    await cancelBtn.click();
    await expect(dialog).not.toBeVisible();
    expect(downloadTriggered).toBe(false);
    await expect(browseBtn).toBeFocused();

    // Esc behaves like 「戻って直す」
    await page.click('#generate-btn');
    await expect(dialog).toBeVisible();
    await expect(cancelBtn).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    expect(downloadTriggered).toBe(false);
    await expect(browseBtn).toBeFocused();
  });

  test('(c) 「このまま作成する」 triggers a download of a valid PDF', async ({ page }) => {
    await page.goto('/');

    const csvPath = path.resolve('tests/fixtures/dialog-errors.csv');
    await page.setInputFiles('#file-input', csvPath);

    const downloadPromise = page.waitForEvent('download');
    await page.click('#generate-btn');
    await expect(page.locator('#confirm-dialog')).toBeVisible();

    await page.click('#dialog-proceed-btn');
    const download = await downloadPromise;

    const filename = download.suggestedFilename();
    expect(filename).toMatch(/^wordcards-\d{8}-\d{4}\.pdf$/);

    const downloadPath = await download.path();
    const pdfBytes = fs.readFileSync(downloadPath);
    const pdfDoc = await pdfjsLib.getDocument({
      data: new Uint8Array(pdfBytes),
      standardFontDataUrl: STANDARD_FONTS_DIR,
    }).promise;

    // 2 cards -> 1 A4 sheet -> 2 pages
    expect(pdfDoc.numPages).toBe(2);
  });

  test('(d) CSV without errors: no dialog, download starts directly', async ({ page }) => {
    await page.goto('/');

    const csvPath = path.resolve('tests/fixtures/dialog-valid.csv');
    await page.setInputFiles('#file-input', csvPath);

    await expect(page.locator('#alert-container .alert-warning')).not.toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.click('#generate-btn');

    // Dialog must not appear
    await expect(page.locator('#confirm-dialog')).not.toBeVisible();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^wordcards-\d{8}-\d{4}\.pdf$/);
  });

  test('(e) CSV containing "¥frac{1}{2}" and "¥100": info note shows 1か所, no TeX error reported', async ({ page }) => {
    await page.goto('/');

    const csvPath = path.resolve('tests/fixtures/dialog-yen.csv');
    await page.setInputFiles('#file-input', csvPath);

    // Info note inside #alert-container
    const alertInfo = page.locator('#alert-container .alert-info');
    await expect(alertInfo).toBeVisible();
    await expect(alertInfo).toContainText('1か所');
    await expect(alertInfo).toContainText('円記号（¥）をバックスラッシュ（\\）として読み替えました：1か所');

    // No TeX error reported
    await expect(page.locator('#alert-container .alert-warning')).not.toBeVisible();
  });
});
