import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const STANDARD_FONTS_DIR = path.resolve('node_modules/pdfjs-dist/standard_fonts/') + '/';

test.describe('Hole punch options UI', () => {
  test('defaults, disable toggle, reload persistence, and PDF generation with hole on/off', async ({ page }) => {
    await page.goto('/');

    const holeCheckbox = page.locator('#hole');
    const holeGuideSelect = page.locator('#hole-guide');

    // 1. Defaults: hole checked, guide 'first', guide enabled
    await expect(holeCheckbox).toBeChecked();
    await expect(holeGuideSelect).toHaveValue('first');
    await expect(holeGuideSelect).toBeEnabled();

    // 2. Unchecking hole disables the select; re-checking enables it
    await holeCheckbox.uncheck();
    await expect(holeGuideSelect).toBeDisabled();
    await holeCheckbox.check();
    await expect(holeGuideSelect).toBeEnabled();

    // 3. Choices persist after reload
    await holeGuideSelect.selectOption('all');
    await holeCheckbox.uncheck();
    await expect(holeGuideSelect).toBeDisabled();

    await page.reload();
    await expect(holeCheckbox).not.toBeChecked();
    await expect(holeGuideSelect).toHaveValue('all');
    await expect(holeGuideSelect).toBeDisabled();

    await holeCheckbox.check();
    await expect(holeGuideSelect).toBeEnabled();
    await expect(holeGuideSelect).toHaveValue('all');

    await holeGuideSelect.selectOption('none');
    await page.reload();
    await expect(holeCheckbox).toBeChecked();
    await expect(holeGuideSelect).toHaveValue('none');
    await expect(holeGuideSelect).toBeEnabled();

    // 4. Upload tests/fixtures/app.csv and generate PDF with hole ON
    const appCsvPath = path.resolve('tests/fixtures/app.csv');
    await page.setInputFiles('#file-input', appCsvPath);
    await expect(page.locator('#card-summary')).toBeVisible();

    const proceedBtn = page.locator('#dialog-proceed-btn');

    const downloadOnPromise = page.waitForEvent('download');
    await page.click('#generate-btn');
    if (await proceedBtn.isVisible()) {
      await proceedBtn.click();
    }
    const downloadOn = await downloadOnPromise;
    expect(downloadOn.suggestedFilename()).toMatch(/^wordcards-\d{8}-\d{4}\.pdf$/);

    const downloadOnPath = await downloadOn.path();
    const pdfOnBytes = fs.readFileSync(downloadOnPath);
    const pdfOnDoc = await pdfjsLib.getDocument({
      data: new Uint8Array(pdfOnBytes),
      standardFontDataUrl: STANDARD_FONTS_DIR,
    }).promise;
    expect(pdfOnDoc.numPages).toBe(6);

    // 5. Generate PDF with hole OFF
    await holeCheckbox.uncheck();
    await expect(holeGuideSelect).toBeDisabled();

    const downloadOffPromise = page.waitForEvent('download');
    await page.click('#generate-btn');
    if (await proceedBtn.isVisible()) {
      await proceedBtn.click();
    }
    const downloadOff = await downloadOffPromise;
    expect(downloadOff.suggestedFilename()).toMatch(/^wordcards-\d{8}-\d{4}\.pdf$/);

    const downloadOffPath = await downloadOff.path();
    const pdfOffBytes = fs.readFileSync(downloadOffPath);
    const pdfOffDoc = await pdfjsLib.getDocument({
      data: new Uint8Array(pdfOffBytes),
      standardFontDataUrl: STANDARD_FONTS_DIR,
    }).promise;
    expect(pdfOffDoc.numPages).toBe(6);
  });
});
