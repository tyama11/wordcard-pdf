import { describe, it, expect } from 'vitest';
import {
  PAGE,
  CARD,
  GRID,
  frontRect,
  backRect,
  mapToBack,
  paginate,
  cropMarkLines,
} from '../../src/layout.js';

describe('layout.js', () => {
  it('all 10 slots inside page and non-overlapping', () => {
    const slots = [];
    for (let i = 0; i < 10; i++) {
      slots.push(frontRect(i));
    }

    // Inside page bounds
    for (const rect of slots) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.w).toBeLessThanOrEqual(PAGE.width);
      expect(rect.y + rect.h).toBeLessThanOrEqual(PAGE.height);
      expect(rect.w).toBe(91);
      expect(rect.h).toBe(55);
    }

    // Non-overlapping
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i];
        const b = slots[j];
        const separatesHorizontally = a.x + a.w <= b.x || b.x + b.w <= a.x;
        const separatesVertically = a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(separatesHorizontally || separatesVertically).toBe(true);
      }
    }
  });

  it('grid exactly fills 182x275 starting at (14,11)', () => {
    const slots = Array.from({ length: 10 }, (_, i) => frontRect(i));
    const minX = Math.min(...slots.map((r) => r.x));
    const minY = Math.min(...slots.map((r) => r.y));
    const maxX = Math.max(...slots.map((r) => r.x + r.w));
    const maxY = Math.max(...slots.map((r) => r.y + r.h));

    expect(minX).toBe(14);
    expect(minY).toBe(11);
    expect(maxX - minX).toBe(182);
    expect(maxY - minY).toBe(275);
    expect(maxX).toBe(196);
    expect(maxY).toBe(286);

    // Sum of slot areas equals grid area (no gaps)
    const totalSlotArea = slots.reduce((acc, r) => acc + r.w * r.h, 0);
    expect(totalSlotArea).toBe(182 * 275);
  });

  it('backRect for long & short flip equals formula', () => {
    for (let slot = 0; slot < 10; slot++) {
      const front = frontRect(slot);

      // Long flip: xb = W - x - w, yb = y
      const longBack = backRect(slot, { flip: 'long' });
      expect(longBack).toEqual({
        x: PAGE.width - front.x - front.w,
        y: front.y,
        w: front.w,
        h: front.h,
      });

      // Short flip: xb = x, yb = H - y - h
      const shortBack = backRect(slot, { flip: 'short' });
      expect(shortBack).toEqual({
        x: front.x,
        y: PAGE.height - front.y - front.h,
        w: front.w,
        h: front.h,
      });
    }
  });

  it('mapToBack is an involution with zero offset (mapping twice returns original)', () => {
    const testCases = [
      { x: 14, y: 11, w: 91, h: 55 },
      { x: 105, y: 66, w: 91, h: 55 },
      { x: 50, y: 120, w: 30, h: 40 },
      { x: 105, y: 148.5, w: 0, h: 0 },
      { x: 0, y: 0, w: 210, h: 297 },
    ];

    for (const flip of ['long', 'short']) {
      for (const rect of testCases) {
        const once = mapToBack(rect, { flip, backOffsetX: 0, backOffsetY: 0 });
        const twice = mapToBack(once, { flip, backOffsetX: 0, backOffsetY: 0 });
        expect(twice).toEqual(rect);
      }
    }
  });

  it('with zero offset the SET of back rects equals the set of front rects', () => {
    const sortRects = (arr) =>
      [...arr].sort((a, b) => a.y - b.y || a.x - b.x);

    const frontRects = sortRects(Array.from({ length: 10 }, (_, i) => frontRect(i)));

    const longBackRects = sortRects(
      Array.from({ length: 10 }, (_, i) => backRect(i, { flip: 'long' }))
    );
    expect(longBackRects).toEqual(frontRects);

    const shortBackRects = sortRects(
      Array.from({ length: 10 }, (_, i) => backRect(i, { flip: 'short' }))
    );
    expect(shortBackRects).toEqual(frontRects);
  });

  it('long flip moves col 0 <-> col 1 in same row', () => {
    for (let row = 0; row < 5; row++) {
      const col0Slot = row * 2;
      const col1Slot = row * 2 + 1;

      const col0Front = frontRect(col0Slot);
      const col1Front = frontRect(col1Slot);

      const col0Back = backRect(col0Slot, { flip: 'long' });
      const col1Back = backRect(col1Slot, { flip: 'long' });

      // col 0 back lands on col 1 front
      expect(col0Back).toEqual(col1Front);
      // col 1 back lands on col 0 front
      expect(col1Back).toEqual(col0Front);

      // Same row (y coordinate preserved)
      expect(col0Back.y).toBe(col0Front.y);
      expect(col1Back.y).toBe(col1Front.y);
    }
  });

  it('offsets are applied', () => {
    const offsetX = 1.7;
    const offsetY = -2.4;

    for (let slot = 0; slot < 10; slot++) {
      const baseLong = backRect(slot, { flip: 'long' });
      const offsetLong = backRect(slot, {
        flip: 'long',
        backOffsetX: offsetX,
        backOffsetY: offsetY,
      });

      expect(offsetLong.x).toBeCloseTo(baseLong.x + offsetX, 10);
      expect(offsetLong.y).toBeCloseTo(baseLong.y + offsetY, 10);
      expect(offsetLong.w).toBe(baseLong.w);
      expect(offsetLong.h).toBe(baseLong.h);

      const baseShort = backRect(slot, { flip: 'short' });
      const offsetShort = backRect(slot, {
        flip: 'short',
        backOffsetX: offsetX,
        backOffsetY: offsetY,
      });

      expect(offsetShort.x).toBeCloseTo(baseShort.x + offsetX, 10);
      expect(offsetShort.y).toBeCloseTo(baseShort.y + offsetY, 10);
    }
  });

  it('paginate for n = 0, 1, 10, 11, 25', () => {
    expect(paginate(0)).toEqual([]);

    expect(paginate(1)).toEqual([{ sheet: 0, slot: 0, index: 0 }]);

    const p10 = paginate(10);
    expect(p10).toHaveLength(10);
    for (let i = 0; i < 10; i++) {
      expect(p10[i]).toEqual({ sheet: 0, slot: i, index: i });
    }

    const p11 = paginate(11);
    expect(p11).toHaveLength(11);
    for (let i = 0; i < 10; i++) {
      expect(p11[i]).toEqual({ sheet: 0, slot: i, index: i });
    }
    expect(p11[10]).toEqual({ sheet: 1, slot: 0, index: 10 });

    const p25 = paginate(25);
    expect(p25).toHaveLength(25);
    for (let i = 0; i < 10; i++) {
      expect(p25[i]).toEqual({ sheet: 0, slot: i, index: i });
      expect(p25[i + 10]).toEqual({ sheet: 1, slot: i, index: i + 10 });
    }
    for (let i = 0; i < 5; i++) {
      expect(p25[20 + i]).toEqual({ sheet: 2, slot: i, index: 20 + i });
    }
  });

  it('cropMarkLines returns 18 valid segments in front coordinates', () => {
    const lines = cropMarkLines();
    expect(lines).toHaveLength(18);

    for (const line of lines) {
      expect(line.x1).toBeGreaterThanOrEqual(0);
      expect(line.x1).toBeLessThanOrEqual(PAGE.width);
      expect(line.x2).toBeGreaterThanOrEqual(0);
      expect(line.x2).toBeLessThanOrEqual(PAGE.width);
      expect(line.y1).toBeGreaterThanOrEqual(0);
      expect(line.y1).toBeLessThanOrEqual(PAGE.height);
      expect(line.y2).toBeGreaterThanOrEqual(0);
      expect(line.y2).toBeLessThanOrEqual(PAGE.height);

      // Either purely horizontal or purely vertical
      const isHorizontal = line.y1 === line.y2 && Math.abs(line.x1 - line.x2) === 5;
      const isVertical = line.x1 === line.x2 && Math.abs(line.y1 - line.y2) === 5;
      expect(isHorizontal || isVertical).toBe(true);
    }
  });
});
