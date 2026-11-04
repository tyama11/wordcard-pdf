import {
  CARDS_PER_SHEET_OPTIONS,
  DEFAULT_CARDS_PER_SHEET,
} from './layout.js';

export const STORAGE_KEYS = {
  cardsPerSheet: 'wordcard_cardsPerSheet',
  flip: 'wordcard_flip',
  backOffsetX: 'wordcard_backOffsetX',
  backOffsetY: 'wordcard_backOffsetY',
  cropMarks: 'wordcard_cropMarks',
  hole: 'wordcard_hole',
  holeGuide: 'wordcard_holeGuide',
};

/**
 * Clamps offset value to [-5.0, 5.0].
 * @param {number} val
 * @returns {number}
 */
export function clampOffset(val) {
  if (isNaN(val)) return 0;
  return Math.max(-5.0, Math.min(5.0, Math.round(val * 10) / 10));
}

/**
 * Reads settings from localStorage, returning validated values or null for missing or invalid ones.
 * cardsPerSheet falls back to DEFAULT_CARDS_PER_SHEET if missing or invalid.
 * @returns {{
 *   cardsPerSheet: number,
 *   flip: 'long'|'short'|null,
 *   backOffsetX: number|null,
 *   backOffsetY: number|null,
 *   cropMarks: boolean|null,
 *   hole: boolean|null,
 *   holeGuide: 'none'|'first'|'all'|null
 * }}
 */
export function readSettings() {
  try {
    const savedCardsPerSheet = localStorage.getItem(STORAGE_KEYS.cardsPerSheet);
    const parsedCardsPerSheet = parseInt(savedCardsPerSheet, 10);
    const cardsPerSheet = CARDS_PER_SHEET_OPTIONS.includes(parsedCardsPerSheet)
      ? parsedCardsPerSheet
      : DEFAULT_CARDS_PER_SHEET;

    const savedFlip = localStorage.getItem(STORAGE_KEYS.flip);
    const flip = savedFlip === 'long' || savedFlip === 'short' ? savedFlip : null;

    const savedX = localStorage.getItem(STORAGE_KEYS.backOffsetX);
    let backOffsetX = null;
    if (savedX !== null) {
      const val = parseFloat(savedX);
      if (!isNaN(val)) {
        backOffsetX = clampOffset(val);
      }
    }

    const savedY = localStorage.getItem(STORAGE_KEYS.backOffsetY);
    let backOffsetY = null;
    if (savedY !== null) {
      const val = parseFloat(savedY);
      if (!isNaN(val)) {
        backOffsetY = clampOffset(val);
      }
    }

    const savedCropMarks = localStorage.getItem(STORAGE_KEYS.cropMarks);
    let cropMarks = null;
    if (savedCropMarks === 'true') {
      cropMarks = true;
    } else if (savedCropMarks === 'false') {
      cropMarks = false;
    }

    const savedHole = localStorage.getItem(STORAGE_KEYS.hole);
    let hole = null;
    if (savedHole === 'true') {
      hole = true;
    } else if (savedHole === 'false') {
      hole = false;
    }

    const savedHoleGuide = localStorage.getItem(STORAGE_KEYS.holeGuide);
    const holeGuide =
      savedHoleGuide === 'none' || savedHoleGuide === 'first' || savedHoleGuide === 'all'
        ? savedHoleGuide
        : null;

    return {
      cardsPerSheet,
      flip,
      backOffsetX,
      backOffsetY,
      cropMarks,
      hole,
      holeGuide,
    };
  } catch (e) {
    console.warn('localStorage is unavailable:', e);
    return {
      cardsPerSheet: DEFAULT_CARDS_PER_SHEET,
      flip: null,
      backOffsetX: null,
      backOffsetY: null,
      cropMarks: null,
      hole: null,
      holeGuide: null,
    };
  }
}

/**
 * Writes settings to localStorage wrapped in try/catch.
 * @param {Partial<{
 *   cardsPerSheet: number|string,
 *   flip: string,
 *   backOffsetX: number|string,
 *   backOffsetY: number|string,
 *   cropMarks: boolean|string,
 *   hole: boolean|string,
 *   holeGuide: string
 * }>} values
 */
export function writeSettings(values = {}) {
  if (!values || typeof values !== 'object') return;
  try {
    if (values.cardsPerSheet !== undefined) {
      localStorage.setItem(STORAGE_KEYS.cardsPerSheet, String(values.cardsPerSheet));
    }
    if (values.flip !== undefined) {
      localStorage.setItem(STORAGE_KEYS.flip, String(values.flip));
    }
    if (values.backOffsetX !== undefined) {
      localStorage.setItem(STORAGE_KEYS.backOffsetX, String(values.backOffsetX));
    }
    if (values.backOffsetY !== undefined) {
      localStorage.setItem(STORAGE_KEYS.backOffsetY, String(values.backOffsetY));
    }
    if (values.cropMarks !== undefined) {
      localStorage.setItem(STORAGE_KEYS.cropMarks, String(values.cropMarks));
    }
    if (values.hole !== undefined) {
      localStorage.setItem(STORAGE_KEYS.hole, String(values.hole));
    }
    if (values.holeGuide !== undefined) {
      localStorage.setItem(STORAGE_KEYS.holeGuide, String(values.holeGuide));
    }
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
  }
}
