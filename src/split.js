// -----------------------------------------------------------------------------
// Cutting a text into requests for the Google Translate endpoint.
//
// The endpoint refuses (HTTP 400) a text over 200 characters (UTF-16 units,
// verified on 2026-11-09: 200 pass, 201 fail; 100 emoji pass). Like gTTS, the
// text is cut after the punctuation that ends a sentence or a clause, then on
// spaces, and as a last resort anywhere (a long run of Chinese or Japanese
// without punctuation). Unlike gTTS, consecutive pieces are merged back up to
// the limit: fewer requests, and Google reads each one with its own intonation.
// -----------------------------------------------------------------------------

// A margin under the 200 the endpoint accepts.
export const MAX_CHUNK_LENGTH = 180;

// Latin punctuation ends a piece when a space follows (so "3.5" and "12:30"
// stay whole); full-width CJK punctuation ends it right away.
const BOUNDARY = /(?<=[.!?…;:,])\s+|(?<=[。！？；：，、])/u;
// A piece made only of punctuation or symbols has nothing to say.
const SPEAKABLE = /[\p{L}\p{N}\p{So}]/u;

/**
 * Tidy a text before it is spoken: the Markdown marks an AI answer may carry
 * would be read out loud, and line breaks end a sentence.
 * @param {string} text - The text Gladys sent.
 * @returns {string[]} The lines, trimmed, whitespace collapsed.
 */
function lines(text) {
  return (
    text
      .replace(/\*\*|__|~~|`+/g, ' ')
      .split(/\r?\n+/)
      // A heading or a list mark at the head of a line; "C#" or "#1" stay.
      .map((line) => line.replace(/^\s*(#{1,6}|[*-])\s+/, ''))
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter((line) => line !== '')
  );
}

/**
 * Cut a piece longer than `max` on spaces, and a word longer than `max`
 * anywhere between two characters (never inside a surrogate pair).
 * @param {string} piece - The piece.
 * @param {number} max - Longest chunk, in UTF-16 units.
 * @returns {string[]} Chunks of at most `max` units.
 */
function cutLong(piece, max) {
  const chunks = [];
  let current = '';
  const push = () => {
    if (current !== '') {
      chunks.push(current);
      current = '';
    }
  };
  for (const word of piece.split(' ')) {
    const joined = current === '' ? word : `${current} ${word}`;
    if (joined.length <= max) {
      current = joined;
      continue;
    }
    push();
    if (word.length <= max) {
      current = word;
      continue;
    }
    for (const character of word) {
      if (current.length + character.length > max) {
        push();
      }
      current += character;
    }
  }
  push();
  return chunks;
}

/**
 * Split a text into the chunks sent to Google Translate, in order.
 * @param {string} text - The text to speak.
 * @param {number} [max] - Longest chunk, in UTF-16 units.
 * @returns {string[]} The chunks, empty when there is nothing to say.
 * @example
 * splitText('Hello. How are you?'); // ['Hello. How are you?']
 */
export function splitText(text, max = MAX_CHUNK_LENGTH) {
  const pieces = lines(String(text ?? ''))
    .flatMap((line) => line.split(BOUNDARY))
    .map((piece) => piece.trim())
    .filter((piece) => SPEAKABLE.test(piece))
    .flatMap((piece) => (piece.length > max ? cutLong(piece, max) : [piece]));

  const chunks = [];
  for (const piece of pieces) {
    const last = chunks.length - 1;
    if (last >= 0 && chunks[last].length + 1 + piece.length <= max) {
      chunks[last] = `${chunks[last]} ${piece}`;
    } else {
      chunks.push(piece);
    }
  }
  return chunks;
}
