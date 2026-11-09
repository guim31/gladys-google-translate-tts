import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseMp3 } from '../src/mp3.js';

// Real clips of the endpoint ("Oui." in French, "Yes." in English).
const oui = await readFile(new URL('./fixtures/oui-fr.mp3', import.meta.url));
const yes = await readFile(new URL('./fixtures/yes-en.mp3', import.meta.url));

test('a Google Translate clip is MPEG-2 Layer III: frames and duration', () => {
  const clip = parseMp3(oui);
  assert.equal(clip.audio.length, oui.length);
  assert.equal(clip.frames, 28);
  // ffprobe gives 0.672 s.
  assert.ok(Math.abs(clip.seconds - 0.672) < 0.001);
});

test('joined clips read to the end', () => {
  const joined = parseMp3(Buffer.concat([oui, yes]));
  assert.ok(Math.abs(joined.seconds - (parseMp3(oui).seconds + parseMp3(yes).seconds)) < 1e-9);
  assert.equal(joined.audio.length, oui.length + yes.length);
});

test('an ID3 tag at the head is dropped', () => {
  // ID3v2.4 header with a 20-byte tag (synchsafe size).
  const tag = Buffer.concat([
    Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 20]),
    Buffer.alloc(20),
  ]);
  const clip = parseMp3(Buffer.concat([tag, oui]));
  assert.deepEqual(clip.audio, oui);
});

test('a frame cut short at the end is dropped', () => {
  const full = parseMp3(oui);
  const cut = parseMp3(oui.subarray(0, oui.length - 100));
  assert.equal(cut.frames, full.frames - 1);
  assert.ok(cut.audio.length < oui.length - 100);
  // What is kept ends on a whole frame: joined clips stay frame-aligned.
  const joined = parseMp3(Buffer.concat([cut.audio, yes]));
  assert.equal(joined.frames, cut.frames + parseMp3(yes).frames);
});

test('what is not MP3 audio is refused', () => {
  assert.equal(parseMp3(Buffer.from('<html><body>Error 400</body></html>')), null);
  assert.equal(parseMp3(Buffer.alloc(0)), null);
  assert.equal(parseMp3(oui.subarray(0, 100)), null);
});
