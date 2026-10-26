import { test, expect } from '@playwright/test';

test.describe('Registration physical alignment proof', () => {
  test('verify card bounding boxes, markers, crop marks, and calibration crosshairs', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const pdfjsLib = await import('/node_modules/pdfjs-dist/build/pdf.mjs');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.mjs';
      const { buildCardsPdf, buildCalibrationPdf } = await import('/src/pdf.js');

      const DPI = 300;
      const MM_TO_PX = DPI / 25.4;

      // 1. Create card face renderer with 3px frame and marker encoding card index
      const cardCache = new Map();
      const renderFace = async (text) => {
        if (cardCache.has(text)) return cardCache.get(text);
        const m = text.match(/CARD_(\d+)/);
        const cardIndex = m ? parseInt(m[1], 10) : 0;

        const canvas = document.createElement('canvas');
        canvas.width = 1075;
        canvas.height = 650;
        const ctx = canvas.getContext('2d');

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 1075, 650);

        // 3 px black frame at the image border
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 1075, 3); // top
        ctx.fillRect(0, 647, 1075, 3); // bottom (650 - 3)
        ctx.fillRect(0, 0, 3, 650); // left
        ctx.fillRect(1072, 0, 3, 650); // right (1075 - 3)

        // Filled black square marker (20x20) encoding card index
        // Positioned at x = 100 + cardIndex * 35, y = 250
        const markerX = 100 + cardIndex * 35;
        const markerY = 250;
        ctx.fillRect(markerX, markerY, 20, 20);

        const dataUrl = canvas.toDataURL('image/png');
        cardCache.set(text, dataUrl);
        return dataUrl;
      };

      // Helper: render PDF page to ImageData at 300 dpi
      const renderPageToImageData = async (pdfDoc, pageNum) => {
        const p = await pdfDoc.getPage(pageNum);
        const viewport = p.getViewport({ scale: DPI / 72 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d');
        await p.render({ canvasContext: ctx, viewport }).promise;
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
      };

      // Helper: mirror bitmap
      const mirrorImageData = (imageData, flip) => {
        const { width, height, data } = imageData;
        const mirroredData = new Uint8ClampedArray(data.length);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const mx = flip === 'long' ? width - 1 - x : x;
            const my = flip === 'short' ? height - 1 - y : y;
            const srcIdx = (y * width + x) * 4;
            const dstIdx = (my * width + mx) * 4;
            mirroredData[dstIdx] = data[srcIdx];
            mirroredData[dstIdx + 1] = data[srcIdx + 1];
            mirroredData[dstIdx + 2] = data[srcIdx + 2];
            mirroredData[dstIdx + 3] = data[srcIdx + 3];
          }
        }
        return new ImageData(mirroredData, width, height);
      };

      const isBlack = (img, x, y) => {
        if (x < 0 || x >= img.width || y < 0 || y >= img.height) return false;
        const idx = (y * img.width + x) * 4;
        return img.data[idx] < 100 && img.data[idx + 1] < 100 && img.data[idx + 2] < 100;
      };

      /**
       * Detects the outer edge of the 3px black frame of a card scanning from outside inward.
       * Uses a search window of +-60 px.
       * Returns null if any edge is not found (never silently falls back).
       */
      const detectCardFrame = (img, expX, expY, expW = 1075, expH = 650) => {
        const SEARCH_WINDOW = 60;
        let top = null;
        let bottom = null;
        let left = null;
        let right = null;

        // Top edge: scan from outside (expY - 60) inward towards (expY + 60)
        for (let y = expY - SEARCH_WINDOW; y <= expY + SEARCH_WINDOW; y++) {
          let count = 0;
          for (let x = expX + 100; x < expX + expW - 100; x += 10) {
            if (isBlack(img, x, y)) count++;
          }
          if (count >= 50) {
            top = y;
            break;
          }
        }

        // Bottom edge: scan from outside ((expY + expH - 1) + 60) inward towards ((expY + expH - 1) - 60)
        const expBottom = expY + expH - 1;
        for (let y = expBottom + SEARCH_WINDOW; y >= expBottom - SEARCH_WINDOW; y--) {
          let count = 0;
          for (let x = expX + 100; x < expX + expW - 100; x += 10) {
            if (isBlack(img, x, y)) count++;
          }
          if (count >= 50) {
            bottom = y;
            break;
          }
        }

        // Left edge: scan from outside (expX - 60) inward towards (expX + 60)
        for (let x = expX - SEARCH_WINDOW; x <= expX + SEARCH_WINDOW; x++) {
          let count = 0;
          for (let y = expY + 100; y < expY + expH - 100; y += 10) {
            if (isBlack(img, x, y)) count++;
          }
          if (count >= 30) {
            left = x;
            break;
          }
        }

        // Right edge: scan from outside ((expX + expW - 1) + 60) inward towards ((expX + expW - 1) - 60)
        const expRight = expX + expW - 1;
        for (let x = expRight + SEARCH_WINDOW; x >= expRight - SEARCH_WINDOW; x--) {
          let count = 0;
          for (let y = expY + 100; y < expY + expH - 100; y += 10) {
            if (isBlack(img, x, y)) count++;
          }
          if (count >= 30) {
            right = x;
            break;
          }
        }

        if (top === null || bottom === null || left === null || right === null) {
          return null;
        }

        return { left, top, right, bottom };
      };

      // Detect marker index
      const detectMarkerIndex = (img, bbox, isMirroredBack, flip) => {
        if (!bbox) return -1;
        const scanY = isMirroredBack && flip === 'short' ? bbox.bottom - 260 : bbox.top + 260;
        let segStart = -1;
        let segEnd = -1;
        for (let x = bbox.left + 50; x < bbox.right - 50; x++) {
          if (isBlack(img, x, scanY)) {
            if (segStart === -1) segStart = x;
            segEnd = x;
          } else {
            if (segStart !== -1 && segEnd - segStart >= 12) {
              break;
            }
            segStart = -1;
          }
        }

        if (segStart === -1) return -1;
        const cx = (segStart + segEnd) / 2;

        if (!isMirroredBack) {
          return Math.round((cx - bbox.left - 110) / 35);
        } else {
          if (flip === 'long') {
            return Math.round((bbox.right - cx - 110) / 35);
          } else {
            return Math.round((cx - bbox.left - 110) / 35);
          }
        }
      };

      // Reusable analysis function for PDF card registration
      const analyzePdfRegistration = async (pdfBytes, {
        expectedFlip,
        assumedBackOffsetX,
        assumedBackOffsetY,
        cards,
        checkCropMarks = false,
      }) => {
        const pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
        const numSheets = Math.ceil(cards.length / 10);
        const offX_px = Math.round(assumedBackOffsetX * MM_TO_PX);
        const offY_px = Math.round(assumedBackOffsetY * MM_TO_PX);

        const cardAlignmentErrors = [];
        const cropMarkErrors = [];
        let cardsCompared = 0;

        for (let sheet = 0; sheet < numSheets; sheet++) {
          const frontPageNum = sheet * 2 + 1;
          const backPageNum = sheet * 2 + 2;

          const frontImg = await renderPageToImageData(pdfDoc, frontPageNum);
          const backImg = await renderPageToImageData(pdfDoc, backPageNum);
          const mirroredBackImg = mirrorImageData(backImg, expectedFlip);

          // Crop mark check
          if (checkCropMarks && assumedBackOffsetX === 0 && assumedBackOffsetY === 0) {
            const cropCheckPoints = [
              { x: Math.round(105 * MM_TO_PX), y: Math.round(8 * MM_TO_PX) },
              { x: Math.round(14 * MM_TO_PX), y: Math.round(8 * MM_TO_PX) },
              { x: Math.round(196 * MM_TO_PX), y: Math.round(8 * MM_TO_PX) },
              { x: Math.round(10 * MM_TO_PX), y: Math.round(66 * MM_TO_PX) },
              { x: Math.round(10 * MM_TO_PX), y: Math.round(121 * MM_TO_PX) },
            ];

            for (const pt of cropCheckPoints) {
              let bestFx = null;
              let bestFy = null;
              let minB = 255;
              for (let dx = -3; dx <= 3; dx++) {
                for (let dy = -3; dy <= 3; dy++) {
                  const px = pt.x + dx;
                  const py = pt.y + dy;
                  if (px >= 0 && px < frontImg.width && py >= 0 && py < frontImg.height) {
                    const idx = (py * frontImg.width + px) * 4;
                    const b = (frontImg.data[idx] + frontImg.data[idx + 1] + frontImg.data[idx + 2]) / 3;
                    if (b < minB) {
                      minB = b;
                      bestFx = px;
                      bestFy = py;
                    }
                  }
                }
              }

              if (minB >= 150 || bestFx === null) {
                cropMarkErrors.push({ sheet, pt, error: 'front_crop_mark_not_found', minB });
                continue;
              }

              let backMatchesWithin1Px = false;
              for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                  const px = bestFx + dx;
                  const py = bestFy + dy;
                  if (px >= 0 && px < mirroredBackImg.width && py >= 0 && py < mirroredBackImg.height) {
                    const idx = (py * mirroredBackImg.width + px) * 4;
                    const b = (mirroredBackImg.data[idx] + mirroredBackImg.data[idx + 1] + mirroredBackImg.data[idx + 2]) / 3;
                    if (b < 150) {
                      backMatchesWithin1Px = true;
                      break;
                    }
                  }
                }
                if (backMatchesWithin1Px) break;
              }

              if (!backMatchesWithin1Px) {
                cropMarkErrors.push({ sheet, pt, error: 'back_crop_mark_mismatch', bestFx, bestFy });
              }
            }
          }

          // Card alignment check
          for (let slot = 0; slot < 10; slot++) {
            const cardIndex = sheet * 10 + slot;
            if (cardIndex >= cards.length) break;

            cardsCompared++;

            const col = slot % 2;
            const row = Math.floor(slot / 2);
            const expFrontX = Math.round((14 + col * 91) * MM_TO_PX);
            const expFrontY = Math.round((11 + row * 55) * MM_TO_PX);

            const frontBbox = detectCardFrame(frontImg, expFrontX, expFrontY);

            let expMirroredX = expFrontX;
            let expMirroredY = expFrontY;
            if (expectedFlip === 'long') {
              expMirroredX = expFrontX - offX_px;
              expMirroredY = expFrontY + offY_px;
            } else {
              expMirroredX = expFrontX + offX_px;
              expMirroredY = expFrontY - offY_px;
            }

            const rawMirroredBbox = detectCardFrame(mirroredBackImg, expMirroredX, expMirroredY);

            if (!frontBbox || !rawMirroredBbox) {
              cardAlignmentErrors.push({
                sheet,
                slot,
                cardIndex,
                error: 'frame_edge_not_found',
                frontBbox,
                rawMirroredBbox,
              });
              continue;
            }

            const alignedBackBbox = { ...rawMirroredBbox };
            if (expectedFlip === 'long') {
              alignedBackBbox.left += offX_px;
              alignedBackBbox.right += offX_px;
              alignedBackBbox.top -= offY_px;
              alignedBackBbox.bottom -= offY_px;
            } else {
              alignedBackBbox.left -= offX_px;
              alignedBackBbox.right -= offX_px;
              alignedBackBbox.top += offY_px;
              alignedBackBbox.bottom += offY_px;
            }

            const diffLeft = Math.abs(frontBbox.left - alignedBackBbox.left);
            const diffRight = Math.abs(frontBbox.right - alignedBackBbox.right);
            const diffTop = Math.abs(frontBbox.top - alignedBackBbox.top);
            const diffBottom = Math.abs(frontBbox.bottom - alignedBackBbox.bottom);

            const frontMarker = detectMarkerIndex(frontImg, frontBbox, false, expectedFlip);
            const backMarker = detectMarkerIndex(mirroredBackImg, rawMirroredBbox, true, expectedFlip);

            if (
              diffLeft > 1 ||
              diffRight > 1 ||
              diffTop > 1 ||
              diffBottom > 1 ||
              frontMarker !== cardIndex ||
              backMarker !== cardIndex
            ) {
              cardAlignmentErrors.push({
                sheet,
                slot,
                cardIndex,
                frontBbox,
                alignedBackBbox,
                diffs: { diffLeft, diffRight, diffTop, diffBottom },
                frontMarker,
                backMarker,
              });
            }
          }
        }

        return { cardsCompared, cardAlignmentErrors, cropMarkErrors };
      };

      // 2. Prepare 23 test cards
      const testCards = [];
      for (let i = 0; i < 23; i++) {
        testCards.push({ front: `CARD_${i}_F`, back: `CARD_${i}_B` });
      }

      // 3. Positive verification: 4 configurations
      const configs = [
        { flip: 'long', backOffsetX: 0, backOffsetY: 0 },
        { flip: 'long', backOffsetX: 1.5, backOffsetY: -0.8 },
        { flip: 'short', backOffsetX: 0, backOffsetY: 0 },
        { flip: 'short', backOffsetX: 1.5, backOffsetY: -0.8 },
      ];

      const positiveResults = [];
      for (const config of configs) {
        const pdfBytes = await buildCardsPdf(testCards, renderFace, {
          flip: config.flip,
          backOffsetX: config.backOffsetX,
          backOffsetY: config.backOffsetY,
          cropMarks: true,
        });

        const analysis = await analyzePdfRegistration(pdfBytes, {
          expectedFlip: config.flip,
          assumedBackOffsetX: config.backOffsetX,
          assumedBackOffsetY: config.backOffsetY,
          cards: testCards,
          checkCropMarks: config.backOffsetX === 0 && config.backOffsetY === 0,
        });

        positiveResults.push({ config, analysis });
      }

      // 4. Negative controls (proof that tests fail when misaligned or flipped incorrectly)
      // Negative Control A: PDF built with offset (0.5, 0), analyzed assuming offset 0
      const negPdfA = await buildCardsPdf(testCards, renderFace, {
        flip: 'long',
        backOffsetX: 0.5,
        backOffsetY: 0,
        cropMarks: true,
      });
      const negAnalysisA = await analyzePdfRegistration(negPdfA, {
        expectedFlip: 'long',
        assumedBackOffsetX: 0,
        assumedBackOffsetY: 0,
        cards: testCards,
      });

      // Negative Control B: PDF built with flip 'short', analyzed assuming flip 'long'
      const negPdfB = await buildCardsPdf(testCards, renderFace, {
        flip: 'short',
        backOffsetX: 0,
        backOffsetY: 0,
        cropMarks: true,
      });
      const negAnalysisB = await analyzePdfRegistration(negPdfB, {
        expectedFlip: 'long',
        assumedBackOffsetX: 0,
        assumedBackOffsetY: 0,
        cards: testCards,
      });

      // 5. Calibration crosshair detection (never falling back to expected coordinate)
      const findCrosshairCenter = (img, expX, expY, radius = 20) => {
        let bestX = null;
        let minSumX = Infinity;
        for (let x = expX - radius; x <= expX + radius; x++) {
          let sum = 0;
          for (let y = expY - radius; y <= expY + radius; y++) {
            const idx = (y * img.width + x) * 4;
            sum += (img.data[idx] + img.data[idx + 1] + img.data[idx + 2]) / 3;
          }
          if (sum < minSumX) {
            minSumX = sum;
            bestX = x;
          }
        }

        let bestY = null;
        let minSumY = Infinity;
        for (let y = expY - radius; y <= expY + radius; y++) {
          let sum = 0;
          for (let x = expX - radius; x <= expX + radius; x++) {
            const idx = (y * img.width + x) * 4;
            sum += (img.data[idx] + img.data[idx + 1] + img.data[idx + 2]) / 3;
          }
          if (sum < minSumY) {
            minSumY = sum;
            bestY = y;
          }
        }

        // Validate that a genuine dark line was detected (average brightness < 150)
        const avgX = minSumX / (2 * radius + 1);
        const avgY = minSumY / (2 * radius + 1);
        if (avgX >= 150 || avgY >= 150) {
          return null;
        }

        return { x: bestX, y: bestY };
      };

      const centersMm = [
        { x: 14, y: 11 },
        { x: 196, y: 11 },
        { x: 14, y: 286 },
        { x: 196, y: 286 },
        { x: 105, y: 148.5 },
      ];

      // A) Calibration PDF with zero offset
      const calibZeroBytes = buildCalibrationPdf({ flip: 'long', backOffsetX: 0, backOffsetY: 0 });
      const calibZeroDoc = await pdfjsLib.getDocument({ data: calibZeroBytes }).promise;
      const calibZeroFront = await renderPageToImageData(calibZeroDoc, 1);
      const calibZeroBack = await renderPageToImageData(calibZeroDoc, 2);
      const calibZeroMirroredBack = mirrorImageData(calibZeroBack, 'long');

      const calibZeroErrors = [];
      for (const ptMm of centersMm) {
        const expX = Math.round(ptMm.x * MM_TO_PX);
        const expY = Math.round(ptMm.y * MM_TO_PX);
        const frontC = findCrosshairCenter(calibZeroFront, expX, expY);
        const backC = findCrosshairCenter(calibZeroMirroredBack, expX, expY);
        if (!frontC || !backC) {
          calibZeroErrors.push({ ptMm, error: 'crosshair_center_not_found', frontC, backC });
          continue;
        }
        const diffX = Math.abs(frontC.x - backC.x);
        const diffY = Math.abs(frontC.y - backC.y);
        if (diffX > 1 || diffY > 1) {
          calibZeroErrors.push({ ptMm, frontC, backC, diffX, diffY });
        }
      }

      // B) Calibration PDF with offset (0.7, -0.3)
      const calibOffBytes = buildCalibrationPdf({ flip: 'long', backOffsetX: 0.7, backOffsetY: -0.3 });
      const calibOffDoc = await pdfjsLib.getDocument({ data: calibOffBytes }).promise;
      const calibOffFront = await renderPageToImageData(calibOffDoc, 1);
      const calibOffBack = await renderPageToImageData(calibOffDoc, 2);
      const calibOffMirroredBack = mirrorImageData(calibOffBack, 'long');

      const expectedDispX = -Math.round(0.7 * MM_TO_PX);
      const expectedDispY = Math.round(-0.3 * MM_TO_PX);

      const calibOffsetErrors = [];
      for (const ptMm of centersMm) {
        const expFrontX = Math.round(ptMm.x * MM_TO_PX);
        const expFrontY = Math.round(ptMm.y * MM_TO_PX);
        const frontC = findCrosshairCenter(calibOffFront, expFrontX, expFrontY);

        const expMirroredX = expFrontX + expectedDispX;
        const expMirroredY = expFrontY + expectedDispY;
        const backC = findCrosshairCenter(calibOffMirroredBack, expMirroredX, expMirroredY);

        if (!frontC || !backC) {
          calibOffsetErrors.push({ ptMm, error: 'offset_crosshair_not_found', frontC, backC });
          continue;
        }

        const actualDispX = backC.x - frontC.x;
        const actualDispY = backC.y - frontC.y;
        const errX = Math.abs(actualDispX - expectedDispX);
        const errY = Math.abs(actualDispY - expectedDispY);

        if (errX > 1 || errY > 1) {
          calibOffsetErrors.push({
            ptMm,
            frontC,
            backC,
            actual: { actualDispX, actualDispY },
            expected: { expectedDispX, expectedDispY },
            errX,
            errY,
          });
        }
      }

      return {
        positiveResults,
        negAnalysisA: {
          cardsCompared: negAnalysisA.cardsCompared,
          errorCount: negAnalysisA.cardAlignmentErrors.length,
        },
        negAnalysisB: {
          cardsCompared: negAnalysisB.cardsCompared,
          errorCount: negAnalysisB.cardAlignmentErrors.length,
        },
        calibZeroErrors,
        calibOffsetErrors,
      };
    });

    // 1. Positive controls: exactly 23 cards compared, 0 errors
    expect(result.positiveResults).toHaveLength(4);
    for (const res of result.positiveResults) {
      expect(res.analysis.cardsCompared).toBe(23);
      expect(res.analysis.cardAlignmentErrors).toEqual([]);
      expect(res.analysis.cropMarkErrors).toEqual([]);
    }

    // 2. Negative controls: confirm test detects misalignments
    // Offset mismatch (0.5mm ≈ 6px): all 23 cards must have alignment errors
    expect(result.negAnalysisA.cardsCompared).toBe(23);
    expect(result.negAnalysisA.errorCount).toBe(23);

    // Flip mismatch ('short' analyzed as 'long'): cards must have alignment errors
    expect(result.negAnalysisB.cardsCompared).toBe(23);
    expect(result.negAnalysisB.errorCount).toBeGreaterThan(0);

    // 3. Calibration sheets: centers coincide within 1 px
    expect(result.calibZeroErrors).toEqual([]);
    expect(result.calibOffsetErrors).toEqual([]);
  });
});
