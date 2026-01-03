/**
 * HKDSE Physics AI Tutor - Internationalization (i18n) System
 * Supports: English (en), 繁體中文 (zh-HK), 简体中文 (zh-CN)
 */

// Current language
let currentLanguage = 'en';

// Translation storage
const translations = {};

// Language display names
const languageNames = {
  'en': 'English',
  'zh-HK': '繁體中文',
  'zh-CN': '简体中文'
};

/**
 * Load translations for a language
 */
async function loadTranslations(lang) {
  if (translations[lang]) {
    return translations[lang];
  }

  try {
    const response = await fetch(`/js/translations/${lang}.json`);
    if (response.ok) {
      translations[lang] = await response.json();
      return translations[lang];
    }
  } catch (err) {
    console.error(`Failed to load translations for ${lang}:`, err);
  }

  // Fallback to English
  if (lang !== 'en' && translations['en']) {
    return translations['en'];
  }

  return {};
}

/**
 * Get translation for a key
 * Supports nested keys like "nav.dashboard"
 */
function t(key, params = {}) {
  const keys = key.split('.');
  let value = translations[currentLanguage];

  for (const k of keys) {
    if (value && typeof value === 'object') {
      value = value[k];
    } else {
      value = undefined;
      break;
    }
  }

  // Fallback to English if not found
  if (value === undefined && currentLanguage !== 'en') {
    value = translations['en'];
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        value = undefined;
        break;
      }
    }
  }

  // If still not found, return the key
  if (value === undefined) {
    return key;
  }

  // Replace parameters like {name}
  if (typeof value === 'string' && Object.keys(params).length > 0) {
    for (const [param, replacement] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{${param}\\}`, 'g'), replacement);
    }
  }

  return value;
}

/**
 * Set the current language
 */
async function setLanguage(lang) {
  if (!['en', 'zh-HK', 'zh-CN'].includes(lang)) {
    console.warn(`Invalid language: ${lang}, defaulting to 'en'`);
    lang = 'en';
  }

  currentLanguage = lang;
  localStorage.setItem('language', lang);
  document.documentElement.lang = lang === 'zh-CN' ? 'zh-CN' : lang === 'zh-HK' ? 'zh-HK' : 'en';

  // Load translations if not already loaded
  await loadTranslations(lang);

  // Update all elements with data-i18n attribute
  translatePage();

  // Dispatch event for components that need to react
  window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
}

/**
 * Get current language
 */
function getLanguage() {
  return currentLanguage;
}

/**
 * Translate all elements on the page with data-i18n attribute
 */
function translatePage() {
  // Translate text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translation = t(key);
    if (translation !== key) {
      el.textContent = translation;
    }
  });

  // Translate placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const translation = t(key);
    if (translation !== key) {
      el.placeholder = translation;
    }
  });

  // Translate titles/tooltips
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const translation = t(key);
    if (translation !== key) {
      el.title = translation;
    }
  });

  // Translate aria-labels
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria');
    const translation = t(key);
    if (translation !== key) {
      el.setAttribute('aria-label', translation);
    }
  });
}

/**
 * Initialize i18n system
 */
async function initI18n() {
  // Get language from localStorage, user preference, or browser
  let lang = localStorage.getItem('language');

  if (!lang) {
    // Try to detect from browser
    const browserLang = navigator.language || navigator.userLanguage;
    if (browserLang.startsWith('zh')) {
      // Check for Traditional vs Simplified
      if (browserLang.includes('TW') || browserLang.includes('HK')) {
        lang = 'zh-HK';
      } else {
        lang = 'zh-CN';
      }
    } else {
      lang = 'en';
    }
  }

  // Load English as fallback first
  await loadTranslations('en');

  // Then load the target language
  if (lang !== 'en') {
    await loadTranslations(lang);
  }

  currentLanguage = lang;
  document.documentElement.lang = lang;

  // Translate the page
  translatePage();

  return lang;
}

/**
 * Create a language switcher dropdown
 * @param {string} containerId - ID of the container element
 */
function createLanguageSwitcher(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const select = document.createElement('select');
  select.className = 'language-switcher';
  select.id = 'languageSwitcher';

  for (const [code, name] of Object.entries(languageNames)) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = name;
    if (code === currentLanguage) {
      option.selected = true;
    }
    select.appendChild(option);
  }

  select.addEventListener('change', async (e) => {
    await setLanguage(e.target.value);

    // Also save to server if logged in
    try {
      await fetch('/api/user/profile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: e.target.value })
      });
    } catch (err) {
      // Ignore errors for non-logged-in users
    }
  });

  container.appendChild(select);
}

/**
 * Get language header for API requests
 */
function getLanguageHeader() {
  return { 'Accept-Language': currentLanguage };
}

// Export functions for use in other scripts
window.i18n = {
  t,
  setLanguage,
  getLanguage,
  initI18n,
  translatePage,
  createLanguageSwitcher,
  getLanguageHeader,
  languageNames
};

