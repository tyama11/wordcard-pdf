/**
 * PDF generation for duplex-printable word cards and calibration sheets.
 * All dimensions and coordinates in mm.
 */

import { jsPDF } from 'jspdf';
import {
  GRID,
  frontRect,
  backRect,
  cropMarkLines,
  mapToBack,
} from './layout.js';

/**
 * Checks if a face text is blank/empty.
 *
 * @param {string} text
 * @returns {boolean}
 */
function isBlank(text) {
  return text == null || String(text).trim() === '';
}

/**
 * Infers image format for jsPDF from data URL mime type.
 *
 * @param {string} dataUrl
 * @returns {'PNG'|'JPEG'|'WEBP'}
 */
function getImageFormat(dataUrl) {
  if (typeof dataUrl === 'string') {
    const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);/);
    if (match) {
      const type = match[1].toLowerCase();
      if (type === 'jpeg' || type === 'jpg') return 'JPEG';
      if (type === 'png') return 'PNG';
      if (type === 'webp') return 'WEBP';
    }
  }
  return 'PNG';
}

/**
 * Draws crop marks on the current page of the PDF document.
 *
 * @param {jsPDF} doc jsPDF document instance
 * @param {boolean} isBack Whether this is a back page
 * @param {object} opts Layout options
 */
function drawCropMarks(doc, isBack, opts) {
  if (opts.cropMarks === false) {
    return;
  }
  const lines = cropMarkLines();
  doc.setLineWidth(0.1);
  doc.setDrawColor(0, 0, 0);

  for (const line of lines) {
    if (!isBack) {
      doc.line(line.x1, line.y1, line.x2, line.y2);
    } else {
      const p1 = mapToBack({ x: line.x1, y: line.y1, w: 0, h: 0 }, opts);
      const p2 = mapToBack({ x: line.x2, y: line.y2, w: 0, h: 0 }, opts);
      doc.line(p1.x, p1.y, p2.x, p2.y);
    }
  }
}

/**
 * Builds a duplex-printable PDF containing business-card size word cards.
 *
 * Pages are generated in duplex printing order:
 * Sheet 1 Front, Sheet 1 Back, Sheet 2 Front, Sheet 2 Back, ...
 *
 * @param {Array<{ front: string, back: string }>} cards List of cards
 * @param {(text: string) => Promise<string>} renderFace Async renderer returning PNG/JPEG data URL
 * @param {object} [opts] Options
 * @param {'long'|'short'} [opts.flip='long'] Duplex flip mode
 * @param {number} [opts.backOffsetX=0] Horizontal calibration offset for back side (mm)
 * @param {number} [opts.backOffsetY=0] Vertical calibration offset for back side (mm)
 * @param {boolean} [opts.cropMarks=true] Whether to draw crop marks in margins
 * @param {(done: number, total: number) => void} [opts.onProgress] Progress callback
 * @returns {Promise<Uint8Array>}
 */
export async function buildCardsPdf(cards, renderFace, opts = {}) {
  const {
    flip = 'long',
    backOffsetX = 0,
    backOffsetY = 0,
    cropMarks = true,
    onProgress,
  } = opts;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  if (!cards || cards.length === 0) {
    if (typeof onProgress === 'function') {
      onProgress(0, 0);
    }
    return new Uint8Array(doc.output('arraybuffer'));
  }

  const layoutOpts = { flip, backOffsetX, backOffsetY, cropMarks };
  const cardsPerSheet = GRID.cardsPerSheet;
  const numSheets = Math.ceil(cards.length / cardsPerSheet);
  const totalSteps = cards.length * 2;
  let doneSteps = 0;

  const stepProgress = () => {
    doneSteps++;
    if (typeof onProgress === 'function') {
      onProgress(doneSteps, totalSteps);
    }
  };

  for (let sheet = 0; sheet < numSheets; sheet++) {
    if (sheet > 0) {
      doc.addPage();
    }

    // --- Sheet Front Page ---
    drawCropMarks(doc, false, layoutOpts);

    const sheetCards = [];
    for (let slot = 0; slot < cardsPerSheet; slot++) {
      const cardIndex = sheet * cardsPerSheet + slot;
      if (cardIndex < cards.length) {
        sheetCards.push({ card: cards[cardIndex], slot });
      }
    }

    for (const { card, slot } of sheetCards) {
      if (!isBlank(card.front)) {
        const dataUrl = await renderFace(card.front);
        if (dataUrl) {
          const rect = frontRect(slot);
          const format = getImageFormat(dataUrl);
          doc.addImage(dataUrl, format, rect.x, rect.y, rect.w, rect.h);
        }
      }
      stepProgress();
    }

    // --- Sheet Back Page ---
    doc.addPage();
    drawCropMarks(doc, true, layoutOpts);

    for (const { card, slot } of sheetCards) {
      if (!isBlank(card.back)) {
        const dataUrl = await renderFace(card.back);
        if (dataUrl) {
          const rect = backRect(slot, layoutOpts);
          const format = getImageFormat(dataUrl);
          doc.addImage(dataUrl, format, rect.x, rect.y, rect.w, rect.h);
        }
      }
      stepProgress();
    }
  }

  return new Uint8Array(doc.output('arraybuffer'));
}

