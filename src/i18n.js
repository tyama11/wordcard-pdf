import ja from './locales/ja.js';
import en from './locales/en.js';
import es from './locales/es.js';
import zhHans from './locales/zh-Hans.js';
import zhHant from './locales/zh-Hant.js';

export const LOCALES = ['ja', 'en', 'es', 'zh-Hans', 'zh-Hant'];

export const LOCALE_NAMES = {
  ja: '日本語',
  en: 'English',
  es: 'Español',
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文',
};

const translations = {
  ja,
  en,
  es,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
};

let currentLocale = 'ja';
const listeners = new Set();

/**
 * Pure function detecting the best matching locale.
 * If userAgent matches /bot|crawl|spider|slurp/i return 'ja'.
 * Otherwise takes the first entry of languages matching supported language:
 * ja* -> ja, en* -> en, es* -> es;
 * for zh: zh-Hant, zh-TW, zh-HK, zh-MO -> zh-Hant, any other zh* -> zh-Hans.
 * Matching is case-insensitive. No match -> 'en'.
 *
 * @param {string[]|string|null|undefined} languages
 * @param {string|null|undefined} userAgent
 * @returns {'ja'|'en'|'es'|'zh-Hans'|'zh-Hant'}
 */
export function detectLocale(languages, userAgent) {
  if (typeof userAgent === 'string' && /bot|crawl|spider|slurp/i.test(userAgent)) {
    return 'ja';
  }

  const list = Array.isArray(languages)
    ? languages
    : (typeof languages === 'string' ? [languages] : []);

  for (const raw of list) {
    if (typeof raw !== 'string') continue;
    const tag = raw.trim().toLowerCase();
    if (!tag) continue;

    const primary = tag.split(/[-_]/)[0];
    if (primary === 'ja') return 'ja';
    if (primary === 'en') return 'en';
    if (primary === 'es') return 'es';

    if (primary === 'zh') {
      if (
        tag.startsWith('zh-hant') ||
        tag.startsWith('zh-tw') ||
        tag.startsWith('zh-hk') ||
        tag.startsWith('zh-mo') ||
        tag.startsWith('zh_hant') ||
        tag.startsWith('zh_tw') ||
        tag.startsWith('zh_hk') ||
        tag.startsWith('zh_mo')
      ) {
        return 'zh-Hant';
      }
      return 'zh-Hans';
    }
  }

  return 'en';
}

/**
 * Resolves initial locale: a saved, valid value in localStorage key `wordcard_locale` wins,
 * otherwise detectLocale(navigator.languages, navigator.userAgent).
 *
 * @returns {string}
 */
export function resolveInitialLocale() {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('wordcard_locale');
      if (saved && LOCALES.includes(saved)) {
        return saved;
      }
    }
  } catch {
    // Ignore security / access errors with localStorage
  }

  const languages =
    typeof navigator !== 'undefined'
      ? (navigator.languages || (navigator.language ? [navigator.language] : []))
      : [];
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return detectLocale(languages, userAgent);
}

/**
 * Returns current locale.
 * @returns {string}
 */
export function getLocale() {
  return currentLocale;
}

/**
 * Sets current locale, ignores unsupported values, updates
 * document.documentElement.lang, and calls listeners.
 * Saves to localStorage only when persist is true, so an automatically detected
 * language is not remembered as the user's choice.
 * @param {string} locale
 * @param {{ persist?: boolean }} [options]
 */
export function setLocale(locale, { persist = true } = {}) {
  if (!LOCALES.includes(locale)) return;
  currentLocale = locale;

  if (persist) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('wordcard_locale', locale);
      }
    } catch {
      // Ignore storage errors
    }
  }

  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = locale;
  }

  for (const fn of listeners) {
    try {
      fn(locale);
    } catch (err) {
      console.error('Error in onLocaleChange listener:', err);
    }
  }
}

/**
 * Registers a locale change listener.
 * @param {(locale: string) => void} fn
 * @returns {() => void} Unsubscribe function
 */
export function onLocaleChange(fn) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Looks up the translation key for the current locale, falls back to ja,
 * then returns the key itself if not found. Replaces {name} placeholders.
 *
 * @param {string} key
 * @param {Record<string, any>} [params]
 * @returns {string}
 */
export function t(key, params) {
  const dict = translations[currentLocale] || {};
  let val = dict[key];
  if (val === undefined || val === null) {
    val = translations.ja ? translations.ja[key] : undefined;
  }
  if (val === undefined || val === null) {
    return key;
  }
  if (params && typeof params === 'object') {
    return String(val).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, paramKey) => {
      return paramKey in params && params[paramKey] !== undefined
        ? String(params[paramKey])
        : match;
    });
  }
  return String(val);
}

function applyAttrsToElement(el) {
  const spec = el.getAttribute('data-i18n-attr');
  if (!spec) return;
  const pairs = spec.split(';');
  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(':');
    if (idx > 0) {
      const attrName = trimmed.slice(0, idx).trim();
      const key = trimmed.slice(idx + 1).trim();
      if (attrName && key) {
        el.setAttribute(attrName, t(key));
      }
    }
  }
}

/**
 * Applies translations to elements under root:
 * - sets textContent from [data-i18n]
 * - sets innerHTML from [data-i18n-html] (only for trusted local messages)
 * - sets attributes from data-i18n-attr="attr:key;attr2:key2"
 *
 * @param {Element|Document} [root=document]
 */
export function applyTranslations(root = typeof document !== 'undefined' ? document : null) {
  if (!root || typeof root.querySelectorAll !== 'function') return;

  if (root.hasAttribute && root.hasAttribute('data-i18n')) {
    const key = root.getAttribute('data-i18n');
    if (key) root.textContent = t(key);
  }
  const textNodes = root.querySelectorAll('[data-i18n]');
  for (const el of textNodes) {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  }

  if (root.hasAttribute && root.hasAttribute('data-i18n-html')) {
    const key = root.getAttribute('data-i18n-html');
    if (key) root.innerHTML = t(key);
  }
  const htmlNodes = root.querySelectorAll('[data-i18n-html]');
  for (const el of htmlNodes) {
    const key = el.getAttribute('data-i18n-html');
    if (key) {
      el.innerHTML = t(key);
    }
  }

  if (root.hasAttribute && root.hasAttribute('data-i18n-attr')) {
    applyAttrsToElement(root);
  }
  const attrNodes = root.querySelectorAll('[data-i18n-attr]');
  for (const el of attrNodes) {
    applyAttrsToElement(el);
  }
}
