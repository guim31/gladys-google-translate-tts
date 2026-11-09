import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_CHUNK_LENGTH, splitText } from '../src/split.js';

test('a short text is one chunk', () => {
  assert.deepEqual(splitText("  La porte d'entrée est ouverte.  "), [
    "La porte d'entrée est ouverte.",
  ]);
});

test('nothing to say gives no chunk', () => {
  for (const text of ['', '   ', '...', ' ** ', '\n\n', null, undefined]) {
    assert.deepEqual(splitText(text), [], String(text));
  }
});

test('Markdown marks are not read and line breaks end a piece', () => {
  assert.deepEqual(splitText('**Salon** : 21 °C\n# Cuisine\n`ok`'), ['Salon : 21 °C Cuisine ok']);
});

test('a long text is cut after sentences, never over the limit, nothing lost', () => {
  const sentence = "La température du salon est de 21,5 degrés, l'humidité reste correcte.";
  const text = Array.from({ length: 28 }, () => sentence).join(' ');
  assert.equal(text.length, 1987);
  const chunks = splitText(text);
  assert.equal(chunks.length, 14);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= MAX_CHUNK_LENGTH, `${chunk.length}: ${chunk}`);
    // Pieces end on punctuation: a decimal comma never ends one.
    assert.match(chunk, /[.,]$/);
    assert.doesNotMatch(chunk, /^5 degrés/);
  }
  assert.equal(chunks.join(' '), text);
});

test('decimals and times stay whole', () => {
  const text = `${'a '.repeat(85)}il fait 3.5 degrés à 12:30, ok.`;
  const chunks = splitText(text);
  assert.ok(chunks.every((chunk) => chunk.length <= MAX_CHUNK_LENGTH));
  assert.ok(chunks.some((chunk) => chunk.includes('3.5') && chunk.includes('12:30')));
});

test('a sentence without punctuation is cut on spaces', () => {
  const text = Array.from({ length: 60 }, (_, i) => `mot${i}`).join(' ');
  const chunks = splitText(text);
  assert.equal(chunks.length, 2);
  assert.ok(chunks.every((chunk) => chunk.length <= MAX_CHUNK_LENGTH));
  assert.equal(chunks.join(' '), text);
});

test('Japanese is cut after its full-width punctuation, or anywhere at worst', () => {
  const sentences = 'こんにちは、世界。'.repeat(30);
  const chunks = splitText(sentences);
  assert.ok(chunks.every((chunk) => chunk.length <= MAX_CHUNK_LENGTH && /[。、]$/.test(chunk)));
  assert.equal(chunks.join('').replace(/ /g, ''), sentences);

  const run = '漢'.repeat(400);
  assert.deepEqual(
    splitText(run).map((chunk) => chunk.length),
    [180, 180, 40],
  );
});

test('a cut never splits a surrogate pair', () => {
  const chunks = splitText('😀'.repeat(150));
  assert.deepEqual(
    chunks.map((chunk) => chunk.length),
    [180, 120],
  );
  assert.ok(chunks.every((chunk) => chunk.isWellFormed()));
});
