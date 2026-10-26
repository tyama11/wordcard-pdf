import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeBytes, parseCards } from '../../src/csv.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../fixtures');

describe('decodeBytes', () => {
  it('decodes standard UTF-8 bytes', () => {
    const raw = 'hello,world\nこんにちは,世界';
    const bytes = new TextEncoder().encode(raw);
    expect(decodeBytes(bytes)).toBe(raw);
  });

  it('strips UTF-8 BOM', () => {
    const raw = '表,裏\nhello,world';
    const utf8Bytes = new TextEncoder().encode(raw);
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8Bytes]);
    const decoded = decodeBytes(withBom);
    expect(decoded).toBe(raw);
    expect(decoded.charCodeAt(0)).not.toBe(0xfeff);
  });

  it('decodes Shift_JIS Japanese bytes when UTF-8 produces U+FFFD', () => {
    // 表: 0x95 0x5C, 裏: 0x97 0xA0, 猫: 0x94 0x4C, 犬: 0x8C 0xA2
    const sjisBytes = new Uint8Array([
      0x95, 0x5c, 0x2c, 0x97, 0xa0, 0x0a,
      0x94, 0x4c, 0x2c, 0x8c, 0xa2,
    ]);
    const decoded = decodeBytes(sjisBytes);
    expect(decoded).toBe('表,裏\n猫,犬');
  });

  it('decodes UTF-8 and Shift_JIS fixtures correctly', () => {
    const utf8Buf = fs.readFileSync(path.join(fixturesDir, 'utf8.csv'));
    const utf8Text = decodeBytes(new Uint8Array(utf8Buf));
    expect(utf8Text).toContain('front,back');

    const bomBuf = fs.readFileSync(path.join(fixturesDir, 'utf8_bom.csv'));
    const bomText = decodeBytes(new Uint8Array(bomBuf));
    expect(bomText.charCodeAt(0)).not.toBe(0xfeff);
    expect(bomText).toContain('単語,意味');

    const sjisBuf = fs.readFileSync(path.join(fixturesDir, 'shift_jis.csv'));
    const sjisText = decodeBytes(new Uint8Array(sjisBuf));
    expect(sjisText).toContain('表,裏');
    expect(sjisText).toContain('猫,Cat');
  });

  it('returns empty string for empty or invalid input', () => {
    expect(decodeBytes(null)).toBe('');
    expect(decodeBytes(undefined)).toBe('');
    expect(decodeBytes(new Uint8Array([]))).toBe('');
  });
});

