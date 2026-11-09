// -----------------------------------------------------------------------------
// Configuration: defaults (mirrors the manifest), normalization, and the choice
// of the voice (language code sent to Google Translate).
//
// Verified against the endpoint on 2026-11-09: the `tld` gTTS uses to pick an
// accent (translate.google.co.uk, .ca…) changes nothing on `translate_tts`,
// whereas a regional language code does (`en-US` and `en` are two voices,
// `en` being the British one). Accents are therefore regional codes.
// -----------------------------------------------------------------------------

// Languages offered in the configuration, each answered 200 by the endpoint.
export const VOICE_LANGUAGES = [
  'ar',
  'bg',
  'ca',
  'cs',
  'da',
  'de',
  'el',
  'en',
  'es',
  'fi',
  'fr',
  'he',
  'hi',
  'hr',
  'hu',
  'id',
  'it',
  'ja',
  'ko',
  'nl',
  'no',
  'pl',
  'pt',
  'ro',
  'ru',
  'sk',
  'sv',
  'th',
  'tr',
  'uk',
  'vi',
  'zh-CN',
  'zh-TW',
];

// Regional voices: used when the language spoken is the one of the accent.
export const ACCENTS = [
  'en-US',
  'en-GB',
  'en-AU',
  'en-IN',
  'fr-FR',
  'fr-CA',
  'es-ES',
  'es-MX',
  'pt-BR',
  'pt-PT',
];

// Voice used when Gladys gives no language (an instance without administrator)
// or one Google Translate does not speak: the default of Guilhem's integrations.
export const FALLBACK_LANGUAGE = 'fr';

export const DEFAULT_CONFIG = Object.freeze({
  language: 'auto',
  accent: 'default',
  slow: false,
});

/**
 * Normalize the raw configuration sent by Gladys: unknown values fall back to
 * the defaults.
 * @param {Record<string, unknown>} [raw] - Values from the configuration form.
 * @returns {{language: string, accent: string, slow: boolean}} The settings.
 * @example
 * normalizeConfig({ language: 'en', slow: 'true' }); // { language: 'en', accent: 'default', slow: true }
 */
export function normalizeConfig(raw = {}) {
  const value = raw ?? {};
  const language =
    value.language === 'auto' || VOICE_LANGUAGES.includes(value.language)
      ? value.language
      : DEFAULT_CONFIG.language;
  const accent = ACCENTS.includes(value.accent) ? value.accent : DEFAULT_CONFIG.accent;
  return { language, accent, slow: value.slow === true || value.slow === 'true' };
}

/**
 * The language Gladys asks for, as a code of VOICE_LANGUAGES, or null.
 * Accepts `fr`, `FR`, `fr-FR`, `fr_FR`, `zh-tw`…
 * @param {unknown} language - Language of the requesting user.
 * @returns {string|null} The code, null when Google Translate has no such voice.
 */
export function supportedLanguage(language) {
  if (typeof language !== 'string') {
    return null;
  }
  const [base = '', region = ''] = language.trim().replace('_', '-').split('-');
  const lower = base.toLowerCase();
  if (lower === 'zh') {
    return ['TW', 'HK', 'MO', 'HANT'].includes(region.toUpperCase()) ? 'zh-TW' : 'zh-CN';
  }
  // Former codes some systems still send.
  const aliases = { iw: 'he', nb: 'no', nn: 'no' };
  const code = aliases[lower] ?? lower;
  return VOICE_LANGUAGES.includes(code) ? code : null;
}

/**
 * The `tl` parameter of a request: the configured language (or the user's in
 * automatic mode), refined by the accent when it is one of that language.
 * @param {{language: string, accent: string}} settings - Normalized settings.
 * @param {string|null} userLanguage - Language Gladys sent, null when unknown.
 * @returns {string} A language code for Google Translate, e.g. `fr` or `en-US`.
 * @example
 * voiceCode({ language: 'auto', accent: 'en-US' }, 'en'); // 'en-US'
 */
export function voiceCode(settings, userLanguage) {
  const language =
    settings.language === 'auto'
      ? (supportedLanguage(userLanguage) ?? FALLBACK_LANGUAGE)
      : settings.language;
  if (settings.accent !== 'default' && settings.accent.split('-')[0] === language) {
    return settings.accent;
  }
  return language;
}
