export default {
  // Meta
  'meta.title': '単語カードPDFメーカー｜CSVから両面印刷の単語帳を無料で作成',

  // Header
  'app.title': '単語カードPDFメーカー',
  'app.description': 'CSVファイルから両面印刷用の単語カードPDFを生成するWebツールです。',
  'header.privacy': 'CSVはブラウザ内だけで処理され、どこにも送信されません',
  'header.localeSelectAria': '言語を選択',

  // AI Guide
  'ai.heading': '単語帳やノートの写真から、AIでCSVを作れます',
  'ai.body': '写真と下の依頼文をAIチャットに渡し、返ってきた内容を .csv で保存して Step 1 で読み込んでください。',
  'ai.copy': '依頼文をコピー',
  'ai.copied': 'コピーしました',
  'ai.copyFailed': 'コピーできませんでした。下の依頼文を選択してコピーしてください',
  'ai.viewPrompt': '依頼文を見る',
  'ai.termsNote': '※ご利用のAIの利用規約を確認の上実行してください。',
  'ai.prompt': `添付した写真から単語カードのデータを読み取り、次の形式のCSVをコードブロックで出力してください。
- 1行目は「表,裏」というヘッダーにする
- 1行に1枚とし、1列目を表面（単語・問題）、2列目を裏面（意味・答え）にする
- カンマ・改行・ダブルクォートを含む項目は全体を "..." で囲み、項目内の " は "" と重ねる
- 数式は $...$、化学式は \\ce{...} の形式で書く
- 読み取れない箇所は推測で埋めず、CSVの後に一覧で知らせる`,

  // Step 1
  'step1.title': 'Step 1: CSVを選ぶ',
  'step1.dropZoneAria': 'CSVファイルを選択またはドロップ',
  'step1.dropZoneText': 'ここにファイルをドラッグ＆ドロップ、または',
  'step1.browse': 'ファイルを選択',
  'step1.downloadSample': 'サンプルCSVをダウンロード',
  'step1.helpSummary': 'CSVの形式・書き方について',
  'step1.helpLine1': '1列目を<strong>表面（表）</strong>、2列目を<strong>裏面（裏）</strong>として読み込みます（3列目以降は無視されます）。',
  'step1.helpLine2': '1行目のヘッダーは自動検出されます（<code>表|裏</code>、<code>front|back</code>、<code>問題|答え</code> など）。',
  'step1.helpLine3': '文字コードは <strong>UTF-8</strong>（BOM付き/なし）および <strong>Shift_JIS</strong> に対応しています（自動判定）。',
  'step1.helpLine4': 'セル内に改行やカンマを含む場合は、RFC 4180 規格に従いダブルクォートで囲んでください。',

  // Summary
  'summary.cardCount': '{count}枚のカード（A4 {sheets}枚・両面）',

  // Step 2
  'step2.title': 'Step 2: 印刷設定',
  'settings.cardsPerSheet': '1ページあたりの枚数',
  'settings.cardsPerSheetOption': '{n}枚（{cols}列×{rows}行・{w}×{h}mm）',
  'settings.cardsPerSheetHelp': '枚数を変えるとカードの大きさも変わります。市販の10面名刺カード用紙に合わせる場合は、10枚を選んでください。',
  'settings.flip': 'とじ方',
  'settings.flipLong': '長辺とじ（推奨）',
  'settings.flipShort': '短辺とじ',
  'settings.offsetLegend': '裏面のずれ補正',
  'settings.offsetX': '裏面オフセット X',
  'settings.offsetY': '裏面オフセット Y',
  'settings.offsetHelp': '裏面を見たとき、+X は裏面を右へ、+Y は裏面を下へ移動します（-X は左へ、-Y は上へ移動）。',
  'settings.cropMarks': 'トンボ（裁断マーク）を印刷する',
  'settings.hole': '穴あけ位置をあける（左辺中央・直径6mm）',
  'settings.holeHelp': '文字が穴にかからないよう、穴側に余白をとります（裏面も穴の位置に合わせて自動調整）',
  'settings.holeGuide': '穴の目印',
  'settings.holeGuideNone': '印刷しない',
  'settings.holeGuideFirst': '各シートの左上のカードのみ',
  'settings.holeGuideAll': 'すべてのカード',
  'settings.calibrationBtn': '位置合わせシートをダウンロード',
  'settings.calibrationHelp': '両面印刷した位置合わせシートを光に透かし、表の十字が裏の目盛りのどこに見えるかを読み取ります。読み取った値を、今の補正値に足して入力してください（裏面を見て +X＝右、+Y＝下）。',

  // Step 3
  'step3.title': 'Step 3: PDFを作る',
  'step3.generate': 'PDFを作成してダウンロード',

  // Progress
  'progress.creating': '{done} / {total} 面を作成中',

  // Print Notice
  'printNotice.title': '印刷時の注意',
  'printNotice.paperSize': '<strong>用紙サイズ</strong>: A4',
  'printNotice.scale': '<strong>倍率設定</strong>: 「実際のサイズ」または「100%」を選択してください（「ページに合わせる / 用紙に合わせる」は必ずOFF）。',
  'printNotice.duplexLabel': '両面印刷',
  'print.duplexShort': '「両面印刷・短辺とじ」に設定してください。',
  'print.duplexLong': '「両面印刷・長辺とじ」に設定してください。',
  'printNotice.borderless': '<strong>フチなし印刷</strong>: 「フチなし印刷」はOFFにしてください（拡大されて位置がずれます）。',

  // Cheatsheet
  'cheatsheet.summary': '数式・化学式の書き方（TeX・mhchem記法チートシート）',
  'cheatsheet.intro': 'セル内のテキストに以下の記法を埋め込むことで、数式や化学式をきれいに表示できます。',
  'cheatsheet.inlineMath': 'インライン数式: <code>$式$</code> または <code>\\(式\\)</code>',
  'cheatsheet.displayMath': '独立行数式（センタリング）: <code>$$式$$</code> または <code>\\[式\\]</code>',
  'cheatsheet.chemistry': '化学式・反応式: <code>\\ce{式}</code>（数式の外でもそのまま記述できます）',
  'cheatsheet.dollar': '通常のドル記号（半角）: <code>\\$</code>',
  'cheatsheet.thSyntax': '書き方（例）',
  'cheatsheet.thDescription': '説明',
  'cheatsheet.descSuperscript': '上付き添字・累乗',
  'cheatsheet.descFraction': '分数',
  'cheatsheet.descSqrt': '平方根（ルート）',
  'cheatsheet.descDisplay': '独立行数式（センタリング表示）',
  'cheatsheet.descWater': '化学式（水）',
  'cheatsheet.descReaction': '化学反応式',
  'cheatsheet.descIon': 'イオン電荷',
  'cheatsheet.descEquilibrium': '平衡反応の矢印',
  'cheatsheet.descDollar': '半角ドル記号の表示',

  // Confirm Dialog
  'dialog.defaultTitle': '数式の確認',
  'dialog.title': '数式の書き方に誤りが{count}件あります',
  'dialog.description': 'このまま作成すると、誤りのある部分は赤字で印刷され、カードの下に「⚠ 数式エラー」と表示されます。',
  'dialog.cancel': '戻って直す',
  'dialog.proceed': 'このまま作成する',
  'dialog.rowSide': '{row}行目・{side}：',

  // Alerts & Messages
  'alert.emptyCsv': 'CSVファイルに有効なデータが含まれていません。1行以上の単語ペアを入力してください。',
  'alert.readFailed': 'ファイルを読み込めませんでした。文字コード（UTF-8 または Shift_JIS）およびファイル形式をご確認ください。',
  'alert.pdfFailed': 'PDFの作成中にエラーが発生しました。',
  'alert.largeFile': 'カード数が1,000枚を超えているため（{count}枚）、PDF生成に数分かかる場合があります。ブラウザを閉じずにお待ちください。',
  'alert.yenReplaced': '円記号（¥）をバックスラッシュ（\\）として読み替えました：{count}か所',
  'alert.texWarningTitle': '数式記法エラー: {count}件の無効なTeX記法が含まれていますが、PDFはそのまま生成されます。',
  'alert.texWarningItem': '{row}行目・{side}：{source} — {explanation}',
  'alert.moreItems': 'ほか{count}件',

  // CSV sides
  'csv.sideFront': '表面',
  'csv.sideBack': '裏面',

  // Calibration sheet
  'calibration.frontTitle': '【位置合わせシートの印刷手順】',
  'calibration.frontLine1': '・用紙サイズ: A4（タテ）',
  'calibration.frontLine2': '・両面印刷: 必ず両面印刷にし、「{flip}」を選択',
  'calibration.frontLine3': '・印刷倍率: 「実際のサイズ」または「100%」（「用紙に合わせる」は必ずOFF）',
  'calibration.frontLine4': '・フチなし印刷: 必ずOFF（拡大されて位置がずれます）',
  'calibration.flipShort': '短辺とじ',
  'calibration.flipLong': '長辺とじ',
  'calibration.backTitle': '【位置合わせ（ズレ補正）の手順】',
  'calibration.backLine1': '1. 印刷後、この裏面を手前にして明るい光に透かします。',
  'calibration.backLine2': '2. 表面の十字線が、裏面の目盛り（+X/+Y）のどこに見えるかを読み取ります。',
  'calibration.backLine3': '3. 読み取った数値を、画面の現在の補正値（裏面オフセット）に足してください。',
  'calibration.backLine4': '   ・裏面を見て: +X は右へ、-X は左へ / +Y は下へ、-Y は上へ補正',

  // TeX errors
  'tex.error.missingArg': '{cmd} の { } の中身が足りません',
  'tex.error.missingCloseBrace': '閉じかっこ } が足りません',
  'tex.error.unbalancedBraces': 'かっこ { } の数が合っていません',
  'tex.error.undefinedCommand': '{cmd} という命令はありません（つづりを確認してください）',
  'tex.error.unclosedDelimiter': '{delim} が閉じられていません（数式は {open} と {close} ではさみます）',
  'tex.error.doubleScript': '^ や _ が続けて使われています。{ } でまとめてください',
  'tex.error.unknown': '数式の書き方に誤りがあります（{msg}）',
  'tex.errorNote': '⚠ 数式エラー：{error}{more}',
  'tex.moreErrors': ' ほか{count}件',
};
