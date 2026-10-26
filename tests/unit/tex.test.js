import { describe, it, expect } from 'vitest';
import { splitTex, normalizeInput } from '../../src/texsplit.js';

describe('splitTex', () => {
  it('returns plain text as a single text part', () => {
    expect(splitTex('光合成')).toEqual([{ type: 'text', value: '光合成' }]);
  });

  it('returns no parts for empty input', () => {
    expect(splitTex('')).toEqual([]);
    expect(splitTex(undefined)).toEqual([]);
    expect(splitTex(null)).toEqual([]);
  });

  it('splits $...$ inline math', () => {
    expect(splitTex('a $x^2$ b')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'inline', value: 'x^2' },
      { type: 'text', value: ' b' },
    ]);
  });

  it('splits $$...$$ display math', () => {
    expect(splitTex('式 $$\\int_0^1 x\\,dx$$ 終')).toEqual([
      { type: 'text', value: '式 ' },
      { type: 'display', value: '\\int_0^1 x\\,dx' },
      { type: 'text', value: ' 終' },
    ]);
  });

  it('splits \\(...\\) inline and \\[...\\] display math', () => {
    expect(splitTex('\\(a+b\\) and \\[c\\]')).toEqual([
      { type: 'inline', value: 'a+b' },
      { type: 'text', value: ' and ' },
      { type: 'display', value: 'c' },
    ]);
  });

  it('handles adjacent inline math', () => {
    expect(splitTex('$a$$b$')).toEqual([
      { type: 'inline', value: 'a' },
      { type: 'inline', value: 'b' },
    ]);
  });

  it('treats \\$ outside math as a literal dollar', () => {
    expect(splitTex('price \\$5 and \\$10')).toEqual([{ type: 'text', value: 'price $5 and $10' }]);
  });

  it('keeps \\$ inside math as TeX and does not close on it', () => {
    expect(splitTex('$\\$5 + x$')).toEqual([{ type: 'inline', value: '\\$5 + x' }]);
  });

  it('emits error parts for unclosed math delimiters', () => {
    expect(splitTex('cost $5')).toEqual([
      { type: 'text', value: 'cost ' },
      { type: 'error', value: '$5', message: 'Unclosed math delimiter $' },
    ]);
    expect(splitTex('a $$ b')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'error', value: '$$ b', message: 'Unclosed math delimiter $$' },
    ]);
    expect(splitTex('\\( open')).toEqual([
      { type: 'error', value: '\\( open', message: 'Unclosed math delimiter \\(' },
    ]);
    expect(splitTex('\\[ open')).toEqual([
      { type: 'error', value: '\\[ open', message: 'Unclosed math delimiter \\[' },
    ]);
  });

  it('emits error parts for single/unclosed delimiters at cell boundaries', () => {
    expect(splitTex('$')).toEqual([
      { type: 'error', value: '$', message: 'Unclosed math delimiter $' },
    ]);
    expect(splitTex('$$')).toEqual([
      { type: 'error', value: '$$', message: 'Unclosed math delimiter $$' },
    ]);
    expect(splitTex('$$$')).toEqual([
      { type: 'error', value: '$$$', message: 'Unclosed math delimiter $$' },
    ]);
    expect(splitTex('\\(')).toEqual([
      { type: 'error', value: '\\(', message: 'Unclosed math delimiter \\(' },
    ]);
    expect(splitTex('\\[')).toEqual([
      { type: 'error', value: '\\[', message: 'Unclosed math delimiter \\[' },
    ]);
  });

  it('renders a bare \\ce{...} as inline math including the command', () => {
    expect(splitTex('硫酸は\\ce{H2SO4}です')).toEqual([
      { type: 'text', value: '硫酸は' },
      { type: 'inline', value: '\\ce{H2SO4}' },
      { type: 'text', value: 'です' },
    ]);
  });

  it('handles nested braces in bare \\ce{...}', () => {
    expect(splitTex('\\ce{A ->[{\\text{heat}}] B} x')).toEqual([
      { type: 'inline', value: '\\ce{A ->[{\\text{heat}}] B}' },
      { type: 'text', value: ' x' },
    ]);
    expect(splitTex('\\ce{SO4^{2-}}')).toEqual([{ type: 'inline', value: '\\ce{SO4^{2-}}' }]);
    expect(splitTex('\\ce{Fe(CN)6^{4-}}')).toEqual([{ type: 'inline', value: '\\ce{Fe(CN)6^{4-}}' }]);
    expect(splitTex('\\ce{{nested}}')).toEqual([{ type: 'inline', value: '\\ce{{nested}}' }]);
  });

  it('allows spaces between \\ce and its brace', () => {
    expect(splitTex('\\ce {H2O}')).toEqual([{ type: 'inline', value: '\\ce {H2O}' }]);
  });

  it('does not treat other commands starting with \\ce as \\ce', () => {
    expect(splitTex('\\cent{1}')).toEqual([{ type: 'text', value: '\\cent{1}' }]);
    expect(splitTex('\\ce')).toEqual([{ type: 'text', value: '\\ce' }]);
  });

  it('emits error part for bare \\ce{ without matching close brace', () => {
    expect(splitTex('\\ce{H2O')).toEqual([
      { type: 'error', value: '\\ce{H2O', message: 'Missing close brace' },
    ]);
    expect(splitTex('\\ce{')).toEqual([
      { type: 'error', value: '\\ce{', message: 'Missing close brace' },
    ]);
    expect(splitTex('\\ce  {H2O')).toEqual([
      { type: 'error', value: '\\ce  {H2O', message: 'Missing close brace' },
    ]);
    expect(splitTex('前 \\ce{H2SO4')).toEqual([
      { type: 'text', value: '前 ' },
      { type: 'error', value: '\\ce{H2SO4', message: 'Missing close brace' },
    ]);
  });

  it('detects unclosed nested braces inside bare \\ce{', () => {
    expect(splitTex('\\ce{A ->[{\\text{heat}} B')).toEqual([
      { type: 'error', value: '\\ce{A ->[{\\text{heat}} B', message: 'Missing close brace' },
    ]);
    expect(splitTex('\\ce{A ->[{\\text{heat')).toEqual([
      { type: 'error', value: '\\ce{A ->[{\\text{heat', message: 'Missing close brace' },
    ]);
    expect(splitTex('\\ce{SO4^{2-')).toEqual([
      { type: 'error', value: '\\ce{SO4^{2-', message: 'Missing close brace' },
    ]);
    expect(splitTex('\\ce{{nested}')).toEqual([
      { type: 'error', value: '\\ce{{nested}', message: 'Missing close brace' },
    ]);
  });

  it('keeps \\ce inside math delimiters as part of the math', () => {
    expect(splitTex('$\\ce{2H2 + O2 -> 2H2O}$')).toEqual([
      { type: 'inline', value: '\\ce{2H2 + O2 -> 2H2O}' },
    ]);
  });

  it('keeps newlines in text parts', () => {
    expect(splitTex('line1\nline2 $x$')).toEqual([
      { type: 'text', value: 'line1\nline2 ' },
      { type: 'inline', value: 'x' },
    ]);
  });

  it('keeps braces inside math untouched', () => {
    expect(splitTex('$\\frac{a}{b}$')).toEqual([{ type: 'inline', value: '\\frac{a}{b}' }]);
  });

  describe('mixed valid and broken in one cell', () => {
    it('handles valid inline math followed by unclosed inline math', () => {
      expect(splitTex('$x^2$ and $y')).toEqual([
        { type: 'inline', value: 'x^2' },
        { type: 'text', value: ' and ' },
        { type: 'error', value: '$y', message: 'Unclosed math delimiter $' },
      ]);
    });

    it('handles valid display math followed by unclosed inline math', () => {
      expect(splitTex('$$x+1$$ then $z')).toEqual([
        { type: 'display', value: 'x+1' },
        { type: 'text', value: ' then ' },
        { type: 'error', value: '$z', message: 'Unclosed math delimiter $' },
      ]);
    });

    it('handles valid inline math followed by unclosed display math', () => {
      expect(splitTex('$x$ then $$y')).toEqual([
        { type: 'inline', value: 'x' },
        { type: 'text', value: ' then ' },
        { type: 'error', value: '$$y', message: 'Unclosed math delimiter $$' },
      ]);
    });

    it('handles valid \\ce{...} followed by unclosed \\ce{...', () => {
      expect(splitTex('\\ce{H2O} then \\ce{NaCl')).toEqual([
        { type: 'inline', value: '\\ce{H2O}' },
        { type: 'text', value: ' then ' },
        { type: 'error', value: '\\ce{NaCl', message: 'Missing close brace' },
      ]);
    });

    it('handles valid \\(...\\) followed by unclosed \\[...', () => {
      expect(splitTex('\\(a+b\\) and \\[c')).toEqual([
        { type: 'inline', value: 'a+b' },
        { type: 'text', value: ' and ' },
        { type: 'error', value: '\\[c', message: 'Unclosed math delimiter \\[' },
      ]);
    });

    it('handles multiple valid math parts before broken math', () => {
      expect(splitTex('前 $a$ 中 \\(b\\) 後 \\ce{C} 末 $d')).toEqual([
        { type: 'text', value: '前 ' },
        { type: 'inline', value: 'a' },
        { type: 'text', value: ' 中 ' },
        { type: 'inline', value: 'b' },
        { type: 'text', value: ' 後 ' },
        { type: 'inline', value: '\\ce{C}' },
        { type: 'text', value: ' 末 ' },
        { type: 'error', value: '$d', message: 'Unclosed math delimiter $' },
      ]);
    });
  });

  describe('\\$ edge cases', () => {
    it('treats single \\$ as literal dollar text', () => {
      expect(splitTex('\\$')).toEqual([{ type: 'text', value: '$' }]);
    });

    it('keeps \\$ as literal dollar and preserves subsequent valid math', () => {
      expect(splitTex('price \\$5 and $x$')).toEqual([
        { type: 'text', value: 'price $5 and ' },
        { type: 'inline', value: 'x' },
      ]);
    });

    it('keeps \\$ as literal dollar while later unclosed delimiter triggers error', () => {
      expect(splitTex('\\$5 and $x')).toEqual([
        { type: 'text', value: '$5 and ' },
        { type: 'error', value: '$x', message: 'Unclosed math delimiter $' },
      ]);
    });

    it('handles \\$ immediately adjacent to valid math', () => {
      expect(splitTex('\\$$5$')).toEqual([
        { type: 'text', value: '$' },
        { type: 'inline', value: '5' },
      ]);
    });

    it('handles \\$ immediately adjacent to unclosed math', () => {
      expect(splitTex('\\$$')).toEqual([
        { type: 'text', value: '$' },
        { type: 'error', value: '$', message: 'Unclosed math delimiter $' },
      ]);
    });

    it('handles \\$ inside unclosed math', () => {
      expect(splitTex('$\\$5')).toEqual([
        { type: 'error', value: '$\\$5', message: 'Unclosed math delimiter $' },
      ]);
    });

    it('handles \\$ inside \\(...\\) and \\[...\\]', () => {
      expect(splitTex('\\(\\$5\\)')).toEqual([{ type: 'inline', value: '\\$5' }]);
      expect(splitTex('\\[\\$5\\]')).toEqual([{ type: 'display', value: '\\$5' }]);
    });

    it('does not apply normalizeInput inside splitTex', () => {
      expect(splitTex('¥frac{1}{2}')).toEqual([{ type: 'text', value: '¥frac{1}{2}' }]);
      expect(splitTex('￥ce{H2O}')).toEqual([{ type: 'text', value: '￥ce{H2O}' }]);
    });
  });
});

