// -----------------------------------------------------------------------------
// Just enough MP3 to join clips.
//
// Google Translate answers a bare MPEG-2 Layer III stream (24 kHz mono, 64
// kbit/s, no ID3 tag, no Xing/Info header: verified on 2026-11-09). MPEG frames
// stand alone, so clips join end to end; a player never stops early on a frame
// count meant for the first clip only. An ID3v2 tag at the head of a clip is
// dropped all the same, should Google add one some day.
// -----------------------------------------------------------------------------

// Bitrates in kbit/s, by [MPEG-1 ? 0 : 1][index] for Layer III.
const BITRATES = [
  [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
];
// Sample rates in Hz, by version bits (3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5).
const SAMPLE_RATES = {
  3: [44100, 48000, 32000],
  2: [22050, 24000, 16000],
  0: [11025, 12000, 8000],
};

/**
 * Header of the MPEG Layer III frame starting at `offset`.
 * @param {Buffer} buffer - The stream.
 * @param {number} offset - Where the frame should start.
 * @returns {{length: number, samples: number, sampleRate: number}|null} The frame, null when there is none.
 */
function frameAt(buffer, offset) {
  if (
    offset + 4 > buffer.length ||
    buffer[offset] !== 0xff ||
    (buffer[offset + 1] & 0xe0) !== 0xe0
  ) {
    return null;
  }
  const version = (buffer[offset + 1] >> 3) & 0x03;
  const layer = (buffer[offset + 1] >> 1) & 0x03;
  const bitrateIndex = buffer[offset + 2] >> 4;
  const rateIndex = (buffer[offset + 2] >> 2) & 0x03;
  const padding = (buffer[offset + 2] >> 1) & 0x01;
  // Layer III only, no reserved version, no free or bad bitrate.
  if (
    version === 1 ||
    layer !== 1 ||
    bitrateIndex === 0 ||
    bitrateIndex === 15 ||
    rateIndex === 3
  ) {
    return null;
  }
  const mpeg1 = version === 3;
  const bitrate = BITRATES[mpeg1 ? 0 : 1][bitrateIndex] * 1000;
  const sampleRate = SAMPLE_RATES[version][rateIndex];
  const samples = mpeg1 ? 1152 : 576;
  const length = Math.floor(((samples / 8) * bitrate) / sampleRate) + padding;
  return { length, samples, sampleRate };
}

/**
 * Size of the ID3v2 tag at the head of a clip, 0 without one.
 * @param {Buffer} buffer - The clip.
 * @returns {number} Bytes to skip.
 */
function id3Length(buffer) {
  if (buffer.length < 10 || buffer.toString('latin1', 0, 3) !== 'ID3') {
    return 0;
  }
  // Synchsafe integer: 7 bits per byte; plus the header, plus the footer flag.
  const size = (buffer[6] << 21) | (buffer[7] << 14) | (buffer[8] << 7) | buffer[9];
  const footer = buffer[5] & 0x10 ? 10 : 0;
  return 10 + size + footer;
}

/**
 * Read a clip: its MPEG frames, without what precedes them.
 * @param {Buffer} buffer - An MP3 clip.
 * @returns {{audio: Buffer, frames: number, seconds: number}|null} The frames
 *   and their duration, null when the clip holds no MPEG Layer III audio.
 * @example
 * parseMp3(clip); // { audio: <Buffer ff f3 …>, frames: 129, seconds: 3.096 }
 */
export function parseMp3(buffer) {
  const start = id3Length(buffer);
  let offset = start;
  let frames = 0;
  let seconds = 0;
  for (let frame = frameAt(buffer, offset); frame; frame = frameAt(buffer, offset)) {
    frames += 1;
    seconds += frame.samples / frame.sampleRate;
    offset += frame.length;
  }
  // Two frames at least, so a page that happens to start with 0xFFE is not taken for audio.
  if (frames < 2) {
    return null;
  }
  return { audio: buffer.subarray(start, Math.min(offset, buffer.length)), frames, seconds };
}
