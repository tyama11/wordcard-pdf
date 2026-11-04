import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  readSettings,
  writeSettings,
  clampOffset,
  STORAGE_KEYS,
} from '../../src/settings.js';
import { DEFAULT_CARDS_PER_SHEET } from '../../src/layout.js';

describe('settings module', () => {
  let mockStore = {};
  let shouldThrow = false;

  const mockLocalStorage = {
    getItem: vi.fn((key) => {
      if (shouldThrow) {
        throw new Error('localStorage is disabled');
      }
      return Object.prototype.hasOwnProperty.call(mockStore, key) ? mockStore[key] : null;
    }),
    setItem: vi.fn((key, value) => {
      if (shouldThrow) {
        throw new Error('localStorage is full');
      }
      mockStore[key] = String(value);
    }),
    removeItem: vi.fn((key) => {
      if (shouldThrow) {
        throw new Error('localStorage error');
      }
      delete mockStore[key];
    }),
    clear: vi.fn(() => {
      if (shouldThrow) {
        throw new Error('localStorage error');
      }
      mockStore = {};
    }),
  };

  beforeEach(() => {
    mockStore = {};
    shouldThrow = false;
    vi.stubGlobal('localStorage', mockLocalStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('clampOffset', () => {
    it('clamps values between -5.0 and 5.0 and rounds to one decimal place', () => {
      expect(clampOffset(0)).toBe(0);
      expect(clampOffset(1.23)).toBe(1.2);
      expect(clampOffset(1.26)).toBe(1.3);
      expect(clampOffset(-2.45)).toBe(-2.4); // or -2.5 depending on round, Math.round(-24.5) is -24
      expect(clampOffset(10)).toBe(5.0);
      expect(clampOffset(-10)).toBe(-5.0);
      expect(clampOffset(5.0)).toBe(5.0);
      expect(clampOffset(-5.0)).toBe(-5.0);
    });

    it('returns 0 for NaN', () => {
      expect(clampOffset(NaN)).toBe(0);
    });
  });

  describe('readSettings', () => {
    it('returns default cardsPerSheet and null for all other keys when storage is empty', () => {
      const settings = readSettings();
      expect(settings).toEqual({
        cardsPerSheet: DEFAULT_CARDS_PER_SHEET,
        flip: null,
        backOffsetX: null,
        backOffsetY: null,
        cropMarks: null,
        hole: null,
        holeGuide: null,
      });
    });

    it('returns validated values when storage has valid values', () => {
      mockStore[STORAGE_KEYS.cardsPerSheet] = '6';
      mockStore[STORAGE_KEYS.flip] = 'short';
      mockStore[STORAGE_KEYS.backOffsetX] = '1.2';
      mockStore[STORAGE_KEYS.backOffsetY] = '-0.5';
      mockStore[STORAGE_KEYS.cropMarks] = 'false';
      mockStore[STORAGE_KEYS.hole] = 'false';
      mockStore[STORAGE_KEYS.holeGuide] = 'all';

      const settings = readSettings();
      expect(settings).toEqual({
        cardsPerSheet: 6,
        flip: 'short',
        backOffsetX: 1.2,
        backOffsetY: -0.5,
        cropMarks: false,
        hole: false,
        holeGuide: 'all',
      });
    });

    it('accepts valid cardsPerSheet options and falls back to default for invalid ones', () => {
      for (const opt of [4, 6, 8, 10, 12, 15, 18]) {
        mockStore[STORAGE_KEYS.cardsPerSheet] = String(opt);
        expect(readSettings().cardsPerSheet).toBe(opt);
      }

      for (const invalid of ['5', '24', 'abc', '-1', '100', '']) {
        mockStore[STORAGE_KEYS.cardsPerSheet] = invalid;
        expect(readSettings().cardsPerSheet).toBe(DEFAULT_CARDS_PER_SHEET);
      }
    });

    it('validates flip options and returns null for invalid values', () => {
      mockStore[STORAGE_KEYS.flip] = 'long';
      expect(readSettings().flip).toBe('long');

      mockStore[STORAGE_KEYS.flip] = 'short';
      expect(readSettings().flip).toBe('short');

      mockStore[STORAGE_KEYS.flip] = 'sideways';
      expect(readSettings().flip).toBe(null);

      mockStore[STORAGE_KEYS.flip] = '';
      expect(readSettings().flip).toBe(null);
    });

    it('clamps backOffsetX and backOffsetY and returns null for invalid values', () => {
      mockStore[STORAGE_KEYS.backOffsetX] = '7.5';
      mockStore[STORAGE_KEYS.backOffsetY] = '-8.2';
      expect(readSettings().backOffsetX).toBe(5.0);
      expect(readSettings().backOffsetY).toBe(-5.0);

      mockStore[STORAGE_KEYS.backOffsetX] = 'not-a-number';
      mockStore[STORAGE_KEYS.backOffsetY] = '';
      expect(readSettings().backOffsetX).toBe(null);
      expect(readSettings().backOffsetY).toBe(null);
    });

    it('validates boolean settings for cropMarks and hole', () => {
      mockStore[STORAGE_KEYS.cropMarks] = 'true';
      mockStore[STORAGE_KEYS.hole] = 'false';
      expect(readSettings().cropMarks).toBe(true);
      expect(readSettings().hole).toBe(false);

      mockStore[STORAGE_KEYS.cropMarks] = 'false';
      mockStore[STORAGE_KEYS.hole] = 'true';
      expect(readSettings().cropMarks).toBe(false);
      expect(readSettings().hole).toBe(true);

      mockStore[STORAGE_KEYS.cropMarks] = 'invalid';
      mockStore[STORAGE_KEYS.hole] = 'yes';
      expect(readSettings().cropMarks).toBe(null);
      expect(readSettings().hole).toBe(null);
    });

    it('validates holeGuide options and returns null for invalid values', () => {
      for (const valid of ['none', 'first', 'all']) {
        mockStore[STORAGE_KEYS.holeGuide] = valid;
        expect(readSettings().holeGuide).toBe(valid);
      }

      for (const invalid of ['custom', 'last', '1', '']) {
        mockStore[STORAGE_KEYS.holeGuide] = invalid;
        expect(readSettings().holeGuide).toBe(null);
      }
    });

    it('catches localStorage errors and returns defaults/nulls when storage throws', () => {
      shouldThrow = true;
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const settings = readSettings();
      expect(settings).toEqual({
        cardsPerSheet: DEFAULT_CARDS_PER_SHEET,
        flip: null,
        backOffsetX: null,
        backOffsetY: null,
        cropMarks: null,
        hole: null,
        holeGuide: null,
      });
      expect(warnSpy).toHaveBeenCalledWith('localStorage is unavailable:', expect.any(Error));
    });
  });

  describe('writeSettings', () => {
    it('writes all values to localStorage with corresponding keys', () => {
      writeSettings({
        cardsPerSheet: 18,
        flip: 'short',
        backOffsetX: '2.0',
        backOffsetY: '-1.5',
        cropMarks: false,
        hole: true,
        holeGuide: 'none',
      });

      expect(mockStore[STORAGE_KEYS.cardsPerSheet]).toBe('18');
      expect(mockStore[STORAGE_KEYS.flip]).toBe('short');
      expect(mockStore[STORAGE_KEYS.backOffsetX]).toBe('2.0');
      expect(mockStore[STORAGE_KEYS.backOffsetY]).toBe('-1.5');
      expect(mockStore[STORAGE_KEYS.cropMarks]).toBe('false');
      expect(mockStore[STORAGE_KEYS.hole]).toBe('true');
      expect(mockStore[STORAGE_KEYS.holeGuide]).toBe('none');
    });

    it('handles partial updates without touching other keys', () => {
      mockStore[STORAGE_KEYS.cardsPerSheet] = '10';
      writeSettings({ flip: 'long' });

      expect(mockStore[STORAGE_KEYS.cardsPerSheet]).toBe('10');
      expect(mockStore[STORAGE_KEYS.flip]).toBe('long');
    });

    it('catches localStorage errors when storage throws on write', () => {
      shouldThrow = true;
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => {
        writeSettings({ flip: 'short' });
      }).not.toThrow();

      expect(warnSpy).toHaveBeenCalledWith('Failed to save to localStorage:', expect.any(Error));
    });

    it('safely ignores null or invalid input', () => {
      expect(() => writeSettings(null)).not.toThrow();
      expect(() => writeSettings(undefined)).not.toThrow();
      expect(() => writeSettings('string')).not.toThrow();
    });
  });
});
