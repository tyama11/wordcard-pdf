import './style.css';
import { decodeBytes, parseCards, hasHeaderRow, pdfFilenameFor } from './csv.js';
import { renderFace, findTexErrors, explainTexErrorLocalized } from './tex.js';
import { normalizeInput } from './texsplit.js';
import { buildCardsPdf, buildCalibrationPdf } from './pdf.js';
import {
  CARDS_PER_SHEET_OPTIONS,
  DEFAULT_CARDS_PER_SHEET,
  gridFor,
} from './layout.js';
import { drawCalibrationInstructions } from './calibration-text.js';
import { readSettings, writeSettings, clampOffset } from './settings.js';
import {
  LOCALES,
  LOCALE_NAMES,
  resolveInitialLocale,
  getLocale,
  setLocale,
  onLocaleChange,
  t,
  applyTranslations,
} from './i18n.js';

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
let loadedFileName = '';
let currentTexErrors = [];
let isProceedingWithGeneration = false;
let currentAlerts = null;
let currentProgress = null;

// DOM Elements
const localeSelect = document.getElementById('locale-select');
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
 * Initializes and populates the locale select element with supported language names.
 */
function initLocaleSelect() {
  if (!localeSelect) return;
  localeSelect.innerHTML = '';
  for (const loc of LOCALES) {
    const opt = document.createElement('option');
    opt.value = loc;
    opt.textContent = LOCALE_NAMES[loc];
    localeSelect.appendChild(opt);
  }
  localeSelect.value = getLocale();
}

/**
 * Populates the cards-per-sheet select element using CARDS_PER_SHEET_OPTIONS and gridFor.
 * Preserves the currently selected value.
 */
function initCardsPerSheetSelect() {
  if (!cardsPerSheetSelect) return;
  const currentVal = cardsPerSheetSelect.value || String(DEFAULT_CARDS_PER_SHEET);
  cardsPerSheetSelect.innerHTML = '';
  for (const n of CARDS_PER_SHEET_OPTIONS) {
    const grid = gridFor(n);
    const opt = document.createElement('option');
    opt.value = String(n);
    const w = Math.round(grid.cardWidth);
    const h = Math.round(grid.cardHeight);
    opt.textContent = t('settings.cardsPerSheetOption', {
      n,
      cols: grid.cols,
      rows: grid.rows,
      w,
      h,
    });
    if (String(n) === currentVal) {
      opt.selected = true;
    }
    cardsPerSheetSelect.appendChild(opt);
  }
  cardsPerSheetSelect.value = currentVal;
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
  cardSummary.textContent = t('summary.cardCount', {
    count: loadedCards.length,
    sheets: sheetCount,
  });
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
      duplexNoticeText.textContent = t('print.duplexShort');
    } else {
      duplexNoticeText.textContent = t('print.duplexLong');
    }
  }
}

function updateLargeFileWarning() {
  if (loadedCards.length > 1000) {
    largeFileWarning.className = 'alert-box alert-warning';
    largeFileWarning.textContent = t('alert.largeFile', { count: loadedCards.length });
    largeFileWarning.hidden = false;
  } else {
    largeFileWarning.className = 'alert-box';
    largeFileWarning.hidden = true;
  }
}

/**
 * Render error/warning alerts in the UI using currentAlerts state.
 */
function renderCurrentAlerts() {
  alertContainer.innerHTML = '';
  if (!currentAlerts) return;

  const { error, info, warnings = [] } = currentAlerts;

  if (error) {
    const errBox = document.createElement('div');
    errBox.className = 'alert-box alert-error';
    errBox.textContent = t(error.key, error.params);
    alertContainer.appendChild(errBox);
  }

  if (info) {
    const infoBox = document.createElement('div');
    infoBox.className = 'alert-box alert-info';
    infoBox.textContent = t(info.key, info.params);
    alertContainer.appendChild(infoBox);
  }

  if (warnings && warnings.length > 0) {
    const warnBox = document.createElement('div');
    warnBox.className = 'alert-box alert-warning';

    const title = document.createElement('p');
    title.style.margin = '0 0 6px';
    title.style.fontWeight = 'bold';
    title.textContent = t('alert.texWarningTitle', { count: warnings.length });
    warnBox.appendChild(title);

    const ul = document.createElement('ul');
    const shown = warnings.slice(0, 10);
    for (const item of shown) {
      const li = document.createElement('li');
      const side = t(item.sideKey);
      const explanation = explainTexErrorLocalized(item.message);
      li.textContent = t('alert.texWarningItem', {
        row: item.row,
        side,
        source: item.source,
        explanation,
      });
      ul.appendChild(li);
    }
    warnBox.appendChild(ul);

    if (warnings.length > 10) {
      const more = document.createElement('p');
      more.style.margin = '6px 0 0';
      more.style.fontSize = '0.85rem';
      more.textContent = t('alert.moreItems', { count: warnings.length - 10 });
      warnBox.appendChild(more);
    }

    alertContainer.appendChild(warnBox);
  }
}

