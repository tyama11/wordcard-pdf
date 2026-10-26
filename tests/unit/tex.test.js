import { describe, it, expect } from 'vitest';
import { splitTex } from '../../src/texsplit.js';

describe('splitTex', () => {
  it('returns plain text as a single text part', () => {
    expect(splitTex('光合成')).toEqual([{ type: 'text', value: '光合成' }]);
  });

  it('returns no parts for empty input', () => {
    expect(splitTex('')).toEqual([]);
    expect(splitTex(undefined)).toEqual([]);
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

  it('treats unclosed delimiters as literal text', () => {
    expect(splitTex('cost $5')).toEqual([{ type: 'text', value: 'cost $5' }]);
    expect(splitTex('a $$ b')).toEqual([{ type: 'text', value: 'a $$ b' }]);
    expect(splitTex('\\( open')).toEqual([{ type: 'text', value: '\\( open' }]);
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
  });

  it('allows spaces between \\ce and its brace', () => {
    expect(splitTex('\\ce {H2O}')).toEqual([{ type: 'inline', value: '\\ce {H2O}' }]);
  });

  it('does not treat other commands starting with \\ce as \\ce', () => {
    expect(splitTex('\\cent{1}')).toEqual([{ type: 'text', value: '\\cent{1}' }]);
  });

  it('treats unbalanced \\ce{ as literal text', () => {
    expect(splitTex('\\ce{H2O')).toEqual([{ type: 'text', value: '\\ce{H2O' }]);
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
});