describe('normalizeInput', () => {
  it('replaces ¥ (U+00A5) before ASCII letters with backslash', () => {
    expect(normalizeInput('¥frac{1}{2}')).toEqual({ text: '\\frac{1}{2}', count: 1 });
    expect(normalizeInput('¥sqrt{x}')).toEqual({ text: '\\sqrt{x}', count: 1 });
    expect(normalizeInput('¥ce{H2O}')).toEqual({ text: '\\ce{H2O}', count: 1 });
    expect(normalizeInput('¥alpha + ¥beta')).toEqual({ text: '\\alpha + \\beta', count: 2 });
    expect(normalizeInput('¥Alpha')).toEqual({ text: '\\Alpha', count: 1 });
  });

  it('replaces ￥ (U+FFE5) before ASCII letters with backslash', () => {
    expect(normalizeInput('￥frac{1}{2}')).toEqual({ text: '\\frac{1}{2}', count: 1 });
    expect(normalizeInput('￥ce{H2O}')).toEqual({ text: '\\ce{H2O}', count: 1 });
    expect(normalizeInput('￥int_0^1')).toEqual({ text: '\\int_0^1', count: 1 });
  });

  it('replaces ¥ and ￥ before delimiters and punctuation { } ( ) [ ] $ ,', () => {
    expect(normalizeInput('¥(')).toEqual({ text: '\\(', count: 1 });
    expect(normalizeInput('¥)')).toEqual({ text: '\\)', count: 1 });
    expect(normalizeInput('¥[')).toEqual({ text: '\\[', count: 1 });
    expect(normalizeInput('¥]')).toEqual({ text: '\\]', count: 1 });
    expect(normalizeInput('¥{')).toEqual({ text: '\\{', count: 1 });
    expect(normalizeInput('¥}')).toEqual({ text: '\\}', count: 1 });
    expect(normalizeInput('¥$')).toEqual({ text: '\\$', count: 1 });
    expect(normalizeInput('¥,')).toEqual({ text: '\\,', count: 1 });

    expect(normalizeInput('￥(')).toEqual({ text: '\\(', count: 1 });
    expect(normalizeInput('￥)')).toEqual({ text: '\\)', count: 1 });
    expect(normalizeInput('￥[')).toEqual({ text: '\\[', count: 1 });
    expect(normalizeInput('￥]')).toEqual({ text: '\\]', count: 1 });
    expect(normalizeInput('￥{')).toEqual({ text: '\\{', count: 1 });
    expect(normalizeInput('￥}')).toEqual({ text: '\\}', count: 1 });
    expect(normalizeInput('￥$')).toEqual({ text: '\\$', count: 1 });
    expect(normalizeInput('￥,')).toEqual({ text: '\\,', count: 1 });
  });

  it('leaves currency prices unchanged', () => {
    expect(normalizeInput('¥100')).toEqual({ text: '¥100', count: 0 });
    expect(normalizeInput('￥500')).toEqual({ text: '￥500', count: 0 });
    expect(normalizeInput('¥0')).toEqual({ text: '¥0', count: 0 });
    expect(normalizeInput('￥9999')).toEqual({ text: '￥9999', count: 0 });
    expect(normalizeInput('価格は¥1,000または￥2,000')).toEqual({
      text: '価格は¥1,000または￥2,000',
      count: 0,
    });
    expect(normalizeInput('¥ 100')).toEqual({ text: '¥ 100', count: 0 });
  });

  it('leaves ¥ and ￥ unchanged before non-matching characters or at end of input', () => {
    expect(normalizeInput('¥')).toEqual({ text: '¥', count: 0 });
    expect(normalizeInput('￥')).toEqual({ text: '￥', count: 0 });
    expect(normalizeInput('¥あ')).toEqual({ text: '¥あ', count: 0 });
    expect(normalizeInput('¥_')).toEqual({ text: '¥_', count: 0 });
    expect(normalizeInput('¥^')).toEqual({ text: '¥^', count: 0 });
    expect(normalizeInput('¥+')).toEqual({ text: '¥+', count: 0 });
    expect(normalizeInput('¥-')).toEqual({ text: '¥-', count: 0 });
    expect(normalizeInput('¥=')).toEqual({ text: '¥=', count: 0 });
  });

  it('replaces only the applicable ¥ in consecutive yen symbols', () => {
    expect(normalizeInput('¥¥frac')).toEqual({ text: '¥\\frac', count: 1 });
    expect(normalizeInput('￥￥ce{H2O}')).toEqual({ text: '￥\\ce{H2O}', count: 1 });
  });

  it('handles mixed realistic Japanese text with both currency and TeX', () => {
    const input = '¥100のノートに¥frac{a}{b}と￥ce{H2O}を書き、￥500払った';
    const expected = '¥100のノートに\\frac{a}{b}と\\ce{H2O}を書き、￥500払った';
    expect(normalizeInput(input)).toEqual({ text: expected, count: 2 });
  });

  it('handles empty, null, or undefined input', () => {
    expect(normalizeInput('')).toEqual({ text: '', count: 0 });
    expect(normalizeInput(null)).toEqual({ text: '', count: 0 });
    expect(normalizeInput(undefined)).toEqual({ text: '', count: 0 });
  });
});
