// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../src/app.js';
import { ACCENTS, DEFAULT_CONFIG, VOICE_LANGUAGES } from '../src/config.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const field = (key) => manifest.config_schema.find((entry) => entry.key === key);
const optionValues = (key) => field(key).options.map((option) => option.value);

function minGladysVersion() {
  const match = manifest.gladys_version.match(/>=\s*(\d+)\.(\d+)\.(\d+)/);
  assert.ok(match, 'gladys_version must declare a minimum version');
  return match.slice(1).map(Number);
}

test('a text-to-speech provider for Gladys 5.3 or later, on the assistants shelf, in the cloud', () => {
  assert.equal(manifest.type, 'tts');
  // `type: "tts"` and `keywords` exist from Gladys 5.3.0.
  const [major, minor] = minGladysVersion();
  assert.ok(major > 5 || (major === 5 && minor >= 3), manifest.gladys_version);
  assert.deepEqual(manifest.categories, ['assistants']);
  assert.deepEqual(manifest.transports, ['cloud']);
});

test('every manifest action has a registered handler', () => {
  const gladys = createFakeGladys();
  const registered = [];
  const onAction = gladys.onAction.bind(gladys);
  gladys.onAction = (key, handler) => {
    registered.push(key);
    onAction(key, handler);
  };
  registerHandlers(gladys, {}, { logger: { info() {} } });
  assert.deepEqual(
    registered,
    manifest.actions.map((action) => action.key),
  );
});

test('config_schema defaults stay consistent with DEFAULT_CONFIG', () => {
  const stored = manifest.config_schema.filter((entry) => entry.type !== 'section');
  assert.deepEqual(stored.map((entry) => entry.key).sort(), Object.keys(DEFAULT_CONFIG).sort());
  for (const entry of stored) {
    assert.equal(entry.default, DEFAULT_CONFIG[entry.key], `default of ${entry.key}`);
  }
});

test('the voice choices of the form are the ones the code knows', () => {
  assert.deepEqual(optionValues('language'), ['auto', ...VOICE_LANGUAGES]);
  assert.deepEqual(optionValues('accent'), ['default', ...ACCENTS]);
});

test('section fields are purely presentational', () => {
  for (const section of manifest.config_schema.filter((entry) => entry.type === 'section')) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//);
    }
  }
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version, 'manifest version must match package.json');
  assert.equal(
    manifest.docker_image,
    `ghcr.io/guim31/gladys-google-translate-tts:${manifest.version}`,
  );
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/guim31/gladys-google-translate-tts/main/cover.png',
  );
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${lang}: ${text.length}`);
  }
});
