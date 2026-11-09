// -----------------------------------------------------------------------------
// GoogleTranslateTts: everything the SDK handlers of src/app.js call.
//
// - applyConfig(): takes the settings, then checks that Google Translate
//   answers with a one-word clip, shown as the status in Supervision. Never
//   throws.
// - handleSynthesize(): turns a text Gladys wants spoken into an MP3 clip.
//   Throwing acks the command as failed: the scene action fails visibly, the
//   voice assistant answers in text only.
// - testVoice(): the "Test the voice" button of the configuration screen.
//
// A clip already made (same text, voice and speed) is served from memory, and
// identical requests running at the same time (one announcement on several
// speakers) share one synthesis: fewer requests to a free service.
// -----------------------------------------------------------------------------

import { logger as defaultLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig, voiceCode } from './config.js';
import { GoogleTranslateClient } from './google/client.js';

// Clips kept in memory (2,000 characters make about 1.3 MB).
export const CACHE_SIZE = 16;

// Failures about the service itself, shown as the status. The others concern
// one text only (nothing to say in it, too long to be spoken in time).
const SERVICE_ERRORS = [
  'unreachable',
  'timeout',
  'rate_limited',
  'server',
  'refused',
  'invalid_response',
];

export const MESSAGES = {
  unreachable: {
    en: 'Google Translate cannot be reached: check the Internet connection of Gladys.',
    fr: 'Google Traduction est injoignable : vérifiez la connexion Internet de Gladys.',
    de: 'Google Übersetzer ist nicht erreichbar: prüfe die Internetverbindung von Gladys.',
    es: 'No se puede acceder a Google Traductor: compruebe la conexión a Internet de Gladys.',
  },
  timeout: {
    en: 'Google Translate does not answer in time. Try again later.',
    fr: 'Google Traduction ne répond pas à temps. Réessayez plus tard.',
    de: 'Google Übersetzer antwortet nicht rechtzeitig. Versuch es später noch einmal.',
    es: 'Google Traductor no responde a tiempo. Vuelva a intentarlo más tarde.',
  },
  rate_limited: {
    en: 'Google Translate limits the requests of this connection for now. Try again later.',
    fr: 'Google Traduction limite pour le moment les requêtes de cette connexion. Réessayez plus tard.',
    de: 'Google Übersetzer begrenzt gerade die Anfragen dieser Verbindung. Versuch es später noch einmal.',
    es: 'Google Traductor limita por ahora las solicitudes de esta conexión. Vuelva a intentarlo más tarde.',
  },
  server: {
    en: 'Google Translate is failing for now. Try again later.',
    fr: 'Google Traduction est en panne pour le moment. Réessayez plus tard.',
    de: 'Google Übersetzer hat gerade eine Störung. Versuch es später noch einmal.',
    es: 'Google Traductor falla por ahora. Vuelva a intentarlo más tarde.',
  },
  refused: {
    en: 'Google Translate refuses the request: the free voice may have changed. Check for an update of the integration.',
    fr: "Google Traduction refuse la requête : la voix gratuite a peut-être changé. Cherchez une mise à jour de l'intégration.",
    de: 'Google Übersetzer lehnt die Anfrage ab: Die kostenlose Stimme hat sich vielleicht geändert. Such nach einem Update der Integration.',
    es: 'Google Traductor rechaza la solicitud: puede que la voz gratuita haya cambiado. Busque una actualización de la integración.',
  },
  invalid_response: {
    en: 'Google Translate no longer answers with audio: the free voice may have changed. Check for an update of the integration.',
    fr: "Google Traduction ne répond plus par du son : la voix gratuite a peut-être changé. Cherchez une mise à jour de l'intégration.",
    de: 'Google Übersetzer antwortet nicht mehr mit Audio: Die kostenlose Stimme hat sich vielleicht geändert. Such nach einem Update der Integration.',
    es: 'Google Traductor ya no responde con audio: puede que la voz gratuita haya cambiado. Busque una actualización de la integración.',
  },
  too_long: {
    en: 'The text is too long to be spoken within the 30 seconds Gladys waits.',
    fr: 'Le texte est trop long pour être prononcé dans les 30 secondes que Gladys attend.',
    de: 'Der Text ist zu lang, um in den 30 Sekunden gesprochen zu werden, die Gladys wartet.',
    es: 'El texto es demasiado largo para pronunciarse en los 30 segundos que espera Gladys.',
  },
  empty: {
    en: 'There is nothing to say in the text.',
    fr: "Il n'y a rien à dire dans le texte.",
    de: 'Im Text gibt es nichts zu sagen.',
    es: 'No hay nada que decir en el texto.',
  },
};

// Sentence of the "Test the voice" button and of the check, per language.
const SAMPLES = {
  en: 'Hello, this is Gladys.',
  fr: 'Bonjour, ici Gladys.',
  de: 'Hallo, hier ist Gladys.',
  es: 'Hola, soy Gladys.',
};

