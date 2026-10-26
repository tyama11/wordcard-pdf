import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { describe, it, expect, vi } from 'vitest';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildCardsPdf, buildCalibrationPdf } from '../../src/pdf.js';
import { frontRect, backRect, mapToBack } from '../../src/layout.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PNG_PATH = path.resolve(__dirname, '../fixtures/tiny.png');
const FIXTURE_JPG_PATH = path.resolve(__dirname, '../fixtures/tiny.jpg');
const DUMMY_PNG_DATA_URL = `data:image/png;base64,${fs.readFileSync(FIXTURE_PNG_PATH).toString('base64')}`;
const DUMMY_JPG_DATA_URL = `data:image/jpeg;base64,${fs.readFileSync(FIXTURE_JPG_PATH).toString('base64')}`;

const STANDARD_FONTS_DIR = path.resolve('node_modules/pdfjs-dist/standard_fonts/') + '/';

/**
 * Creates a unique 1x1 PNG data URL with RGB values.
 */
function create1x1Png(r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const combined = Buffer.concat([typeBuf, data]);
    let c = 0xffffffff;
    for (let i = 0; i < combined.length; i++) {
      c ^= combined[i];
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
    }
    crcBuf.writeInt32BE(~c, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(1, 0);
  ihdrData.writeUInt32BE(1, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 2; // RGB
  const ihdr = makeChunk('IHDR', ihdrData);

  const rawScanline = Buffer.from([0, r, g, b]);
  const idat = makeChunk('IDAT', zlib.deflateSync(rawScanline));
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return 'data:image/png;base64,' + Buffer.concat([sig, ihdr, idat, iend]).toString('base64');
}

/**
 * Extracts painted image rects { x, y, w, h, key } in top-left mm coordinates
 * from a pdfjs page by tracking save/restore/transform operations on the CTM.
 */
async function extractPageImagesWithKeys(page, ops) {
  const k = 72 / 25.4;
  const pageHeightPt = page.view[3];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const images = [];

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];

    if (fn === pdfjsLib.OPS.save) {
      stack.push([...ctm]);
    } else if (fn === pdfjsLib.OPS.restore) {
      ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    } else if (fn === pdfjsLib.OPS.transform) {
      ctm = pdfjsLib.Util.transform(ctm, args);
    } else if (
      fn === pdfjsLib.OPS.paintImageXObject ||
      fn === pdfjsLib.OPS.paintInlineImageXObject
    ) {
      const imgName = args[0];
      const [a, b, c, d, e, f] = ctm;
      const x = e / k;
      const y = (pageHeightPt - (f + d)) / k;
      const w = a / k;
      const h = d / k;

      let key = imgName;
      if (page.objs && page.commonObjs) {
        const obj = await new Promise((resolve) => {
          if (page.objs.has(imgName)) {
            page.objs.get(imgName, resolve);
          } else {
            page.commonObjs.get(imgName, resolve);
          }
        });
        if (obj) {
          key = obj.ref || (obj.data ? Array.from(obj.data).join(',') : imgName);
        }
      }

      images.push({ x, y, w, h, key });
    }
  }

  return images;
}

/**
 * Extracts line segments { x1, y1, x2, y2 } in top-left mm coordinates.
 */
function extractPageLines(ops, pageView) {
  const k = 72 / 25.4;
  const pageHeightPt = pageView[3];
  const lines = [];

  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] === pdfjsLib.OPS.constructPath) {
      const paths = ops.argsArray[i][1];
      for (const p of paths) {
        lines.push({
          x1: p[1] / k,
          y1: (pageHeightPt - p[2]) / k,
          x2: p[4] / k,
          y2: (pageHeightPt - p[5]) / k,
        });
      }
    }
  }

  return lines;
}

function approx(a, b, tol = 0.01) {
  return Math.abs(a - b) <= tol;
}

function ptEqual(p, q, tol = 0.01) {
  return approx(p.x, q.x, tol) && approx(p.y, q.y, tol);
}

