// -----------------------------------------------------------------------------
// Client of the Google Translate speech endpoint, the one gTTS and the
// `google_translate` text-to-speech of Home Assistant use:
//
//   GET https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=<language>&q=<text>
//   -> audio/mpeg
//
// No key, no account, no cookie, nothing imitating a browser. Unofficial: Google
// may change or limit it at any time. Requests go one at a time, for the whole
// integration (several speakers announcing at once queue up), to stay a light
// user of a free service.
// -----------------------------------------------------------------------------

import { parseMp3 } from '../mp3.js';
import { splitText } from '../split.js';

export const ENDPOINT = 'https://translate.google.com/translate_tts';
// `ttsspeed` of gTTS 1.x: the slow reading of the Google Translate page.
const SLOW_SPEED = '0.24';
// One request takes ~0.2 s; this bounds a stalled one.
export const REQUEST_TIMEOUT_MS = 10_000;
// Gladys waits 30 s for the clip: keep a margin for the relay.
export const SYNTHESIS_BUDGET_MS = 25_000;
const USER_AGENT =
  'gladys-google-translate-tts (+https://github.com/guim31/gladys-google-translate-tts)';

export class GoogleTranslateError extends Error {
  /**
   * @param {'unreachable'|'timeout'|'rate_limited'|'refused'|'server'|'invalid_response'|'empty'} kind - What failed.
   * @param {string} message - Technical detail, for the logs.
   * @param {{status?: number, cause?: unknown}} [options]
   */
  constructor(kind, message, { status, cause } = {}) {
    super(message, { cause });
    this.name = 'GoogleTranslateError';
    this.kind = kind;
    this.status = status;
  }
}

export class GoogleTranslateClient {
  /**
   * @param {object} [deps]
   * @param {typeof fetch} [deps.fetch] - Injectable for tests.
   * @param {() => number} [deps.now] - Clock, injectable for tests.
   * @param {number} [deps.requestTimeoutMs] - Bound of one request.
   * @param {number} [deps.budgetMs] - Bound of one synthesis.
   */
  constructor({
    fetch: fetchImpl = globalThis.fetch,
    now = Date.now,
    requestTimeoutMs = REQUEST_TIMEOUT_MS,
    budgetMs = SYNTHESIS_BUDGET_MS,
  } = {}) {
    this.fetch = fetchImpl;
    this.now = now;
    this.requestTimeoutMs = requestTimeoutMs;
    this.budgetMs = budgetMs;
    // Tail of the queue: every request waits for the previous one.
    this.queue = Promise.resolve();
    // Number of requests sent, for the logs and the tests.
    this.requests = 0;
  }

  /**
   * Run `task` once every request queued before it is done.
   * @template T
   * @param {() => Promise<T>} task - One request.
   * @returns {Promise<T>} Its result.
   */
  enqueue(task) {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => {});
    return run;
  }

  /**
   * Speak one chunk (at most 200 characters).
   * @param {{text: string, language: string, slow: boolean, timeoutMs: number}} request - The chunk.
   * @returns {Promise<{audio: Buffer, seconds: number}>} Its MPEG frames.
   * @throws {GoogleTranslateError} On any failure.
   */
  async fetchChunk({ text, language, slow, timeoutMs }) {
    const url = new URL(ENDPOINT);
    url.searchParams.set('ie', 'UTF-8');
    url.searchParams.set('client', 'tw-ob');
    url.searchParams.set('tl', language);
    if (slow) {
      url.searchParams.set('ttsspeed', SLOW_SPEED);
    }
    url.searchParams.set('q', text);
    this.requests += 1;

    let response;
    try {
      response = await this.fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new GoogleTranslateError('timeout', `no answer within ${timeoutMs} ms`, {
          cause: err,
        });
      }
      const reason = err?.cause?.code ?? err?.message ?? String(err);
      throw new GoogleTranslateError('unreachable', `request failed: ${reason}`, { cause: err });
    }

    if (!response.ok) {
      // Drain the body so the connection can be reused.
      await response.arrayBuffer().catch(() => {});
      const { status } = response;
      const kind = status === 429 ? 'rate_limited' : status >= 500 ? 'server' : 'refused';
      throw new GoogleTranslateError(kind, `HTTP ${status}`, { status });
    }
    const type = response.headers.get('content-type') ?? '';
    const body = Buffer.from(await response.arrayBuffer());
    const clip = type.startsWith('audio/') ? parseMp3(body) : null;
    if (!clip) {
      throw new GoogleTranslateError(
        'invalid_response',
        `expected MP3 audio, got "${type}" (${body.length} bytes)`,
      );
    }
    return { audio: clip.audio, seconds: clip.seconds };
  }

  /**
   * Speak a whole text: cut into chunks, requested in order, joined.
   * @param {{text: string, language: string, slow: boolean}} request - What to say, and how.
   * @returns {Promise<{audio: Buffer, chunks: number, seconds: number}>} The MP3 clip.
   * @throws {GoogleTranslateError} `empty` when there is nothing to say, or the
   *   failure of a request (`timeout` as well when the whole text does not fit
   *   in the time Gladys waits).
   * @example
   * await client.synthesize({ text: 'La porte est ouverte.', language: 'fr', slow: false });
   */
  async synthesize({ text, language, slow }) {
    const chunks = splitText(text);
    if (chunks.length === 0) {
      throw new GoogleTranslateError('empty', 'nothing to say in the text');
    }
    const deadline = this.now() + this.budgetMs;
    const parts = [];
    let seconds = 0;
    for (const chunk of chunks) {
      const part = await this.enqueue(() => {
        const left = deadline - this.now();
        if (left <= 0) {
          throw new GoogleTranslateError(
            'timeout',
            `text too long to be spoken in time (${parts.length} of ${chunks.length} parts done)`,
          );
        }
        return this.fetchChunk({
          text: chunk,
          language,
          slow,
          timeoutMs: Math.min(this.requestTimeoutMs, left),
        });
      });
      parts.push(part.audio);
      seconds += part.seconds;
    }
    return { audio: Buffer.concat(parts), chunks: chunks.length, seconds };
  }
}