describe('parseCards', () => {
  describe('Header vs no header', () => {
    const headerVariants = [
      ['front', 'back'],
      ['表', '裏'],
      ['表面', '裏面'],
      ['question', 'answer'],
      ['問題', '答え'],
      ['word', 'meaning'],
      ['単語', '意味'],
    ];

    for (const [hFront, hBack] of headerVariants) {
      it(`skips header variant: ${hFront}|${hBack}`, () => {
        const csv = `${hFront},${hBack}\ncard1,card2\ncard3,card4`;
        const cards = parseCards(csv);
        expect(cards).toEqual([
          { front: 'card1', back: 'card2' },
          { front: 'card3', back: 'card4' },
        ]);
      });

      it(`handles case-insensitive and trimmed header: " ${hFront.toUpperCase()} "," ${hBack.toUpperCase()} "`, () => {
        const csv = `"${hFront.toUpperCase()} "," ${hBack.toUpperCase()}"\ncard1,card2`;
        const cards = parseCards(csv);
        expect(cards).toEqual([
          { front: 'card1', back: 'card2' },
        ]);
      });
    }

    it('skips header row even when extra columns are present in the header', () => {
      const csv = 'front,back,category,difficulty\ncard1,card2,vocab,easy';
      const cards = parseCards(csv);
      expect(cards).toEqual([
        { front: 'card1', back: 'card2' },
      ]);
    });

    it('treats first row as card data if it is not a header', () => {
      const csv = 'cat,neko\ndog,inu';
      const cards = parseCards(csv);
      expect(cards).toEqual([
        { front: 'cat', back: 'neko' },
        { front: 'dog', back: 'inu' },
      ]);
    });

    it('does not treat 1-column front as header even if name matches header pattern', () => {
      const csv = 'front\ncard1,card2';
      const cards = parseCards(csv);
      expect(cards).toEqual([
        { front: 'front', back: '' },
        { front: 'card1', back: 'card2' },
      ]);
    });

    it('does not treat mismatched pairs as header', () => {
      const csv = 'front,meaning\ncard1,card2';
      const cards = parseCards(csv);
      expect(cards).toEqual([
        { front: 'front', back: 'meaning' },
        { front: 'card1', back: 'card2' },
      ]);
    });

    it('only auto-detects header on the first row, not subsequent rows', () => {
      const csv = 'card1,card2\nfront,back\ncard3,card4';
      const cards = parseCards(csv);
      expect(cards).toEqual([
        { front: 'card1', back: 'card2' },
        { front: 'front', back: 'back' },
        { front: 'card3', back: 'card4' },
      ]);
    });
  });

  describe('quoted commas and quoted newlines', () => {
    it('preserves commas inside quoted fields', () => {
      const csv = '"Tokyo, Japan","Capital"\n"Berlin, Germany","Capital"';
      const cards = parseCards(csv);
      expect(cards).toEqual([
        { front: 'Tokyo, Japan', back: 'Capital' },
        { front: 'Berlin, Germany', back: 'Capital' },
      ]);
    });

    it('preserves inner newlines and trims only surrounding whitespace', () => {
      const csv = '"  line 1\nline 2  ","  answer\nline 2  "';
      const cards = parseCards(csv);
      expect(cards).toEqual([
        { front: 'line 1\nline 2', back: 'answer\nline 2' },
      ]);
    });
  });

  describe('CRLF line endings and cell content', () => {
    it('handles CRLF file line endings', () => {
      const csv = 'front,back\r\ncard1,card2\r\ncard3,card4\r\n';
      const cards = parseCards(csv);
      expect(cards).toEqual([
        { front: 'card1', back: 'card2' },
        { front: 'card3', back: 'card4' },
      ]);
    });

    it('normalizes CRLF to LF inside quoted cell content', () => {
      const csv = '"line 1\r\nline 2","answer\r\nsecond line"';
      const cards = parseCards(csv);
      expect(cards).toEqual([
        { front: 'line 1\nline 2', back: 'answer\nsecond line' },
      ]);
    });
  });

  describe('empty rows', () => {
    it('skips leading, intermediate, and trailing empty rows', () => {
      const csv = '\n\r\nfront,back\n\ncard1,card2\n  ,  \n\ncard3,card4\n\n';
      const cards = parseCards(csv);
      expect(cards).toEqual([
        { front: 'card1', back: 'card2' },
        { front: 'card3', back: 'card4' },
      ]);
    });

    it('skips rows where both front and back are empty but extra columns exist', () => {
      const csv = 'front,back\n,,"extra only"\ncard1,card2';
      const cards = parseCards(csv);
      expect(cards).toEqual([
        { front: 'card1', back: 'card2' },
      ]);
    });

    it('returns empty array when text has only empty rows or whitespace', () => {
      expect(parseCards('')).toEqual([]);
      expect(parseCards('\n\r\n   \n\t\n')).toEqual([]);
    });
  });

  describe('1-column rows and extra columns', () => {
    it('sets back to empty string for 1-column rows', () => {
      const csv = 'front,back\n"single front card"\ncard2,back2';
      const cards = parseCards(csv);
      expect(cards).toEqual([
        { front: 'single front card', back: '' },
        { front: 'card2', back: 'back2' },
      ]);
    });

    it('ignores columns beyond column 2', () => {
      const csv = 'front,back\ncol1,col2,col3,col4\ncat,neko,mammal,pet';
      const cards = parseCards(csv);
      expect(cards).toEqual([
        { front: 'col1', back: 'col2' },
        { front: 'cat', back: 'neko' },
      ]);
    });
  });

  describe('TeX strings preservation', () => {
    it('keeps backslashes, math delimiters, braces, and quotes intact', () => {
      const csv = [
        'front,back',
        '"$\\frac{1}{2}$","\\ce{H2SO4}"',
        '"\\[ \\sum_{i=1}^{n} i = \\frac{n(n+1)}{2} \\]","sum formula"',
        '"\\( x \\in \\mathbb{R} \\)","real number"',
        '"\\$100 is \\$100","escaped dollar"',
        '"{x | x > 0}","braces preserved"',
        '"He said ""hello""","quote inside"',
        '"$\\text{""quoted""}$","math with quotes"',
      ].join('\n');

      const cards = parseCards(csv);
      expect(cards).toEqual([
        { front: '$\\frac{1}{2}$', back: '\\ce{H2SO4}' },
        { front: '\\[ \\sum_{i=1}^{n} i = \\frac{n(n+1)}{2} \\]', back: 'sum formula' },
        { front: '\\( x \\in \\mathbb{R} \\)', back: 'real number' },
        { front: '\\$100 is \\$100', back: 'escaped dollar' },
        { front: '{x | x > 0}', back: 'braces preserved' },
        { front: 'He said "hello"', back: 'quote inside' },
        { front: '$\\text{"quoted"}$', back: 'math with quotes' },
      ]);
    });
  });

  describe('TSV automatic detection', () => {
    it('automatically accepts TSV when first line contains tab and no comma', () => {
      const tsv = 'front\tback\ncard1\tcard2\ncard3\tcard4';
      const cards = parseCards(tsv);
      expect(cards).toEqual([
        { front: 'card1', back: 'card2' },
        { front: 'card3', back: 'card4' },
      ]);
    });

    it('handles TSV with Japanese header and CRLF', () => {
      const tsv = '問題\t答え\r\n日本の首都は？\t東京\r\n富士山の高さは？\t3776m\r\n';
      const cards = parseCards(tsv);
      expect(cards).toEqual([
        { front: '日本の首都は？', back: '東京' },
        { front: '富士山の高さは？', back: '3776m' },
      ]);
    });

    it('loads and parses tsv fixture file', () => {
      const tsvBuf = fs.readFileSync(path.join(fixturesDir, 'tsv.csv'));
      const text = decodeBytes(new Uint8Array(tsvBuf));
      const cards = parseCards(text);
      expect(cards).toEqual([
        { front: 'What is 1+1?', back: '2' },
        { front: 'Capital of Japan?', back: 'Tokyo' },
      ]);
    });
  });

  describe('Combined fixtures', () => {
    it('correctly parses complex fixture', () => {
      const complexBuf = fs.readFileSync(path.join(fixturesDir, 'complex.csv'));
      const text = decodeBytes(new Uint8Array(complexBuf));
      const cards = parseCards(text);
      expect(cards).toEqual([
        { front: '$\\frac{1}{2}$', back: 'quoted, comma' },
        { front: '\\ce{H2SO4}', back: 'multi\nline' },
        { front: 'one column only', back: '' },
        { front: 'extra', back: 'columns' },
      ]);
    });
  });
});
