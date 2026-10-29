import { describe, it, expect } from 'vitest';
import {
  CARD,
  GRID,
  HOLE,
  BASE_PADDING,
  frontRect,
  backRect,
  mapToBack,
  holeSide,
  facePadding,
  holeCenter,
} from '../../src/layout.js';

describe('hole geometry and exports', () => {
  it('exports constants with expected values', () => {
    expect(HOLE).toEqual({ diameter: 6, centerFromEdge: 8, clearance: 2 });
    expect(BASE_PADDING).toBe(4);
  });

  describe('holeSide', () => {
    it('returns left for front face', () => {
      expect(holeSide('front')).toBe('left');
      expect(holeSide('front', 'long')).toBe('left');
      expect(holeSide('front', 'short')).toBe('left');
    });

    it('returns right for back face with long-edge flip', () => {
      expect(holeSide('back', 'long')).toBe('right');
      expect(holeSide('back')).toBe('right');
    });

    it('returns left for back face with short-edge flip', () => {
      expect(holeSide('back', 'short')).toBe('left');
    });

    it('throws for unknown face', () => {
      expect(() => holeSide('unknown')).toThrow();
      expect(() => holeSide('top')).toThrow();
    });

    it('throws for unknown flip', () => {
      expect(() => holeSide('front', 'diagonal')).toThrow();
      expect(() => holeSide('back', 'invalid')).toThrow();
    });
  });

  describe('facePadding', () => {
    const holePad = HOLE.centerFromEdge + HOLE.diameter / 2 + HOLE.clearance; // 8 + 3 + 2 = 13

    it('returns all BASE_PADDING when side is null or undefined', () => {
      expect(facePadding()).toEqual({ top: 4, right: 4, bottom: 4, left: 4 });
      expect(facePadding(undefined)).toEqual({ top: 4, right: 4, bottom: 4, left: 4 });
      expect(facePadding(null)).toEqual({ top: 4, right: 4, bottom: 4, left: 4 });
    });

    it('pads left side when side is left', () => {
      expect(facePadding('left')).toEqual({
        top: 4,
        right: 4,
        bottom: 4,
        left: holePad,
      });
    });

    it('pads right side when side is right', () => {
      expect(facePadding('right')).toEqual({
        top: 4,
        right: holePad,
        bottom: 4,
        left: 4,
      });
    });

    it('throws for invalid side values', () => {
      expect(() => facePadding('top')).toThrow();
      expect(() => facePadding('bottom')).toThrow();
      expect(() => facePadding('')).toThrow();
      expect(() => facePadding(123)).toThrow();
    });
  });

  describe('holeCenter', () => {
    it('computes expected values for slot 0 and slot 1', () => {
      expect(holeCenter(0)).toEqual({ x: 22, y: 38.5 });
      expect(holeCenter(1)).toEqual({ x: 113, y: 38.5 });
    });

    it('computes center for all slots accurately', () => {
      for (let s = 0; s < GRID.cardsPerSheet; s++) {
        const rect = frontRect(s);
        expect(holeCenter(s)).toEqual({
          x: rect.x + HOLE.centerFromEdge,
          y: rect.y + CARD.height / 2,
        });
      }
    });
  });

  describe('mapToBack duplex alignment test', () => {
    it('mapToBack(holeCenter) lies inside backRect on holeSide at distance 8 mm for all slots and flips', () => {
      const flips = ['long', 'short'];

      for (const flip of flips) {
        for (let s = 0; s < GRID.cardsPerSheet; s++) {
          const frontCenter = holeCenter(s);
          const backHolePoint = mapToBack(
            { x: frontCenter.x, y: frontCenter.y, w: 0, h: 0 },
            { flip }
          );
          const bRect = backRect(s, { flip });
          const side = holeSide('back', flip);

          // Point must lie inside backRect
          expect(backHolePoint.x).toBeGreaterThanOrEqual(bRect.x);
          expect(backHolePoint.x).toBeLessThanOrEqual(bRect.x + bRect.w);
          expect(backHolePoint.y).toBeGreaterThanOrEqual(bRect.y);
          expect(backHolePoint.y).toBeLessThanOrEqual(bRect.y + bRect.h);

          // Check distance from that edge
          if (side === 'right') {
            const distFromRight = (bRect.x + bRect.w) - backHolePoint.x;
            expect(distFromRight).toBeCloseTo(HOLE.centerFromEdge, 5);
          } else if (side === 'left') {
            const distFromLeft = backHolePoint.x - bRect.x;
            expect(distFromLeft).toBeCloseTo(HOLE.centerFromEdge, 5);
          }

          // Vertically centered within backRect
          const centerY = bRect.y + bRect.h / 2;
          expect(backHolePoint.y).toBeCloseTo(centerY, 5);
        }
      }
    });
  });
});
