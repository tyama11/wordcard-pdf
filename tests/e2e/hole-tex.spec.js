import { test, expect } from '@playwright/test';

/**
 * Runs in the page: renders `text` with renderFace and returns image size,
 * dark pixel count, fit info, and card position.
 */
async function renderInPage(page, text, dpi = 300, opts = {}) {
  return page.evaluate(
    async ({ text, dpi, opts }) => {
      const m = await import('/src/tex.js');
      const url = await m.renderFace(text, { dpi, ...opts });
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let dark = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] < 128 && d[i + 1] < 128 && d[i + 2] < 128) dark++;
      }
      return {
        prefix: url.slice(0, 22),
        width: img.naturalWidth,
        height: img.naturalHeight,
        dark,
        fit: m.getLastFitInfo(),
      };
    },
    { text, dpi, opts },
  );
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => console.error('pageerror:', err.message));
  await page.goto('/');
});

const CARD_LEFT_PX = -10000;
const CARD_TOP_PX = 0;
const CARD_WIDTH_PX = (91 * 96) / 25.4;
const CARD_HEIGHT_PX = (55 * 96) / 25.4;
const CARD_RIGHT_PX = CARD_LEFT_PX + CARD_WIDTH_PX;
const CARD_BOTTOM_PX = CARD_TOP_PX + CARD_HEIGHT_PX;

const PADDING_4MM_PX = (4 * 96) / 25.4;
const PADDING_13MM_PX = (13 * 96) / 25.4;
const TOLERANCE = 0.5;

const LONG_TEXT = '光合成とは植物が光エネルギーを使って二酸化炭素と水から有機物を作る反応である。'
  .repeat(10)
  .slice(0, 300);

for (const holeSide of ['left', 'right', null]) {
  test(`holeSide ${holeSide}: fits long text inside reduced area and maintains 1075x650 image`, async ({
    page,
  }) => {
    const r = await renderInPage(page, LONG_TEXT, 300, { holeSide });

    // Assert image size is still 1075x650 at 300 dpi
    expect(r.width).toBe(1075);
    expect(r.height).toBe(650);

    // Verify text needed shrinking
    expect(r.fit.fontSize).toBeLessThan(48);
    expect(r.fit.fits).toBe(true);

    const boxRect = r.fit.boxRect;
    const leftDist = boxRect.left - CARD_LEFT_PX;
    const rightDist = CARD_RIGHT_PX - boxRect.right;
    const topDist = boxRect.top - CARD_TOP_PX;
    const bottomDist = CARD_BOTTOM_PX - boxRect.bottom;

    if (holeSide === 'left') {
      expect(leftDist).toBeGreaterThanOrEqual(PADDING_13MM_PX - TOLERANCE);
      expect(Math.abs(leftDist - PADDING_13MM_PX)).toBeLessThanOrEqual(TOLERANCE);
      expect(Math.abs(rightDist - PADDING_4MM_PX)).toBeLessThanOrEqual(TOLERANCE);
    } else if (holeSide === 'right') {
      expect(rightDist).toBeGreaterThanOrEqual(PADDING_13MM_PX - TOLERANCE);
      expect(Math.abs(rightDist - PADDING_13MM_PX)).toBeLessThanOrEqual(TOLERANCE);
      expect(Math.abs(leftDist - PADDING_4MM_PX)).toBeLessThanOrEqual(TOLERANCE);
    } else {
      expect(Math.abs(leftDist - PADDING_4MM_PX)).toBeLessThanOrEqual(TOLERANCE);
      expect(Math.abs(rightDist - PADDING_4MM_PX)).toBeLessThanOrEqual(TOLERANCE);
    }

    // Top and bottom padding should always be about 4 mm
    expect(Math.abs(topDist - PADDING_4MM_PX)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(bottomDist - PADDING_4MM_PX)).toBeLessThanOrEqual(TOLERANCE);
  });
}
