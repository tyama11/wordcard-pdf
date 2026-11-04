import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  CARDS_PER_SHEET_OPTIONS,
  DEFAULT_CARDS_PER_SHEET,
  gridFor,
  frontRect,
  backRect,
} from '../../src/layout.js';

const STANDARD_FONTS_DIR = path.resolve('node_modules/pdfjs-dist/standard_fonts/') + '/';

/**
 * Extracts painted image rects { x, y, w, h } in top-left mm coordinates
 * from a pdfjs page by tracking save/restore/transform operations on the CTM.
 */
async function extractPageImages(page) {
  const ops = await page.getOperatorList();
  const k = 72 / 25.4;
  const pageHeightPt = page.view[3];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const images = [];

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];

    if (fn === pdfjsLib.OPS.save) {
      stack.push([...ctm]);
    } else if (fn === pdfjsLib.OPS.restore) {
      ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    } else if (fn === pdfjsLib.OPS.transform) {
      ctm = pdfjsLib.Util.transform(ctm, args);
    } else if (
      fn === pdfjsLib.OPS.paintImageXObject ||
      fn === pdfjsLib.OPS.paintInlineImageXObject
    ) {
      const [a, b, c, d, e, f] = ctm;
      const x = e / k;
      const y = (pageHeightPt - (f + d)) / k;
      const w = a / k;
      const h = d / k;
      images.push({ x, y, w, h });
    }
  }

  return images;
}

/**
 * Generates CSV content with `n` word pairs.
 */
function makeCsvContent(n) {
  let s = 'front,back\n';
  for (let i = 1; i <= n; i++) {
    s += `Card ${i} Front,Card ${i} Back\n`;
  }
  return s;
}

/**
 * Clicks generate PDF, confirms any warning dialog, and returns the parsed pdfjs document.
 */
async function generateAndLoadPdf(page) {
  const proceedBtn = page.locator('#dialog-proceed-btn');
  const downloadPromise = page.waitForEvent('download');
  await page.click('#generate-btn');
  if (await proceedBtn.isVisible()) {
    await proceedBtn.click();
  }
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^wordcards-\d{8}-\d{4}\.pdf$/);

  const downloadPath = await download.path();
  const pdfBytes = fs.readFileSync(downloadPath);
  return pdfjsLib.getDocument({
    data: new Uint8Array(pdfBytes),
    standardFontDataUrl: STANDARD_FONTS_DIR,
  }).promise;
}

/**
 * Compares an array of extracted image rects against expected rects within tolerance.
 */
function verifyImageRects(actualRects, expectedRects, tol = 0.01) {
  expect(actualRects).toHaveLength(expectedRects.length);
  for (let i = 0; i < expectedRects.length; i++) {
    const act = actualRects[i];
    const exp = expectedRects[i];
    expect(Math.abs(act.x - exp.x)).toBeLessThanOrEqual(tol);
    expect(Math.abs(act.y - exp.y)).toBeLessThanOrEqual(tol);
    expect(Math.abs(act.w - exp.w)).toBeLessThanOrEqual(tol);
    expect(Math.abs(act.h - exp.h)).toBeLessThanOrEqual(tol);
  }
}

