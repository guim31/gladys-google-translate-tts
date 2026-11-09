import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  FALLBACK_LANGUAGE,
  normalizeConfig,
  supportedLanguage,
  voiceCode,
} from '../src/config.js';

test('unknown values fall back to the defaults', () => {
  assert.deepEqual(normalizeConfig(), { ...DEFAULT_CONFIG });
  assert.deepEqual(normalizeConfig(null), { ...DEFAULT_CONFIG });
  assert.deepEqual(normalizeConfig({ language: 'xx', accent: 'en-ZZ', slow: 'yes' }), {
    ...DEFAULT_CONFIG,
  });
  assert.deepEqual(normalizeConfig({ language: 'de', accent: 'fr-CA', slow: 'true' }), {
    language: 'de',
    accent: 'fr-CA',
    slow: true,
  });
});

test('the language Gladys sends is read in its usual forms', () => {
  assert.equal(supportedLanguage('fr'), 'fr');
  assert.equal(supportedLanguage('FR'), 'fr');
  assert.equal(supportedLanguage('en-US'), 'en');
  assert.equal(supportedLanguage('es_ES'), 'es');
  assert.equal(supportedLanguage('zh'), 'zh-CN');
  assert.equal(supportedLanguage('zh-tw'), 'zh-TW');
  assert.equal(supportedLanguage('nb'), 'no');
  assert.equal(supportedLanguage('iw'), 'he');
  assert.equal(supportedLanguage('tlh'), null);
  assert.equal(supportedLanguage(null), null);
  assert.equal(supportedLanguage(42), null);
});

test('automatic mode speaks the language of the user, French when unknown', () => {
  const auto = normalizeConfig({});
  assert.equal(voiceCode(auto, 'en'), 'en');
  assert.equal(voiceCode(auto, 'de'), 'de');
  assert.equal(voiceCode(auto, null), FALLBACK_LANGUAGE);
  assert.equal(voiceCode(auto, 'tlh'), 'fr');
});

test('a forced language ignores the language of the user', () => {
  assert.equal(voiceCode(normalizeConfig({ language: 'it' }), 'en'), 'it');
});

test('the accent applies to its own language only', () => {
  const settings = normalizeConfig({ accent: 'en-US' });
  assert.equal(voiceCode(settings, 'en'), 'en-US');
  assert.equal(voiceCode(settings, 'fr'), 'fr');
  assert.equal(voiceCode(normalizeConfig({ language: 'fr', accent: 'fr-CA' }), 'en'), 'fr-CA');
});
