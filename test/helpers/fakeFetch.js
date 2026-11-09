// A fetch that answers like the Google Translate endpoint, from real clips,
// and records every request.

import { readFile } from 'node:fs/promises';

export const OUI = await readFile(new URL('../fixtures/oui-fr.mp3', import.meta.url));
export const YES = await readFile(new URL('../fixtures/yes-en.mp3', import.meta.url));

export const mp3 = (clip = OUI) =>
  new Response(clip, { status: 200, headers: { 'content-type': 'audio/mpeg' } });

/**
 * @param {(url: URL, call: number) => Response|Promise<Response>} [answer] - Answer of each request.
 * @returns {typeof fetch & {calls: {url: URL, init: RequestInit}[]}} The fake.
 */
export function fakeFetch(answer = () => mp3()) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url: new URL(url), init });
    return answer(new URL(url), calls.length);
  };
  fetch.calls = calls;
  return fetch;
}
