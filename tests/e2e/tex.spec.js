import { test, expect } from '@playwright/test';

/**
 * Runs in the page: renders `text` with renderFace and returns image size,
 * dark pixel count and the fit info.
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

test('findTexErrors returns shape [{source, message, ja}] and correct ja strings', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const m = await import('/src/tex.js');
    return {
      frac: m.findTexErrors('$\\frac{1}$'),
      sqrt: m.findTexErrors('$\\sqrt{x$'),
      valid: m.findTexErrors('$\\frac{1}{2}$'),
      plain: m.findTexErrors('光合成'),
      // Test explainTexError mappings directly
      exMissingArg: m.explainTexError('Missing argument for \\frac'),
      exMissingClose: m.explainTexError('Missing close brace'),
      exExtraClose: m.explainTexError('Extra close brace'),
      exExtraOpen: m.explainTexError('Extra open brace or missing close brace'),
      exUndefined: m.explainTexError('Undefined control sequence \\foo'),
      exDelimDollar: m.explainTexError('Unclosed math delimiter $'),
      exDelimDoubleDollar: m.explainTexError('Unclosed math delimiter $$'),
      exDelimParen: m.explainTexError('Unclosed math delimiter \\('),
      exDelimBracket: m.explainTexError('Unclosed math delimiter \\['),
      exDoubleExp: m.explainTexError('Double exponent: use braces to clarify'),
      exDoubleSub: m.explainTexError('Double subscript: use braces to clarify'),
      exOther: m.explainTexError('Some unknown parser error'),
    };
  });

  // Shape of frac
  expect(result.frac).toHaveLength(1);
  expect(result.frac[0]).toEqual({
    source: '\\frac{1}',
    message: expect.stringContaining('Missing argument for'),
    ja: '\\frac の { } の中身が足りません',
  });

  // Shape of sqrt with unclosed brace (MathJax throws Missing close brace)
  expect(result.sqrt).toHaveLength(1);
  expect(result.sqrt[0].source).toBe('\\sqrt{x');
  expect(result.sqrt[0].message).toBe('Missing close brace');
  expect(result.sqrt[0].ja).toBe('閉じかっこ } が足りません');

  // Valid inputs return empty array
  expect(result.valid).toEqual([]);
  expect(result.plain).toEqual([]);

  // explainTexError strings
  expect(result.exMissingArg).toBe('\\frac の { } の中身が足りません');
  expect(result.exMissingClose).toBe('閉じかっこ } が足りません');
  expect(result.exExtraClose).toBe('かっこ { } の数が合っていません');
  expect(result.exExtraOpen).toBe('かっこ { } の数が合っていません');
  expect(result.exUndefined).toBe('\\foo という命令はありません（つづりを確認してください）');
  expect(result.exDelimDollar).toBe('$ が閉じられていません（数式は $ と $ ではさみます）');
  expect(result.exDelimDoubleDollar).toBe('$$ が閉じられていません（数式は $$ と $$ ではさみます）');
  expect(result.exDelimParen).toBe('\\( が閉じられていません（数式は \\( と \\) ではさみます）');
  expect(result.exDelimBracket).toBe('\\[ が閉じられていません（数式は \\[ と \\] ではさみます）');
  expect(result.exDoubleExp).toBe('^ や _ が続けて使われています。{ } でまとめてください');
  expect(result.exDoubleSub).toBe('^ や _ が続けて使われています。{ } でまとめてください');
  expect(result.exOther).toBe('数式の書き方に誤りがあります（Some unknown parser error）');
});

test('undefined control sequence is reported and rendered in red', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const m = await import('/src/tex.js');
    const errs = m.findTexErrors('$\\foo{x}$');
    const html = m.toHtml('$\\foo{x}$');
    return { errs, html };
  });

  expect(result.errs).toHaveLength(1);
  expect(result.errs[0]).toEqual({
    source: '\\foo{x}',
    message: 'Undefined control sequence \\foo',
    ja: '\\foo という命令はありません（つづりを確認してください）',
  });

  // Still renders in red via noundefined in SVG
  expect(result.html).toContain('<svg');
  expect(result.html).toContain('fill="red"');
  expect(result.html).toContain('\\foo');
});

test('footer present for invalid face and absent for valid face', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const m = await import('/src/tex.js');

    // Invalid face with single error
    const faceSingle = m.buildFace('$\\frac{1}$');
    document.body.appendChild(faceSingle.card);
    const noteSingle = faceSingle.card.querySelector('.wordcard-error-note');
    const textSingle = noteSingle ? noteSingle.textContent : null;
    faceSingle.card.remove();

    // Invalid face with multiple errors
    const faceMultiple = m.buildFace('$\\frac{1}$ and $\\foo{x}$');
    document.body.appendChild(faceMultiple.card);
    const noteMultiple = faceMultiple.card.querySelector('.wordcard-error-note');
    const textMultiple = noteMultiple ? noteMultiple.textContent : null;
    faceMultiple.card.remove();

    // Valid face
    const faceValid = m.buildFace('$\\frac{1}{2}$');
    document.body.appendChild(faceValid.card);
    const noteValid = faceValid.card.querySelector('.wordcard-error-note');
    faceValid.card.remove();

    // Plain text face
    const facePlain = m.buildFace('光合成');
    document.body.appendChild(facePlain.card);
    const notePlain = facePlain.card.querySelector('.wordcard-error-note');
    facePlain.card.remove();

    return {
      textSingle,
      textMultiple,
      hasNoteValid: !!noteValid,
      hasNotePlain: !!notePlain,
    };
  });

  expect(result.textSingle).toBe('⚠ 数式エラー：\\frac の { } の中身が足りません');
  expect(result.textMultiple).toBe('⚠ 数式エラー：\\frac の { } の中身が足りません ほか1件');
  expect(result.hasNoteValid).toBe(false);
  expect(result.hasNotePlain).toBe(false);
});

test('footer does not overlap fitted content in offscreen render', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const m = await import('/src/tex.js');

    // Test with short invalid text
    const shortFace = m.buildFace('$\\frac{1}$');
    document.body.appendChild(shortFace.card);
    m.fitFace(shortFace.box);
    const shortBoxRect = shortFace.box.getBoundingClientRect();
    const shortNote = shortFace.card.querySelector('.wordcard-error-note');
    const shortNoteRect = shortNote.getBoundingClientRect();
    const shortComputed = window.getComputedStyle(shortNote);
    const shortFontSize = shortComputed.fontSize;
    shortFace.card.remove();

    // Test with long text + invalid TeX to force auto-fit down
    const longText = '説明文 '.repeat(50) + '$\\frac{1}$';
    const longFace = m.buildFace(longText);
    document.body.appendChild(longFace.card);
    const fitInfo = m.fitFace(longFace.box);
    const longBoxRect = longFace.box.getBoundingClientRect();
    const longNote = longFace.card.querySelector('.wordcard-error-note');
    const longNoteRect = longNote.getBoundingClientRect();
    longFace.card.remove();

    // Also verify via renderFace and getLastFitInfo
    await m.renderFace('$\\foo{x}$');
    const lastFit = m.getLastFitInfo();

    return {
      shortBoxBottom: shortBoxRect.bottom,
      shortNoteTop: shortNoteRect.top,
      shortFontSize,
      longBoxBottom: longBoxRect.bottom,
      longNoteTop: longNoteRect.top,
      longFitFontSize: fitInfo.fontSize,
      lastFitBoxBottom: lastFit.boxRect.bottom,
      lastFitFooterTop: lastFit.footerRect.top,
      hasFooter: lastFit.hasFooter,
    };
  });

  // Short face: box bottom must not exceed note top
  expect(result.shortBoxBottom).toBeLessThanOrEqual(result.shortNoteTop);
  expect(result.shortFontSize).toBe('7px');

  // Long face: auto-fitted content fits within remaining height and does not overlap
  expect(result.longFitFontSize).toBeLessThan(48);
  expect(result.longBoxBottom).toBeLessThanOrEqual(result.longNoteTop);

  // renderFace getLastFitInfo bounding boxes
  expect(result.hasFooter).toBe(true);
  expect(result.lastFitBoxBottom).toBeLessThanOrEqual(result.lastFitFooterTop);
});

test('renderFace with errorNote:false has no footer', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const m = await import('/src/tex.js');

    // renderFace with errorNote: false on invalid formula
    await m.renderFace('$\\frac{1}$', { errorNote: false });
    const fitNoFooter = m.getLastFitInfo();

    // buildFace with errorNote: false
    const face = m.buildFace('$\\frac{1}$', { errorNote: false });
    document.body.appendChild(face.card);
    const note = face.card.querySelector('.wordcard-error-note');
    face.card.remove();

    return {
      hasFooter: fitNoFooter.hasFooter,
      footerRect: fitNoFooter.footerRect,
      hasNoteElement: !!note,
    };
  });

  expect(result.hasFooter).toBe(false);
  expect(result.footerRect).toBeNull();
  expect(result.hasNoteElement).toBe(false);
});
