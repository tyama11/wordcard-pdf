import './style.css';
import Papa from 'papaparse';
import { decodeBytes, parseCards } from './csv.js';
import { renderFace, findTexErrors, splitTex } from './tex.js';
import { buildCardsPdf, buildCalibrationPdf } from './pdf.js';

const STORAGE_KEYS = {
  flip: 'wordcard_flip',
  backOffsetX: 'wordcard_backOffsetX',
  backOffsetY: 'wordcard_backOffsetY',
  cropMarks: 'wordcard_cropMarks',
};

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
 * Checks if raw CSV / TSV text begins with a recognized header row.
 * @param {string} rawText
 * @returns {boolean}
 */
function detectCsvHeader(rawText) {
  if (!rawText) return false;
  const lines = rawText.split(/\r\n|\r|\n/);
  const firstLine = lines[0] ?? '';
  const firstNonEmpty = lines.find((line) => line.trim().length > 0) ?? '';
  const isTsv =
    (firstLine.includes('\t') && !firstLine.includes(',')) ||
    (firstNonEmpty.includes('\t') && !firstNonEmpty.includes(','));
  const delimiter = isTsv ? '\t' : ',';

  const parsed = Papa.parse(rawText, { delimiter });
  for (const row of parsed.data) {
    if (!Array.isArray(row)) continue;
    const f = (row[0] ?? '').trim().toLowerCase();
    const b = (row[1] ?? '').trim().toLowerCase();
    if (f === '' && b === '') continue;
    return HEADER_PAIRS.some(([hf, hb]) => hf === f && hb === b);
  }
  return false;
}

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
 * Clamps offset value to [-5.0, 5.0].
 * @param {number} val
 * @returns {number}
 */
function clampOffset(val) {
  if (isNaN(val)) return 0;
  return Math.max(-5.0, Math.min(5.0, Math.round(val * 10) / 10));
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

/**
 * Renders Japanese instruction text for the calibration PDF sheet.
 * @param {import('jspdf').jsPDF} doc
 * @param {number} pageNumber
 * @param {'long'|'short'} flip
 */
function drawCalibrationInstructions(doc, pageNumber, flip) {
  const canvas = document.createElement('canvas');
  const dpi = 300;
  const mmToPx = dpi / 25.4;
  const wMm = 140;
  const hMm = 55;
  canvas.width = Math.round(wMm * mmToPx);
  canvas.height = Math.round(hMm * mmToPx);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = Math.round(0.5 * mmToPx);
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  ctx.fillStyle = '#0f172a';
  const fontFam = '"Hiragino Sans","Noto Sans JP","Yu Gothic","Meiryo",sans-serif';

  if (pageNumber === 1) {
    // Front page text: how to print (A4, 両面, 長辺/短辺 as selected, 実際のサイズ/100%)
    ctx.font = `bold ${Math.round(4.0 * mmToPx)}px ${fontFam}`;
    ctx.fillText('【位置合わせシートの印刷手順】', Math.round(8 * mmToPx), Math.round(12 * mmToPx));

    ctx.font = `normal ${Math.round(3.3 * mmToPx)}px ${fontFam}`;
    const lines = [
      '・用紙サイズ: A4（タテ）',
      `・両面印刷: 必ず両面印刷にし、「${flip === 'short' ? '短辺とじ' : '長辺とじ'}」を選択`,
      '・印刷倍率: 「実際のサイズ」または「100%」（「用紙に合わせる」は必ずOFF）',
      '・フチなし印刷: 必ずOFF（拡大されて位置がずれます）',
    ];
    let y = Math.round(20 * mmToPx);
    for (const line of lines) {
      ctx.fillText(line, Math.round(8 * mmToPx), y);
      y += Math.round(7.2 * mmToPx);
    }
  } else {
    // Back page text: how to read (光に透かす, 表の十字が裏の目盛りのどこに見えるか読む, その値を現在の補正値に足す, +X=右 +Y=下（裏面を見て）)
    ctx.font = `bold ${Math.round(4.0 * mmToPx)}px ${fontFam}`;
    ctx.fillText('【位置合わせ（ズレ補正）の手順】', Math.round(8 * mmToPx), Math.round(12 * mmToPx));

    ctx.font = `normal ${Math.round(3.1 * mmToPx)}px ${fontFam}`;
    const lines = [
      '1. 印刷後、この裏面を手前にして明るい光に透かします。',
      '2. 表面の十字線が、裏面の目盛り（+X/+Y）のどこに見えるかを読み取ります。',
      '3. 読み取った数値を、画面の現在の補正値（裏面オフセット）に足してください。',
      '   ・裏面を見て: +X は右へ、-X は左へ / +Y は下へ、-Y は上へ補正',
    ];
    let y = Math.round(19.5 * mmToPx);
    for (const line of lines) {
      ctx.fillText(line, Math.round(8 * mmToPx), y);
      y += Math.round(6.8 * mmToPx);
    }
  }

  const dataUrl = canvas.toDataURL('image/png');
  // Placed at center column away from center crosshair (cy = 148.5) and top crosshairs (cy = 11)
  doc.addImage(dataUrl, 'PNG', 35, 52, wMm, hMm);
}

// State
let loadedCards = [];
let hasDetectedHeader = false;
let currentTexErrors = [];

// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');
const summaryContainer = document.getElementById('summary-container');
const cardSummary = document.getElementById('card-summary');
const largeFileWarning = document.getElementById('large-file-warning');
const alertContainer = document.getElementById('alert-container');

const flipSelect = document.getElementById('flip-select');
const offsetXInput = document.getElementById('offset-x');
const offsetYInput = document.getElementById('offset-y');
const cropMarksCheckbox = document.getElementById('crop-marks');
const calibrationBtn = document.getElementById('calibration-btn');

const generateBtn = document.getElementById('generate-btn');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const printNotice = document.getElementById('print-notice');
const duplexNoticeText = document.getElementById('duplex-notice-text');

/**
 * Load settings from localStorage wrapped in try/catch.
 */
function loadSettings() {
  try {
    const savedFlip = localStorage.getItem(STORAGE_KEYS.flip);
    if (savedFlip === 'long' || savedFlip === 'short') {
      flipSelect.value = savedFlip;
    }

    const savedX = localStorage.getItem(STORAGE_KEYS.backOffsetX);
    if (savedX !== null) {
      const val = parseFloat(savedX);
      if (!isNaN(val)) offsetXInput.value = clampOffset(val).toFixed(1);
    }

    const savedY = localStorage.getItem(STORAGE_KEYS.backOffsetY);
    if (savedY !== null) {
      const val = parseFloat(savedY);
      if (!isNaN(val)) offsetYInput.value = clampOffset(val).toFixed(1);
    }

    const savedCropMarks = localStorage.getItem(STORAGE_KEYS.cropMarks);
    if (savedCropMarks !== null) {
      cropMarksCheckbox.checked = savedCropMarks === 'true';
    }
  } catch (e) {
    console.warn('localStorage is unavailable:', e);
  }
  updateDuplexNotice();
}

/**
 * Save settings to localStorage wrapped in try/catch.
 */
function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEYS.flip, flipSelect.value);
    localStorage.setItem(STORAGE_KEYS.backOffsetX, offsetXInput.value);
    localStorage.setItem(STORAGE_KEYS.backOffsetY, offsetYInput.value);
    localStorage.setItem(STORAGE_KEYS.cropMarks, String(cropMarksCheckbox.checked));
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
  }
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
 * @param {{ error?: string, warnings?: string[] }} alerts
 */
