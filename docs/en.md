# Google Translate TTS

Gives Gladys the free voice of **Google Translate**: the scene announcements
are spoken by it on your speakers. No account, no API key, like the
`google_translate` text-to-speech of Home Assistant (gTTS).

## What you get

- A **voice for Gladys** (Gladys 5.3.0 or later): once selected, the **Talk on a
  speaker** scene action speaks with Google Translate on your speakers
  (Sonos, Google Cast, AirPlay…).
- Texts in **33 languages**, in the language of each user automatically, with
  regional accents for English, French, Spanish and Portuguese, and a slow
  reading.
- Long texts (up to the 2,000 characters Gladys sends) are cut at the end of
  sentences and joined into a single clip.

## Before you start: what this voice is

- It is the voice of the **Google Translate website**, used the way gTTS has
  used it for years. It is **not an official Google service**: there is no
  guarantee, and Google may change it, limit it or stop it at any time. The
  integration then fails visibly (Supervision, scene log), it never falls back
  to another voice on its own.
- **Every text spoken is sent to Google** (with the IP address of your
  connection), under the
  [Google privacy policy](https://policies.google.com/privacy). Do not use it
  for texts you want to keep at home.
- An Internet connection is required.
- Not affiliated with Google. Google Translate is a trademark of Google LLC.

## Configuration

1. Install the integration from the catalog, then open its **Configuration**
   tab.
2. **Language of the voice**: **Automatic** speaks the language of the user
   Gladys answers, and the language of the first administrator for a scene
   announcement (French when Gladys does not know it). Or force one language.
3. **Accent**: a regional voice (English of the United States, the United
   Kingdom, Australia or India; French of France or Canada; Spanish of Spain
   or Mexico; Portuguese of Brazil or Portugal). It applies when the language
   spoken is its own; the other languages keep their usual voice. The usual
   English voice is the British one.
4. **Slow reading**: speaks more slowly, like the slow button of Google
   Translate.
5. Save, then press **Test the voice**: it asks Google Translate for a test
   sentence and shows the length of the clip received.
6. Open **Integrations → Artificial Intelligence** and choose **Google
   Translate TTS** in the **Voice** card.

## Using it in scenes

Add a **Talk on a speaker** action to a scene, pick a speaker and type the
text. Gladys asks this integration for the clip, then serves it to the speaker
on your local network.

The voice assistant of Gladys stays text-only with a voice integration: its
page runs over HTTPS, and the clip is served over the local network in HTTP,
which the browser blocks. This is a limit of Gladys, the same for every voice
integration.

## Limits

- Google Translate takes **200 characters per request**: a longer text is cut
  at the end of sentences (then clauses, then words) and requested **one part
  at a time**, about 0.3 s each. The 2,000 characters Gladys sends at most make
  about 12 requests, 4 seconds and a 1.5 MB clip of 3 minutes: well within the
  30 seconds Gladys waits.
- Each part is read with its own intonation, so a long text has short pauses
  between parts.
- A clip already made (same text, voice and speed) is kept in memory (the 16
  latest), and one announcement on several speakers asks Google once.
- When Google refuses too many requests (HTTP 429), the integration waits for
  the next announcement: it does not insist.

## Troubleshooting

- **Supervision** shows whether Google Translate answers and, if not, why
  (no Internet, too many requests, the free voice changed…).
- A failed announcement is written in the **logs** of the integration, and the
  scene action fails in the scene log.
- "The free voice may have changed": Google has modified its website; look
  for an update of the integration.
- Start the container with `LOG_LEVEL=debug` to see every request.
