export default {
  // Meta
  'meta.title': 'Word Card PDF Maker | Free Printable Double-Sided Flashcards from CSV',

  // Header
  'app.title': 'Word Card PDF Maker',
  'app.description': 'A web tool to generate double-sided printable flashcard PDFs from a CSV file.',
  'header.privacy': 'CSV files are processed entirely in your browser and never uploaded anywhere.',
  'header.localeSelectAria': 'Select language',

  // AI Guide
  'ai.heading': 'Generate a CSV from photos of vocabulary lists or notebooks using AI',
  'ai.body': 'Give your photo and the prompt below to an AI chat, save the output as a .csv file, and upload it in Step 1.',
  'ai.copy': 'Copy Prompt',
  'ai.copied': 'Copied!',
  'ai.copyFailed': 'Failed to copy. Please select and copy the prompt below manually.',
  'ai.viewPrompt': 'View Prompt',
  'ai.termsNote': '* Please check the terms of service of your AI tool before use.',
  'ai.prompt': `Please read the flashcard data from the attached photo and output a CSV inside a code block in the following format:
- The first line must have the header line exactly: front,back
- One card per line; column 1 is the front (word/question), column 2 is the back (meaning/answer)
- Keep the card text in the language written in the photo
- If a field contains commas, line breaks, or double quotes, enclose the entire field in "..." and escape internal " as ""
- Format math formulas as $...$ and chemical formulas as \\ce{...}
- Do not guess unreadable text; list any illegible parts after the CSV`,

  // Step 1
  'step1.title': 'Step 1: Choose CSV',
  'step1.dropZoneAria': 'Select or drop CSV file',
  'step1.dropZoneText': 'Drag and drop a file here, or',
  'step1.browse': 'Browse files',
  'step1.downloadSample': 'Download Sample CSV',
  'step1.helpSummary': 'CSV format and instructions',
  'step1.helpLine1': 'Column 1 is loaded as the <strong>front</strong> and column 2 as the <strong>back</strong> (subsequent columns are ignored).',
  'step1.helpLine2': 'Header row is detected automatically (e.g. <code>front,back</code>, <code>表|裏</code>, <code>問題|答え</code>).',
  'step1.helpLine3': 'Supported character encodings: <strong>UTF-8</strong> (with or without BOM) and <strong>Shift_JIS</strong> (auto-detected).',
  'step1.helpLine4': 'If a cell contains line breaks or commas, enclose it in double quotes according to the RFC 4180 standard.',

  // Summary
  'summary.cardCount': '{count} cards ({sheets} A4 double-sided sheets)',

  // Step 2
  'step2.title': 'Step 2: Print Settings',
  'settings.cardsPerSheet': 'Cards per sheet',
  'settings.cardsPerSheetOption': '{n} cards ({cols} cols × {rows} rows, {w} × {h} mm)',
  'settings.cardsPerSheetHelp': 'Changing the count changes the card size. Select 10 cards to match standard 10-up business card perforated paper.',
  'settings.flip': 'Binding',
  'settings.flipLong': 'Long-edge binding (Recommended)',
  'settings.flipShort': 'Short-edge binding',
  'settings.offsetLegend': 'Back alignment calibration',
  'settings.offsetX': 'Back offset X',
  'settings.offsetY': 'Back offset Y',
  'settings.offsetHelp': 'Looking at the back of the page, +X shifts the back to the right and +Y shifts it down (-X shifts left, -Y shifts up).',
  'settings.cropMarks': 'Print crop marks',
  'settings.hole': 'Leave space for punch hole (centered on left edge, 6mm diameter)',
  'settings.holeHelp': 'Adds margin on the punch side so text won’t overlap the hole (back side is automatically adjusted to match).',
  'settings.holeGuide': 'Punch mark guide',
  'settings.holeGuideNone': 'Do not print',
  'settings.holeGuideFirst': 'Top-left card of each sheet only',
  'settings.holeGuideAll': 'All cards',
  'settings.calibrationBtn': 'Download Calibration Sheet',
  'settings.calibrationHelp': 'Hold the double-sided printed calibration sheet up to light and check where the front crosshair aligns on the back scale. Add the measured value to your current offset (+X = right, +Y = down when viewing the back).',

  // Step 3
  'step3.title': 'Step 3: Generate PDF',
  'step3.generate': 'Generate and Download PDF',

  // Progress
  'progress.creating': 'Generating page {done} / {total}',

  // Print Notice
  'printNotice.title': 'Printing Tips',
  'printNotice.paperSize': '<strong>Paper size</strong>: A4',
  'printNotice.scale': '<strong>Scale</strong>: Select "Actual Size" or "100%" (ensure "Fit to page / Scale to fit" is OFF).',
  'printNotice.duplexLabel': 'Double-sided printing',
  'print.duplexShort': 'Set to "Double-sided printing, short-edge binding".',
  'print.duplexLong': 'Set to "Double-sided printing, long-edge binding".',
  'printNotice.borderless': '<strong>Borderless printing</strong>: Turn OFF borderless printing (it enlarges the page and causes misalignment).',

  // Cheatsheet
  'cheatsheet.summary': 'How to write math & chemical formulas (TeX & mhchem cheatsheet)',
  'cheatsheet.intro': 'You can format math and chemical formulas cleanly by embedding the following syntax in cell text.',
  'cheatsheet.inlineMath': 'Inline math: <code>$formula$</code> or <code>\\(formula\\)</code>',
  'cheatsheet.displayMath': 'Block math (centered): <code>$$formula$$</code> or <code>\\[formula\\]</code>',
  'cheatsheet.chemistry': 'Chemical formula / reaction: <code>\\ce{...}</code> (works outside math mode too)',
  'cheatsheet.dollar': 'Literal dollar sign: <code>\\$</code>',
  'cheatsheet.thSyntax': 'Syntax (example)',
  'cheatsheet.thDescription': 'Description',
  'cheatsheet.descSuperscript': 'Superscript / Power',
  'cheatsheet.descFraction': 'Fraction',
  'cheatsheet.descSqrt': 'Square root',
  'cheatsheet.descDisplay': 'Block math (centered display)',
  'cheatsheet.descWater': 'Chemical formula (water)',
  'cheatsheet.descReaction': 'Chemical equation',
  'cheatsheet.descIon': 'Ionic charge',
  'cheatsheet.descEquilibrium': 'Equilibrium reaction arrow',
  'cheatsheet.descDollar': 'Display dollar sign',

  // Confirm Dialog
  'dialog.defaultTitle': 'Check Math Formulas',
  'dialog.title': 'Found {count} error(s) in math formula syntax',
  'dialog.description': 'If you proceed, errors will be printed in red with "⚠ Math Error" shown at the bottom of the card.',
  'dialog.cancel': 'Go Back and Edit',
  'dialog.proceed': 'Proceed Anyway',
  'dialog.rowSide': 'Row {row}, {side}:',

  // Alerts & Messages
  'alert.emptyCsv': 'The CSV file contains no valid data. Please enter at least one card pair.',
  'alert.readFailed': 'Failed to read file. Please check character encoding (UTF-8 or Shift_JIS) and file format.',
  'alert.pdfFailed': 'An error occurred while generating the PDF.',
  'alert.largeFile': 'With over 1,000 cards ({count} cards), PDF generation may take a few minutes. Please keep your browser window open.',
  'alert.yenReplaced': 'Replaced yen sign (¥) with backslash (\\): {count} occurrence(s)',
  'alert.texWarningTitle': 'Math syntax warning: {count} invalid TeX expression(s) found, but PDF will still be generated.',
  'alert.texWarningItem': 'Row {row}, {side}: {source} — {explanation}',
  'alert.moreItems': 'and {count} more',

  // CSV sides
  'csv.sideFront': 'Front',
  'csv.sideBack': 'Back',

  // Calibration sheet
  'calibration.frontTitle': '[Calibration Sheet Printing Instructions]',
  'calibration.frontLine1': '• Paper size: A4 (Portrait)',
  'calibration.frontLine2': '• Double-sided printing: Must be duplex, select "{flip}"',
  'calibration.frontLine3': '• Scale: "Actual Size" or "100%" ("Fit to page" must be OFF)',
  'calibration.frontLine4': '• Borderless printing: Must be OFF (enlarging causes misalignment)',
  'calibration.flipShort': 'Short-edge binding',
  'calibration.flipLong': 'Long-edge binding',
  'calibration.backTitle': '[Alignment Calibration Instructions]',
  'calibration.backLine1': '1. After printing, hold this sheet up to bright light with this back side facing you.',
  'calibration.backLine2': '2. Note where the front crosshair aligns against the back grid (+X / +Y).',
  'calibration.backLine3': '3. Add the read values to the current offset settings (Back offset) on screen.',
  'calibration.backLine4': '   • Looking at the back: +X shifts right, -X shifts left / +Y shifts down, -Y shifts up',

  // TeX errors
  'tex.error.missingArg': 'Missing argument inside { } for {cmd}',
  'tex.error.missingCloseBrace': 'Missing closing brace }',
  'tex.error.unbalancedBraces': 'Unbalanced braces { }',
  'tex.error.undefinedCommand': 'Undefined command: {cmd} (check spelling)',
  'tex.error.unclosedDelimiter': 'Unclosed delimiter {delim} (enclose math in {open} and {close})',
  'tex.error.doubleScript': 'Consecutive ^ or _ found. Group them using { }',
  'tex.error.unknown': 'Math formula syntax error ({msg})',
  'tex.errorNote': '⚠ Math error: {error}{more}',
  'tex.moreErrors': ' and {count} more',
};
