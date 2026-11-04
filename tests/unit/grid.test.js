import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi } from 'vitest';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  CARDS_PER_SHEET_OPTIONS,
  DEFAULT_CARDS_PER_SHEET,
  gridFor,
  frontRect,
  backRect,
  mapToBack,
  paginate,
  cropMarkLines,
  holeCenter,
} from '../../src/layout.js';
import { buildCardsPdf } from '../../src/pdf.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PNG_PATH = path.resolve(__dirname, '../fixtures/tiny.png');
const DUMMY_PNG_DATA_URL = `data:image/png;base64,${fs.readFileSync(FIXTURE_PNG_PATH).toString('base64')}`;
const STANDARD_FONTS_DIR = path.resolve('node_modules/pdfjs-dist/standard_fonts/') + '/';

describe('gridFor input validation', () => {
  it('rejects 0, 5, 10.5, 19, 20, "10", null', () => {
    const invalidValues = [0, 5, 10.5, 19, 20, '10', null];
    for (const val of invalidValues) {
      expect(() => gridFor(val)).toThrow(RangeError);
    }
  });

  it('exports CARDS_PER_SHEET_OPTIONS and DEFAULT_CARDS_PER_SHEET', () => {
    expect(CARDS_PER_SHEET_OPTIONS).toEqual([4, 6, 8, 10, 12, 15, 18]);
    expect(DEFAULT_CARDS_PER_SHEET).toBe(10);
  });
});

describe('default-value regression check', () => {
  it('frontRect(9) equals frontRect(9, 10), and is x 105, y 231, w 91, h 55', () => {
    const def = frontRect(9);
    const explicit = frontRect(9, 10);
    expect(def).toEqual(explicit);
    expect(def).toEqual({ x: 105, y: 231, w: 91, h: 55 });
  });

  it('gridFor() defaults to 10 cards per sheet', () => {
    const def = gridFor();
    expect(def.cardsPerSheet).toBe(10);
    expect(def.cols).toBe(2);
    expect(def.rows).toBe(5);
    expect(def.cardWidth).toBe(91);
    expect(def.cardHeight).toBe(55);
  });
});

