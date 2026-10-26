// Card face rendering: text with embedded TeX -> HTML (inline SVG math) -> PNG.
// Browser module. See docs/SPEC.md "Text / LaTeX" and "Card rendering and auto-fit".

import { mathjax } from '@mathjax/src/js/mathjax.js';
import { TeX } from '@mathjax/src/js/input/tex.js';
import { SVG } from '@mathjax/src/js/output/svg.js';
import { browserAdaptor } from '@mathjax/src/js/adaptors/browserAdaptor.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import '@mathjax/src/js/input/tex/base/BaseConfiguration.js';
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js';
import '@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js';
import '@mathjax/src/js/input/tex/noundefined/NoUndefinedConfiguration.js';
import '@mathjax/src/js/input/tex/mhchem/MhchemConfiguration.js';
import { MathJaxNewcmFont } from '@mathjax/mathjax-newcm-font/js/svg.js';
// MathJax v4 fonts split rarely used glyphs into "dynamic" files that are normally fetched at
// runtime. We bundle the math-relevant ones statically (each registers itself on import) and
// make MathJax's loader synchronous, so no network access is ever needed. Glyphs from files not
// listed here (e.g. Cyrillic, Hebrew, Braille) fall back to the browser's text rendering.
import '@mathjax/mathjax-newcm-font/js/svg/dynamic/accents.js';
import '@mathjax/mathjax-newcm-font/js/svg/dynamic/arrows.js';
import '@mathjax/mathjax-newcm-font/js/svg/dynamic/calligraphic.js';
import '@mathjax/mathjax-newcm-font/js/svg/dynamic/double-struck.js';
import '@mathjax/mathjax-newcm-font/js/svg/dynamic/fraktur.js';
import '@mathjax/mathjax-newcm-font/js/svg/dynamic/latin.js';
import '@mathjax/mathjax-newcm-font/js/svg/dynamic/marrows.js';
import '@mathjax/mathjax-newcm-font/js/svg/dynamic/math.js';
import '@mathjax/mathjax-newcm-font/js/svg/dynamic/mshapes.js';
import '@mathjax/mathjax-newcm-font/js/svg/dynamic/script.js';
import '@mathjax/mathjax-newcm-font/js/svg/dynamic/shapes.js';
import '@mathjax/mathjax-newcm-font/js/svg/dynamic/symbols.js';
import '@mathjax/mathjax-newcm-font/js/svg/dynamic/variants.js';
import html2canvas from 'html2canvas-pro';
import { splitTex } from './texsplit.js';

export { splitTex };

const MM_PER_IN = 25.4;
const CSS_DPI = 96;
const CARD_W_MM = 91;
const CARD_H_MM = 55;
const PADDING_MM = 4;
const PX_PER_MM = CSS_DPI / MM_PER_IN;

/** Card face width in CSS px (91 mm at 96 dpi = 343.94 px). */
export const FACE_WIDTH_PX = CARD_W_MM * PX_PER_MM;
/** Card face height in CSS px (55 mm at 96 dpi = 207.87 px). */
export const FACE_HEIGHT_PX = CARD_H_MM * PX_PER_MM;
/** Auto-fit font-size range and resolution in CSS px. */
export const FIT_MIN_PX = 6;
export const FIT_MAX_PX = 48;
export const FIT_STEP_PX = 0.5;

const FONT_FAMILY = '"Hiragino Sans","Noto Sans JP","Yu Gothic","Meiryo",sans-serif';
const ERROR_COLOR = '#c00';
const STYLE_ID = 'wordcard-tex-styles';

/**
 * mhchem emits Private Use Area code points whose glyphs live in the separate
 * `mathjax-mhchem-font-extension` package (not a dependency). Map them to standard
 * Unicode arrows/bonds that the bundled New CM font provides (stretchy where needed).
 * @type {Record<string, string>}
 */
const MHCHEM_CHAR_MAP = {
  '\uE408': '\u21CC', // rightleftharpoons
  '\uE409': '\u21CC', // Rightleftharpoons (approx.)
  '\uE40A': '\u21CC', // Leftrightharpoons (approx.)
  '\uE410': '\u22EF', // tripledash (approx.)
  '\uE411': '=', // bond ~- (approx.)
  '\uE412': '\u2261', // bond ~-- (approx.)
  '\uE413': '\u2261', // bond -~- (approx.)
  '\uE428': '\u27F5', // long left arrow
  '\uE429': '\u27F6', // long right arrow
  '\uE42A': '\u27F7', // long left-right arrow
  '\uE42B': '\u21C4', // left-right arrows
  '\uE42C': '\u2190', // left arrow
  '\uE42D': '\u2192', // right arrow
  '\uE42E': '\u2194', // left-right arrow
};
const MHCHEM_CHAR_RE = /[\uE408-\uE40A\uE410-\uE413\uE428-\uE42E]/g;

