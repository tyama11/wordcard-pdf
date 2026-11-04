# wordcard-pdf specification

Static web app (GitHub Pages). User uploads a CSV, the browser generates a duplex-printable
PDF of word cards. Everything runs client-side. Built with Vite (ES modules, `base: './'`).

## Physical layout (all units: mm)

| item | value |
|---|---|
| Page | A4 portrait, 210 x 297 |
| Grid area | 182 x 275, centered (margins: left/right 14, top/bottom 11) |
| Cards per sheet | Configurable: 4, 6, 8, 10, 12, 15, 18 (default: 10) |
| Card (default 10) | 91 x 55 (business-card size, fits commercial 10-up perforated paper) |
| Grid | `cols` columns x `rows` rows = `n` cards / sheet, no gaps filling the 182 x 275 mm area |
| Margins | left/right 14, top/bottom 11 (common to all cards-per-sheet options) |

### Cards per sheet options

Cards fill the exact same 182 x 275 mm grid area with no gaps. Only the 10-card layout fits commercial 10-up perforated business-card paper.

| Cards (`n`) | Grid (`cols x rows`) | Card size (mm, `w x h`) |
|---|---|---|
| 4 | 2 x 2 | 91 x 137.5 |
| 6 | 2 x 3 | 91 x 91.67 |
| 8 | 2 x 4 | 91 x 68.75 |
| 10 | 2 x 5 | 91 x 55 (default) |
| 12 | 3 x 4 | 60.67 x 68.75 |
| 15 | 3 x 5 | 60.67 x 55 |
| 18 | 3 x 6 | 60.67 x 45.83 |

For a chosen option with `cols` and `rows`:
- Card width: `w = 182 / cols` mm
- Card height: `h = 275 / rows` mm
- Card slot `i` (`0 <= i < n`) on a sheet: `col = i % cols`, `row = floor(i / cols)`.
- Front position: `x = 14 + col * w`, `y = 11 + row * h` (origin = top-left of page, y downward).

### Duplex mapping (back side)

The back of a card must land physically behind its front.
For a front rect `(x, y, w, h)` on a page of size `(W, H)`:

- `flip: 'long'` (long-edge binding, default): `xb = W - x - w`, `yb = y`
- `flip: 'short'` (short-edge binding): `xb = x`, `yb = H - y - h`

Then the user calibration offset is added: `xb += backOffsetX`, `yb += backOffsetY` (mm, default 0, may be negative).
Consequence for long-edge: the card whose front is in the LEFT column has its back in the RIGHT column.
Content on the back is drawn upright (not rotated, not mirrored); only the position is mirrored.

### Crop marks

Drawn as vector lines (0.1 mm, black) in the margin area at every grid line (boundary lines of actual card columns and rows),
starting 1 mm outside the grid and 5 mm long (clipped to the page). Crop marks follow actual grid lines for the selected cards-per-sheet option
(for 10 cards: x = 14, 105, 196; y = 11, 66, 121, 176, 231, 286). Drawn on both sides; on the back they are
mapped with the same duplex mapping + offset as cards (the outer grid is symmetric, so with zero offset they coincide).
Option `cropMarks` (default true).

### Punch hole

One punch hole for a ring: on the FRONT face at the LEFT edge, vertically centered on the actual card; diameter 6 mm, center 8 mm from the card edge. Not configurable.
Option `hole` (checkbox, default true in UI; default false in `buildCardsPdf`).

- When ON, the text area avoids the hole with a band: padding on the hole side becomes 13 mm (8 mm center + 3 mm radius + 2 mm clearance) instead of 4 mm; other sides stay 4 mm. Text is centered and auto-fit inside the remaining area.
- On the back face, the hole is on the RIGHT for long-edge binding (`flip: 'long'`) and on the LEFT for short-edge binding (`flip: 'short'`), so the back padding follows that side automatically.

Option `holeGuide` (select, default 'first' in UI; default 'none' in `buildCardsPdf`): `'none'` | `'first'` | `'all'`. Disabled when `hole` is OFF.
- Draws a thin gray circle (diameter 6 mm, 0.2 mm line) with a small center cross at the hole position on the FRONT page only.
- Values:
  - `'none'`: Do not draw guide.
  - `'first'`: Top-left card only on each sheet. Punch the marked card, then stack cut cards and punch through using it as a template.
  - `'all'`: All cards on the sheet. Punch each card at its mark.

### Calibration sheet

Separate 2-page PDF (front, back). Common to all cards-per-sheet values since the outer grid area (182 x 275 mm) is unchanged.
Front: crosshairs (10 mm arms, 0.2 mm) at the 4 grid corners and the center of the grid.
Back: crosshairs at the duplex-mapped positions of the same points (with current offset), plus a mm scale
(ticks every 0.5 mm, +-5 mm) around each crosshair so the user can hold the sheet to light and read the misalignment.
Text on the sheet explains (in Japanese) how to read it and to enter the measured value as the offset.

## AI Guide