/**
 * Status shown in Supervision once Google Translate answered.
 * @param {{language: string, accent: string, slow: boolean}} settings - Normalized settings.
 * @returns {{en: string, fr: string, de: string, es: string}} The message.
 */
export function readyMessage(settings) {
  const language = settings.language === 'auto' ? null : settings.language;
  const accent = settings.accent === 'default' ? '' : `, ${settings.accent}`;
  const voice = {
    en: language ? `"${language}"${accent}` : `the language of each user${accent}`,
    fr: language ? `« ${language} »${accent}` : `la langue de chaque utilisateur${accent}`,
    de: language ? `„${language}“${accent}` : `die Sprache des jeweiligen Benutzers${accent}`,
    es: language ? `«${language}»${accent}` : `el idioma de cada usuario${accent}`,
  };
  const slow = settings.slow
    ? { en: ', slow', fr: ', lente', de: ', langsam', es: ', lenta' }
    : { en: '', fr: '', de: '', es: '' };
  return {
    en: `Google Translate answers. Voice: ${voice.en}${slow.en}.`,
    fr: `Google Traduction répond. Voix : ${voice.fr}${slow.fr}.`,
    de: `Google Übersetzer antwortet. Stimme: ${voice.de}${slow.de}.`,
    es: `Google Traductor responde. Voz: ${voice.es}${slow.es}.`,
  };
}

/**
 * Answer of the "Test the voice" button.
 * @param {string} code - Language code sent to Google.
 * @param {{audio: Buffer, chunks: number, seconds: number}} clip - The clip made.
 * @returns {{en: string, fr: string, de: string, es: string}} The message.
 */
export function testMessage(code, clip) {
  const kb = Math.max(1, Math.round(clip.audio.length / 1024));
  const en = clip.seconds.toFixed(1);
  const comma = en.replace('.', ',');
  return {
    en: `Google Translate spoke the test sentence in "${code}": a ${en}-second clip (${kb} KB). Select this voice on the Artificial Intelligence page of Gladys.`,
    fr: `Google Traduction a prononcé la phrase de test en « ${code} » : un clip de ${comma} s (${kb} Ko). Choisissez cette voix sur la page Intelligence Artificielle de Gladys.`,
    de: `Google Übersetzer hat den Testsatz auf „${code}“ gesprochen: ein Clip von ${comma} s (${kb} KB). Wähle diese Stimme auf der Seite Künstliche Intelligenz von Gladys.`,
    es: `Google Traductor pronunció la frase de prueba en «${code}»: un clip de ${comma} s (${kb} KB). Elija esta voz en la página Inteligencia artificial de Gladys.`,
  };
}

/**
 * The message of a failure, for the administrator.
 * @param {unknown} err - Usually a GoogleTranslateError.
 * @returns {{en: string, fr: string, de: string, es: string}} The message.
 */
export function describeError(err) {
  if (err?.kind === 'timeout' && /too long/.test(err.message)) {
    return MESSAGES.too_long;
  }
  return MESSAGES[err?.kind] ?? MESSAGES.unreachable;
}

/**
 * The error a failed command acks: the actionable text and the technical
 * detail, since only the message reaches Gladys.
 * @param {Error} err - The failure.
 * @returns {Error} The error to throw.
 */
function failure(err) {
  return new Error(`${describeError(err).en} [${err.message}]`, { cause: err });
}

export class GoogleTranslateTts {
  /**
   * @param {object} gladys - The SDK instance (GladysIntegration).
   * @param {object} [deps]
   * @param {GoogleTranslateClient} [deps.client] - Injectable for tests.
   * @param {{info: Function, warn: Function, debug: Function}} [deps.logger] - Injectable for tests.
   */
  constructor(gladys, { client = new GoogleTranslateClient(), logger = defaultLogger } = {}) {
    this.gladys = gladys;
    this.client = client;
    this.logger = logger;
    this.settings = normalizeConfig({});
    this.loaded = false;
    this.loading = null;
    // Bumped by every configuration: a clip made with older settings is not kept.
    this.generation = 0;
    // Synthesis key -> clip (Buffer), oldest first.
    this.cache = new Map();
    // Synthesis key -> pending synthesis, shared by identical requests.
    this.inFlight = new Map();
    this.status = null;
  }

  /**
   * Take the settings into account, then check that Google Translate answers.
   * @param {Record<string, unknown>} rawConfig - Configuration from the SDK.
   * @returns {Promise<void>} Never rejects.
   * @example
   * await tts.applyConfig(gladys.config);
   */
  async applyConfig(rawConfig) {
    this.settings = normalizeConfig(rawConfig);
    this.loaded = true;
    this.generation += 1;
    this.cache.clear();
    this.inFlight.clear();
    const { language, accent, slow } = this.settings;
    this.logger.info(`Voice settings: language ${language}, accent ${accent}, slow ${slow}`);
    try {
      // One word: a single light request.
      await this.speak('Gladys', null);
    } catch {
      // Already reported as the status.
    }
  }