/**
 * TeX post-filter replacing mhchem PUA characters in token nodes (see MHCHEM_CHAR_MAP).
 * @param {{data: {root: any}}} arg
 */
function remapMhchemChars({ data }) {
  data.root.walkTree((node) => {
    if (!node.isToken) return;
    for (const child of node.childNodes) {
      if (!child.isKind('text')) continue;
      const text = child.getText();
      const mapped = text.replace(MHCHEM_CHAR_RE, (c) => MHCHEM_CHAR_MAP[c] || c);
      if (mapped !== text) child.setText(mapped);
    }
  });
}

/** @type {{html: any, adaptor: any} | null} */
let mj = null;

/**
 * Lazily create the MathJax document (needs a browser `document`).
 * @returns {{html: any, adaptor: any}}
 */
function getMathJax() {
  if (mj) return mj;
  // Dynamic font files are statically imported above, so "loading" is a no-op;
  // files that were not imported keep their default setup and are marked failed.
  mathjax.asyncLoad = () => {};
  mathjax.asyncIsSynchronous = true;
  const adaptor = browserAdaptor();
  RegisterHTMLHandler(adaptor);
  const tex = new TeX({
    packages: ['base', 'ams', 'newcommand', 'noundefined', 'mhchem'],
    formatError: (_jax, err) => {
      throw err;
    },
  });
  tex.postFilters.add(remapMhchemChars, -1);
  // Text in math (\text, CJK identifiers, glyphs missing from the math font) uses the card font.
  const svg = new SVG({
    fontData: MathJaxNewcmFont,
    fontCache: 'none',
    mtextFont: FONT_FAMILY,
    unknownFamily: FONT_FAMILY,
  });
  // mhchem marks its arrows with the '-mhchem' variant, which normally comes from a separate
  // font extension; alias it to 'normal' so arrows render with the bundled font.
  if (!svg.font.getVariant('-mhchem')) svg.font.createVariant('-mhchem', 'normal');
  const html = mathjax.document(document, { InputJax: tex, OutputJax: svg });
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      adaptor.textContent(svg.styleSheet(html)) +
      '\n.wordcard-face mjx-container[jax="SVG"][display="true"]{margin:0.25em 0;}';
    document.head.appendChild(style);
  }
  mj = { html, adaptor };
  return mj;
}

/**
 * Escape text for safe insertion into HTML.
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Convert a plain-text part to HTML (escaped, newlines as <br>).
 * @param {string} s
 * @returns {string}
 */
function textToHtml(s) {
  return escapeHtml(s).replace(/\r\n|\r|\n/g, '<br>');
}

/**
 * Render one TeX expression to an HTML string containing a self-contained SVG.
 * Invalid TeX yields the raw source in red.
 * @param {string} tex
 * @param {boolean} display
 * @returns {string}
 */
function mathToHtml(tex, display) {
  try {
    const { html, adaptor } = getMathJax();
    const node = html.convert(tex, { display, em: 16, ex: 8 });
    return adaptor.outerHTML(node);
  } catch {
    return `<span style="color:${ERROR_COLOR}">${textToHtml(tex)}</span>`;
  }
}

/**
 * Convert cell text with embedded TeX to HTML. Plain text is HTML-escaped with newlines
 * turned into `<br>`; math (`$..$`, `\(..\)`, `$$..$$`, `\[..\]`, bare `\ce{..}`) becomes
 * inline SVG (MathJax v4, fontCache 'none'). Invalid TeX is shown as red source text.
 * @param {string} text
 * @returns {string}
 */
export function toHtml(text) {
  return splitTex(text)
    .map((p) => (p.type === 'text' ? textToHtml(p.value) : mathToHtml(p.value, p.type === 'display')))
    .join('');
}

/**
 * Build the off-screen card face element (not yet attached to the document).
 * Structure: card (91x55 mm, 4 mm padding) > box (content box, overflow checked) > content.
 * @param {string} text
 * @returns {{card: HTMLDivElement, box: HTMLDivElement}}
 */