/**
 * Builds a 2-page calibration sheet PDF (Front, Back) for printer duplex alignment.
 *
 * Page 1 (Front): Header "FRONT - calibration sheet" and crosshairs
 * (10 mm arms, 0.2 mm line width) at the 4 grid corners and grid center.
 * Page 2 (Back): Header "BACK - hold to light; read where the FRONT cross appears on this scale and ADD that value to the offset",
 * crosshairs at duplex-mapped positions, mm scale (ticks every 0.5 mm, +-5 mm)
 * labeled with ASCII numbers at -4, -2, 2, 4 mm on both axes, and captions "+X"
 * at the positive end of the horizontal scale and "+Y" at the positive (downward)
 * end of the vertical scale.
 *
 * Sign rule:
 * reading r measured on the back scale (back-page coordinates, +X right, +Y down when looking at the back)
 * => new offset = current offset + r.
 *
 * Japanese explanatory text: Standard jsPDF fonts cannot draw Japanese glyphs.
 * Explanatory text can be drawn via an injectable `opts.drawText(doc, pageNumber)`
 * callback (e.g. from the browser using canvas/images). In Node test environments,
 * ASCII geometry and labels alone are drawn reliably.
 *
 * @param {object} [opts] Options
 * @param {'long'|'short'} [opts.flip='long'] Duplex flip mode
 * @param {number} [opts.backOffsetX=0] Horizontal offset (mm)
 * @param {number} [opts.backOffsetY=0] Vertical offset (mm)
 * @param {(doc: jsPDF, page: number) => void} [opts.drawText] Optional callback to draw explanation
 * @returns {Uint8Array}
 */
export function buildCalibrationPdf(opts = {}) {
  const {
    flip = 'long',
    backOffsetX = 0,
    backOffsetY = 0,
    drawText,
  } = opts;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const ARM_LEN = 10;
  const LINE_WIDTH = 0.2;

  // 4 grid corners and grid center
  const xLeft = GRID.marginLeft; // 14
  const xRight = GRID.marginLeft + GRID.width; // 196
  const xCenter = GRID.marginLeft + GRID.width / 2; // 105
  const yTop = GRID.marginTop; // 11
  const yBottom = GRID.marginTop + GRID.height; // 286
  const yCenter = GRID.marginTop + GRID.height / 2; // 148.5

  const centers = [
    { x: xLeft, y: yTop },
    { x: xRight, y: yTop },
    { x: xLeft, y: yBottom },
    { x: xRight, y: yBottom },
    { x: xCenter, y: yCenter },
  ];

  const drawCrosshair = (cx, cy) => {
    doc.setLineWidth(LINE_WIDTH);
    doc.setDrawColor(0, 0, 0);
    doc.line(cx - ARM_LEN, cy, cx + ARM_LEN, cy);
    doc.line(cx, cy - ARM_LEN, cx, cy + ARM_LEN);
  };

  const drawScale = (cx, cy) => {
    doc.setLineWidth(0.1);
    doc.setDrawColor(0, 0, 0);
    for (let i = -10; i <= 10; i++) {
      if (i === 0) continue;
      const t = i * 0.5;
      const isWhole = i % 2 === 0;
      const tickHalfLen = isWhole ? 1.0 : 0.5;

      // Vertical tick on horizontal axis
      doc.line(cx + t, cy - tickHalfLen, cx + t, cy + tickHalfLen);

      // Horizontal tick on vertical axis
      doc.line(cx - tickHalfLen, cy + t, cx + tickHalfLen, cy + t);
    }

    // ASCII scale numbers and captions (~4 pt)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4);
    doc.setTextColor(0, 0, 0);

    // Horizontal scale labels: -4, -2, 2, 4 mm
    for (const val of [-4, -2, 2, 4]) {
      // Labels sit in distinct quadrants so the X and Y numbers never collide:
      // -X below, +X above, -Y left, +Y right.
      doc.text(String(val), cx + val, val < 0 ? cy + 2.8 : cy - 1.8, { align: 'center' });
    }
    // Caption "+X" at the positive end of horizontal scale
    doc.text('+X', cx + 10.8, cy, { align: 'left', baseline: 'middle' });

    // Vertical scale labels: -4, -2, 2, 4 mm
    for (const val of [-4, -2, 2, 4]) {
      if (val < 0) doc.text(String(val), cx - 1.6, cy + val, { align: 'right', baseline: 'middle' });
      else doc.text(String(val), cx + 1.6, cy + val, { align: 'left', baseline: 'middle' });
    }
    // Caption "+Y" at the positive (downward) end of vertical scale
    doc.text('+Y', cx, cy + 12, { align: 'center', baseline: 'middle' });
  };

  // --- Page 1: Front ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text('FRONT - calibration sheet', 105, 6, { align: 'center' });

  for (const pt of centers) {
    drawCrosshair(pt.x, pt.y);
  }
  if (typeof drawText === 'function') {
    drawText(doc, 1);
  }

  // --- Page 2: Back ---
  doc.addPage();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  doc.text(
    'BACK - hold to light; read where the FRONT cross appears on this scale and ADD that value to the offset',
    105,
    6,
    { align: 'center' }
  );

  for (const pt of centers) {
    const backPt = mapToBack({ x: pt.x, y: pt.y, w: 0, h: 0 }, { flip, backOffsetX, backOffsetY });
    drawCrosshair(backPt.x, backPt.y);
    drawScale(backPt.x, backPt.y);
  }
  if (typeof drawText === 'function') {
    drawText(doc, 2);
  }

  return new Uint8Array(doc.output('arraybuffer'));
}
