/**
 * Layout constants and geometry for duplex A4 business card sheets.
 * Units: mm.
 */

export const PAGE = {
  width: 210,
  height: 297,
  w: 210,
  h: 297,
};

export const CARD = {
  width: 91,
  height: 55,
  w: 91,
  h: 55,
};

export const GRID = {
  cols: 2,
  rows: 5,
  cardsPerSheet: 10,
  marginLeft: 14,
  marginTop: 11,
  width: 182,
  height: 275,
  w: 182,
  h: 275,
  x: 14,
  y: 11,
};

/**
 * Returns the front-face rect {x, y, w, h} (in mm) for a card slot (0..9).
 * Origin is the top-left of the page, y downward.
 *
 * @param {number} slot Slot index 0..9 on a sheet
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
export function frontRect(slot) {
  if (slot < 0 || slot >= GRID.cardsPerSheet) {
    throw new RangeError(`Invalid slot index: ${slot}. Must be 0..9.`);
  }
  const col = slot % GRID.cols;
  const row = Math.floor(slot / GRID.cols);
  return {
    x: GRID.marginLeft + col * CARD.width,
    y: GRID.marginTop + row * CARD.height,
    w: CARD.width,
    h: CARD.height,
  };
}

/**
 * Duplex mapping for a front rect or point onto the back side of the page.
 * Works for any rect or point (w = h = 0).
 *
 * @param {{ x: number, y: number, w?: number, h?: number, width?: number, height?: number }} rect
 * @param {object} [opts]
 * @param {'long'|'short'} [opts.flip='long'] Long-edge or short-edge binding
 * @param {number} [opts.backOffsetX=0] User calibration offset X in mm
 * @param {number} [opts.backOffsetY=0] User calibration offset Y in mm
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
export function mapToBack(rect, opts = {}) {
  const {
    flip = 'long',
    backOffsetX = 0,
    backOffsetY = 0,
  } = opts;

  const w = rect.w ?? rect.width ?? 0;
  const h = rect.h ?? rect.height ?? 0;

  let xb;
  let yb;

  if (flip === 'long') {
    xb = PAGE.width - rect.x - w;
    yb = rect.y;
  } else if (flip === 'short') {
    xb = rect.x;
    yb = PAGE.height - rect.y - h;
  } else {
    throw new Error(`Unknown flip option: "${flip}". Must be 'long' or 'short'.`);
  }

  xb += backOffsetX;
  yb += backOffsetY;

  return { x: xb, y: yb, w, h };
}

/**
 * Returns the back-face rect {x, y, w, h} (in mm) for a card slot (0..9).
 *
 * @param {number} slot Slot index 0..9 on a sheet
 * @param {object} [opts]
 * @param {'long'|'short'} [opts.flip='long'] Long-edge or short-edge binding
 * @param {number} [opts.backOffsetX=0] User calibration offset X in mm
 * @param {number} [opts.backOffsetY=0] User calibration offset Y in mm
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
export function backRect(slot, opts = {}) {
  const front = frontRect(slot);
  return mapToBack(front, opts);
}

/**
 * Paginates n cards into sheets and slots.
 *
 * @param {number} n Total number of cards
 * @returns {Array<{ sheet: number, slot: number, index: number }>}
 */
export function paginate(n) {
  const result = [];
  for (let i = 0; i < n; i++) {
    result.push({
      sheet: Math.floor(i / GRID.cardsPerSheet),
      slot: i % GRID.cardsPerSheet,
      index: i,
    });
  }
  return result;
}

/**
 * Returns the crop mark line segments in front coordinates.
 * Crop marks are drawn at every grid line, starting 1 mm outside the grid
 * and 5 mm long (clipped to the page).
 *
 * @returns {Array<{ x1: number, y1: number, x2: number, y2: number }>}
 */
export function cropMarkLines() {
  const lines = [];

  const clampX = (v) => Math.max(0, Math.min(PAGE.width, v));
  const clampY = (v) => Math.max(0, Math.min(PAGE.height, v));

  // Vertical grid lines (x = 14, 105, 196)
  const xGridLines = [
    GRID.marginLeft,
    GRID.marginLeft + CARD.width,
    GRID.marginLeft + 2 * CARD.width,
  ];

  // Horizontal grid lines (y = 11, 66, 121, 176, 231, 286)
  const yGridLines = [];
  for (let row = 0; row <= GRID.rows; row++) {
    yGridLines.push(GRID.marginTop + row * CARD.height);
  }

  // Vertical marks in top & bottom margins
  for (const x of xGridLines) {
    // Top margin: starts 1 mm above grid (y = 10), 5 mm long upwards (to y = 5)
    lines.push({
      x1: clampX(x),
      y1: clampY(GRID.marginTop - 1),
      x2: clampX(x),
      y2: clampY(GRID.marginTop - 1 - 5),
    });
    // Bottom margin: starts 1 mm below grid (y = 287), 5 mm long downwards (to y = 292)
    const gridBottom = GRID.marginTop + GRID.height;
    lines.push({
      x1: clampX(x),
      y1: clampY(gridBottom + 1),
      x2: clampX(x),
      y2: clampY(gridBottom + 1 + 5),
    });
  }

  // Horizontal marks in left & right margins
  for (const y of yGridLines) {
    // Left margin: starts 1 mm left of grid (x = 13), 5 mm long leftwards (to x = 8)
    lines.push({
      x1: clampX(GRID.marginLeft - 1),
      y1: clampY(y),
      x2: clampX(GRID.marginLeft - 1 - 5),
      y2: clampY(y),
    });
    // Right margin: starts 1 mm right of grid (x = 197), 5 mm long rightwards (to x = 202)
    const gridRight = GRID.marginLeft + GRID.width;
    lines.push({
      x1: clampX(gridRight + 1),
      y1: clampY(y),
      x2: clampX(gridRight + 1 + 5),
      y2: clampY(y),
    });
  }

  return lines;
}