function buildFace(text) {
  const card = document.createElement('div');
  card.className = 'wordcard-face';
  Object.assign(card.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0px',
    width: `${FACE_WIDTH_PX}px`,
    height: `${FACE_HEIGHT_PX}px`,
    padding: `${PADDING_MM * PX_PER_MM}px`,
    margin: '0',
    border: '0',
    boxSizing: 'border-box',
    overflow: 'hidden',
    background: '#ffffff',
    color: '#000000',
    fontFamily: FONT_FAMILY,
    lineHeight: '1.3',
  });
  const box = document.createElement('div');
  Object.assign(box.style, {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    // 'safe' keeps overflowing content start-aligned so scrollHeight reports the overflow.
    justifyContent: 'safe center',
    overflow: 'hidden',
  });
  const content = document.createElement('div');
  Object.assign(content.style, {
    flex: 'none',
    textAlign: 'center',
    overflowWrap: 'anywhere',
    whiteSpace: 'normal',
  });
  content.innerHTML = toHtml(text);
  box.appendChild(content);
  card.appendChild(box);
  return { card, box };
}

/**
 * @typedef {object} FitInfo
 * @property {number} fontSize chosen font size in CSS px
 * @property {boolean} fits whether the content fits at that size (false only if even 6 px overflows)
 * @property {number} scrollWidth content box scrollWidth at the chosen size
 * @property {number} scrollHeight content box scrollHeight at the chosen size
 * @property {number} clientWidth content box clientWidth
 * @property {number} clientHeight content box clientHeight
 */

/** @type {FitInfo | null} */
let lastFitInfo = null;

/**
 * Auto-fit: set the largest font size in [6, 48] px (0.5 px steps, binary search) on the
 * content box `box` such that it does not overflow (scrollWidth/scrollHeight <= clientWidth/
 * clientHeight). `box` must be attached to the document. If nothing fits, 6 px is used.
 * @param {HTMLElement} box
 * @returns {FitInfo}
 */
export function fitFace(box) {
  const fitsAt = (size) => {
    box.style.fontSize = `${size}px`;
    return box.scrollWidth <= box.clientWidth && box.scrollHeight <= box.clientHeight;
  };
  const steps = Math.round((FIT_MAX_PX - FIT_MIN_PX) / FIT_STEP_PX);
  let lo = -1; // largest step known to fit (-1 = none)
  let hi = steps + 1; // smallest step known not to fit
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (fitsAt(FIT_MIN_PX + mid * FIT_STEP_PX)) lo = mid;
    else hi = mid;
  }
  const fontSize = FIT_MIN_PX + Math.max(lo, 0) * FIT_STEP_PX;
  box.style.fontSize = `${fontSize}px`;
  return {
    fontSize,
    fits: lo >= 0,
    scrollWidth: box.scrollWidth,
    scrollHeight: box.scrollHeight,
    clientWidth: box.clientWidth,
    clientHeight: box.clientHeight,
  };
}

/**
 * Fit result of the most recent renderFace() call (for tests / diagnostics).
 * @returns {FitInfo | null}
 */
export function getLastFitInfo() {
  return lastFitInfo;
}

/**
 * Render a card face (91 x 55 mm) to a PNG data URL: builds an off-screen element, auto-fits
 * the font size, waits for fonts, rasterizes with html2canvas-pro on a white background.
 * The image is exactly round(91/25.4*dpi) x round(55/25.4*dpi) px (1075 x 650 at 300 dpi).
 * After it resolves, getLastFitInfo() describes the chosen font size.
 * @param {string} text cell text (plain text with embedded TeX)
 * @param {{dpi?: number}} [opts]
 * @returns {Promise<string>} PNG data URL
 */
export async function renderFace(text, { dpi = 300 } = {}) {
  const outW = Math.round((CARD_W_MM / MM_PER_IN) * dpi);
  const outH = Math.round((CARD_H_MM / MM_PER_IN) * dpi);
  const scale = dpi / CSS_DPI;
  const { card, box } = buildFace(text);
  document.body.appendChild(card);
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    lastFitInfo = fitFace(box);
    // Capture outW/scale x outH/scale CSS px so the canvas is (almost) exactly outW x outH;
    // any remaining rounding difference is fixed by copying onto an exact-size canvas.
    const src = await html2canvas(card, {
      scale,
      backgroundColor: '#ffffff',
      logging: false,
      width: outW / scale,
      height: outH / scale,
    });
    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outW, outH);
    if (Math.abs(src.width - outW) <= 2 && Math.abs(src.height - outH) <= 2) {
      ctx.drawImage(src, 0, 0); // crop / pad by at most a couple of px, no resampling
    } else {
      ctx.drawImage(src, 0, 0, outW, outH);
    }
    return out.toDataURL('image/png');
  } finally {
    card.remove();
  }
}
