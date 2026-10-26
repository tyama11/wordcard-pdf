# UI Specification (`src/main.js`)

This document defines the single-page user interface specification for `wordcard-pdf`, intended for the developer implementing `src/main.js`. All user-facing text must be in Japanese.

---

## Page Layout Overview

The application is structured as a clean, single-column workflow divided into logical steps:
1. Header
2. Step 1: CSVを選ぶ (Select CSV)
3. Step 2: 印刷設定 (Print Settings)
4. Step 3: PDFを作る (Generate PDF)
5. Error & Warning Displays
6. Cheat Sheet: 数式・化学式の書き方 (Collapsible LaTeX & Chemistry syntax reference)
7. Footer

---

## 1. Header

- **Application Title**: `単語カードPDFメーカー`
- **One-line Description**: `CSVファイルから両面印刷用の単語カードPDFを生成するWebツールです。`
- **Privacy Note / Notice**:
  - Exact text: `CSVはブラウザ内だけで処理され、どこにも送信されません`
  - Style: Badge or subtle callout box with a shield/lock icon emphasizing local client-side processing.

---

## 2. Step 1: CSVを選ぶ (Select CSV)

- **Section Heading**: `Step 1: CSVを選ぶ`
- **Drag & Drop Zone and File Button**:
  - Acceptable file types: `.csv`, `.tsv`, `.txt` (`accept=".csv,.tsv,.txt"`).
  - Visual drop target with border highlighting on drag over.
  - File picker button (e.g., `ファイルを選択`).
- **Post-Load Information**:
  - After loading and parsing the CSV:
    - Display card count summary: `◯枚のカード（A4 ◯枚・両面）` (calculated as `Math.ceil(cardCount / 10)` A4 sheets).
    - **Yen Sign Normalization Note (`円記号の自動読み替え`)**:
      - If cells contain `¥` or `￥` preceding TeX commands or delimiters, they are automatically normalized to `\` via `normalizeInput()`.
      - If any replacements occur (count > 0), an info notice is displayed in `#alert-container`: `円記号（¥）をバックスラッシュ（\）として読み替えました：◯か所`.
- **Sample CSV Link**:
  - Text: `サンプルCSVをダウンロード`
  - Link target: `./sample.csv` (download attribute).
- **Collapsible CSV Format Help (`<details>` or accordion)**:
  - Title: `CSVの形式・書き方について`
  - Explains:
    - 1st column: Front (表), 2nd column: Back (裏). Columns beyond the 2nd are ignored.
    - Header row is optional and automatically detected (`表|裏`, `front|back`, etc.).
    - Supported encodings: UTF-8 (with/without BOM) or Shift_JIS (auto-detected).
    - Multi-line cells and fields containing commas must be quoted per RFC 4180.

---

## 3. Step 2: 印刷設定 (Print Settings)

- **Section Heading**: `Step 2: 印刷設定`
- **Binding / Flip Select (`とじ方`)**:
  - Dropdown options:
    - `長辺とじ（推奨）` (value: `long`)
    - `短辺とじ` (value: `short`)
  - Note: In long-edge binding, the back page mirrors horizontally (left column back aligns with right column front). In short-edge binding, it mirrors vertically.
- **Back Side Calibration Offset Inputs (`裏面のずれ補正`)**:
  - **X offset (`裏面オフセット X`)**:
    - Input: `<input type="number" step="0.1" min="-5.0" max="5.0" value="0.0">` (unit: `mm`).
  - **Y offset (`裏面オフセット Y`)**:
    - Input: `<input type="number" step="0.1" min="-5.0" max="5.0" value="0.0">` (unit: `mm`).
  - **Sign Explanation**:
    - Clear directional guide: `裏面を見たとき、+X は裏面を右へ、+Y は裏面を下へ移動します（-X は左へ、-Y は上へ移動）。`
- **Crop Marks Checkbox (`トンボ`)**:
  - Label: `トンボ（裁断マーク）を印刷する`
  - Default: Checked (`true`).
  - Adds 0.1mm vector crop marks at card grid boundaries for cutting on plain paper.
- **Calibration Sheet Download Button & Guide**:
  - Button text: `位置合わせシートをダウンロード`
  - Action: Invokes `buildCalibrationPdf()` and triggers download of `calibration-sheet.pdf`.
  - Short How-To text:
    - `両面印刷後、光に透かして表面の十字マークと裏面の目盛り付き十字マークのズレを読み取り、上記の裏面オフセットに入力してください。`

---

## 4. Step 3: PDFを作る (Generate PDF)

- **Section Heading**: `Step 3: PDFを作る`
- **Generate Button**:
  - Button text: `PDFを作成してダウンロード`
  - Disabled state: Disabled if no valid CSV is loaded or if PDF generation is in progress.