test.describe('Cards per sheet setting', () => {
  test('1. Default is 10; option values are exactly 4,6,8,10,12,15,18 and labels match gridFor', async ({ page }) => {
    await page.goto('/');

    const select = page.locator('#cards-per-sheet');
    const help = page.locator('#cards-per-sheet-help');

    // Helper text
    await expect(help).toBeVisible();
    await expect(help).toHaveText('枚数を変えるとカードの大きさも変わります。市販の10面名刺カード用紙に合わせる場合は、10枚を選んでください。');

    // Default value is 10
    await expect(select).toHaveValue(String(DEFAULT_CARDS_PER_SHEET));

    // Option values and labels
    const options = select.locator('option');
    await expect(options).toHaveCount(CARDS_PER_SHEET_OPTIONS.length);

    const expectedOptions = [4, 6, 8, 10, 12, 15, 18];
    expect(CARDS_PER_SHEET_OPTIONS).toEqual(expectedOptions);

    for (let i = 0; i < CARDS_PER_SHEET_OPTIONS.length; i++) {
      const n = CARDS_PER_SHEET_OPTIONS[i];
      const opt = options.nth(i);
      await expect(opt).toHaveAttribute('value', String(n));

      const grid = gridFor(n);
      const w = Math.round(grid.cardWidth);
      const h = Math.round(grid.cardHeight);
      const expectedLabel = `${n}枚（${grid.cols}列×${grid.rows}行・${w}×${h}mm）`;
      await expect(opt).toHaveText(expectedLabel);
    }
  });

  test('2. Changing select with loaded fixture CSV updates displayed sheet count', async ({ page }) => {
    await page.goto('/');

    const appCsvPath = path.resolve('tests/fixtures/app.csv');
    await page.setInputFiles('#file-input', appCsvPath);

    const summary = page.locator('#card-summary');
    await expect(summary).toBeVisible();

    // app.csv has 23 cards
    // 10 cards per sheet (default): ceil(23 / 10) = 3 sheets
    await expect(summary).toHaveText('23枚のカード（A4 3枚・両面）');

    // 4 cards per sheet: ceil(23 / 4) = 6 sheets
    await page.selectOption('#cards-per-sheet', '4');
    await expect(summary).toHaveText('23枚のカード（A4 6枚・両面）');

    // 18 cards per sheet: ceil(23 / 18) = 2 sheets
    await page.selectOption('#cards-per-sheet', '18');
    await expect(summary).toHaveText('23枚のカード（A4 2枚・両面）');

    // 10 cards per sheet again: ceil(23 / 10) = 3 sheets
    await page.selectOption('#cards-per-sheet', '10');
    await expect(summary).toHaveText('23枚のカード（A4 3枚・両面）');
  });

  test('3. Selection persists across reload and invalid localStorage value falls back to 10', async ({ page }) => {
    await page.goto('/');

    const select = page.locator('#cards-per-sheet');

    // Select 6, reload, verify persists
    await page.selectOption('#cards-per-sheet', '6');
    await page.reload();
    await expect(select).toHaveValue('6');

    // Select 18, reload, verify persists
    await page.selectOption('#cards-per-sheet', '18');
    await page.reload();
    await expect(select).toHaveValue('18');

    // Invalid localStorage value '5' falls back to 10
    await page.evaluate(() => localStorage.setItem('wordcard_cardsPerSheet', '5'));
    await page.reload();
    await expect(select).toHaveValue('10');

    // Invalid localStorage value 'abc' falls back to 10
    await page.evaluate(() => localStorage.setItem('wordcard_cardsPerSheet', 'abc'));
    await page.reload();
    await expect(select).toHaveValue('10');
  });

  test('4. PDF generation for 4 and 18 with hole ON verifies duplex alignment for long and short flip', async ({ page }) => {
    await page.goto('/');

    // Verify hole is ON by default
    const holeCheckbox = page.locator('#hole');
    await expect(holeCheckbox).toBeChecked();

    // --- Case A: 4 cards per sheet (fills sheet with 4 cards) ---
    await page.selectOption('#cards-per-sheet', '4');
    await page.setInputFiles('#file-input', {
      name: 'cards4.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(makeCsvContent(4)),
    });
    await expect(page.locator('#generate-btn')).toBeEnabled();
    await expect(page.locator('#card-summary')).toHaveText('4枚のカード（A4 1枚・両面）');

    const expFront4 = Array.from({ length: 4 }, (_, s) => frontRect(s, 4));
    const expBack4Long = Array.from({ length: 4 }, (_, s) => backRect(s, { flip: 'long', cardsPerSheet: 4 }));
    const expBack4Short = Array.from({ length: 4 }, (_, s) => backRect(s, { flip: 'short', cardsPerSheet: 4 }));

    // Long flip
    await page.selectOption('#flip-select', 'long');
    const pdf4Long = await generateAndLoadPdf(page);
    expect(pdf4Long.numPages).toBe(2);
    verifyImageRects(await extractPageImages(await pdf4Long.getPage(1)), expFront4);
    verifyImageRects(await extractPageImages(await pdf4Long.getPage(2)), expBack4Long);

    // Short flip
    await expect(page.locator('#generate-btn')).toBeEnabled();
    await page.selectOption('#flip-select', 'short');
    const pdf4Short = await generateAndLoadPdf(page);
    expect(pdf4Short.numPages).toBe(2);
    verifyImageRects(await extractPageImages(await pdf4Short.getPage(1)), expFront4);
    verifyImageRects(await extractPageImages(await pdf4Short.getPage(2)), expBack4Short);

    // --- Case B: 18 cards per sheet (fills sheet with 18 cards) ---
    await expect(page.locator('#generate-btn')).toBeEnabled();
    await page.selectOption('#cards-per-sheet', '18');
    await page.setInputFiles('#file-input', {
      name: 'cards18.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(makeCsvContent(18)),
    });
    await expect(page.locator('#generate-btn')).toBeEnabled();
    await expect(page.locator('#card-summary')).toHaveText('18枚のカード（A4 1枚・両面）');

    const expFront18 = Array.from({ length: 18 }, (_, s) => frontRect(s, 18));
    const expBack18Long = Array.from({ length: 18 }, (_, s) => backRect(s, { flip: 'long', cardsPerSheet: 18 }));
    const expBack18Short = Array.from({ length: 18 }, (_, s) => backRect(s, { flip: 'short', cardsPerSheet: 18 }));

    // Long flip
    await page.selectOption('#flip-select', 'long');
    const pdf18Long = await generateAndLoadPdf(page);
    expect(pdf18Long.numPages).toBe(2);
    verifyImageRects(await extractPageImages(await pdf18Long.getPage(1)), expFront18);
    verifyImageRects(await extractPageImages(await pdf18Long.getPage(2)), expBack18Long);

    // Short flip
    await expect(page.locator('#generate-btn')).toBeEnabled();
    await page.selectOption('#flip-select', 'short');
    const pdf18Short = await generateAndLoadPdf(page);
    expect(pdf18Short.numPages).toBe(2);
    verifyImageRects(await extractPageImages(await pdf18Short.getPage(1)), expFront18);
    verifyImageRects(await extractPageImages(await pdf18Short.getPage(2)), expBack18Short);
  });

  test('5. Default regression: not selecting anything yields the same 10-card placement', async ({ page }) => {
    await page.goto('/');

    // Verify default value is 10 and default flip is long
    await expect(page.locator('#cards-per-sheet')).toHaveValue('10');
    await expect(page.locator('#flip-select')).toHaveValue('long');

    // Upload 10 cards to fill 1 sheet
    await page.setInputFiles('#file-input', {
      name: 'cards10.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(makeCsvContent(10)),
    });
    await expect(page.locator('#generate-btn')).toBeEnabled();
    await expect(page.locator('#card-summary')).toHaveText('10枚のカード（A4 1枚・両面）');

    // Generate PDF without touching cards-per-sheet
    const pdfDoc = await generateAndLoadPdf(page);
    expect(pdfDoc.numPages).toBe(2);

    const expFront10 = Array.from({ length: 10 }, (_, s) => frontRect(s, 10));
    const expBack10Long = Array.from({ length: 10 }, (_, s) => backRect(s, { flip: 'long', cardsPerSheet: 10 }));

    verifyImageRects(await extractPageImages(await pdfDoc.getPage(1)), expFront10);
    verifyImageRects(await extractPageImages(await pdfDoc.getPage(2)), expBack10Long);
  });
});
