import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../src/app.js';
import { GoogleTranslateClient } from '../src/google/client.js';
import { CACHE_SIZE, GoogleTranslateTts, MESSAGES } from '../src/integration.js';
import { OUI, fakeFetch, mp3 } from './helpers/fakeFetch.js';

/** A logger that records, by level. */
function recordingLogger() {
  const lines = { info: [], warn: [], debug: [], error: [] };
  const logger = Object.fromEntries(
    Object.keys(lines).map((level) => [level, (message) => lines[level].push(message)]),
  );
  return { logger, lines };
}

async function setup({ config = {}, answer } = {}) {
  const gladys = createFakeGladys({ config });
  const fetch = fakeFetch(answer);
  const { logger, lines } = recordingLogger();
  const tts = new GoogleTranslateTts(gladys, {
    client: new GoogleTranslateClient({ fetch }),
    logger,
  });
  registerHandlers(gladys, tts, { logger });
  await gladys.connect();
  return { gladys, fetch, tts, lines };
}

const decoded = (ack) => {
  const [type, payload] = ack.data.audio.split(';base64,');
  return { type, audio: Buffer.from(payload, 'base64') };
};

test('at startup, one word checks Google Translate and the status says so', async () => {
  const { gladys, fetch, lines } = await setup();
  assert.equal(fetch.calls.length, 1);
  assert.equal(fetch.calls[0].url.searchParams.get('q'), 'Gladys');
  assert.equal(fetch.calls[0].url.searchParams.get('tl'), 'fr');
  const status = gladys.fake.connectionStatus;
  assert.equal(status.connected, true);
  assert.deepEqual(Object.keys(status.message), ['en', 'fr', 'de', 'es']);
  assert.match(status.message.fr, /Voix : la langue de chaque utilisateur\./);
  assert.ok(lines.info.includes('Google Translate answers'));
});

test('a text is spoken in the language of the user, as an MP3 clip', async () => {
  const { gladys, fetch } = await setup();
  const ack = await gladys.fake.ttsSynthesize('The garage door is open.', 'en');
  assert.equal(ack.success, true);
  const { type, audio } = decoded(ack);
  assert.equal(type, 'audio/mpeg');
  assert.deepEqual(audio, OUI);
  const last = fetch.calls.at(-1).url.searchParams;
  assert.equal(last.get('tl'), 'en');
  assert.equal(last.get('q'), 'The garage door is open.');
});

test('an announcement without language speaks French; settings choose the voice', async () => {
  const { gladys, fetch } = await setup({
    config: { language: 'en', accent: 'en-AU', slow: true },
  });
  await gladys.fake.ttsSynthesize('Dinner is ready.', null);
  const last = fetch.calls.at(-1).url.searchParams;
  assert.equal(last.get('tl'), 'en-AU');
  assert.equal(last.get('ttsspeed'), '0.24');
  assert.match(gladys.fake.connectionStatus.message.en, /Voice: "en", en-AU, slow\./);

  const auto = await setup();
  await auto.gladys.fake.ttsSynthesize('La porte est ouverte.', null);
  assert.equal(auto.fetch.calls.at(-1).url.searchParams.get('tl'), 'fr');
});

test('the same announcement on several speakers is asked once', async () => {
  const { gladys, fetch } = await setup();
  const before = fetch.calls.length;
  const acks = await Promise.all([
    gladys.fake.ttsSynthesize('Le linge est sec.', 'fr'),
    gladys.fake.ttsSynthesize('Le linge est sec.', 'fr'),
  ]);
  assert.ok(acks.every((ack) => ack.success));
  assert.equal(fetch.calls.length - before, 1);
  // And again later, from memory.
  await gladys.fake.ttsSynthesize('Le linge est sec.', 'fr');
  assert.equal(fetch.calls.length - before, 1);
  // Another voice is another clip.
  await gladys.fake.ttsSynthesize('Le linge est sec.', 'de');
  assert.equal(fetch.calls.length - before, 2);
});

test('the memory keeps the latest clips only, and forgets them on new settings', async () => {
  const { gladys, fetch, tts } = await setup();
  for (let i = 0; i <= CACHE_SIZE; i += 1) {
    await gladys.fake.ttsSynthesize(`Texte ${i}.`, 'fr');
  }
  assert.equal(tts.cache.size, CACHE_SIZE);
  const before = fetch.calls.length;
  await gladys.fake.ttsSynthesize('Texte 0.', 'fr');
  assert.equal(fetch.calls.length - before, 1);

  await gladys.fake.configUpdated({ slow: true });
  await gladys.fake.ttsSynthesize('Texte 0.', 'fr');
  assert.equal(fetch.calls.length - before, 3);
  assert.equal(fetch.calls.at(-1).url.searchParams.get('ttsspeed'), '0.24');
});