- **Pre-Generation Confirmation Dialog (`<dialog class="confirm-dialog">`)**:
  - Trigger: If there are TeX syntax errors when clicking `PDFを作成してダウンロード`, PDF generation does not start immediately. Instead, `<dialog class="confirm-dialog">` opens via `showModal()`. If there are no errors, no dialog opens and generation starts directly.
  - Title: `数式の書き方に誤りが◯件あります`
  - Explanation: `このまま作成すると、誤りのある部分は赤字で印刷され、カードの下に「⚠ 数式エラー」と表示されます。`
  - Error List: A scrollable container (`.confirm-dialog-list`) displaying ALL error entries with row number, side (`表面` or `裏面`), source code in `<code>`, and Japanese explanation translated via `explainTexError` (e.g., `3行目・裏面：<code>\frac{1}</code> — \frac の { } の中身が足りません`).
  - Buttons:
    - `戻って直す`: Closes the dialog, cancels generation, and returns keyboard focus to the file-select button (`#browse-btn`).
    - `このまま作成する`: Closes the dialog and proceeds with PDF generation using `renderFace(..., { errorNote: true })`.
  - Accessibility & Keyboard:
    - Esc key closes the dialog without generating and returns focus to the file-select button (same as `戻って直す`).
    - Initial focus is set on `戻って直す`.
- **Progress Bar & Status Display**:
  - During generation:
    - Show progress bar (HTML5 `<progress>` or styled bar).
    - Text indicator: `◯ / ◯ 面を作成中` (e.g. `12 / 20 面を作成中`).
    - Disable button and inputs while running.
- **Output File Download**:
  - Downloads generated file named with timestamp: `wordcards-YYYYMMDD-HHmm.pdf` (e.g., `wordcards-20261026-1138.pdf`).
- **Post-Generation Notice Box (`印刷時の注意`)**:
  - Displayed prominently after successful PDF creation:
    - **用紙サイズ**: `A4`
    - **倍率設定**: `「実際のサイズ」または「100%」を選択してください（「ページに合わせる / 用紙に合わせる」は必ずOFF）。`
    - **両面印刷**: `「両面印刷・長辺とじ」に設定してください（Step 2で短辺とじを選択した場合は短辺とじ）。`
    - **フチなし印刷**: `「フチなし印刷」はOFFにしてください（拡大されて位置がずれます）。`

---

## 5. Errors and Warnings

All error messages must be clearly displayed in Japanese:
- **Empty CSV**:
  - Message: `CSVファイルに有効なデータが含まれていません。1行以上の単語ペアを入力してください。`
- **Unreadable File / Decode Error**:
  - Message: `ファイルを読み込めませんでした。文字コード（UTF-8 または Shift_JIS）およびファイル形式をご確認ください。`
- **TeX Syntax Errors**:
  - Behavior: Does not crash generation. The raw TeX formula will be rendered in red text on the card.
  - Step 1 Warning Banner: In `#alert-container`, displays up to 10 entries formatted as `◯行目・[表面|裏面]：<source> — <ja>` (e.g. `3行目・裏面：\frac{1} — \frac の { } の中身が足りません`), followed by `ほか◯件` if more than 10 errors exist.
  - Card Footer Error Note: When `errorNote: true`, any card face with TeX errors includes a red footer note at the bottom: `⚠ 数式エラー：<ja explanation>` (appends `ほか◯件` if multiple errors on the face).
- **Large CSV Warning (> 1000 cards)**:
  - When card count > 1000:
    - Warning banner: `カード数が1,000枚を超えているため（◯枚）、PDF生成に数分かかる場合があります。ブラウザを閉じずにお待ちください。`

---

## 6. Collapsible Cheat Sheet: 数式・化学式の書き方

A collapsible section (`<details>`) providing a syntax reference table:
- Title: `数式・化学式の書き方（TeX・mhchem記法チートシート）`
- Content:
  - Math delimiters: `$式$` or `\(式\)` for inline math, `$$式$$` or `\[式\]` for display math.
  - Chemistry: `\ce{式}` for chemical formulas and equations.
  - Escaped dollar: `\$` for literal `$` signs.
  - Table of examples:
    - `$x^2$` : 上付き添字・累乗
    - `$\frac{a}{b}$` : 分数
    - `$\sqrt{x}$` : 平方根（ルート）
    - `$$...$$` : 独立行数式（センタリング表示）
    - `\ce{H2O}` : 化学式（水）
    - `\ce{2H2 + O2 -> 2H2O}` : 化学反応式
    - `\ce{Fe^{3+}}` : イオン電荷
    - `\ce{A <=> B}` : 平衡反応の矢印
    - `\$` : 半角ドル記号の表示

---

## 7. Footer

- **GitHub Repository Link**: Link to `https://github.com/tyama11/wordcard-pdf` with GitHub icon/text.
- **Version Number**: `v1.0.0` (from `package.json`).
- **Copyright / License**: `MIT License © 2026 tyama11`

---

## 8. Technical & Accessibility Requirements

- **Local Persistence (`localStorage`)**:
  - Persist user choices: `flip` mode, `backOffsetX`, `backOffsetY`, `cropMarks`.
  - All read/write operations must be safely wrapped in `try { ... } catch (e) { ... }` to handle private browsing modes and disabled cookies without throwing uncaught exceptions.
- **Responsiveness**:
  - Fully responsive down to 360px viewport width.
  - Side gutters: at least 16px padding on mobile screens.
- **Color Theme**:
  - Adapt seamlessly to light and dark themes using CSS media query `@media (prefers-color-scheme: dark)`.
- **Accessibility & Operability**:
  - Semantic HTML tags (`<main>`, `<header>`, `<section>`, `<footer>`, `<button>`, `<input>`, `<label>`).
  - All form controls must have explicit `<label>` or `aria-label` attributes.
  - Full keyboard accessibility (logical `tabindex`, visible focus indicators).
  - Minimum tap target size of 44x44px for touch interactions on buttons and inputs.
