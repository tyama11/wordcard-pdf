export default {
  // Meta
  'meta.title': 'Creador de tarjetas de vocabulario en PDF | Cree tarjetas para impresión a doble cara gratis desde un CSV',

  // Header
  'app.title': 'Creador de tarjetas de vocabulario en PDF',
  'app.description': 'Herramienta web para generar tarjetas de vocabulario en PDF listas para imprimir a doble cara a partir de un archivo CSV.',
  'header.privacy': 'El CSV se procesa únicamente en el navegador y no se envía a ningún servidor',
  'header.localeSelectAria': 'Seleccionar idioma',

  // AI Guide
  'ai.heading': 'Genere un CSV con IA a partir de fotos de sus notas o tarjetas',
  'ai.body': 'Envíe la foto y el siguiente prompt a un chat de IA, guarde la respuesta como .csv y cárguela en el Paso 1.',
  'ai.copy': 'Copiar prompt',
  'ai.copied': 'Copiado',
  'ai.copyFailed': 'No se pudo copiar. Seleccione y copie el prompt que aparece abajo.',
  'ai.viewPrompt': 'Ver prompt',
  'ai.termsNote': '* Revise los términos de servicio de la IA utilizada antes de continuar.',
  'ai.prompt': `Lea los datos de las tarjetas de vocabulario a partir de la foto adjunta y genere un archivo CSV en un bloque de código con el siguiente formato.
- La primera línea debe ser exactamente el encabezado: front,back
- Una tarjeta por línea, colocando el anverso (palabra/pregunta) en la primera columna y el reverso (significado/respuesta) en la segunda columna
- Mantenga el texto de las tarjetas en el mismo idioma en que está escrito en la foto
- Si un campo contiene comas, saltos de línea o comillas dobles, enciérrelo entre comillas dobles "..." y duplique las comillas internas ""
- Escriba las fórmulas matemáticas como $...$ y las químicas como \\ce{...}
- No adivine las partes ilegibles; indíquelas en una lista después del CSV`,

  // Step 1
  'step1.title': 'Paso 1: Seleccionar archivo CSV',
  'step1.dropZoneAria': 'Seleccionar o arrastrar archivo CSV',
  'step1.dropZoneText': 'Arrastre y suelte el archivo aquí, o',
  'step1.browse': 'Examinar archivo',
  'step1.downloadSample': 'Descargar CSV de ejemplo',
  'step1.helpSummary': 'Sobre el formato y la estructura del CSV',
  'step1.helpLine1': 'La primera columna se lee como <strong>anverso</strong> y la segunda como <strong>reverso</strong> (las columnas a partir de la tercera se ignoran).',
  'step1.helpLine2': 'El encabezado de la primera fila se detecta automáticamente (<code>表|裏</code>, <code>front|back</code>, <code>問題|答え</code>, etc.).',
  'step1.helpLine3': 'Compatible con codificación <strong>UTF-8</strong> (con/sin BOM) y <strong>Shift_JIS</strong> (detección automática).',
  'step1.helpLine4': 'Si una celda contiene saltos de línea o comas, enciérrela entre comillas dobles conforme al estándar RFC 4180.',

  // Summary
  'summary.cardCount': '{count} tarjetas ({sheets} hojas A4 · doble cara)',

  // Step 2
  'step2.title': 'Paso 2: Configuración de impresión',
  'settings.cardsPerSheet': 'Tarjetas por página',
  'settings.cardsPerSheetOption': '{n} tarjetas ({cols} col × {rows} filas · {w} × {h} mm)',
  'settings.cardsPerSheetHelp': 'Al cambiar el número de tarjetas varía también su tamaño. Elija 10 si utiliza hojas comerciales microperforadas para tarjetas de presentación de 10 unidades.',
  'settings.flip': 'Orientación de doble cara',
  'settings.flipLong': 'Voltear por el borde largo (recomendado)',
  'settings.flipShort': 'Voltear por el borde corto',
  'settings.offsetLegend': 'Ajuste de alineación del reverso',
  'settings.offsetX': 'Desplazamiento X del reverso',
  'settings.offsetY': 'Desplazamiento Y del reverso',
  'settings.offsetHelp': 'Mirando el reverso: +X desplaza el reverso hacia la derecha y +Y hacia abajo (-X hacia la izquierda, -Y hacia arriba).',
  'settings.cropMarks': 'Imprimir marcas de corte',
  'settings.hole': 'Espacio para perforación (borde izquierdo centrado, diám. 6 mm)',
  'settings.holeHelp': 'Añade margen en el lado de la perforación para no tapar el texto (se ajusta automáticamente también en el reverso).',
  'settings.holeGuide': 'Guía de perforación',
  'settings.holeGuideNone': 'No imprimir',
  'settings.holeGuideFirst': 'Solo en la primera tarjeta de cada hoja',
  'settings.holeGuideAll': 'En todas las tarjetas',
  'settings.calibrationBtn': 'Descargar hoja de calibración',
  'settings.calibrationHelp': 'Imprima la hoja de calibración a doble cara y colóquela a contraluz para ver dónde coincide la cruz del anverso con la escala del reverso. Sume ese valor a la corrección actual (mirando el reverso: +X = derecha, +Y = abajo).',

  // Step 3
  'step3.title': 'Paso 3: Crear PDF',
  'step3.generate': 'Crear y descargar PDF',

  // Progress
  'progress.creating': 'Creando página {done} de {total}',

  // Print Notice
  'printNotice.title': 'Instrucciones de impresión',
  'printNotice.paperSize': '<strong>Tamaño de papel</strong>: A4',
  'printNotice.scale': '<strong>Escala</strong>: Seleccione «Tamaño real» o «100%» (asegúrese de desactivar «Ajustar a la página / al papel»).',
  'printNotice.duplexLabel': 'Impresión a doble cara',
  'print.duplexShort': 'Configure la impresora en «Doble cara: voltear por el borde corto».',
  'print.duplexLong': 'Configure la impresora en «Doble cara: voltear por el borde largo».',
  'printNotice.borderless': '<strong>Impresión sin bordes</strong>: Desactive la opción «Sin bordes» (evita ampliaciones y desalineaciones).',

  // Cheatsheet
  'cheatsheet.summary': 'Cómo escribir fórmulas matemáticas y químicas (guía rápida de TeX / mhchem)',
  'cheatsheet.intro': 'Inserte la siguiente sintaxis en el texto de las celdas para formatear fórmulas matemáticas y químicas con precisión.',
  'cheatsheet.inlineMath': 'Fórmula en línea: <code>$fórmula$</code> o <code>\\(fórmula\\)</code>',
  'cheatsheet.displayMath': 'Fórmula en bloque (centrada): <code>$$fórmula$$</code> o <code>\\[fórmula\\]</code>',
  'cheatsheet.chemistry': 'Fórmulas y reacciones químicas: <code>\\ce{fórmula}</code> (se puede escribir directamente fuera del modo matemático)',
  'cheatsheet.dollar': 'Símbolo de dólar ordinario: <code>\\$</code>',
  'cheatsheet.thSyntax': 'Sintaxis (ejemplo)',
  'cheatsheet.thDescription': 'Descripción',
  'cheatsheet.descSuperscript': 'Superíndice / potencia',
  'cheatsheet.descFraction': 'Fracción',
  'cheatsheet.descSqrt': 'Raíz cuadrada',
  'cheatsheet.descDisplay': 'Fórmula en bloque (centrada)',
  'cheatsheet.descWater': 'Fórmula química (agua)',
  'cheatsheet.descReaction': 'Ecuación química',
  'cheatsheet.descIon': 'Carga iónica',
  'cheatsheet.descEquilibrium': 'Flecha de equilibrio químico',
  'cheatsheet.descDollar': 'Mostrar el símbolo de dólar',

  // Confirm Dialog
  'dialog.defaultTitle': 'Revisión de fórmulas',
  'dialog.title': 'Se encontraron {count} errores en la sintaxis de las fórmulas',
  'dialog.description': 'Si continúa, las partes con errores se imprimirán en rojo y se mostrará el aviso «⚠ Error en fórmula» al pie de la tarjeta.',
  'dialog.cancel': 'Volver y corregir',
  'dialog.proceed': 'Continuar y crear de todos modos',
  'dialog.rowSide': 'Fila {row} · {side}:',

  // Alerts & Messages
  'alert.emptyCsv': 'El archivo CSV no contiene datos válidos. Ingrese al menos una fila con un par de términos.',
  'alert.readFailed': 'No se pudo leer el archivo. Verifique la codificación (UTF-8 o Shift_JIS) y el formato del archivo.',
  'alert.pdfFailed': 'Ocurrió un error al crear el PDF.',
  'alert.largeFile': 'El archivo contiene más de 1.000 tarjetas ({count} tarjetas); la generación del PDF puede tardar varios minutos. No cierre el navegador mientras se procesa.',
  'alert.yenReplaced': 'Se sustituyó el símbolo de yen (¥) por una barra invertida (\\): {count} ocurrencias',
  'alert.texWarningTitle': 'Errores de sintaxis TeX: se detectaron {count} expresiones TeX no válidas, pero el PDF se generará igualmente.',
  'alert.texWarningItem': 'Fila {row} · {side}: {source} — {explanation}',
  'alert.moreItems': 'y {count} más',

  // CSV sides
  'csv.sideFront': 'Anverso',
  'csv.sideBack': 'Reverso',

  // Calibration sheet
  'calibration.frontTitle': '【Instrucciones de impresión de la hoja de calibración】',
  'calibration.frontLine1': '· Tamaño de papel: A4 (vertical)',
  'calibration.frontLine2': '· Impresión a doble cara: imprima siempre a doble cara y seleccione «{flip}»',
  'calibration.frontLine3': '· Escala de impresión: «Tamaño real» o «100%» (desactive siempre «Ajustar a la página»)',
  'calibration.frontLine4': '· Impresión sin bordes: desactive siempre esta opción (provoca ampliaciones y desalineaciones)',
  'calibration.flipShort': 'Voltear por el borde corto',
  'calibration.flipLong': 'Voltear por el borde largo',
  'calibration.backTitle': '【Instrucciones de alineación y ajuste】',
  'calibration.backLine1': '1. Tras la impresión, coloque esta hoja a contraluz mirando hacia el reverso.',
  'calibration.backLine2': '2. Compruebe en qué punto de la escala del reverso (+X / +Y) se visualiza la cruz del anverso.',
  'calibration.backLine3': '3. Sume los valores observados a los valores de ajuste actuales en la pantalla (desplazamiento del reverso).',
  'calibration.backLine4': '   · Mirando el reverso: +X desplaza a la derecha, -X a la izquierda / +Y hacia abajo, -Y hacia arriba',

  // TeX errors
  'tex.error.missingArg': 'Falta el contenido entre llaves { } para {cmd}',
  'tex.error.missingCloseBrace': 'Falta la llave de cierre }',
  'tex.error.unbalancedBraces': 'Las llaves { } no están equilibradas',
  'tex.error.undefinedCommand': 'El comando {cmd} no existe (verifique la ortografía)',
  'tex.error.unclosedDelimiter': 'El delimitador {delim} no está cerrado (las fórmulas deben encerrarse entre {open} y {close})',
  'tex.error.doubleScript': 'Se han utilizado ^ o _ de forma consecutiva. Agrupe los elementos con llaves { }',
  'tex.error.unknown': 'Error en la sintaxis de la fórmula ({msg})',
  'tex.errorNote': '⚠ Error en fórmula: {error}{more}',
  'tex.moreErrors': ' y {count} más',
};
