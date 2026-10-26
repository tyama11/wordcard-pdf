# wordcard-pdf specification

Static web app (GitHub Pages). User uploads a CSV, the browser generates a duplex-printable
PDF of word cards. Everything runs client-side. Built with Vite (ES modules, `base: './'`).

## Physical layout (all units: mm)

| item | value |
|---|---|
| Page | A4 portrait, 210 x 297 |
| Card | 91 x 55 (business-card size) |
| Grid | 2 columns x 5 rows = 10 cards / sheet, no gaps |
| Margins | left/right 14, top/bottom 11 (matches A4 10-up perforated business-card paper) |

Card slot `i` (0..9) on a sheet: `col = i % 2`, `row = floor(i / 2)`.
Front position: `x = 14 + col*91`, `y = 11 + row*55` (origin = top-left of page, y downward).

### Duplex mapping (back side)

The back of a card must land physically behind its front.
For a front rect `(x, y, w, h)` on a page of size `(W, H)`:

- `flip: 'long'` (long-edge binding, default): `xb = W - x - w`, `yb = y`
- `flip: 'short'` (short-edge binding): `xb = x`, `yb = H - y - h`

Then the user calibration offset is added: `xb += backOffsetX`, `yb += backOffsetY` (mm, default 0, may be negative).
Consequence for long-edge: the card whose front is in the LEFT column has its back in the RIGHT column.
Content on the back is drawn upright (not rotated, not mirrored); only the position is mirrored.

### Crop marks

Drawn as vector lines (0.1 mm, black) in the margin area at every grid line (x = 14, 105, 196; y = 11, 66, 121, 176, 231, 286),
starting 1 mm outside the grid and 5 mm long (clipped to the page). Drawn on both sides; on the back they are
mapped with the same duplex mapping + offset as cards (the grid is symmetric, so with zero offset they coincide).
Option `cropMarks` (default true).

### Calibration sheet

Separate 2-page PDF (front, back). Front: crosshairs (10 mm arms, 0.2 mm) at the 4 grid corners and the center of the grid.
Back: crosshairs at the duplex-mapped positions of the same points (with current offset), plus a mm scale
(ticks every 0.5 mm, +-5 mm) around each crosshair so the user can hold the sheet to light and read the misalignment.
Text on the sheet explains (in Japanese) how to read it and to enter the measured value as the offset.

## CSV

- Column 1 = front text, column 2 = back text. Extra columns ignored. Empty rows skipped.
- Header row auto-detected: first row is treated as a header if its cells (trimmed, case-insensitive) match
  one of: `front|back`, `表|裏`, `表面|裏面`, `question|answer`, `問題|答え`, `word|meaning`, `単語|意味`.
- Encoding: UTF-8 (with or without BOM). If decoding as UTF-8 yields U+FFFD, decode as Shift_JIS.
- Quoted fields with commas and newlines are supported (RFC 4180). A newline inside a cell is a line break on the card.

## Text / LaTeX

Cell text is plain text with embedded TeX:
- `$...$` and `\(...\)` inline math; `$$...$$` and `\[...\]` display math.
- `\ce{...}` (mhchem) outside math delimiters is also rendered as inline math (`\ce` works inside math too).
- `\$` is a literal dollar sign.
- Invalid TeX must not crash: render the raw source in red instead.
Rendering: MathJax v4 (`@mathjax/src`) TeX input with the `mhchem` package, SVG output with `fontCache: 'none'`
(each SVG self-contained) so it rasterizes reliably.

## Card rendering and auto-fit

- Each card face is rendered as a DOM element of exactly 91 x 55 mm (CSS px at 96 dpi), padding 4 mm,
  content centered horizontally and vertically, text wraps (`overflow-wrap: anywhere`).
- Font: system Japanese sans (`"Hiragino Sans","Noto Sans JP","Yu Gothic","Meiryo",sans-serif`).
- Auto-fit: largest font size in [6 px, 48 px] (binary search, 0.5 px resolution) such that content does not overflow.
- Rasterized at 300 dpi (1075 x 650 px) to PNG; placed in the PDF at the exact mm rect, no scaling of the page.

## Module contracts (src/)

- `layout.js` (pure, no DOM):
  - `export const PAGE`, `CARD`, `GRID` constants.
  - `export function frontRect(slot) -> {x,y,w,h}`
  - `export function backRect(slot, {flip='long', backOffsetX=0, backOffsetY=0}={}) -> {x,y,w,h}`
  - `export function mapToBack(rect, opts) -> rect` (the duplex mapping above, works for any rect/point with w=h=0)
  - `export function paginate(n) -> [{sheet, slot, index}]` for card indices 0..n-1
  - `export function cropMarkLines() -> [{x1,y1,x2,y2}]` (front coordinates)
- `csv.js` (pure): `export function decodeBytes(Uint8Array) -> string`, `export function parseCards(text) -> [{front, back}]`
- `tex.js` (browser): `export function toHtml(text) -> string` (HTML with inline SVG math),
  `export async function renderFace(text, {dpi=300}={}) -> Promise<string /* PNG data URL */>` (does auto-fit)
- `pdf.js`: `export async function buildCardsPdf(cards, renderFace, opts) -> Promise<Uint8Array>`
  - `renderFace(text) -> Promise<dataURL>` is injected (so node tests can pass a dummy PNG).
  - Page order: sheet1 front, sheet1 back, sheet2 front, ... (duplex printing order).
  - `export function buildCalibrationPdf(opts) -> Uint8Array`
  - Uses jsPDF with `unit: 'mm'`, `format: 'a4'`, PNG via `addImage`.
- `main.js`: UI (file input, flip select, back offset X/Y inputs, crop marks checkbox, generate button,
  calibration button, progress, error display). Japanese UI. Settings remembered in localStorage (try/catch).

## Tests

- Unit (Vitest, node): layout invariants; CSV parsing; PDF structure parsed with `pdfjs-dist`
  (page size exactly 595.28 x 841.89 pt; each image's transform matrix equals the expected rect within 0.01 mm;
  front/back of every card related by the duplex mapping; crop marks coincide).
- E2E (Playwright, Chromium): upload CSV -> download PDF; render PDF pages with pdf.js, mirror the back page,
  check registration marks coincide within 1 px at 300 dpi; math and chemistry render non-blank; auto-fit keeps
  long text within the card.
