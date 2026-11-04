/**
 * Renders Japanese instruction text for the calibration PDF sheet.
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
  const fontFam = '"Hiragino Sans","Noto Sans JP","Yu Gothic","Meiryo",sans-serif';

  if (pageNumber === 1) {
    // Front page text: how to print (A4, 両面, 長辺/短辺 as selected, 実際のサイズ/100%)
    ctx.font = `bold ${Math.round(4.0 * mmToPx)}px ${fontFam}`;
    ctx.fillText('【位置合わせシートの印刷手順】', Math.round(8 * mmToPx), Math.round(12 * mmToPx));

    ctx.font = `normal ${Math.round(3.3 * mmToPx)}px ${fontFam}`;
    const lines = [
      '・用紙サイズ: A4（タテ）',
      `・両面印刷: 必ず両面印刷にし、「${flip === 'short' ? '短辺とじ' : '長辺とじ'}」を選択`,
      '・印刷倍率: 「実際のサイズ」または「100%」（「用紙に合わせる」は必ずOFF）',
      '・フチなし印刷: 必ずOFF（拡大されて位置がずれます）',
    ];
    let y = Math.round(20 * mmToPx);
    for (const line of lines) {
      ctx.fillText(line, Math.round(8 * mmToPx), y);
      y += Math.round(7.2 * mmToPx);
    }
  } else {
    // Back page text: how to read (光に透かす, 表の十字が裏の目盛りのどこに見えるか読む, その値を現在の補正値に足す, +X=右 +Y=下（裏面を見て）)
    ctx.font = `bold ${Math.round(4.0 * mmToPx)}px ${fontFam}`;
    ctx.fillText('【位置合わせ（ズレ補正）の手順】', Math.round(8 * mmToPx), Math.round(12 * mmToPx));

    ctx.font = `normal ${Math.round(3.1 * mmToPx)}px ${fontFam}`;
    const lines = [
      '1. 印刷後、この裏面を手前にして明るい光に透かします。',
      '2. 表面の十字線が、裏面の目盛り（+X/+Y）のどこに見えるかを読み取ります。',
      '3. 読み取った数値を、画面の現在の補正値（裏面オフセット）に足してください。',
      '   ・裏面を見て: +X は右へ、-X は左へ / +Y は下へ、-Y は上へ補正',
    ];
    let y = Math.round(19.5 * mmToPx);
    for (const line of lines) {
      ctx.fillText(line, Math.round(8 * mmToPx), y);
      y += Math.round(6.8 * mmToPx);
    }
  }

  const dataUrl = canvas.toDataURL('image/png');
  // Placed at center column away from center crosshair (cy = 148.5) and top crosshairs (cy = 11)
  doc.addImage(dataUrl, 'PNG', 35, 52, wMm, hMm);
}
