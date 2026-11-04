import './style.css';
import { decodeBytes, parseCards, hasHeaderRow } from './csv.js';
import { renderFace, findTexErrors } from './tex.js';
import { normalizeInput } from './texsplit.js';
import { buildCardsPdf, buildCalibrationPdf } from './pdf.js';
import {
  CARDS_PER_SHEET_OPTIONS,
  DEFAULT_CARDS_PER_SHEET,
  gridFor,
} from './layout.js';
import { drawCalibrationInstructions } from './calibration-text.js';
import { readSettings, writeSettings, clampOffset } from './settings.js';

/**
 * Format local timestamp as YYYYMMDD-HHmm.
 * @param {Date} date
 * @returns {string}
 */
function formatLocalTimestamp(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${min}`;
}

/**
 * Downloads a Blob as a file in browser.
 * @param {Blob} blob
 * @param {string} filename
 */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

// State
let loadedCards = [];
let hasDetectedHeader = false;
let currentTexErrors = [];
let isProceedingWithGeneration = false;

// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');
const summaryContainer = document.getElementById('summary-container');
const cardSummary = document.getElementById('card-summary');
const largeFileWarning = document.getElementById('large-file-warning');
const alertContainer = document.getElementById('alert-container');

const confirmDialog = document.getElementById('confirm-dialog');
const confirmDialogTitle = document.getElementById('confirm-dialog-title');
const confirmDialogList = document.getElementById('confirm-dialog-list');
const dialogCancelBtn = document.getElementById('dialog-cancel-btn');
const dialogProceedBtn = document.getElementById('dialog-proceed-btn');

const cardsPerSheetSelect = document.getElementById('cards-per-sheet');
const flipSelect = document.getElementById('flip-select');
const offsetXInput = document.getElementById('offset-x');
const offsetYInput = document.getElementById('offset-y');
const cropMarksCheckbox = document.getElementById('crop-marks');
const holeCheckbox = document.getElementById('hole');
const holeGuideSelect = document.getElementById('hole-guide');
const calibrationBtn = document.getElementById('calibration-btn');

const generateBtn = document.getElementById('generate-btn');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const printNotice = document.getElementById('print-notice');
const duplexNoticeText = document.getElementById('duplex-notice-text');

/**
 * Populates the cards-per-sheet select element using CARDS_PER_SHEET_OPTIONS and gridFor.
 */
function initCardsPerSheetSelect() {
  if (!cardsPerSheetSelect) return;
  cardsPerSheetSelect.innerHTML = '';
  for (const n of CARDS_PER_SHEET_OPTIONS) {
    const grid = gridFor(n);
    const opt = document.createElement('option');
    opt.value = String(n);
    const w = Math.round(grid.cardWidth);
    const h = Math.round(grid.cardHeight);
    opt.textContent = `${n}枚（${grid.cols}列×${grid.rows}行・${w}×${h}mm）`;
    if (n === DEFAULT_CARDS_PER_SHEET) {
      opt.selected = true;
    }
    cardsPerSheetSelect.appendChild(opt);
  }
}

/**
 * Returns currently selected cards-per-sheet count, falling back to DEFAULT_CARDS_PER_SHEET.
 * @returns {number}
 */
function getSelectedCardsPerSheet() {
  const val = parseInt(cardsPerSheetSelect?.value, 10);
  return CARDS_PER_SHEET_OPTIONS.includes(val) ? val : DEFAULT_CARDS_PER_SHEET;
}

/**
 * Updates card summary text based on loaded cards and current cardsPerSheet.
 */
function updateSummary() {
  if (loadedCards.length === 0) {
    summaryContainer.hidden = true;
    return;
  }
  const perSheet = getSelectedCardsPerSheet();
  const sheetCount = Math.ceil(loadedCards.length / perSheet);
  cardSummary.textContent = `${loadedCards.length}枚のカード（A4 ${sheetCount}枚・両面）`;
  summaryContainer.hidden = false;
}

/**
 * Updates disabled state of the hole guide select according to hole checkbox.
 */
function updateHoleGuideState() {
  if (holeGuideSelect && holeCheckbox) {
    holeGuideSelect.disabled = !holeCheckbox.checked;
  }
}

/**
 * Load settings from localStorage and apply to UI controls.
 */
function loadSettings() {
  const settings = readSettings();

  cardsPerSheetSelect.value = String(settings.cardsPerSheet);

  if (settings.flip !== null) {
    flipSelect.value = settings.flip;
  }

  if (settings.backOffsetX !== null) {
    offsetXInput.value = settings.backOffsetX.toFixed(1);
  }

  if (settings.backOffsetY !== null) {
    offsetYInput.value = settings.backOffsetY.toFixed(1);
  }

  if (settings.cropMarks !== null) {
    cropMarksCheckbox.checked = settings.cropMarks;
  }

  if (settings.hole !== null) {
    holeCheckbox.checked = settings.hole;
  }

  if (settings.holeGuide !== null) {
    holeGuideSelect.value = settings.holeGuide;
  }

  updateHoleGuideState();
  updateDuplexNotice();
}

/**
 * Save current UI settings to localStorage.
 */
function saveSettings() {
  writeSettings({
    cardsPerSheet: cardsPerSheetSelect.value,
    flip: flipSelect.value,
    backOffsetX: offsetXInput.value,
    backOffsetY: offsetYInput.value,
    cropMarks: cropMarksCheckbox.checked,
    hole: holeCheckbox.checked,
    holeGuide: holeGuideSelect.value,
  });
  updateDuplexNotice();
}

function updateDuplexNotice() {
  if (duplexNoticeText) {
    if (flipSelect.value === 'short') {
      duplexNoticeText.textContent = '「両面印刷・短辺とじ」に設定してください。';
    } else {
      duplexNoticeText.textContent = '「両面印刷・長辺とじ」に設定してください。';
    }
  }
}

/**
 * Render error/warning alerts in the UI.
 * @param {{ error?: string, warnings?: Array<{row: number, side: '表面'|'裏面', source: string, ja: string}>, info?: string }} alerts
 */
function renderAlerts({ error, warnings = [], info } = {}) {
  alertContainer.innerHTML = '';

  if (error) {
    const errBox = document.createElement('div');
    errBox.className = 'alert-box alert-error';
    errBox.textContent = error;
    alertContainer.appendChild(errBox);
  }

  if (info) {
    const infoBox = document.createElement('div');
    infoBox.className = 'alert-box alert-info';
    infoBox.textContent = info;
    alertContainer.appendChild(infoBox);
  }

  if (warnings && warnings.length > 0) {
    const warnBox = document.createElement('div');
    warnBox.className = 'alert-box alert-warning';

    const title = document.createElement('p');
    title.style.margin = '0 0 6px';
    title.style.fontWeight = 'bold';
    title.textContent = `数式記法エラー: ${warnings.length}件の無効なTeX記法が含まれていますが、PDFはそのまま生成されます。`;
    warnBox.appendChild(title);

    const ul = document.createElement('ul');
    const shown = warnings.slice(0, 10);
    for (const item of shown) {
      const li = document.createElement('li');
      li.textContent = `${item.row}行目・${item.side}：${item.source} — ${item.ja}`;
      ul.appendChild(li);
    }
    warnBox.appendChild(ul);

    if (warnings.length > 10) {
      const more = document.createElement('p');
      more.style.margin = '6px 0 0';
      more.style.fontSize = '0.85rem';
      more.textContent = `ほか${warnings.length - 10}件`;
      warnBox.appendChild(more);
    }

    alertContainer.appendChild(warnBox);
  }
}

/**
 * Validate TeX expressions across all loaded cards.
 * @param {Array<{front: string, back: string}>} cards
 * @param {boolean} hasHeader
 * @returns {Array<{row: number, side: '表面'|'裏面', source: string, ja: string}>}
 */
function validateCardsTex(cards, hasHeader) {
  const entries = [];
  const rowOffset = hasHeader ? 2 : 1;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const row = i + rowOffset;

    // Check front
    const frontErrors = findTexErrors(card.front);
    for (const err of frontErrors) {
      entries.push({
        row,
        side: '表面',
        source: err.source,
        ja: err.ja,
      });
    }

    // Check back
    const backErrors = findTexErrors(card.back);
    for (const err of backErrors) {
      entries.push({
        row,
        side: '裏面',
        source: err.source,
        ja: err.ja,
      });
    }
  }

  return entries;
}

/**
 * Handles raw CSV / TSV text processing.
 * @param {string} rawText
 */
function processCsvText(rawText) {
  if (!rawText || !rawText.trim()) {
    loadedCards = [];
    currentTexErrors = [];
    generateBtn.disabled = true;
    summaryContainer.hidden = true;
    largeFileWarning.hidden = true;
    renderAlerts({ error: 'CSVファイルに有効なデータが含まれていません。1行以上の単語ペアを入力してください。' });
    return;
  }

  hasDetectedHeader = hasHeaderRow(rawText);
  const cards = parseCards(rawText);

  if (!cards || cards.length === 0) {
    loadedCards = [];
    currentTexErrors = [];
    generateBtn.disabled = true;
    summaryContainer.hidden = true;
    largeFileWarning.hidden = true;
    renderAlerts({ error: 'CSVファイルに有効なデータが含まれていません。1行以上の単語ペアを入力してください。' });
    return;
  }

  // Normalize yen signs to backslashes for TeX expressions
  let yenCount = 0;
  for (const card of cards) {
    const normFront = normalizeInput(card.front);
    card.front = normFront.text;
    yenCount += normFront.count;

    const normBack = normalizeInput(card.back);
    card.back = normBack.text;
    yenCount += normBack.count;
  }

  loadedCards = cards;
  generateBtn.disabled = false;

  // Summary display per UI.md: ◯枚のカード（A4 ◯枚・両面）
  updateSummary();

  // Large CSV warning (> 1000 cards)
  if (cards.length > 1000) {
    largeFileWarning.className = 'alert-box alert-warning';
    largeFileWarning.textContent = `カード数が1,000枚を超えているため（${cards.length}枚）、PDF生成に数分かかる場合があります。ブラウザを閉じずにお待ちください。`;
    largeFileWarning.hidden = false;
  } else {
    largeFileWarning.className = 'alert-box';
    largeFileWarning.hidden = true;
  }

  // TeX error check
  currentTexErrors = validateCardsTex(cards, hasDetectedHeader);
  renderAlerts({
    info: yenCount > 0 ? `円記号（¥）をバックスラッシュ（\\）として読み替えました：${yenCount}か所` : undefined,
    warnings: currentTexErrors,
  });
}

/**
 * Handles file reading and decoding.
 * @param {File} file
 */
async function handleFile(file) {
  if (!file) return;

  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const text = decodeBytes(bytes);
    processCsvText(text);
  } catch (err) {
    console.error('File reading failed:', err);
    loadedCards = [];
    generateBtn.disabled = true;
    summaryContainer.hidden = true;
    renderAlerts({ error: 'ファイルを読み込めませんでした。文字コード（UTF-8 または Shift_JIS）およびファイル形式をご確認ください。' });
  }
}

// Event Listeners
browseBtn.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) handleFile(file);
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer?.files?.[0];
  if (file) handleFile(file);
});

// Click or Enter/Space on dropZone opens file picker
dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

// Settings change
cardsPerSheetSelect.addEventListener('change', () => {
  saveSettings();
  updateSummary();
});
flipSelect.addEventListener('change', saveSettings);
cropMarksCheckbox.addEventListener('change', saveSettings);
holeCheckbox.addEventListener('change', () => {
  updateHoleGuideState();
  saveSettings();
});
holeGuideSelect.addEventListener('change', saveSettings);

offsetXInput.addEventListener('change', () => {
  const val = parseFloat(offsetXInput.value);
  offsetXInput.value = clampOffset(val).toFixed(1);
  saveSettings();
});

offsetYInput.addEventListener('change', () => {
  const val = parseFloat(offsetYInput.value);
  offsetYInput.value = clampOffset(val).toFixed(1);
  saveSettings();
});

// Calibration PDF download
calibrationBtn.addEventListener('click', () => {
  const flip = flipSelect.value;
  const backOffsetX = clampOffset(parseFloat(offsetXInput.value) || 0);
  const backOffsetY = clampOffset(parseFloat(offsetYInput.value) || 0);

  const pdfBytes = buildCalibrationPdf({
    flip,
    backOffsetX,
    backOffsetY,
    drawText: (doc, page) => {
      drawCalibrationInstructions(doc, page, flip);
    },
  });

  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  triggerDownload(blob, 'wordcards-calibration.pdf');
});

/**
 * Opens pre-generation confirmation dialog listing all TeX syntax errors.
 */
function openConfirmDialog() {
  confirmDialogTitle.textContent = `数式の書き方に誤りが${currentTexErrors.length}件あります`;
  confirmDialogList.innerHTML = '';

  for (const err of currentTexErrors) {
    const item = document.createElement('div');
    item.className = 'confirm-dialog-item';
    item.style.marginBottom = '6px';

    const rowSide = document.createElement('span');
    rowSide.textContent = `${err.row}行目・${err.side}：`;

    const code = document.createElement('code');
    code.textContent = err.source;

    const ja = document.createElement('span');
    ja.textContent = ` — ${err.ja}`;

    item.appendChild(rowSide);
    item.appendChild(code);
    item.appendChild(ja);
    confirmDialogList.appendChild(item);
  }

  confirmDialog.showModal();
  dialogCancelBtn.focus();
}

/**
 * Enables or disables UI controls during PDF generation.
 * @param {boolean} disabled
 */
function setControlsDisabled(disabled) {
  generateBtn.disabled = disabled;
  cardsPerSheetSelect.disabled = disabled;
  flipSelect.disabled = disabled;
  offsetXInput.disabled = disabled;
  offsetYInput.disabled = disabled;
  cropMarksCheckbox.disabled = disabled;
  holeCheckbox.disabled = disabled;
  if (disabled) {
    holeGuideSelect.disabled = true;
  } else {
    updateHoleGuideState();
  }
  calibrationBtn.disabled = disabled;
}

/**
 * Generates and downloads the PDF from loaded cards.
 */
async function generatePdf() {
  if (loadedCards.length === 0) return;

  const flip = flipSelect.value;
  const backOffsetX = clampOffset(parseFloat(offsetXInput.value) || 0);
  const backOffsetY = clampOffset(parseFloat(offsetYInput.value) || 0);
  const cropMarks = cropMarksCheckbox.checked;
  const hole = holeCheckbox.checked;
  const holeGuide = holeGuideSelect.value;
  const cardsPerSheet = getSelectedCardsPerSheet();

  setControlsDisabled(true);
  printNotice.hidden = true;

  progressContainer.hidden = false;
  progressBar.value = 0;
  progressBar.max = loadedCards.length * 2;
  progressText.textContent = `0 / ${loadedCards.length * 2} 面を作成中`;

  try {
    const renderFaceWithYield = async (text, faceOpts) => {
      // Yield to the event loop between faces so progress bar updates smoothly
      await new Promise((resolve) => setTimeout(resolve, 0));
      return renderFace(text, { format: 'png', errorNote: true, ...faceOpts });
    };

    const pdfBytes = await buildCardsPdf(loadedCards, renderFaceWithYield, {
      flip,
      backOffsetX,
      backOffsetY,
      cropMarks,
      hole,
      holeGuide,
      cardsPerSheet,
      onProgress: (done, total) => {
        progressBar.max = total;
        progressBar.value = done;
        progressText.textContent = `${done} / ${total} 面を作成中`;
      },
    });

    const timestamp = formatLocalTimestamp();
    const filename = `wordcards-${timestamp}.pdf`;
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    triggerDownload(blob, filename);

    printNotice.hidden = false;
  } catch (err) {
    console.error('PDF generation error:', err);
    renderAlerts({ error: 'PDFの作成中にエラーが発生しました。' });
  } finally {
    setControlsDisabled(false);
  }
}

// Generate PDF
generateBtn.addEventListener('click', () => {
  if (loadedCards.length === 0) return;

  if (currentTexErrors.length > 0) {
    openConfirmDialog();
  } else {
    generatePdf();
  }
});

// Confirmation Dialog events
dialogCancelBtn.addEventListener('click', () => {
  isProceedingWithGeneration = false;
  confirmDialog.close();
  browseBtn.focus();
});

dialogProceedBtn.addEventListener('click', () => {
  isProceedingWithGeneration = true;
  confirmDialog.close();
  generatePdf();
});

confirmDialog.addEventListener('close', () => {
  if (!isProceedingWithGeneration) {
    browseBtn.focus();
  }
  isProceedingWithGeneration = false;
});

// Initialize settings
initCardsPerSheetSelect();
loadSettings();