function segEqual(s1, s2, tol = 0.01) {
  const p1 = { x: s1.x1, y: s1.y1 };
  const p2 = { x: s1.x2, y: s1.y2 };
  const q1 = { x: s2.x1, y: s2.y1 };
  const q2 = { x: s2.x2, y: s2.y2 };

  return (
    (ptEqual(p1, q1, tol) && ptEqual(p2, q2, tol)) ||
    (ptEqual(p1, q2, tol) && ptEqual(p2, q1, tol))
  );
}

/**
 * Finds crosshair centers by identifying intersecting perpendicular arms (> 5 mm).
 */
function extractCrosshairCenters(ops, pageView) {
  const lines = extractPageLines(ops, pageView);
  const longLines = lines.filter((l) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1) > 5);

  const hLines = longLines.filter((l) => approx(l.y1, l.y2, 0.1));
  const vLines = longLines.filter((l) => approx(l.x1, l.x2, 0.1));

  const centers = [];
  for (const hl of hLines) {
    const cy = (hl.y1 + hl.y2) / 2;
    const cx = (hl.x1 + hl.x2) / 2;
    const vl = vLines.find((v) => {
      const minVy = Math.min(v.y1, v.y2);
      const maxVy = Math.max(v.y1, v.y2);
      return approx(v.x1, cx, 0.2) && minVy - 0.2 <= cy && cy <= maxVy + 0.2;
    });
    if (vl) {
      centers.push({ x: cx, y: cy });
    }
  }

  return centers;
}

