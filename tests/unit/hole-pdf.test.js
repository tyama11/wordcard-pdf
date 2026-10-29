import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi } from 'vitest';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildCardsPdf } from '../../src/pdf.js';
import { holeCenter, HOLE } from '../../src/layout.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PNG_PATH = path.resolve(__dirname, '../fixtures/tiny.png');
const DUMMY_PNG_DATA_URL = `data:image/png;base64,${fs.readFileSync(FIXTURE_PNG_PATH).toString('base64')}`;
const STANDARD_FONTS_DIR = path.resolve('node_modules/pdfjs-dist/standard_fonts/') + '/';

/**
 * Approach for detecting hole punch guides from the PDF operator list:
 *
 * 1. Style & Stroke Color:
 *    Hole guides are styled with gray stroke RGB(150, 150, 150) (hex `#969696` in pdfjs)
 *    and line width 0.2 mm. Crop marks use black (`#000000`) and line width 0.1 mm.
 *
 * 2. Circle Geometry (constructPath with bezier curves):
 *    jsPDF renders `doc.circle(cx, cy, 3, 'S')` as a single path containing 4 cubic bezier
 *    curves (op code 2). In pdfjs-dist's operator list, this constructPath has subpath length 31
 *    (Float32Array) with a bounding box of size HOLE.diameter = 6 mm.
 *    The circle's center coordinates in mm can be derived from its bounding box:
 *      cx = ((bbox[0] + bbox[2]) / 2) / k
 *      cy = (pageHeightPt / k) - ((bbox[1] + bbox[3]) / 2) / k
 *
 * 3. Cross Geometry:
 *    Centered at (cx, cy), two perpendicular 2 mm lines follow the circle in the operator list.
 *
 * This function extracts all hole punch guides on a page by identifying gray-stroked circle paths
 * and computing their (cx, cy) coordinates in page mm.
 */
function extractHoleGuides(ops, pageView) {
  const k = 72 / 25.4;
  const pageHeightPt = pageView[3];
  const guides = [];
  let currentStrokeColor = null;

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];

    if (fn === pdfjsLib.OPS.setStrokeRGBColor) {
      currentStrokeColor = args[0];
    } else if (fn === pdfjsLib.OPS.constructPath) {
      const subpaths = args[1];
      // A jsPDF circle produces a subpath of 31 floats (moveTo + 4 cubic bezier curves)
      const isCircle = Array.isArray(subpaths) && subpaths.some((sp) => sp.length === 31);
      const isGray = currentStrokeColor === '#969696';

      if (isCircle && isGray) {
        const bbox = args[2];
        const minX = bbox[0] / k;
        const minY = bbox[1] / k;
        const maxX = bbox[2] / k;
        const maxY = bbox[3] / k;
        const cx = (minX + maxX) / 2;
        const cy = pageHeightPt / k - (minY + maxY) / 2;
        const diameter = maxX - minX;

        // Check that cross lines follow the circle
        const hasCross =
          i + 2 < ops.fnArray.length &&
          ops.fnArray[i + 1] === pdfjsLib.OPS.constructPath &&
          ops.fnArray[i + 2] === pdfjsLib.OPS.constructPath;

        guides.push({ cx, cy, diameter, hasCross, opIndex: i });
      }
    }
  }

  return guides;
}

/**
 * Counts occurrences of gray stroke color (#969696) in the operator list.
 */
function countGrayStrokeOps(ops) {
  let count = 0;
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] === pdfjsLib.OPS.setStrokeRGBColor && ops.argsArray[i][0] === '#969696') {
      count++;
    }
  }
  return count;
}