function renderAlerts({ error, warnings = [] } = {}) {
  alertContainer.innerHTML = '';

  if (error) {
    const errBox = document.createElement('div');
    errBox.className = 'alert-box alert-error';
    errBox.textContent = error;
    alertContainer.appendChild(errBox);
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
      li.textContent = item;
      ul.appendChild(li);
    }
    warnBox.appendChild(ul);

    if (warnings.length > 10) {
      const more = document.createElement('p');
      more.style.margin = '6px 0 0';
      more.style.fontSize = '0.85rem';
      more.textContent = `… 他 ${warnings.length - 10} 件`;
      warnBox.appendChild(more);
    }

    alertContainer.appendChild(warnBox);
  }
}

/**
 * Validate TeX expressions across all loaded cards.
 * @param {Array<{front: string, back: string}>} cards
 * @param {boolean} hasHeader
 * @returns {string[]}
 */
function validateCardsTex(cards, hasHeader) {
  const entries = [];
  const rowOffset = hasHeader ? 2 : 1;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const rowNum = i + rowOffset;

    // Check front
    for (const part of splitTex(card.front)) {
      if (part.type === 'text') continue;
      const testExpr = part.type === 'inline' ? `$${part.value}$` : `$$${part.value}$$`;
      const errs = findTexErrors(testExpr);
      if (errs.length > 0) {
        entries.push(`${rowNum}行目・表面: ${part.value}`);
      }
    }

    // Check back
    for (const part of splitTex(card.back)) {
      if (part.type === 'text') continue;
      const testExpr = part.type === 'inline' ? `$${part.value}$` : `$$${part.value}$$`;
      const errs = findTexErrors(testExpr);
      if (errs.length > 0) {
        entries.push(`${rowNum}行目・裏面: ${part.value}`);
      }
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

  hasDetectedHeader = detectCsvHeader(rawText);
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

  loadedCards = cards;
  generateBtn.disabled = false;

  // Summary display per UI.md: ◯枚のカード（A4 ◯枚・両面）
  const sheetCount = Math.ceil(cards.length / 10);
  cardSummary.textContent = `${cards.length}枚のカード（A4 ${sheetCount}枚・両面）`;
  summaryContainer.hidden = false;

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
  renderAlerts({ warnings: currentTexErrors });
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
flipSelect.addEventListener('change', saveSettings);
cropMarksCheckbox.addEventListener('change', saveSettings);

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

// Generate PDF
generateBtn.addEventListener('click', async () => {
  if (loadedCards.length === 0) return;

  const flip = flipSelect.value;
  const backOffsetX = clampOffset(parseFloat(offsetXInput.value) || 0);
  const backOffsetY = clampOffset(parseFloat(offsetYInput.value) || 0);
  const cropMarks = cropMarksCheckbox.checked;

  generateBtn.disabled = true;
  flipSelect.disabled = true;
  offsetXInput.disabled = true;
  offsetYInput.disabled = true;
  cropMarksCheckbox.disabled = true;
  calibrationBtn.disabled = true;
  printNotice.hidden = true;

  progressContainer.hidden = false;
  progressBar.value = 0;
  progressBar.max = loadedCards.length * 2;
  progressText.textContent = `0 / ${loadedCards.length * 2} 面を作成中`;

  try {
    const renderFaceWithYield = async (text) => {
      // Yield to the event loop between faces so progress bar updates smoothly
      await new Promise((resolve) => setTimeout(resolve, 0));
      return renderFace(text, { format: 'png' });
    };

    const pdfBytes = await buildCardsPdf(loadedCards, renderFaceWithYield, {
      flip,
      backOffsetX,
      backOffsetY,
      cropMarks,
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
    generateBtn.disabled = false;
    flipSelect.disabled = false;
    offsetXInput.disabled = false;
    offsetYInput.disabled = false;
    cropMarksCheckbox.disabled = false;
    calibrationBtn.disabled = false;
  }
});

// Initialize settings
loadSettings();