describe.each(CARDS_PER_SHEET_OPTIONS)('grid configuration: %d cards per sheet', (cardsPerSheet) => {
  it('cols * rows equals cardsPerSheet', () => {
    const grid = gridFor(cardsPerSheet);
    expect(grid.cols * grid.rows).toBe(cardsPerSheet);
    expect(grid.cardsPerSheet).toBe(cardsPerSheet);
  });

  it('cards do not overlap and exactly fill 182x275', () => {
    const grid = gridFor(cardsPerSheet);
    const slots = Array.from({ length: cardsPerSheet }, (_, i) => frontRect(i, cardsPerSheet));

    for (const rect of slots) {
      expect(rect.w).toBeCloseTo(grid.cardWidth, 6);
      expect(rect.h).toBeCloseTo(grid.cardHeight, 6);
    }

    const minX = Math.min(...slots.map((r) => r.x));
    const minY = Math.min(...slots.map((r) => r.y));
    const maxX = Math.max(...slots.map((r) => r.x + r.w));
    const maxY = Math.max(...slots.map((r) => r.y + r.h));

    expect(minX).toBeCloseTo(14, 4);
    expect(minY).toBeCloseTo(11, 4);
    expect(maxX).toBeCloseTo(196, 4);
    expect(maxY).toBeCloseTo(286, 4);
    expect(maxX - minX).toBeCloseTo(182, 4);
    expect(maxY - minY).toBeCloseTo(275, 4);

    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i];
        const b = slots[j];
        const sepX = a.x + a.w <= b.x + 1e-6 || b.x + b.w <= a.x + 1e-6;
        const sepY = a.y + a.h <= b.y + 1e-6 || b.y + b.h <= a.y + 1e-6;
        expect(sepX || sepY).toBe(true);
      }
    }

    const totalArea = slots.reduce((sum, r) => sum + r.w * r.h, 0);
    expect(totalArea).toBeCloseTo(182 * 275, 4);
  });

  it('slot out of range throws', () => {
    expect(() => frontRect(-1, cardsPerSheet)).toThrow(RangeError);
    expect(() => frontRect(cardsPerSheet, cardsPerSheet)).toThrow(RangeError);
    expect(() => frontRect(cardsPerSheet + 1, cardsPerSheet)).toThrow(RangeError);
    expect(() => frontRect(1.5, cardsPerSheet)).toThrow(RangeError);

    expect(() => backRect(-1, { cardsPerSheet })).toThrow(RangeError);
    expect(() => backRect(cardsPerSheet, { cardsPerSheet })).toThrow(RangeError);
    expect(() => backRect(cardsPerSheet + 1, { cardsPerSheet })).toThrow(RangeError);

    expect(() => holeCenter(-1, cardsPerSheet)).toThrow(RangeError);
    expect(() => holeCenter(cardsPerSheet, cardsPerSheet)).toThrow(RangeError);
  });

  it('for both flips, back rect is exact duplex mapping within 0.01mm and covers same positions', () => {
    const frontSlots = Array.from({ length: cardsPerSheet }, (_, i) => frontRect(i, cardsPerSheet));

    for (const flip of ['long', 'short']) {
      const backSlots = Array.from({ length: cardsPerSheet }, (_, i) =>
        backRect(i, { flip, cardsPerSheet })
      );

      for (let i = 0; i < cardsPerSheet; i++) {
        const expected = mapToBack(frontSlots[i], { flip });
        expect(Math.abs(backSlots[i].x - expected.x)).toBeLessThanOrEqual(0.01);
        expect(Math.abs(backSlots[i].y - expected.y)).toBeLessThanOrEqual(0.01);
        expect(Math.abs(backSlots[i].w - expected.w)).toBeLessThanOrEqual(0.01);
        expect(Math.abs(backSlots[i].h - expected.h)).toBeLessThanOrEqual(0.01);
      }

      const sortKey = (r) => `${Math.round(r.y * 100) / 100}_${Math.round(r.x * 100) / 100}`;
      const frontKeys = frontSlots.map(sortKey).sort();
      const backKeys = backSlots.map(sortKey).sort();
      expect(backKeys).toEqual(frontKeys);
    }
  });

  it('crop-mark count and positions match the grid lines', () => {
    const grid = gridFor(cardsPerSheet);
    const lines = cropMarkLines(cardsPerSheet);

    const expectedVertLines = grid.cols + 1;
    const expectedHorizLines = grid.rows + 1;
    const expectedCount = 2 * expectedVertLines + 2 * expectedHorizLines;
    expect(lines).toHaveLength(expectedCount);

    const expectedX = [];
    for (let col = 0; col <= grid.cols; col++) {
      expectedX.push(grid.marginLeft + col * grid.cardWidth);
    }
    const expectedY = [];
    for (let row = 0; row <= grid.rows; row++) {
      expectedY.push(grid.marginTop + row * grid.cardHeight);
    }

    const verticalMarks = lines.filter((l) => l.x1 === l.x2);
    const horizontalMarks = lines.filter((l) => l.y1 === l.y2);

    expect(verticalMarks).toHaveLength(2 * expectedVertLines);
    expect(horizontalMarks).toHaveLength(2 * expectedHorizLines);

    for (const vm of verticalMarks) {
      const matchesX = expectedX.some((x) => Math.abs(vm.x1 - x) < 0.001);
      expect(matchesX).toBe(true);
      const isTop = Math.abs(vm.y1 - 10) < 0.001 && Math.abs(vm.y2 - 5) < 0.001;
      const isBottom = Math.abs(vm.y1 - 287) < 0.001 && Math.abs(vm.y2 - 292) < 0.001;
      expect(isTop || isBottom).toBe(true);
    }

    for (const hm of horizontalMarks) {
      const matchesY = expectedY.some((y) => Math.abs(hm.y1 - y) < 0.001);
      expect(matchesY).toBe(true);
      const isLeft = Math.abs(hm.x1 - 13) < 0.001 && Math.abs(hm.x2 - 8) < 0.001;
      const isRight = Math.abs(hm.x1 - 197) < 0.001 && Math.abs(hm.x2 - 202) < 0.001;
      expect(isLeft || isRight).toBe(true);
    }
  });

  it('paginate splits correctly', () => {
    for (const count of [0, 1, cardsPerSheet, cardsPerSheet + 1, 2 * cardsPerSheet + 3]) {
      const p = paginate(count, cardsPerSheet);
      expect(p).toHaveLength(count);
      for (let i = 0; i < count; i++) {
        expect(p[i].sheet).toBe(Math.floor(i / cardsPerSheet));
        expect(p[i].slot).toBe(i % cardsPerSheet);
        expect(p[i].index).toBe(i);
      }
    }
  });

  it('real buildCardsPdf yields expected page count and passes card sizes to callback', async () => {
    const grid = gridFor(cardsPerSheet);
    const numCards = cardsPerSheet + 1;
    const cards = Array.from({ length: numCards }, (_, i) => ({
      front: `Front ${i}`,
      back: `Back ${i}`,
    }));

    const renderCalls = [];
    const renderFace = vi.fn(async (text, opts) => {
      renderCalls.push({ text, opts });
      return DUMMY_PNG_DATA_URL;
    });

    const pdfBytes = await buildCardsPdf(cards, renderFace, {
      cardsPerSheet,
      hole: true,
      flip: 'long',
    });

    const pdf = await pdfjsLib.getDocument({
      data: pdfBytes,
      standardFontDataUrl: STANDARD_FONTS_DIR,
    }).promise;
    expect(pdf.numPages).toBe(4);

    expect(renderCalls).toHaveLength(numCards * 2);
    for (const call of renderCalls) {
      expect(call.opts.cardWidthMm).toBeCloseTo(grid.cardWidth, 4);
      expect(call.opts.cardHeightMm).toBeCloseTo(grid.cardHeight, 4);
    }
  });
});