  /**
   * Read the configuration when a command arrives before the SDK
   * resynchronized it (Gladys relays right after the WebSocket authenticates).
   * @returns {Promise<void>}
   */
  async load() {
    if (this.loaded) {
      return;
    }
    this.loading ??= this.gladys.getConfig().then(
      (config) => this.applyConfig(config),
      (err) => {
        this.loading = null;
        throw err;
      },
    );
    await this.loading;
  }

  /**
   * Synthesize a text Gladys wants spoken.
   * @param {string} text - The text (≤ 2,000 characters, capped by Gladys).
   * @param {string|null} language - Language of the requesting user (the first
   *   administrator's for an announcement), null when unknown.
   * @returns {Promise<string>} The clip, as `audio/mpeg;base64,…`.
   * @throws {Error} When no clip can be made.
   * @example
   * await tts.handleSynthesize('La porte est ouverte.', 'fr');
   */
  async handleSynthesize(text, language) {
    try {
      await this.load();
      const clip = await this.speak(typeof text === 'string' ? text : '', language);
      return `audio/mpeg;base64,${clip.audio.toString('base64')}`;
    } catch (err) {
      // The failed ack only reaches the Gladys server log: say it here too,
      // in the integration logs the administrator can open from Gladys.
      this.logger.warn(`Speech not synthesized: ${err.message}`);
      throw err;
    }
  }

  /**
   * The "Test the voice" button: speaks a sentence in the configured voice.
   * @returns {Promise<{en: string, fr: string, de: string, es: string}>} The message shown under the button.
   * @throws {Error} When Google Translate does not answer.
   */
  async testVoice() {
    await this.load();
    // Automatic mode: the voice the first administrator would hear, unknown
    // here; the test speaks the fallback language.
    const code = voiceCode(this.settings, null);
    const base = code.split('-')[0];
    const clip = await this.speak(SAMPLES[base] ?? SAMPLES.en, null);
    this.logger.info(`Voice tested: ${code}, ${clip.seconds.toFixed(1)} s`);
    return testMessage(code, clip);
  }

  /**
   * The clip of a text: from memory, from a synthesis already running, or
   * from Google Translate. Reports the outcome as the status.
   * @param {string} text - The text.
   * @param {string|null} language - Language of the requesting user.
   * @returns {Promise<{audio: Buffer, chunks: number, seconds: number}>} The clip.
   * @throws {Error} The actionable failure.
   */
  async speak(text, language) {
    const { settings, generation } = this;
    const code = voiceCode(settings, language);
    const key = JSON.stringify([code, settings.slow, text.trim()]);
    const cached = this.cache.get(key);
    if (cached) {
      this.logger.debug(`Clip served from memory (${text.length} characters)`);
      return cached;
    }
    let pending = this.inFlight.get(key);
    if (!pending) {
      pending = this.client.synthesize({ text, language: code, slow: settings.slow });
      this.inFlight.set(key, pending);
      pending
        .finally(() => {
          if (this.inFlight.get(key) === pending) {
            this.inFlight.delete(key);
          }
        })
        .catch(() => {});
    }

    let clip;
    try {
      clip = await pending;
    } catch (err) {
      if (generation === this.generation && SERVICE_ERRORS.includes(err?.kind)) {
        await this.reportStatus(false, describeError(err), err);
      }
      throw failure(err);
    }
    if (generation === this.generation) {
      this.cache.set(key, clip);
      if (this.cache.size > CACHE_SIZE) {
        this.cache.delete(this.cache.keys().next().value);
      }
      await this.reportStatus(true, readyMessage(settings));
    }
    this.logger.debug(
      `Clip synthesized in "${code}": ${text.length} characters, ${clip.chunks} request(s), ${clip.audio.length} bytes`,
    );
    return clip;
  }

  /**
   * Publish the status, only when it changes (it is pushed to every open
   * Gladys page), and log the transitions only. A failure is logged, never
   * thrown: a synthesis must not fail because the status could not be shown.
   * @param {boolean} connected - Whether Google Translate answers.
   * @param {{en: string, fr: string, de: string, es: string}} message - Shown to the administrator.
   * @param {Error} [err] - The failure, for the log.
   * @returns {Promise<void>}
   */
  async reportStatus(connected, message, err) {
    if (this.status?.connected === connected && this.status?.message.en === message.en) {
      return;
    }
    const wasConnected = this.status?.connected;
    this.status = { connected, message };
    if (connected && wasConnected === false) {
      this.logger.info('Google Translate answers again');
    } else if (connected && wasConnected === undefined) {
      this.logger.info('Google Translate answers');
    } else if (!connected) {
      this.logger.warn(`Google Translate unavailable: ${err?.message ?? message.en}`);
    }
    try {
      await this.gladys.setConnectionStatus(connected, message);
    } catch (statusErr) {
      this.logger.warn(`Unable to publish the status: ${statusErr.message}`);
    }
  }
}
