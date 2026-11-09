import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GoogleTranslateClient, ENDPOINT } from '../src/google/client.js';
import { MAX_CHUNK_LENGTH } from '../src/split.js';
import { OUI, YES, fakeFetch, mp3 } from './helpers/fakeFetch.js';

const LONG = Array.from({ length: 28 }, (_, i) => `Phrase ${i}, la porte est ouverte.`).join(' ');

test('one short text is one request, as gTTS sends it', async () => {
  const fetch = fakeFetch();
  const client = new GoogleTranslateClient({ fetch });
  const clip = await client.synthesize({
    text: "L'entrée est ouverte.",
    language: 'fr',
    slow: false,
  });
  assert.deepEqual(clip.audio, OUI);
  assert.equal(clip.chunks, 1);
  assert.equal(fetch.calls.length, 1);
  const { url, init } = fetch.calls[0];
  assert.equal(`${url.origin}${url.pathname}`, ENDPOINT);
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    ie: 'UTF-8',
    client: 'tw-ob',
    tl: 'fr',
    q: "L'entrée est ouverte.",
  });
  // An honest user agent, no cookie, nothing imitating a browser.
  assert.match(init.headers['User-Agent'], /^gladys-google-translate-tts/);
  assert.equal(Object.keys(init.headers).length, 1);
});

test('slow reading adds the ttsspeed of gTTS', async () => {
  const fetch = fakeFetch();
  await new GoogleTranslateClient({ fetch }).synthesize({
    text: 'Oui',
    language: 'fr',
    slow: true,
  });
  assert.equal(fetch.calls[0].url.searchParams.get('ttsspeed'), '0.24');
});

test('a long text is requested chunk by chunk, in order, and joined', async () => {
  const fetch = fakeFetch((url, call) => mp3(call % 2 ? OUI : YES));
  const clip = await new GoogleTranslateClient({ fetch }).synthesize({
    text: LONG,
    language: 'fr',
    slow: false,
  });
  const sent = fetch.calls.map(({ url }) => url.searchParams.get('q'));
  assert.ok(sent.length > 1);
  assert.ok(sent.every((q) => q.length <= MAX_CHUNK_LENGTH));
  assert.equal(sent.join(' '), LONG);
  assert.equal(clip.chunks, sent.length);
  const expected = Buffer.concat(sent.map((_, i) => (i % 2 ? YES : OUI)));
  assert.deepEqual(clip.audio, expected);
});

test('requests go one at a time, even for two texts at once', async () => {
  let running = 0;
  let most = 0;
  const fetch = fakeFetch(async () => {
    running += 1;
    most = Math.max(most, running);
    await new Promise((resolve) => setTimeout(resolve, 5));
    running -= 1;
    return mp3();
  });
  const client = new GoogleTranslateClient({ fetch });
  await Promise.all([
    client.synthesize({ text: LONG, language: 'fr', slow: false }),
    client.synthesize({ text: 'Autre texte.', language: 'fr', slow: false }),
  ]);
  assert.equal(most, 1);
});

test('a failure of the queue does not block the next requests', async () => {
  const fetch = fakeFetch((url, call) => (call === 1 ? new Response('', { status: 500 }) : mp3()));
  const client = new GoogleTranslateClient({ fetch });
  await assert.rejects(client.synthesize({ text: 'Un.', language: 'fr', slow: false }), {
    kind: 'server',
  });
  const clip = await client.synthesize({ text: 'Deux.', language: 'fr', slow: false });
  assert.deepEqual(clip.audio, OUI);
});

test('every failure has its kind', async () => {
  const cases = [
    [() => new Response('', { status: 429 }), 'rate_limited'],
    [() => new Response('', { status: 503 }), 'server'],
    [() => new Response('<html>400</html>', { status: 400 }), 'refused'],
    [
      () => new Response('<html>consent</html>', { headers: { 'content-type': 'text/html' } }),
      'invalid_response',
    ],
    [
      () => new Response('not mp3', { headers: { 'content-type': 'audio/mpeg' } }),
      'invalid_response',
    ],
    [
      () => {
        throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } });
      },
      'unreachable',
    ],
    [
      () => {
        throw new DOMException('timed out', 'TimeoutError');
      },
      'timeout',
    ],
  ];
  for (const [answer, kind] of cases) {
    const client = new GoogleTranslateClient({ fetch: fakeFetch(answer) });
    await assert.rejects(client.synthesize({ text: 'Oui', language: 'fr', slow: false }), (err) => {
      assert.equal(err.kind, kind);
      return true;
    });
  }
});

test('a stalled request is aborted', async () => {
  const fetch = (url, { signal }) =>
    new Promise((resolve, reject) => {
      // Keeps the event loop alive while the timeout runs.
      const keep = setTimeout(() => {}, 1000);
      signal.addEventListener('abort', () => {
        clearTimeout(keep);
        reject(signal.reason);
      });
    });
  const client = new GoogleTranslateClient({ fetch, requestTimeoutMs: 20 });
  await assert.rejects(client.synthesize({ text: 'Oui', language: 'fr', slow: false }), {
    kind: 'timeout',
  });
});

test('a body that stalls after the headers is aborted too', async () => {
  const fetch = (url, { signal }) =>
    Promise.resolve({
      ok: true,
      headers: new Headers({ 'content-type': 'audio/mpeg' }),
      arrayBuffer: () =>
        new Promise((resolve, reject) => {
          const keep = setTimeout(() => {}, 1000);
          signal.addEventListener('abort', () => {
            clearTimeout(keep);
            reject(signal.reason);
          });
        }),
    });
  const client = new GoogleTranslateClient({ fetch, requestTimeoutMs: 20 });
  await assert.rejects(client.synthesize({ text: 'Oui', language: 'fr', slow: false }), {
    kind: 'timeout',
  });
});

test('a text that does not fit in the time Gladys waits stops early', async () => {
  let clock = 0;
  const fetch = fakeFetch(() => {
    clock += 10_000;
    return mp3();
  });
  const client = new GoogleTranslateClient({ fetch, now: () => clock });
  await assert.rejects(client.synthesize({ text: LONG, language: 'fr', slow: false }), (err) => {
    assert.equal(err.kind, 'too_long');
    return true;
  });
  // 25 s budget: three requests at 10 s each, then it stops.
  assert.equal(fetch.calls.length, 3);
});

test('nothing to say sends nothing', async () => {
  const fetch = fakeFetch();
  await assert.rejects(
    new GoogleTranslateClient({ fetch }).synthesize({ text: ' … ', language: 'fr', slow: false }),
    { kind: 'empty' },
  );
  assert.equal(fetch.calls.length, 0);
});
