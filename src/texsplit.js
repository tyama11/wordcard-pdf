// Pure TeX delimiter splitter and input normalizer (no DOM, no MathJax). See docs/SPEC.md "Text / LaTeX".

const YEN_RE = /[\u00A5\uFFE5](?=[a-zA-Z{}()[\]$,])/g;

/**
 * Replace '¥' (U+00A5) and '￥' (U+FFE5) with '\' ONLY when immediately followed by
 * an ASCII letter or one of { } ( ) [ ] $ , (e.g. TeX commands like `\frac`, delimiters `\(`,
 * `\[`, escaped braces/dollars, or `\,`).
 * Currency amounts like '¥100' and '￥500' stay unchanged.
 * @param {string} text
 * @returns {{text: string, count: number}}
 */
export function normalizeInput(text) {
  const s = String(text ?? '');
  let count = 0;
  const normalized = s.replace(YEN_RE, () => {
    count++;
    return '\\';
  });
  return { text: normalized, count };
}

/**
 * Find the index of the closing `$` (or `$$`) for math starting at `start`.
 * Backslash escapes (e.g. `\$`, `\\`) inside the math are skipped.
 * @param {string} s
 * @param {number} start index of the first character inside the math
 * @param {string} close '$' or '$$'
 * @returns {number} index of the closing delimiter, or -1
 */
function findDollarClose(s, start, close) {
  let i = start;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (s.startsWith(close, i)) return i;
    i++;
  }
  return -1;
}

/**
 * Find the index of the closing `\)` or `\]` for math starting at `start`.
 * @param {string} s
 * @param {number} start
 * @param {string} closeChar ')' or ']'
 * @returns {number} index of the backslash of the closing delimiter, or -1
 */
function findBackslashClose(s, start, closeChar) {
  let i = start;
  while (i < s.length) {
    if (s[i] === '\\') {
      if (s[i + 1] === closeChar) return i;
      i += 2;
      continue;
    }
    i++;
  }
  return -1;
}

/**
 * Find the index just after the brace that closes the group opened at `open`.
 * Handles nested braces and backslash-escaped braces.
 * @param {string} s
 * @param {number} open index of the opening `{`
 * @returns {number} index after the matching `}`, or -1 if unbalanced
 */
function findGroupEnd(s, open) {
  let depth = 0;
  let i = open;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }
  return -1;
}

/**
 * Split cell text into plain-text, TeX math parts, and syntax error parts.
 *
 * Rules (docs/SPEC.md):
 * - `$...$` and `\(...\)` are inline math; `$$...$$` and `\[...\]` are display math.
 * - A bare `\ce{...}` (nested braces allowed) outside math is inline math; its value
 *   is the whole `\ce{...}` source.
 * - `\$` outside math is a literal dollar sign.
 * - Unmatched math delimiters (`$`, `$$`, `\(`, `\[`) emit an error part with the
 *   delimiter and the rest of the cell.
 * - Bare `\ce{` without a matching closing brace emits an error part from `\ce{` to the end of the cell.
 * - Text before an unclosed delimiter stays a normal text part.
 *
 * Adjacent text parts are merged; empty text parts are omitted.
 * @param {string} text
 * @returns {({type: 'text'|'inline'|'display', value: string} | {type: 'error', value: string, message: string})[]}
 */
export function splitTex(text) {
  const s = String(text ?? '');
  /** @type {({type: 'text'|'inline'|'display', value: string} | {type: 'error', value: string, message: string})[]} */
  const parts = [];
  let buf = '';
  const flush = () => {
    if (buf) parts.push({ type: 'text', value: buf });
    buf = '';
  };
  const pushMath = (type, value) => {
    flush();
    parts.push({ type, value });
  };

  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') {
      const n = s[i + 1];
      if (n === '$') {
        buf += '$';
        i += 2;
        continue;
      }
      if (n === '(' || n === '[') {
        const closeChar = n === '(' ? ')' : ']';
        const end = findBackslashClose(s, i + 2, closeChar);
        if (end !== -1) {
          pushMath(n === '(' ? 'inline' : 'display', s.slice(i + 2, end));
          i = end + 2;
          continue;
        }
        flush();
        parts.push({
          type: 'error',
          value: s.slice(i),
          message: n === '(' ? 'Unclosed math delimiter \\(' : 'Unclosed math delimiter \\['
        });
        return parts;
      }
      const ce = /^\\ce\s*\{/.exec(s.slice(i));
      if (ce) {
        const end = findGroupEnd(s, i + ce[0].length - 1);
        if (end !== -1) {
          pushMath('inline', s.slice(i, end));
          i = end;
          continue;
        }
        flush();
        parts.push({
          type: 'error',
          value: s.slice(i),
          message: 'Missing close brace'
        });
        return parts;
      }
      buf += c;
      i++;
      continue;
    }
    if (c === '$') {
      const display = s[i + 1] === '$';
      const open = display ? 2 : 1;
      const end = findDollarClose(s, i + open, display ? '$$' : '$');
      if (end !== -1) {
        pushMath(display ? 'display' : 'inline', s.slice(i + open, end));
        i = end + open;
        continue;
      }
      flush();
      parts.push({
        type: 'error',
        value: s.slice(i),
        message: display ? 'Unclosed math delimiter $$' : 'Unclosed math delimiter $'
      });
      return parts;
    }
    buf += c;
    i++;
  }
  flush();
  return parts;
}