test('a failing Google Translate fails the synthesis and shows in Supervision, then recovers', async () => {
  let failing = false;
  const { gladys, lines } = await setup({
    answer: () => (failing ? new Response('', { status: 429 }) : mp3()),
  });
  failing = true;
  const ack = await gladys.fake.ttsSynthesize('Alerte.', 'fr');
  assert.equal(ack.success, false);
  assert.match(ack.error, /limits the requests/);
  assert.deepEqual(gladys.fake.connectionStatus, {
    connected: false,
    message: MESSAGES.rate_limited,
  });
  // One line per failed announcement, the transition once.
  await gladys.fake.ttsSynthesize('Alerte 2.', 'fr');
  assert.equal(
    lines.warn.filter((line) => line.startsWith('Google Translate unavailable')).length,
    1,
  );
  assert.equal(lines.warn.filter((line) => line.startsWith('Speech not synthesized')).length, 2);

  failing = false;
  assert.equal((await gladys.fake.ttsSynthesize('Alerte.', 'fr')).success, true);
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.ok(lines.info.includes('Google Translate answers again'));
});

test('a text too long for the time Gladys waits fails without touching the status', async () => {
  let clock = 0;
  const gladys = createFakeGladys();
  const fetch = fakeFetch(() => {
    clock += 10_000;
    return mp3();
  });
  const { logger } = recordingLogger();
  const client = new GoogleTranslateClient({ fetch, now: () => clock });
  registerHandlers(gladys, new GoogleTranslateTts(gladys, { client, logger }), { logger });
  await gladys.connect();
  const statuses = gladys.fake.connectionStatuses.length;
  const text = Array.from({ length: 30 }, (_, i) => `Phrase ${i}, la porte est ouverte.`).join(' ');
  const ack = await gladys.fake.ttsSynthesize(text, 'fr');
  assert.equal(ack.success, false);
  assert.match(ack.error, /too long/);
  assert.equal(gladys.fake.connectionStatuses.length, statuses);
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('a text with nothing to say fails without touching the status', async () => {
  const { gladys } = await setup();
  const statuses = gladys.fake.connectionStatuses.length;
  const ack = await gladys.fake.ttsSynthesize(' *** ', 'fr');
  assert.equal(ack.success, false);
  assert.match(ack.error, /nothing to say/);
  assert.equal(gladys.fake.connectionStatuses.length, statuses);
});

test('a normal synthesis writes nothing at info level', async () => {
  const { gladys, lines } = await setup();
  const before = lines.info.length;
  await gladys.fake.ttsSynthesize('Bonne nuit.', 'fr');
  await gladys.fake.ttsSynthesize('Bonne nuit.', 'fr');
  assert.equal(lines.info.length, before);
  assert.equal(lines.warn.length, 0);
});

test('the "Test the voice" button speaks a sentence and says what came back', async () => {
  const { gladys, fetch } = await setup({ config: { accent: 'fr-CA' } });
  const ack = await gladys.fake.action('test_voice');
  assert.equal(ack.success, true);
  assert.match(ack.data.message.fr, /en « fr-CA » : un clip de 0,7 s \(5 Ko\)/);
  assert.match(ack.data.message.en, /in "fr-CA": a 0\.7-second clip/);
  assert.equal(fetch.calls.at(-1).url.searchParams.get('q'), 'Bonjour, ici Gladys.');
  // A second press asks Google again.
  const before = fetch.calls.length;
  await gladys.fake.action('test_voice');
  assert.equal(fetch.calls.length - before, 1);
});

test('a request arriving before the configuration is read waits for it', async () => {
  const gladys = createFakeGladys({ config: { language: 'es' } });
  const fetch = fakeFetch();
  const { logger } = recordingLogger();
  const tts = new GoogleTranslateTts(gladys, {
    client: new GoogleTranslateClient({ fetch }),
    logger,
  });
  const clip = await tts.handleSynthesize('Hola.', 'fr');
  assert.match(clip, /^audio\/mpeg;base64,/);
  assert.equal(fetch.calls.at(-1).url.searchParams.get('tl'), 'es');
});
