import Papa from 'papaparse';

const HEADER_PAIRS = [
  ['front', 'back'],
  ['表', '裏'],
  ['表面', '裏面'],
  ['question', 'answer'],
  ['問題', '答え'],
  ['word', 'meaning'],
  ['単語', '意味'],
];

/**
 * Normalizes a cell value by converting CRLF/CR to LF and trimming outer whitespace.
 *
 * @param {*} val - Cell value.
 * @returns {string} Normalized string.
 */
function normalizeCell(val) {
  if (val === null || val === undefined) {
    return '';
  }
  return String(val).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

/**
 * Checks if the pair of cells matches any recognized header pair.
 *
 * @param {string} front - Front cell content.
 * @param {string} back - Back cell content.
 * @returns {boolean} True if matching a recognized header.
 */
function isHeaderPair(front, back) {
  const f = front.toLowerCase();
  const b = back.toLowerCase();
  return HEADER_PAIRS.some(([hFront, hBack]) => hFront === f && hBack === b);
}

/**
 * Decodes a byte buffer into a string, stripping UTF-8 BOM if present,
 * and falling back to Shift_JIS if UTF-8 decoding produces replacement characters (U+FFFD).
 *
 * @param {Uint8Array} bytes - The binary data to decode.
 * @returns {string} Decoded text string.
 */
export function decodeBytes(bytes) {
  if (!bytes) {
    return '';
  }

  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let data = u8;

  // Strip UTF-8 BOM (0xEF, 0xBB, 0xBF)
  if (data.length >= 3 && data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) {
    data = data.subarray(3);
  }

  const utf8Text = new TextDecoder('utf-8', { fatal: false }).decode(data);
  if (utf8Text.includes('\ufffd')) {
    return new TextDecoder('shift_jis').decode(u8);
  }

  return utf8Text;
}

/**
 * Parses CSV or TSV text into an array of card objects with front and back text.
 * Trims surrounding whitespace, normalizes CRLF to LF, skips empty rows,
 * and ignores extra columns beyond the first two.
 *
 * @param {string} text - Raw CSV or TSV string.
 * @returns {Array<{front: string, back: string}>} Parsed cards.
 */
export function parseCards(text) {
  if (typeof text !== 'string' || !text) {
    return [];
  }

  const lines = text.split(/\r\n|\r|\n/);
  const firstLine = lines[0] ?? '';
  const firstNonEmpty = lines.find((line) => line.trim().length > 0) ?? '';
  const isTsv = (firstLine.includes('\t') && !firstLine.includes(',')) ||
    (firstNonEmpty.includes('\t') && !firstNonEmpty.includes(','));
  const delimiter = isTsv ? '\t' : ',';

  const parsed = Papa.parse(text, {
    delimiter,
  });

  const cards = [];
  let isFirstRow = true;

  for (const row of parsed.data) {
    if (!Array.isArray(row)) {
      continue;
    }

    const front = normalizeCell(row[0]);
    const back = normalizeCell(row[1]);

    if (front === '' && back === '') {
      continue;
    }

    if (isFirstRow) {
      isFirstRow = false;
      if (isHeaderPair(front, back)) {
        continue;
      }
    }

    cards.push({ front, back });
  }

  return cards;
}
