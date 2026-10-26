import { test, expect } from '@playwright/test';

/**
 * Runs in the page: renders `text` with renderFace and returns image size,
 * dark pixel count and the fit info.
 */
async function renderInPage(page, text, dpi = 300) {
  return page.evaluate(
    async ({ text, dpi }) => {
      const m = await import('/src/tex.js');
      const url = await m.renderFace(text, { dpi });
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
    { text, dpi },
  );
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => console.error('pageerror:', err.message));
  await page.goto('/');
});

test('renderFace returns a PNG of the exact card size', async ({ page }) => {
  const r300 = await renderInPage(page, 'abc');
  expect(r300.prefix).toBe('data:image/png;base64,');
  expect(r300.width).toBe(1075);
  expect(r300.height).toBe(650);
  const r150 = await renderInPage(page, 'abc', 150);
  expect(r150.width).toBe(Math.round((91 / 25.4) * 150));
  expect(r150.height).toBe(Math.round((55 / 25.4) * 150));
});

test('blank face renders as an all-white image', async ({ page }) => {
  const r = await renderInPage(page, '');
  expect(r.width).toBe(1075);
  expect(r.dark).toBe(0);
});

for (const text of [
  '$\\frac{a}{b}$',
  '$\\sqrt{x^2+1}$',
  '$$\\int_0^1 x\\,dx$$',
  '\\ce{H2SO4}',
  '$\\ce{2H2 + O2 -> 2H2O}$',
  '光合成',
]) {
  test(`renders non-blank: ${text}`, async ({ page }) => {
    const r = await renderInPage(page, text);
    expect(r.width).toBe(1075);
    expect(r.height).toBe(650);
    expect(r.dark).toBeGreaterThan(500);
  });
}

test('toHtml produces inline SVG for math and \\ce, escaped text and <br>', async ({ page }) => {
  const out = await page.evaluate(async () => {
    const m = await import('/src/tex.js');
    return {
      math: m.toHtml('$\\frac{a}{b}$'),
      display: m.toHtml('$$\\int_0^1 x\\,dx$$'),
      ce: m.toHtml('\\ce{H2SO4}'),
      ceMath: m.toHtml('$\\ce{2H2 + O2 -> 2H2O}$'),
      text: m.toHtml('a<b & "c"\nd \\$5'),
    };
  });
  expect(out.math).toContain('<svg');
  expect(out.display).toContain('<svg');
  expect(out.display).toContain('display="true"');
  expect(out.ce).toContain('<svg');
  expect(out.ceMath).toContain('<svg');
  // mhchem arrows are remapped from Private Use Area chars to glyphs of the bundled font
  // (unknown glyphs would be emitted as <text> elements)
  expect(out.ceMath).not.toMatch(/[\uE000-\uF8FF]/);
  expect(out.ceMath).not.toContain('<text');
  // fontCache 'none': no shared <use> references to a global cache
  expect(out.math).not.toContain('<use');
  expect(out.text).toBe('a&lt;b &amp; &quot;c&quot;<br>d $5');
});

test('invalid TeX does not throw and shows red source', async ({ page }) => {
  const out = await page.evaluate(async () => {
    const m = await import('/src/tex.js');
    return m.toHtml('$\\frac{1}$');
  });
  expect(out).toContain('<span style="color:#c00">');
  expect(out).toContain('\\frac{1}');
  expect(out).not.toContain('<svg');
  const r = await renderInPage(page, '$\\frac{1}$');
  expect(r.width).toBe(1075);
  expect(r.height).toBe(650);
});

test('auto-fit shrinks long text and keeps it within the card', async ({ page }) => {
  const short = await renderInPage(page, '光');
  const longText = '光合成とは植物が光エネルギーを使って二酸化炭素と水から有機物を作る反応である。'
    .repeat(10)
    .slice(0, 300);
  expect([...longText].length).toBe(300);
  const long = await renderInPage(page, longText);
  expect(short.fit.fontSize).toBe(48);
  expect(long.fit.fontSize).toBeLessThan(short.fit.fontSize);
  expect(long.fit.fontSize).toBeGreaterThanOrEqual(6);
  expect(long.fit.fits).toBe(true);
  expect(long.fit.scrollWidth).toBeLessThanOrEqual(long.fit.clientWidth);
  expect(long.fit.scrollHeight).toBeLessThanOrEqual(long.fit.clientHeight);
  // the chosen size is maximal: 0.5 px larger overflows (checked via fitFace on a fresh element)
  const check = await page.evaluate(
    async ({ text, size }) => {
      const m = await import('/src/tex.js');
      const box = document.createElement('div');
      Object.assign(box.style, {
        position: 'fixed',
        left: '-10000px',
        top: '0',
        width: `${m.FACE_WIDTH_PX - 2 * (4 * 96) / 25.4}px`,
        height: `${m.FACE_HEIGHT_PX - 2 * (4 * 96) / 25.4}px`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'safe center',
        overflow: 'hidden',
        overflowWrap: 'anywhere',
        fontFamily: '"Hiragino Sans","Noto Sans JP","Yu Gothic","Meiryo",sans-serif',
        lineHeight: '1.3',
      });
      box.innerHTML = `<div style="flex:none;text-align:center">${m.toHtml(text)}</div>`;
      document.body.appendChild(box);
      const info = m.fitFace(box);
      box.style.fontSize = `${size + 0.5}px`;
      const overflowsAtNext =
        box.scrollWidth > box.clientWidth || box.scrollHeight > box.clientHeight;
      box.remove();
      return { info, overflowsAtNext };
    },
    { text: longText, size: long.fit.fontSize },
  );
  expect(check.info.fontSize).toBe(long.fit.fontSize);
  expect(check.overflowsAtNext).toBe(true);
  // long text still produces visible ink
  expect(long.dark).toBeGreaterThan(1000);
});