Section `#ai-guide` directly under the header (above Step 1) explains that a photo of a vocabulary book or notes can be converted into a CSV using an external AI chat service.
- Copy button `#ai-prompt-copy` copies `AI_CSV_PROMPT` (from `src/ai-guide.js`) to the clipboard and displays "コピーしました" for 2 seconds.
- On copy failure (e.g., clipboard permissions), an error message is shown and the details accordion `#ai-prompt-details` opens automatically.
- Privacy: The photo is sent only to the external AI service chosen by the user; `wordcard-pdf` itself sends no data.

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

- Each card face is rendered as a DOM element sized to the card's dimensions (`cardWidthMm` x `cardHeightMm`, default 91 x 55 mm for 10 cards; CSS px at 96 dpi), padding 4 mm (or 13 mm on hole side when hole is enabled), content centered horizontally and vertically, text wraps (`overflow-wrap: anywhere`).
- Font: system Japanese sans (`"Hiragino Sans","Noto Sans JP","Yu Gothic","Meiryo",sans-serif`).
- Auto-fit: largest font size in [6 px, 48 px] (binary search, 0.5 px resolution) such that content does not overflow.
- Rasterized at 300 dpi (image pixel size = `round(mm / 25.4 * dpi)`) to PNG; placed in the PDF at the exact mm rect, no scaling of the page.

## Module contracts (src/)

- `layout.js` (pure, no DOM):
  - `export const PAGE`, `CARD`, `GRID` constants.
  - `export const CARDS_PER_SHEET_OPTIONS = [4, 6, 8, 10, 12, 15, 18]`, `DEFAULT_CARDS_PER_SHEET = 10`.
  - `export function gridFor(n)` returns `{ cols, rows, cardsPerSheet, marginLeft, marginTop, width, height, cardWidth, cardHeight }` for `n` cards per sheet. Throws `RangeError` for values not in `CARDS_PER_SHEET_OPTIONS`.
  - `export const HOLE = {diameter:6, centerFromEdge:8, clearance:2}`, `BASE_PADDING = 4`.
  - `export function holeSide(face, flip) -> 'left'|'right'`
  - `export function facePadding(side) -> {top,right,bottom,left}`
  - `export function holeCenter(slot) -> {x,y}`
  - `export function frontRect(slot) -> {x,y,w,h}`
  - `export function backRect(slot, {flip='long', backOffsetX=0, backOffsetY=0}={}) -> {x,y,w,h}`
  - `export function mapToBack(rect, opts) -> rect` (the duplex mapping above, works for any rect/point with w=h=0)
  - `export function paginate(n) -> [{sheet, slot, index}]` for card indices 0..n-1
  - `export function cropMarkLines() -> [{x1,y1,x2,y2}]` (front coordinates)
- `csv.js` (pure): `export function decodeBytes(Uint8Array) -> string`, `export function parseCards(text) -> [{front, back}]`
- `ai-guide.js`: `export const AI_CSV_PROMPT` prompt text for instructing AI to convert photo of notes/vocabulary to CSV.
- `tex.js` (browser): `export function toHtml(text) -> string` (HTML with inline SVG math),
  `export async function renderFace(text, {dpi=300, holeSide=null, cardWidthMm, cardHeightMm}={}) -> Promise<string /* PNG data URL */>` (does auto-fit; `holeSide`: `'left'`|`'right'`|`null`, default `null`),
  `buildFace` also accepts options `holeSide` (`'left'`|`'right'`|`null`, default `null`), `cardWidthMm`, and `cardHeightMm`.
- `pdf.js`: `export async function buildCardsPdf(cards, renderFace, opts) -> Promise<Uint8Array>`
  - `renderFace(text, { holeSide, cardWidthMm, cardHeightMm }) -> Promise<dataURL>` is injected (so node tests can pass a dummy PNG).
  - Options include `cardsPerSheet` (default 10), `hole` (default `false`) and `holeGuide` (`'none'`|`'first'`|`'all'`, default `'none'`). Calls `renderFace(text, { holeSide, cardWidthMm, cardHeightMm })` with `holeSide` `null` when `hole` is `false`.
  - Page order: sheet1 front, sheet1 back, sheet2 front, ... (duplex printing order).
  - `export function buildCalibrationPdf(opts) -> Uint8Array`
  - Uses jsPDF with `unit: 'mm'`, `format: 'a4'`, PNG via `addImage`.
- `main.js`: UI (file input, AI guide section `#ai-guide`, cards per sheet select `#cards-per-sheet`, flip select, back offset X/Y inputs, crop marks checkbox, hole checkbox, holeGuide select, generate button,
  calibration button, progress, error display). Japanese UI. Settings remembered in localStorage (try/catch, key `wordcard_cardsPerSheet` with invalid values falling back to 10).

## Tests

- Unit (Vitest, node): layout invariants; CSV parsing; PDF structure parsed with `pdfjs-dist`
  (page size exactly 595.28 x 841.89 pt; each image's transform matrix equals the expected rect within 0.01 mm;
  front/back of every card related by the duplex mapping; crop marks coincide).
- E2E (Playwright, Chromium): upload CSV -> download PDF; render PDF pages with pdf.js, mirror the back page,
  check registration marks coincide within 1 px at 300 dpi; math and chemistry render non-blank; auto-fit keeps
  long text within the card.
