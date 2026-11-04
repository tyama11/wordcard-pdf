export default {
  // Meta
  'meta.title': '單字卡 PDF 產生器｜免費將 CSV 製作成雙面列印單字卡',

  // Header
  'app.title': '單字卡 PDF 產生器',
  'app.description': '將 CSV 檔案轉換為雙面列印單字卡 PDF 的線上工具。',
  'header.privacy': 'CSV 檔案僅在瀏覽器本機端處理，絕不上傳至任何伺服器',
  'header.localeSelectAria': '選擇語言',

  // AI Guide
  'ai.heading': '用單字本或筆記照片，讓 AI 幫你產生 CSV',
  'ai.body': '將照片與下方的提示詞傳給 AI 聊天機器人，把回傳內容存成 .csv 檔案後，於 Step 1 匯入即可。',
  'ai.copy': '複製提示詞',
  'ai.copied': '已複製',
  'ai.copyFailed': '無法複製，請手動選取下方提示詞並複製',
  'ai.viewPrompt': '查看提示詞',
  'ai.termsNote': '※請先確認並遵守所使用之 AI 服務的使用條款。',
  'ai.prompt': `請讀取所附照片中的單字卡內容，並以程式碼區塊輸出符合下列格式的 CSV：
- 第 1 行的標題欄位必須正好是「front,back」
- 每 1 行代表 1 張卡片，第 1 欄為正面（單字／題目），第 2 欄為背面（釋義／答案）
- 卡片文字請保留照片中所記載的語言，不要自行翻譯
- 若內容包含逗號、換行或雙引號，請將該欄位用 "..." 包裹，且欄位內的 " 請寫成 ""
- 數學式請用 $...$、化學式請用 \\ce{...} 的格式表示
- 照片中無法辨識的部分請勿自行猜測，請在 CSV 區塊後方條列說明`,

  // Step 1
  'step1.title': 'Step 1: 選擇 CSV 檔案',
  'step1.dropZoneAria': '選取或拖曳 CSV 檔案至此',
  'step1.dropZoneText': '將檔案拖曳至此處，或',
  'step1.browse': '瀏覽檔案',
  'step1.downloadSample': '下載範例 CSV',
  'step1.helpSummary': '關於 CSV 格式與編寫說明',
  'step1.helpLine1': '系統會將第 1 欄讀取為<strong>正面</strong>、第 2 欄讀取為<strong>背面</strong>（第 3 欄以後將會忽略）。',
  'step1.helpLine2': '系統會自動辨識第 1 行的標題名稱（如 <code>front,back</code>、<code>表|裏</code>、<code>問題|答え</code> 等）。',
  'step1.helpLine3': '編碼支援 <strong>UTF-8</strong>（含/不含 BOM）與 <strong>Shift_JIS</strong>（自動判定）。',
  'step1.helpLine4': '儲存格內若包含換行或逗號，請遵循 RFC 4180 標準以雙引號括起。',

  // Summary
  'summary.cardCount': '共 {count} 張卡片（A4 共 {sheets} 頁・雙面）',

  // Step 2
  'step2.title': 'Step 2: 列印設定',
  'settings.cardsPerSheet': '每頁卡片數量',
  'settings.cardsPerSheetOption': '{n} 張（{cols} 欄 × {rows} 列・{w} × {h} mm）',
  'settings.cardsPerSheetHelp': '調整每頁張數會連帶改變卡片大小。若使用市售 10 模名片卡紙，請選擇 10 張。',
  'settings.flip': '翻頁裝訂方式',
  'settings.flipLong': '長邊裝訂（推薦）',
  'settings.flipShort': '短邊裝訂',
  'settings.offsetLegend': '背面位置偏移校正',
  'settings.offsetX': '背面水平偏移 (X)',
  'settings.offsetY': '背面垂直偏移 (Y)',
  'settings.offsetHelp': '檢視背面時，+X 會將背面內容向右移、+Y 向下移（-X 向左移、-Y 向上移）。',
  'settings.cropMarks': '列印裁切標記（裁切線）',
  'settings.hole': '預留打孔空間（左側中央・直徑 6mm）',
  'settings.holeHelp': '打孔側會自動保留邊距，避免文字被裁切或遮擋（背面位置亦會自動對應調整）',
  'settings.holeGuide': '打孔記號',
  'settings.holeGuideNone': '不列印記號',
  'settings.holeGuideFirst': '僅每張紙左上角的卡片',
  'settings.holeGuideAll': '所有卡片',
  'settings.calibrationBtn': '下載校正對齊試印表',
  'settings.calibrationHelp': '將雙面列印出的校正表對著光線透視，觀察正面十字落在背面刻度的位置。將讀取到的數值加到目前的校正值中即可（檢視背面時：+X＝向右，+Y＝向下）。',

  // Step 3
  'step3.title': 'Step 3: 產生 PDF',
  'step3.generate': '產生並下載 PDF',

  // Progress
  'progress.creating': '正在建立第 {done} / {total} 面',

  // Print Notice
  'printNotice.title': '列印注意事項',
  'printNotice.paperSize': '<strong>紙張尺寸</strong>: A4',
  'printNotice.scale': '<strong>列印比例</strong>: 請選擇「實際大小」或「100%」（務必關閉「配合紙張大小／適合頁面」）。',
  'printNotice.duplexLabel': '雙面列印',
  'print.duplexShort': '請在印表機設定中選擇「雙面列印・短邊裝訂」。',
  'print.duplexLong': '請在印表機設定中選擇「雙面列印・長邊裝訂」。',
  'printNotice.borderless': '<strong>無邊界列印</strong>: 請務必關閉「無邊界列印」（否則會因影像放大導致正反面對不齊）。',

  // Cheatsheet
  'cheatsheet.summary': '數學式與化學式語法說明（TeX・mhchem 語法速查表）',
  'cheatsheet.intro': '在儲存格文字中加入以下語法，即可排版顯示精美的數學式或化學式。',
  'cheatsheet.inlineMath': '行內數學式: <code>$式子$</code> 或 <code>\\(式子\\)</code>',
  'cheatsheet.displayMath': '獨立行數學式（置中）: <code>$$式子$$</code> 或 <code>\\[式子\\]</code>',
  'cheatsheet.chemistry': '化學式／反應式: <code>\\ce{式子}</code>（在數學式外亦可直接使用）',
  'cheatsheet.dollar': '半形錢字號: <code>\\$</code>',
  'cheatsheet.thSyntax': '語法（範例）',
  'cheatsheet.thDescription': '說明',
  'cheatsheet.descSuperscript': '上標／次方',
  'cheatsheet.descFraction': '分數',
  'cheatsheet.descSqrt': '平方根（根號）',
  'cheatsheet.descDisplay': '獨立行數學式（置中顯示）',
  'cheatsheet.descWater': '化學式（水分子）',
  'cheatsheet.descReaction': '化學反應式',
  'cheatsheet.descIon': '離子電荷',
  'cheatsheet.descEquilibrium': '平衡反應箭頭',
  'cheatsheet.descDollar': '顯示半形錢字號',

  // Confirm Dialog
  'dialog.defaultTitle': '確認數學式語法',
  'dialog.title': '發現 {count} 處數學式語法錯誤',
  'dialog.description': '若直接產生，錯誤的部分將以紅字印出，卡片下方亦會標示「⚠ 數學式錯誤」。',
  'dialog.cancel': '返回修改',
  'dialog.proceed': '略過並繼續產生',
  'dialog.rowSide': '第 {row} 列・{side}：',

  // Alerts & Messages
  'alert.emptyCsv': 'CSV 檔案中未包含有效資料。請至少輸入 1 組單字資料。',
  'alert.readFailed': '無法讀取檔案。請確認檔案編碼（UTF-8 或 Shift_JIS）及格式是否正確。',
  'alert.pdfFailed': '產生 PDF 時發生錯誤。',
  'alert.largeFile': '卡片數量超過 1,000 張（共 {count} 張），產生 PDF 可能需要數分鐘。請不要關閉瀏覽器並耐心等候。',
  'alert.yenReplaced': '已自動將日圓符號（¥）替換為反斜線（\\）：共 {count} 處',
  'alert.texWarningTitle': '數學式語法警告: 包含 {count} 處無效的 TeX 語法，但仍會繼續產生 PDF。',
  'alert.texWarningItem': '第 {row} 列・{side}：{source} — {explanation}',
  'alert.moreItems': '以及其他 {count} 項',

  // CSV sides
  'csv.sideFront': '正面',
  'csv.sideBack': '背面',

  // Calibration sheet
  'calibration.frontTitle': '【校正對齊試印表 列印說明】',
  'calibration.frontLine1': '・紙張尺寸: A4（縱向／直向）',
  'calibration.frontLine2': '・雙面列印: 請務必開啟雙面列印，並選擇「{flip}」',
  'calibration.frontLine3': '・列印比例: 「實際大小」或「100%」（切勿勾選「配合紙張大小」）',
  'calibration.frontLine4': '・無邊界列印: 請務必關閉（否則影像放大會導致位置偏移）',
  'calibration.flipShort': '短邊裝訂',
  'calibration.flipLong': '長邊裝訂',
  'calibration.backTitle': '【校正對齊（偏移補正）操作步驟】',
  'calibration.backLine1': '1. 列印後，背面朝向自己並對著光源透光檢視。',
  'calibration.backLine2': '2. 觀察正面十字線落在背面刻度（+X/+Y）的哪個數值上。',
  'calibration.backLine3': '3. 將讀取的數值累加到畫面中的目前設定值（背面偏移補正）。',
  'calibration.backLine4': '   ・檢視背面時: +X 向右補正、-X 向左補正 / +Y 向下補正、-Y 向上補正',

  // TeX errors
  'tex.error.missingArg': '{cmd} 的 { } 缺少必要內容',
  'tex.error.missingCloseBrace': '缺少結尾大括號 }',
  'tex.error.unbalancedBraces': '大括號 { } 數量不對稱',
  'tex.error.undefinedCommand': '未定義的指令 {cmd}（請檢查拼字是否正確）',
  'tex.error.unclosedDelimiter': '{delim} 未正確封閉（數學式前後需以 {open} 與 {close} 包裹）',
  'tex.error.doubleScript': '^ 或 _ 連續使用，請使用 { } 包裹',
  'tex.error.unknown': '數學式語法有誤（{msg}）',
  'tex.errorNote': '⚠ 數學式錯誤：{error}{more}',
  'tex.moreErrors': ' 以及其他 {count} 項',
};