describe('pdf.js', () => {
  it('hard-coded expectations: front slot 0, 1, 9 and back of slot 0, 1, 9 for long and short flips', async () => {
    const cards = Array.from({ length: 10 }, (_, i) => ({
      front: `card_${i}_front`,
      back: `card_${i}_back`,
    }));

    const renderDistinct = async (text) => {
      const match = text.match(/card_(\d+)_/);
      const idx = match ? parseInt(match[1], 10) : 0;
      return create1x1Png((idx * 17 + 5) % 256, (idx * 31 + 13) % 256, (idx * 47 + 23) % 256);
    };

    // --- Long flip with zero offset ---
    {
      const pdfBytes = await buildCardsPdf(cards, renderDistinct, { flip: 'long' });
      const pdf = await pdfjsLib.getDocument({ data: pdfBytes, standardFontDataUrl: STANDARD_FONTS_DIR }).promise;

      const p1 = await pdf.getPage(1);
      const p2 = await pdf.getPage(2);
      const frontImgs = await extractPageImagesWithKeys(p1, await p1.getOperatorList());
      const backImgs = await extractPageImagesWithKeys(p2, await p2.getOperatorList());

      // Front hard-coded expectations:
      // slot 0 at (14, 11)
      expect(frontImgs[0].x).toBeCloseTo(14, 2);
      expect(frontImgs[0].y).toBeCloseTo(11, 2);
      expect(frontImgs[0].w).toBeCloseTo(91, 2);
      expect(frontImgs[0].h).toBeCloseTo(55, 2);

      // slot 1 at (105, 11)
      expect(frontImgs[1].x).toBeCloseTo(105, 2);
      expect(frontImgs[1].y).toBeCloseTo(11, 2);

      // slot 9 at (105, 231)
      expect(frontImgs[9].x).toBeCloseTo(105, 2);
      expect(frontImgs[9].y).toBeCloseTo(231, 2);

      // Long-flip back of slot 0 at (105, 11)
      const b0 = backImgs.find((b) => b.key === frontImgs[0].key);
      expect(b0.x).toBeCloseTo(105, 2);
      expect(b0.y).toBeCloseTo(11, 2);

      // Long-flip back of slot 1 at (14, 11)
      const b1 = backImgs.find((b) => b.key === frontImgs[1].key);
      expect(b1.x).toBeCloseTo(14, 2);
      expect(b1.y).toBeCloseTo(11, 2);
    }

    // --- Short flip with zero offset ---
    {
      const pdfBytes = await buildCardsPdf(cards, renderDistinct, { flip: 'short' });
      const pdf = await pdfjsLib.getDocument({ data: pdfBytes, standardFontDataUrl: STANDARD_FONTS_DIR }).promise;

      const p1 = await pdf.getPage(1);
      const p2 = await pdf.getPage(2);
      const frontImgs = await extractPageImagesWithKeys(p1, await p1.getOperatorList());
      const backImgs = await extractPageImagesWithKeys(p2, await p2.getOperatorList());

      // Short-flip back of slot 0 at (14, 231)
      const b0 = backImgs.find((b) => b.key === frontImgs[0].key);
      expect(b0.x).toBeCloseTo(14, 2);
      expect(b0.y).toBeCloseTo(231, 2);

      // Short-flip back of slot 9 at (105, 11)
      const b9 = backImgs.find((b) => b.key === frontImgs[9].key);
      expect(b9.x).toBeCloseTo(105, 2);
      expect(b9.y).toBeCloseTo(11, 2);
    }
  });

  it('pairs front and back images for 23 cards and verifies duplex relations and non-overlap without layout.js', async () => {
    const cards = Array.from({ length: 23 }, (_, i) => ({
      front: `card_${i}_front`,
      back: `card_${i}_back`,
    }));

    // renderFace mock returns distinct PNG per card index so front and back of each card share an XObject
    const renderFace = async (text) => {
      const match = text.match(/card_(\d+)_/);
      const idx = match ? parseInt(match[1], 10) : 0;
      return create1x1Png((idx * 11 + 7) % 256, (idx * 19 + 11) % 256, (idx * 31 + 17) % 256);
    };

    const testRuns = [
      { flip: 'long', ox: 0, oy: 0 },
      { flip: 'long', ox: 0.7, oy: -0.3 },
      { flip: 'short', ox: 0, oy: 0 },
      { flip: 'short', ox: 0.7, oy: -0.3 },
    ];

    for (const { flip, ox, oy } of testRuns) {
      const pdfBytes = await buildCardsPdf(cards, renderFace, {
        flip,
        backOffsetX: ox,
        backOffsetY: oy,
      });

      const pdf = await pdfjsLib.getDocument({ data: pdfBytes, standardFontDataUrl: STANDARD_FONTS_DIR }).promise;

      // Page count: 23 cards = 6 pages
      expect(pdf.numPages).toBe(6);

      // Check all pages: view exactly [0, 0, 595.28, 841.89], inside page, and non-overlapping
      for (let pNum = 1; pNum <= 6; pNum++) {
        const page = await pdf.getPage(pNum);
        expect(page.view[0]).toBeCloseTo(0, 2);
        expect(page.view[1]).toBeCloseTo(0, 2);
        expect(page.view[2]).toBeCloseTo(595.28, 2);
        expect(page.view[3]).toBeCloseTo(841.89, 2);

        const imgs = await extractPageImagesWithKeys(page, await page.getOperatorList());

        // All lie within page (210 x 297 mm)
        for (const img of imgs) {
          expect(img.x).toBeGreaterThanOrEqual(0);
          expect(img.y).toBeGreaterThanOrEqual(0);
          expect(img.x + img.w).toBeLessThanOrEqual(210 + 0.01);
          expect(img.y + img.h).toBeLessThanOrEqual(297 + 0.01);
          expect(img.w).toBeCloseTo(91, 2);
          expect(img.h).toBeCloseTo(55, 2);
        }

        // No two images on a page overlap
        for (let i = 0; i < imgs.length; i++) {
          for (let j = i + 1; j < imgs.length; j++) {
            const a = imgs[i];
            const b = imgs[j];
            const sepX = a.x + a.w <= b.x + 0.01 || b.x + b.w <= a.x + 0.01;
            const sepY = a.y + a.h <= b.y + 0.01 || b.y + b.h <= a.y + 0.01;
            expect(sepX || sepY).toBe(true);
          }
        }
      }

      // Check pairing and mathematical relations across sheets
      for (let sheet = 0; sheet < 3; sheet++) {
        const pFront = await pdf.getPage(sheet * 2 + 1);
        const pBack = await pdf.getPage(sheet * 2 + 2);

        const frontImgs = await extractPageImagesWithKeys(pFront, await pFront.getOperatorList());
        const backImgs = await extractPageImagesWithKeys(pBack, await pBack.getOperatorList());

        const expectedCount = sheet === 2 ? 3 : 10;
        expect(frontImgs).toHaveLength(expectedCount);
        expect(backImgs).toHaveLength(expectedCount);

        for (const fImg of frontImgs) {
          const bImg = backImgs.find((b) => b.key === fImg.key);
          expect(bImg).toBeDefined();

          const x_front = fImg.x;
          const y_front = fImg.y;
          const x_back_clean = bImg.x - ox;
          const y_back_clean = bImg.y - oy;

          if (flip === 'long') {
            // long flip -> x_front + x_back + 91 == 210 and y_front == y_back
            expect(x_front + x_back_clean + 91).toBeCloseTo(210, 2);
            expect(y_front).toBeCloseTo(y_back_clean, 2);
          } else {
            // short flip -> x_front == x_back and y_front + y_back + 55 == 297
            expect(x_front).toBeCloseTo(x_back_clean, 2);
            expect(y_front + y_back_clean + 55).toBeCloseTo(297, 2);
          }
        }
      }
    }
  });

  it('crop mark line segments exist on front and back and coincide (zero offset, long flip)', async () => {
    const cards = Array.from({ length: 23 }, (_, i) => ({
      front: `Front ${i + 1}`,
      back: `Back ${i + 1}`,
    }));

    const dummyRender = async () => DUMMY_PNG_DATA_URL;

    const pdfBytes = await buildCardsPdf(cards, dummyRender, {
      flip: 'long',
      backOffsetX: 0,
      backOffsetY: 0,
      cropMarks: true,
    });

    const pdf = await pdfjsLib.getDocument({ data: pdfBytes, standardFontDataUrl: STANDARD_FONTS_DIR }).promise;

    for (let sheet = 0; sheet < 3; sheet++) {
      const frontPageNum = sheet * 2 + 1;
      const backPageNum = sheet * 2 + 2;

      const frontPage = await pdf.getPage(frontPageNum);
      const backPage = await pdf.getPage(backPageNum);

      const frontOps = await frontPage.getOperatorList();
      const backOps = await backPage.getOperatorList();

      const frontLines = extractPageLines(frontOps, frontPage.view);
      const backLines = extractPageLines(backOps, backPage.view);

      expect(frontLines).toHaveLength(18);
      expect(backLines).toHaveLength(18);

      for (const fLine of frontLines) {
        const found = backLines.some((bLine) => segEqual(fLine, bLine, 0.01));
        expect(found).toBe(true);
      }
    }
  });

  it('omits crop marks when cropMarks is false', async () => {
    const cards = [{ front: 'F1', back: 'B1' }];
    const dummyRender = async () => DUMMY_PNG_DATA_URL;

    const pdfBytes = await buildCardsPdf(cards, dummyRender, {
      cropMarks: false,
    });

    const pdf = await pdfjsLib.getDocument({ data: pdfBytes, standardFontDataUrl: STANDARD_FONTS_DIR }).promise;
    const page1 = await pdf.getPage(1);
    const ops = await page1.getOperatorList();
    const lines = extractPageLines(ops, page1.view);

    expect(lines).toHaveLength(0);
  });

  it('infers JPEG format from data URL prefix and places JPEG image correctly', async () => {
    const cards = [{ front: 'Front JPEG', back: 'Back JPEG' }];
    const renderJpeg = async () => DUMMY_JPG_DATA_URL;

    const pdfBytes = await buildCardsPdf(cards, renderJpeg);
    const pdf = await pdfjsLib.getDocument({ data: pdfBytes, standardFontDataUrl: STANDARD_FONTS_DIR }).promise;

    const p1 = await pdf.getPage(1);
    const imgs = await extractPageImagesWithKeys(p1, await p1.getOperatorList());

    expect(imgs).toHaveLength(1);
    expect(imgs[0].x).toBeCloseTo(14, 2);
    expect(imgs[0].y).toBeCloseTo(11, 2);
    expect(imgs[0].w).toBeCloseTo(91, 2);
    expect(imgs[0].h).toBeCloseTo(55, 2);
  });

  it('leaves empty text faces blank without calling renderFace', async () => {
    const renderFaceMock = vi.fn(async () => DUMMY_PNG_DATA_URL);

    const cards = [
      { front: 'Hello', back: '' }, // Back empty
      { front: '   ', back: 'World' }, // Front empty
      { front: null, back: undefined }, // Both empty
    ];

    const pdfBytes = await buildCardsPdf(cards, renderFaceMock);
    const pdf = await pdfjsLib.getDocument({ data: pdfBytes, standardFontDataUrl: STANDARD_FONTS_DIR }).promise;

    expect(renderFaceMock).toHaveBeenCalledTimes(2);
    expect(renderFaceMock).toHaveBeenCalledWith('Hello');
    expect(renderFaceMock).toHaveBeenCalledWith('World');

    const frontPage = await pdf.getPage(1);
    const backPage = await pdf.getPage(2);

    const frontImages = await extractPageImagesWithKeys(frontPage, await frontPage.getOperatorList());
    const backImages = await extractPageImagesWithKeys(backPage, await backPage.getOperatorList());

    expect(frontImages).toHaveLength(1);
    expect(frontImages[0].x).toBeCloseTo(14, 2);
    expect(frontImages[0].y).toBeCloseTo(11, 2);

    expect(backImages).toHaveLength(1);
    expect(backImages[0].x).toBeCloseTo(14, 2); // slot 1 back on long-flip lands on slot 0 (x=14)
    expect(backImages[0].y).toBeCloseTo(11, 2);
  });

  it('invokes onProgress callback during generation', async () => {
    const cards = [
      { front: 'A', back: 'B' },
      { front: 'C', back: 'D' },
    ];
    const progressCalls = [];
    const onProgress = (done, total) => {
      progressCalls.push({ done, total });
    };

    await buildCardsPdf(cards, async () => DUMMY_PNG_DATA_URL, { onProgress });

    expect(progressCalls).toHaveLength(4);
    expect(progressCalls[0]).toEqual({ done: 1, total: 4 });
    expect(progressCalls[3]).toEqual({ done: 4, total: 4 });
  });

  it('calibration sheet has 2 pages, readable ASCII headers and scale labels, and mapped centers', async () => {
    const opts = {
      flip: 'long',
      backOffsetX: 1.2,
      backOffsetY: -0.8,
    };

    const pdfBytes = buildCalibrationPdf(opts);
    expect(pdfBytes).toBeInstanceOf(Uint8Array);

    const pdf = await pdfjsLib.getDocument({ data: pdfBytes, standardFontDataUrl: STANDARD_FONTS_DIR }).promise;
    expect(pdf.numPages).toBe(2);

    const page1 = await pdf.getPage(1);
    const page2 = await pdf.getPage(2);

    // Assert headers and scale labels in text content
    const t1 = await page1.getTextContent();
    const t2 = await page2.getTextContent();

    const t1Strings = t1.items.map((i) => i.str).join(' ');
    const t2Strings = t2.items.map((i) => i.str).join(' ');

    // Front header
    expect(t1Strings).toContain('FRONT - calibration sheet');

    // Back header
    expect(t2Strings).toContain(
      'BACK - hold to light; read where the FRONT cross appears on this scale and ADD that value to the offset'
    );

    // Back scale numbers and captions
    expect(t2Strings).toContain('-4');
    expect(t2Strings).toContain('-2');
    expect(t2Strings).toContain('2');
    expect(t2Strings).toContain('4');
    expect(t2Strings).toContain('+X');
    expect(t2Strings).toContain('+Y');

    // Geometry: crosshair centers
    const ops1 = await page1.getOperatorList();
    const ops2 = await page2.getOperatorList();

    const frontCenters = extractCrosshairCenters(ops1, page1.view);
    const backCenters = extractCrosshairCenters(ops2, page2.view);

    expect(frontCenters).toHaveLength(5);
    expect(backCenters).toHaveLength(5);

    for (const fc of frontCenters) {
      const expectedBack = mapToBack({ x: fc.x, y: fc.y, w: 0, h: 0 }, opts);
      const matchingBack = backCenters.find((bc) => ptEqual(bc, expectedBack, 0.01));
      expect(matchingBack).toBeDefined();
    }
  });

  it('calibration PDF invokes drawText when provided', () => {
    const drawTextMock = vi.fn();
    buildCalibrationPdf({ drawText: drawTextMock });

    expect(drawTextMock).toHaveBeenCalledTimes(2);
    expect(drawTextMock).toHaveBeenNthCalledWith(1, expect.any(Object), 1);
    expect(drawTextMock).toHaveBeenNthCalledWith(2, expect.any(Object), 2);
  });
});