/**
 * Updates alerts state and re-renders alert container.
 * @param {{ error?: { key: string, params?: Record<string, any> }, info?: { key: string, params?: Record<string, any> }, warnings?: Array<any> }} [alerts]
 */
function setAlerts(alerts) {
  currentAlerts = alerts || null;
  renderCurrentAlerts();
}

/**
 * Validate TeX expressions across all loaded cards.
 * @param {Array<{front: string, back: string}>} cards
 * @param {boolean} hasHeader
 * @returns {Array<{row: number, sideKey: string, side: string, source: string, message: string, ja: string, explanation: string}>}
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
        sideKey: 'csv.sideFront',
        side: 'front',
        source: err.source,
        message: err.message,
        ja: err.ja,
        explanation: err.explanation,
      });
    }

    // Check back
    const backErrors = findTexErrors(card.back);
    for (const err of backErrors) {
      entries.push({
        row,
        sideKey: 'csv.sideBack',
        side: 'back',
        source: err.source,
        message: err.message,
        ja: err.ja,
        explanation: err.explanation,
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
    setAlerts({ error: { key: 'alert.emptyCsv' } });
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
    setAlerts({ error: { key: 'alert.emptyCsv' } });
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

  updateSummary();
  updateLargeFileWarning();

  // TeX error check
  currentTexErrors = validateCardsTex(cards, hasDetectedHeader);
  setAlerts({
    info: yenCount > 0 ? { key: 'alert.yenReplaced', params: { count: yenCount } } : undefined,
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
    loadedFileName = file.name;
    processCsvText(text);
  } catch (err) {
    console.error('File reading failed:', err);
    loadedCards = [];
    generateBtn.disabled = true;
    summaryContainer.hidden = true;
    setAlerts({ error: { key: 'alert.readFailed' } });
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
 * Re-renders pre-generation confirmation dialog items.
 */
function renderConfirmDialogList() {
  confirmDialogTitle.textContent = t('dialog.title', { count: currentTexErrors.length });
  confirmDialogList.innerHTML = '';

  for (const err of currentTexErrors) {
    const item = document.createElement('div');
    item.className = 'confirm-dialog-item';
    item.style.marginBottom = '6px';

    const rowSide = document.createElement('span');
    const side = t(err.sideKey);
    rowSide.textContent = t('dialog.rowSide', { row: err.row, side });

    const code = document.createElement('code');
    code.textContent = err.source;

    const ja = document.createElement('span');
    const explanation = explainTexErrorLocalized(err.message);
    ja.textContent = ` — ${explanation}`;

    item.appendChild(rowSide);
    item.appendChild(code);
    item.appendChild(ja);
    confirmDialogList.appendChild(item);
  }
}

/**
 * Opens pre-generation confirmation dialog listing all TeX syntax errors.
 */
function openConfirmDialog() {
  renderConfirmDialogList();
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
  currentProgress = { done: 0, total: loadedCards.length * 2 };
  progressText.textContent = t('progress.creating', currentProgress);

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
        currentProgress = { done, total };
        progressText.textContent = t('progress.creating', currentProgress);
      },
    });

    const filename = pdfFilenameFor(loadedFileName);
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    triggerDownload(blob, filename);

    printNotice.hidden = false;
  } catch (err) {
    console.error('PDF generation error:', err);
    setAlerts({ error: { key: 'alert.pdfFailed' } });
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

if (localeSelect) {
  localeSelect.addEventListener('change', (e) => {
    setLocale(e.target.value);
  });
}

// Locale change reaction
onLocaleChange(() => {
  if (localeSelect && localeSelect.value !== getLocale()) {
    localeSelect.value = getLocale();
  }
  applyTranslations();
  document.title = t('meta.title');

  initCardsPerSheetSelect();
  updateSummary();
  updateDuplexNotice();
  updateLargeFileWarning();
  renderCurrentAlerts();

  if (confirmDialog && confirmDialog.open) {
    renderConfirmDialogList();
  }

  if (currentProgress && !progressContainer.hidden) {
    progressText.textContent = t('progress.creating', currentProgress);
  }
});

// Single place startup initialization
function initApp() {
  const initialLocale = resolveInitialLocale();
  setLocale(initialLocale, { persist: false });
  initLocaleSelect();
  applyTranslations();
  document.title = t('meta.title');

  initCardsPerSheetSelect();
  loadSettings();
}

initApp();
