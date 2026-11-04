import { describe, it, expect, beforeEach } from 'vitest';
import {
  LOCALES,
  LOCALE_NAMES,
  detectLocale,
  resolveInitialLocale,
  getLocale,
  setLocale,
  onLocaleChange,
  t,
  applyTranslations,
} from '../../src/i18n.js';
import ja from '../../src/locales/ja.js';
import en from '../../src/locales/en.js';
import es from '../../src/locales/es.js';
import zhHans from '../../src/locales/zh-Hans.js';
import zhHant from '../../src/locales/zh-Hant.js';

describe('detectLocale', () => {
  it('compares the primary language subtag, not a prefix', () => {
    expect(detectLocale(['jam'])).toBe('en');
    expect(detectLocale(['esu', 'es-419'])).toBe('es');
    expect(detectLocale(['zh_TW'])).toBe('zh-Hant');
  });

  const table = [
    { languages: ['ja-JP'], ua: '', expected: 'ja', label: 'ja-JP' },
    { languages: ['en-US'], ua: '', expected: 'en', label: 'en-US' },
    { languages: ['es-MX'], ua: '', expected: 'es', label: 'es-MX' },
    { languages: ['zh'], ua: '', expected: 'zh-Hans', label: 'zh' },
    { languages: ['zh-CN'], ua: '', expected: 'zh-Hans', label: 'zh-CN' },
    { languages: ['zh-SG'], ua: '', expected: 'zh-Hans', label: 'zh-SG' },
    { languages: ['zh-TW'], ua: '', expected: 'zh-Hant', label: 'zh-TW' },
    { languages: ['zh-HK'], ua: '', expected: 'zh-Hant', label: 'zh-HK' },
    { languages: ['ZH-hant-tw'], ua: '', expected: 'zh-Hant', label: 'ZH-hant-tw' },
    { languages: ['fr'], ua: '', expected: 'en', label: 'fr -> en' },
    { languages: ['fr', 'es'], ua: '', expected: 'es', label: "['fr', 'es'] -> es" },
    { languages: [], ua: '', expected: 'en', label: 'empty -> en' },
    {
      languages: ['en-US'],
      ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      expected: 'ja',
      label: 'Googlebot UA -> ja',
    },
  ];

  for (const { languages, ua, expected, label } of table) {
    it(`resolves ${label} to ${expected}`, () => {
      expect(detectLocale(languages, ua)).toBe(expected);
    });
  }
});

describe('t() translation function', () => {
  beforeEach(() => {
    setLocale('ja');
  });

  it('translates existing keys in current locale', () => {
    expect(t('step1.browse')).toBe('ファイルを選択');
    expect(t('app.title')).toBe('単語カードPDFメーカー');
  });

  it('falls back to ja when current locale lacks the key', () => {
    setLocale('en');
    expect(t('step1.browse')).toBe('ファイルを選択');
  });

  it('returns key itself when key is missing from current locale and ja fallback', () => {
    expect(t('some.unknown.key')).toBe('some.unknown.key');
  });

  it('replaces named placeholders with params', () => {
    const summary = t('summary.cardCount', { count: 23, sheets: 3 });
    expect(summary).toBe('23枚のカード（A4 3枚・両面）');

    const opt = t('settings.cardsPerSheetOption', {
      n: 10,
      cols: 2,
      rows: 5,
      w: 91,
      h: 55,
    });
    expect(opt).toBe('10枚（2列×5行・91×55mm）');
  });

  it('leaves placeholders intact when param is missing', () => {
    const partial = t('summary.cardCount', { count: 12 });
    expect(partial).toBe('12枚のカード（A4 {sheets}枚・両面）');
  });
});

describe('Locale completeness', () => {
  const otherLocales = {
    en,
    es,
    'zh-Hans': zhHans,
    'zh-Hant': zhHant,
  };

  function extractPlaceholders(str) {
    if (typeof str !== 'string') return [];
    const matches = str.match(/\{([a-zA-Z0-9_]+)\}/g);
    return matches ? matches.sort() : [];
  }

  for (const [loc, dict] of Object.entries(otherLocales)) {
    const hasKeys = Object.keys(dict).length > 0;
    const itFn = hasKeys ? it : it.skip;

    itFn(`verifies key set and placeholders for ${loc}`, () => {
      expect(Object.keys(dict).sort()).toEqual(Object.keys(ja).sort());

      for (const [key, jaText] of Object.entries(ja)) {
        const transText = dict[key];
        expect(extractPlaceholders(transText)).toEqual(extractPlaceholders(jaText));
      }
    });
  }
});
