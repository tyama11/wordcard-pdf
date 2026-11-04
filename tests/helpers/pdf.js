import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const FIXTURE_PNG_PATH = path.resolve(__dirname, '../fixtures/tiny.png');
export const FIXTURE_JPG_PATH = path.resolve(__dirname, '../fixtures/tiny.jpg');

export const DUMMY_PNG_DATA_URL = `data:image/png;base64,${fs.readFileSync(FIXTURE_PNG_PATH).toString('base64')}`;
export const DUMMY_JPG_DATA_URL = `data:image/jpeg;base64,${fs.readFileSync(FIXTURE_JPG_PATH).toString('base64')}`;

export const STANDARD_FONTS_DIR = path.resolve('node_modules/pdfjs-dist/standard_fonts/') + '/';

/**
 * Loads a PDF document using pdfjs with standard fonts configured.
 *
 * @param {Uint8Array|Buffer|ArrayBuffer} pdfData
 * @returns {Promise<import('pdfjs-dist').PDFDocumentProxy>}
 */
export async function loadPdf(pdfData) {
  const data = pdfData instanceof Uint8Array ? pdfData : new Uint8Array(pdfData);
  return pdfjsLib.getDocument({
    data,
    standardFontDataUrl: STANDARD_FONTS_DIR,
  }).promise;
}

/**
 * Extracts painted image rects { x, y, w, h } in top-left mm coordinates
 * from a pdfjs page by tracking save/restore/transform operations on the CTM.
 * If withKeys is true, also resolves each image's XObject key.
 *
 * @param {import('pdfjs-dist').PDFPageProxy} page
 * @param {object} [options]
 * @param {object} [options.ops] Pre-fetched operator list
 * @param {boolean} [options.withKeys=false] Also resolve each image's XObject key
 * @returns {Promise<Array<{ x: number, y: number, w: number, h: number, key?: string }>>}
 */
export async function extractPageImages(page, { ops: givenOps, withKeys = false } = {}) {
  const ops = givenOps ?? await page.getOperatorList();

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

      if (withKeys) {
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
      } else {
        images.push({ x, y, w, h });
      }
    }
  }

  return images;
}

/**
 * Convenience helper to extract image placements including image object keys.
 *
 * @param {import('pdfjs-dist').PDFPageProxy} page
 * @param {object} [ops] - Pre-fetched operator list
 * @returns {Promise<Array<{ x: number, y: number, w: number, h: number, key: string }>>}
 */
export async function extractPageImagesWithKeys(page, ops) {
  return extractPageImages(page, { ops, withKeys: true });
}
