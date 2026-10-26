import { test, expect } from '@playwright/test';

/**
 * Computes the relative luminance of an sRGB color component.
 * @param {number} r Red component (0-255)
 * @param {number} g Green component (0-255)
 * @param {number} b Blue component (0-255)
 * @returns {number} Relative luminance
 */
export function getRelativeLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((val) => {
    const c = val / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Computes the WCAG contrast ratio between foreground and background.
 * @param {{ r: number, g: number, b: number }} fg Foreground color
 * @param {{ r: number, g: number, b: number }} bg Background color
 * @returns {number} Contrast ratio (>= 1.0)
 */
export function getContrastRatio(fg, bg) {
  const l1 = getRelativeLuminance(fg.r, fg.g, fg.b);
  const l2 = getRelativeLuminance(bg.r, bg.g, bg.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Extracts computed color and effective non-transparent background of elements matching selector.
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @returns {Promise<Array<{ selector: string, text: string, fg: { r: number, g: number, b: number }, bg: { r: number, g: number, b: number }, ratio: number }>>}
 */
export async function getElementsContrast(page, selector) {
  return page.evaluate((sel) => {
    function parseRgba(str) {
      if (!str) return null;
      const match = str.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/);
      if (!match) return null;
      return {
        r: parseFloat(match[1]),
        g: parseFloat(match[2]),
        b: parseFloat(match[3]),
        a: match[4] !== undefined ? parseFloat(match[4]) : 1,
      };
    }

    function getLuminance(r, g, b) {
      const [rs, gs, bs] = [r, g, b].map((val) => {
        const c = val / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }

    function computeRatio(fg, bg) {
      const l1 = getLuminance(fg.r, fg.g, fg.b);
      const l2 = getLuminance(bg.r, bg.g, bg.b);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    const elements = Array.from(document.querySelectorAll(sel));
    if (elements.length === 0) {
      throw new Error(`No elements matching selector: ${sel}`);
    }

    return elements.map((el) => {
      const fgStyle = window.getComputedStyle(el);
      console.log('computed color for', sel, ':', fgStyle.color, 'bg:', fgStyle.backgroundColor);
      const fg = parseRgba(fgStyle.color) || { r: 0, g: 0, b: 0, a: 1 };

      let current = el;
      let bg = null;
      while (current) {
        const bgStyle = window.getComputedStyle(current);
        const parsed = parseRgba(bgStyle.backgroundColor);
        if (parsed && parsed.a > 0) {
          bg = parsed;
          break;
        }
        current = current.parentElement;
      }

      if (!bg) {
        bg = { r: 255, g: 255, b: 255, a: 1 };
      }

      const ratio = computeRatio(fg, bg);
      return {
        selector: sel,
        text: (el.textContent || '').trim().slice(0, 30),
        fg,
        bg,
        ratio,
      };
    });
  }, selector);
}

const TARGET_SELECTORS = [
  '.drop-zone-text',
  '#browse-btn',
  '#calibration-btn',
  '#generate-btn',
  '.help-text',
  '.sample-link-wrapper a',
  'h1',
  'h2',
];

for (const colorScheme of ['light', 'dark']) {
  test.describe(`Contrast tests (${colorScheme} mode)`, () => {
    test.use({ colorScheme });

    test(`all primary UI elements satisfy WCAG AA contrast >= 4.5 in ${colorScheme} theme`, async ({ page }) => {
      await page.goto('/');

      // Wait until Vite has loaded and applied style.css
      await page.waitForFunction(() => {
        const btn = document.querySelector('#browse-btn');
        if (!btn) return false;
        const style = window.getComputedStyle(btn);
        return style.borderRadius === '8px';
      });

      // Disable CSS transitions during test so computed colors are stable
      await page.addStyleTag({
        content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
      });

      for (const selector of TARGET_SELECTORS) {
        const results = await getElementsContrast(page, selector);
        expect(results.length, `${selector} not found`).toBeGreaterThan(0);
        for (const item of results) {
          expect(
            item.ratio,
            `Expected ${selector} ("${item.text}") in ${colorScheme} mode to have contrast >= 4.5, got ${item.ratio.toFixed(2)} (fg: rgb(${item.fg.r},${item.fg.g},${item.fg.b}), bg: rgb(${item.bg.r},${item.bg.g},${item.bg.b}))`
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    test(`injected confirm-dialog satisfies WCAG AA contrast >= 4.5 in ${colorScheme} theme`, async ({ page }) => {
      await page.goto('/');

      // Wait until Vite has loaded and applied style.css
      await page.waitForFunction(() => {
        const btn = document.querySelector('#browse-btn');
        if (!btn) return false;
        const style = window.getComputedStyle(btn);
        return style.borderRadius === '8px';
      });

      // Disable CSS transitions during test so computed colors are stable
      await page.addStyleTag({
        content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
      });

      await page.evaluate(() => {
        const dialog = document.createElement('dialog');
        dialog.className = 'confirm-dialog';
        dialog.id = 'injected-confirm-dialog';
        dialog.innerHTML = `
          <h2>確認ダイアログ</h2>
          <p class="confirm-dialog-msg">以下の設定内容をご確認ください。</p>
          <div class="confirm-dialog-list">
            <p>1. 表面設定: 表</p>
            <p>2. 裏面設定: 裏</p>
          </div>
          <footer class="confirm-dialog-footer">
            <button type="button" class="btn secondary-btn" id="dialog-cancel-btn">キャンセル</button>
            <button type="button" class="btn primary-btn" id="dialog-proceed-btn">確定して実行</button>
          </footer>
        `;
        document.body.appendChild(dialog);
        dialog.showModal();
      });

      const dialogSelectors = [
        '#injected-confirm-dialog h2',
        '#injected-confirm-dialog .confirm-dialog-msg',
        '#injected-confirm-dialog .confirm-dialog-list p',
        '#dialog-cancel-btn',
        '#dialog-proceed-btn',
      ];

      for (const selector of dialogSelectors) {
        const results = await getElementsContrast(page, selector);
        expect(results.length, `${selector} not found`).toBeGreaterThan(0);
        for (const item of results) {
          expect(
            item.ratio,
            `Expected ${selector} ("${item.text}") in dialog (${colorScheme} mode) to have contrast >= 4.5, got ${item.ratio.toFixed(2)}`
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  });
}
