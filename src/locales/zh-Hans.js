export default {
  // Meta
  'meta.title': '单词卡 PDF 生成器｜免费从 CSV 制作双面打印单词卡',

  // Header
  'app.title': '单词卡 PDF 生成器',
  'app.description': '一款从 CSV 文件生成双面打印单词卡 PDF 的网页工具。',
  'header.privacy': 'CSV 仅在浏览器本地处理，绝不会上传到任何服务器',
  'header.localeSelectAria': '选择语言',

  // AI Guide
  'ai.heading': '用 AI 从单词书或笔记照片生成 CSV',
  'ai.body': '把照片和下方的提示词发给 AI 对话助手，将返回的内容保存为 .csv 文件，并在 Step 1 中导入。',
  'ai.copy': '复制提示词',
  'ai.copied': '已复制',
  'ai.copyFailed': '复制失败，请手动选择下方提示词进行复制',
  'ai.viewPrompt': '查看提示词',
  'ai.termsNote': '※ 请在确认所使用 AI 的服务条款后再行使用。',
  'ai.prompt': `请识别所附照片中的单词卡内容，并以代码块形式输出符合以下格式的 CSV：
- 第 1 行表头必须严格为「front,back」
- 每行一张卡片，第 1 列为正面（单词或题目），第 2 列为反面（释义或答案）
- 保持卡片内容为照片中所写的语言不变
- 若单元格内包含逗号、换行或双引号，需用 "..." 将整项包裹；项内的双引号用连续两个双引号 "" 转义表示
- 数学公式使用 $...$ 格式，化学式使用 \\ce{...} 格式
- 无法看清的部分切勿自行猜测补充，请在 CSV 代码块下方集中列出说明`,

  // Step 1
  'step1.title': 'Step 1: 选择 CSV 文件',
  'step1.dropZoneAria': '选择或拖拽上传 CSV 文件',
  'step1.dropZoneText': '将文件拖拽到此处，或者',
  'step1.browse': '选择文件',
  'step1.downloadSample': '下载示例 CSV',
  'step1.helpSummary': '关于 CSV 格式与编写说明',
  'step1.helpLine1': '将第 1 列读取为<strong>正面</strong>，第 2 列读取为<strong>反面</strong>（第 3 列及之后的内容将被忽略）。',
  'step1.helpLine2': '首行表头会自动识别（如 <code>front,back</code> 等）。',
  'step1.helpLine3': '字符编码支持 <strong>UTF-8</strong>（带/不带 BOM）与 <strong>Shift_JIS</strong>（自动检测）。',
  'step1.helpLine4': '若单元格内含有换行或逗号，请遵循 RFC 4180 标准用双引号将其包裹。',

  // Summary
  'summary.cardCount': '{count} 张卡片（A4 共 {sheets} 页・双面）',

  // Step 2
  'step2.title': 'Step 2: 打印设置',
  'settings.cardsPerSheet': '每页卡片张数',
  'settings.cardsPerSheetOption': '{n} 张（{cols} 列 × {rows} 行・{w} × {h} mm）',
  'settings.cardsPerSheetHelp': '更改每页张数会调整卡片尺寸。若配合市售的 10 面名片打印纸使用，请选择 10 张。',
  'settings.flip': '装订方式',
  'settings.flipLong': '长边翻转（推荐）',
  'settings.flipShort': '短边翻转',
  'settings.offsetLegend': '反面对齐微调',
  'settings.offsetX': '反面水平偏移 X',
  'settings.offsetY': '反面垂直偏移 Y',
  'settings.offsetHelp': '以卡片反面为基准：+X 向右移，+Y 向下移（-X 向左移，-Y 向上移）。',
  'settings.cropMarks': '打印裁切标记（角线）',
  'settings.hole': '预留打孔位置（左侧居中・直径 6mm）',
  'settings.holeHelp': '打孔侧会自动留出边距以防文字被遮挡（反面也会自动对称调整）',
  'settings.holeGuide': '打孔参考标记',
  'settings.holeGuideNone': '不打印',
  'settings.holeGuideFirst': '仅每页左上角卡片',
  'settings.holeGuideAll': '所有卡片',
  'settings.calibrationBtn': '下载校准测试页',
  'settings.calibrationHelp': '将双面打印好的校准测试页对着光线透光观察，查看正面的十字线落在此面（反面）刻度的哪个坐标。将读取到的数值累加到当前偏移量中（面朝反面：+X 向右，+Y 向下）。',

  // Step 3
  'step3.title': 'Step 3: 生成 PDF',
  'step3.generate': '生成并下载 PDF',

  // Progress
  'progress.creating': '正在生成第 {done} / {total} 页',

  // Print Notice
  'printNotice.title': '打印注意事项',
  'printNotice.paperSize': '<strong>纸张大小</strong>: A4',
  'printNotice.scale': '<strong>打印缩放</strong>: 请选择「实际大小」或「100%」（切勿勾选「适合纸张大小 / 缩放到可打印区域」）。',
  'printNotice.duplexLabel': '双面打印',
  'print.duplexShort': '请设置为「双面打印・短边翻转」。',
  'print.duplexLong': '请设置为「双面打印・长边翻转」。',
  'printNotice.borderless': '<strong>无边距打印</strong>: 请务必关闭「无边距打印」（开启会导致图像被放大偏移）。',

  // Cheatsheet
  'cheatsheet.summary': '数学公式与化学式编写方法（TeX / mhchem 速查表）',
  'cheatsheet.intro': '在单元格文本中嵌入以下语法，即可美观地排版显示数学公式和化学式。',
  'cheatsheet.inlineMath': '行内公式: <code>$公式$</code> 或 <code>\\(公式\\)</code>',
  'cheatsheet.displayMath': '独立行公式（居中）: <code>$$公式$$</code> 或 <code>\\[公式\\]</code>',
  'cheatsheet.chemistry': '化学式与方程式: <code>\\ce{公式}</code>（在公式环境外也可直接书写）',
  'cheatsheet.dollar': '普通半角美元符号: <code>\\$</code>',
  'cheatsheet.thSyntax': '语法示例',
  'cheatsheet.thDescription': '说明',
  'cheatsheet.descSuperscript': '上标与乘方',
  'cheatsheet.descFraction': '分数',
  'cheatsheet.descSqrt': '平方根（根号）',
  'cheatsheet.descDisplay': '独立行公式（居中显示）',
  'cheatsheet.descWater': '化学式（水）',
  'cheatsheet.descReaction': '化学反应方程式',
  'cheatsheet.descIon': '离子电荷',
  'cheatsheet.descEquilibrium': '化学平衡可逆箭头',
  'cheatsheet.descDollar': '显示半角美元符号',

  // Confirm Dialog
  'dialog.defaultTitle': '公式检查',
  'dialog.title': '发现 {count} 处公式语法错误',
  'dialog.description': '如果直接生成，有错误的部分将以红字打印，并在卡片下方标注「⚠ 公式错误」。',
  'dialog.cancel': '返回修改',
  'dialog.proceed': '仍然生成',
  'dialog.rowSide': '第 {row} 行・{side}：',

  // Alerts & Messages
  'alert.emptyCsv': 'CSV 文件中没有有效数据。请至少输入一行单词对。',
  'alert.readFailed': '无法读取文件。请检查字符编码（UTF-8 或 Shift_JIS）及文件格式。',
  'alert.pdfFailed': '生成 PDF 时发生错误。',
  'alert.largeFile': '卡片数量超过 1,000 张（共 {count} 张），生成 PDF 可能需要几分钟。请不要关闭浏览器并耐心等待。',
  'alert.yenReplaced': '已将日元符号（¥）转换为反斜杠（\\）：共 {count} 处',
  'alert.texWarningTitle': '公式语法警告: 包含 {count} 处无效 TeX 语法，但仍将继续生成 PDF。',
  'alert.texWarningItem': '第 {row} 行・{side}：{source} — {explanation}',
  'alert.moreItems': '以及其他 {count} 项',

  // CSV sides
  'csv.sideFront': '正面',
  'csv.sideBack': '反面',

  // Calibration sheet
  'calibration.frontTitle': '【校准测试页打印说明】',
  'calibration.frontLine1': '・纸张大小: A4（纵向）',
  'calibration.frontLine2': '・双面打印: 必须开启双面打印，并选择「{flip}」',
  'calibration.frontLine3': '・打印缩放: 「实际大小」或「100%」（切勿选择「适合纸张大小」）',
  'calibration.frontLine4': '・无边距打印: 务必关闭（开启会导致图像被放大偏移）',
  'calibration.flipShort': '短边翻转',
  'calibration.flipLong': '长边翻转',
  'calibration.backTitle': '【对齐与偏移校准步骤】',
  'calibration.backLine1': '1. 打印完成后，将此反面朝向自己，对着光线透光观察。',
  'calibration.backLine2': '2. 查看正面的十字线落在此面刻度（+X/+Y）的哪个坐标位置。',
  'calibration.backLine3': '3. 将读取出的数值累加填入屏幕上的当前偏移微调项中。',
  'calibration.backLine4': '   ・面朝反面观察：+X 向右微调，-X 向左微调 / +Y 向下微调，-Y 向上微调',

  // TeX errors
  'tex.error.missingArg': '{cmd} 缺少 { } 内的必要参数',
  'tex.error.missingCloseBrace': '缺少右花括号 }',
  'tex.error.unbalancedBraces': '花括号 { } 未正确闭合或配对',
  'tex.error.undefinedCommand': '未知的命令 {cmd}（请检查拼写）',
  'tex.error.unclosedDelimiter': '{delim} 未闭合（公式需包裹在 {open} 与 {close} 之间）',
  'tex.error.doubleScript': '^ 或 _ 连续使用，请使用 { } 将其组合',
  'tex.error.unknown': '公式书写格式有误（{msg}）',
  'tex.errorNote': '⚠ 公式错误：{error}{more}',
  'tex.moreErrors': ' 及其余 {count} 处',
};