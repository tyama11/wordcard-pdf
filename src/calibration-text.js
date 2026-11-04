import { t } from './i18n.js';

/**
 * Renders instruction text for the calibration PDF sheet.
 * @param {import('jspdf').jsPDF} doc
 * @param {number} pageNumber
 * @param {'long'|'short'} flip
 */
export function drawCalibrationInstructions(doc, pageNumber, flip) {
  const canvas = document.createElement('canvas');
  const dpi = 300;
  const mmToPx = dpi / 25.4;
  const wMm = 140;
  const hMm = 55;
  canvas.width = Math.round(wMm * mmToPx);
  canvas.height = Math.round(hMm * mmToPx);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = Math.round(0.5 * mmToPx);
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  ctx.fillStyle = '#0f172a';
  const fontFam = '"Hiragino Sans","Noto Sans JP","Yu Gothic","Meiryo","PingFang SC","PingFang TC","Microsoft YaHei","Microsoft JhengHei",sans-serif';
  const maxTextWidth = canvas.width - Math.round(16 * mmToPx);

  const drawFittedText = (text, x, y, baseSizePx, isBold = false) => {
    let size = baseSizePx;
    ctx.font = `${isBold ? 'bold ' : 'normal '}${size}px ${fontFam}`;
    const measured = ctx.measureText(text).width;
    if (measured > maxTextWidth) {
      size = baseSizePx * (maxTextWidth / measured);
      ctx.font = `${isBold ? 'bold ' : 'normal '}${size}px ${fontFam}`;
    }
    ctx.fillText(text, x, y);
  };

  if (pageNumber === 1) {
    // Front page text: how to print (A4, duplex, long/short as selected, actual size/100%)
    drawFittedText(
      t('calibration.frontTitle'),
      Math.round(8 * mmToPx),
      Math.round(12 * mmToPx),
      Math.round(4.0 * mmToPx),
      true
    );

    const flipText = flip === 'short' ? t('calibration.flipShort') : t('calibration.flipLong');
    const lines = [
      t('calibration.frontLine1'),
      t('calibration.frontLine2', { flip: flipText }),
      t('calibration.frontLine3'),
      t('calibration.frontLine4'),
    ];
    let y = Math.round(20 * mmToPx);
    for (const line of lines) {
      drawFittedText(line, Math.round(8 * mmToPx), y, Math.round(3.3 * mmToPx), false);
      y += Math.round(7.2 * mmToPx);
    }
  } else {
    // Back page text: how to read calibration marks
    drawFittedText(
      t('calibration.backTitle'),
      Math.round(8 * mmToPx),
      Math.round(12 * mmToPx),
      Math.round(4.0 * mmToPx),
      true
    );

    const lines = [
      t('calibration.backLine1'),
      t('calibration.backLine2'),
      t('calibration.backLine3'),
      t('calibration.backLine4'),
    ];
    let y = Math.round(19.5 * mmToPx);
    for (const line of lines) {
      drawFittedText(line, Math.round(8 * mmToPx), y, Math.round(3.1 * mmToPx), false);
      y += Math.round(6.8 * mmToPx);
    }
  }

  const dataUrl = canvas.toDataURL('image/png');
  // Placed at center column away from center crosshair (cy = 148.5) and top crosshairs (cy = 11)
  doc.addImage(dataUrl, 'PNG', 35, 52, wMm, hMm);
}