describe('hole-pdf.js', () => {
  describe('(a) renderFace options argument', () => {
    it('passes { holeSide: "left" } for front and { holeSide: "right" } for back with hole: true and flip: "long"', async () => {
      const calls = [];
      const renderFace = vi.fn(async (text, opts) => {
        calls.push({ text, opts });
        return DUMMY_PNG_DATA_URL;
      });

      const cards = [{ front: 'Card1 F', back: 'Card1 B' }];
      await buildCardsPdf(cards, renderFace, { hole: true, flip: 'long' });

      expect(calls).toHaveLength(2);
      expect(calls[0]).toEqual({ text: 'Card1 F', opts: { holeSide: 'left' } });
      expect(calls[1]).toEqual({ text: 'Card1 B', opts: { holeSide: 'right' } });
    });

    it('passes { holeSide: "left" } for front and { holeSide: "left" } for back with hole: true and flip: "short"', async () => {
      const calls = [];
      const renderFace = vi.fn(async (text, opts) => {
        calls.push({ text, opts });
        return DUMMY_PNG_DATA_URL;
      });

      const cards = [{ front: 'Card1 F', back: 'Card1 B' }];
      await buildCardsPdf(cards, renderFace, { hole: true, flip: 'short' });

      expect(calls).toHaveLength(2);
      expect(calls[0]).toEqual({ text: 'Card1 F', opts: { holeSide: 'left' } });
      expect(calls[1]).toEqual({ text: 'Card1 B', opts: { holeSide: 'left' } });
    });

    it('passes { holeSide: null } for all faces when hole: false', async () => {
      const callsLong = [];
      const renderFaceLong = vi.fn(async (text, opts) => {
        callsLong.push({ text, opts });
        return DUMMY_PNG_DATA_URL;
      });

      const cards = [{ front: 'F1', back: 'B1' }];
      await buildCardsPdf(cards, renderFaceLong, { hole: false, flip: 'long' });

      expect(callsLong).toHaveLength(2);
      expect(callsLong[0]).toEqual({ text: 'F1', opts: { holeSide: null } });
      expect(callsLong[1]).toEqual({ text: 'B1', opts: { holeSide: null } });

      const callsShort = [];
      const renderFaceShort = vi.fn(async (text, opts) => {
        callsShort.push({ text, opts });
        return DUMMY_PNG_DATA_URL;
      });

      await buildCardsPdf(cards, renderFaceShort, { hole: false, flip: 'short' });

      expect(callsShort).toHaveLength(2);
      expect(callsShort[0]).toEqual({ text: 'F1', opts: { holeSide: null } });
      expect(callsShort[1]).toEqual({ text: 'B1', opts: { holeSide: null } });
    });

    it('passes { holeSide: null } by default when hole option is omitted', async () => {
      const calls = [];
      const renderFace = vi.fn(async (text, opts) => {
        calls.push({ text, opts });
        return DUMMY_PNG_DATA_URL;
      });

      const cards = [{ front: 'Default F', back: 'Default B' }];
      await buildCardsPdf(cards, renderFace);

      expect(calls).toHaveLength(2);
      expect(calls[0]).toEqual({ text: 'Default F', opts: { holeSide: null } });
      expect(calls[1]).toEqual({ text: 'Default B', opts: { holeSide: null } });
    });
  });

  describe('(b) hole guide drawing with 12 cards and hole: true', () => {
    const cards12 = Array.from({ length: 12 }, (_, i) => ({
      front: `Card ${i + 1} Front`,
      back: `Card ${i + 1} Back`,
    }));

    it('holeGuide "first" produces guide only on front pages (1 and 3), once per sheet, at holeCenter(0)', async () => {
      const renderFace = async () => DUMMY_PNG_DATA_URL;
      const pdfBytes = await buildCardsPdf(cards12, renderFace, {
        hole: true,
        holeGuide: 'first',
      });

      const pdf = await pdfjsLib.getDocument({
        data: pdfBytes,
        standardFontDataUrl: STANDARD_FONTS_DIR,
      }).promise;

      expect(pdf.numPages).toBe(4);

      const expectedCenter0 = holeCenter(0);

      // Page 1 (Sheet 1 Front): exactly 1 guide at slot 0
      const page1 = await pdf.getPage(1);
      const ops1 = await page1.getOperatorList();
      const guides1 = extractHoleGuides(ops1, page1.view);
      expect(guides1).toHaveLength(1);
      expect(guides1[0].cx).toBeCloseTo(expectedCenter0.x, 2);
      expect(guides1[0].cy).toBeCloseTo(expectedCenter0.y, 2);
      expect(guides1[0].diameter).toBeCloseTo(HOLE.diameter, 2);
      expect(guides1[0].hasCross).toBe(true);

      // Page 2 (Sheet 1 Back): no guides
      const page2 = await pdf.getPage(2);
      const ops2 = await page2.getOperatorList();
      expect(extractHoleGuides(ops2, page2.view)).toHaveLength(0);
      expect(countGrayStrokeOps(ops2)).toBe(0);

      // Page 3 (Sheet 2 Front): exactly 1 guide at slot 0
      const page3 = await pdf.getPage(3);
      const ops3 = await page3.getOperatorList();
      const guides3 = extractHoleGuides(ops3, page3.view);
      expect(guides3).toHaveLength(1);
      expect(guides3[0].cx).toBeCloseTo(expectedCenter0.x, 2);
      expect(guides3[0].cy).toBeCloseTo(expectedCenter0.y, 2);
      expect(guides3[0].diameter).toBeCloseTo(HOLE.diameter, 2);
      expect(guides3[0].hasCross).toBe(true);

      // Page 4 (Sheet 2 Back): no guides
      const page4 = await pdf.getPage(4);
      const ops4 = await page4.getOperatorList();
      expect(extractHoleGuides(ops4, page4.view)).toHaveLength(0);
      expect(countGrayStrokeOps(ops4)).toBe(0);
    });

    it('holeGuide "all" produces 10 guides on sheet 1 front and 2 on sheet 2 front', async () => {
      const renderFace = async () => DUMMY_PNG_DATA_URL;
      const pdfBytes = await buildCardsPdf(cards12, renderFace, {
        hole: true,
        holeGuide: 'all',
      });

      const pdf = await pdfjsLib.getDocument({
        data: pdfBytes,
        standardFontDataUrl: STANDARD_FONTS_DIR,
      }).promise;

      expect(pdf.numPages).toBe(4);

      // Sheet 1 Front (Page 1): 10 guides for slots 0..9
      const page1 = await pdf.getPage(1);
      const ops1 = await page1.getOperatorList();
      const guides1 = extractHoleGuides(ops1, page1.view);
      expect(guides1).toHaveLength(10);
      for (let slot = 0; slot < 10; slot++) {
        const expected = holeCenter(slot);
        expect(guides1[slot].cx).toBeCloseTo(expected.x, 2);
        expect(guides1[slot].cy).toBeCloseTo(expected.y, 2);
        expect(guides1[slot].diameter).toBeCloseTo(HOLE.diameter, 2);
        expect(guides1[slot].hasCross).toBe(true);
      }

      // Sheet 1 Back (Page 2): 0 guides
      const page2 = await pdf.getPage(2);
      const ops2 = await page2.getOperatorList();
      expect(extractHoleGuides(ops2, page2.view)).toHaveLength(0);
      expect(countGrayStrokeOps(ops2)).toBe(0);

      // Sheet 2 Front (Page 3): 2 guides for slots 0..1
      const page3 = await pdf.getPage(3);
      const ops3 = await page3.getOperatorList();
      const guides3 = extractHoleGuides(ops3, page3.view);
      expect(guides3).toHaveLength(2);
      for (let slot = 0; slot < 2; slot++) {
        const expected = holeCenter(slot);
        expect(guides3[slot].cx).toBeCloseTo(expected.x, 2);
        expect(guides3[slot].cy).toBeCloseTo(expected.y, 2);
        expect(guides3[slot].diameter).toBeCloseTo(HOLE.diameter, 2);
        expect(guides3[slot].hasCross).toBe(true);
      }

      // Sheet 2 Back (Page 4): 0 guides
      const page4 = await pdf.getPage(4);
      const ops4 = await page4.getOperatorList();
      expect(extractHoleGuides(ops4, page4.view)).toHaveLength(0);
      expect(countGrayStrokeOps(ops4)).toBe(0);
    });

    it('holeGuide "none" produces no guides on any page', async () => {
      const renderFace = async () => DUMMY_PNG_DATA_URL;
      const pdfBytes = await buildCardsPdf(cards12, renderFace, {
        hole: true,
        holeGuide: 'none',
      });

      const pdf = await pdfjsLib.getDocument({
        data: pdfBytes,
        standardFontDataUrl: STANDARD_FONTS_DIR,
      }).promise;

      for (let p = 1; p <= 4; p++) {
        const page = await pdf.getPage(p);
        const ops = await page.getOperatorList();
        expect(extractHoleGuides(ops, page.view)).toHaveLength(0);
        expect(countGrayStrokeOps(ops)).toBe(0);
      }
    });

    it('hole: false ignores holeGuide and produces no guides on any page', async () => {
      const renderFace = async () => DUMMY_PNG_DATA_URL;
      const pdfBytes = await buildCardsPdf(cards12, renderFace, {
        hole: false,
        holeGuide: 'all',
      });

      const pdf = await pdfjsLib.getDocument({
        data: pdfBytes,
        standardFontDataUrl: STANDARD_FONTS_DIR,
      }).promise;

      for (let p = 1; p <= 4; p++) {
        const page = await pdf.getPage(p);
        const ops = await page.getOperatorList();
        expect(extractHoleGuides(ops, page.view)).toHaveLength(0);
        expect(countGrayStrokeOps(ops)).toBe(0);
      }
    });

    it('draws guides after card images so they are visible on top', async () => {
      const renderFace = async () => DUMMY_PNG_DATA_URL;
      const pdfBytes = await buildCardsPdf(cards12, renderFace, {
        hole: true,
        holeGuide: 'all',
      });

      const pdf = await pdfjsLib.getDocument({
        data: pdfBytes,
        standardFontDataUrl: STANDARD_FONTS_DIR,
      }).promise;

      const page1 = await pdf.getPage(1);
      const ops1 = await page1.getOperatorList();
      const guides1 = extractHoleGuides(ops1, page1.view);

      const lastImageOpIndex = ops1.fnArray.lastIndexOf(pdfjsLib.OPS.paintImageXObject);
      expect(lastImageOpIndex).toBeGreaterThan(-1);

      // All guides must appear after all card images
      for (const guide of guides1) {
        expect(guide.opIndex).toBeGreaterThan(lastImageOpIndex);
      }
    });

    it('throws on invalid holeGuide values', async () => {
      const renderFace = async () => DUMMY_PNG_DATA_URL;
      await expect(
        buildCardsPdf(cards12, renderFace, { holeGuide: 'invalid' })
      ).rejects.toThrow(/Unknown holeGuide option/);
    });
  });
});
