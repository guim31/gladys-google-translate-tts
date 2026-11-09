# Google Translate TTS for Gladys Assistant

A text-to-speech provider for [Gladys Assistant](https://gladysassistant.com)
that speaks with the free voice of **Google Translate**: no account, no API
key, like the `google_translate` text-to-speech of Home Assistant (gTTS). Once
selected as the voice of Gladys, the **Talk on a speaker** scene action
announces your texts on Sonos, Google Cast or AirPlay speakers.

> **Unofficial.** This uses the voice of the Google Translate website, not a
> Google Cloud API: there is no guarantee, and Google may change, limit or stop
> it at any time. Every text spoken is sent to Google.

## Features

- 33 languages, in the language of each user automatically (the first
  administrator's for a scene announcement), or one language forced.
- Regional accents: English (US, UK, Australia, India), French (France,
  Canada), Spanish (Spain, Mexico), Portuguese (Brazil, Portugal); slow reading.
- Long texts (the 2,000 characters Gladys sends at most) cut at the end of
  sentences, requested one part at a time and joined into one MP3 clip.
- A memory of the 16 latest clips; one announcement on several speakers asks
  Google once.
- The state of the service in Supervision, and a "Test the voice" button.

## Requirements

- Gladys Assistant **5.3.0** or later (text-to-speech providers).
- An Internet connection from the Gladys host.

## Installation

In Gladys, open **Integrations → Install from GitHub** and enter
`https://github.com/guim31/gladys-google-translate-tts`, or install it from the
catalog. Then choose **Google Translate TTS** in the **Voice** card of the
**Artificial Intelligence** integration. The full user documentation is in
[`docs/`](docs/en.md) (English, French, German, Spanish).

## How it works

`GET https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=<language>&q=<text>`
answers an MPEG-2 Layer III clip (24 kHz mono, 64 kbit/s) for at most 200
characters. The integration cuts the text like gTTS does (sentences, clauses,
words), merges the pieces back up to 180 characters, sends the requests one at
a time (about 0.3 s each, 12 for 2,000 characters), checks that each answer is
MPEG audio and joins the frames. Accents use regional language codes (`en-US`,
`fr-CA`…): the `tld` gTTS uses for that changes nothing on this endpoint.

## Limits

- Unofficial endpoint, subject to change and to rate limits (HTTP 429): the
  integration then fails visibly, it does not retry in a loop.
- Each part of a long text is read with its own intonation.
- The voice assistant of Gladys stays text-only with any voice integration
  (its HTTPS page cannot play a clip served over HTTP on the local network).

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests never touch the network: `test/fixtures/` holds two real clips of
the endpoint. See [`CLAUDE.md`](CLAUDE.md) for the project rules.

## Credits

- [gTTS](https://github.com/pndurette/gTTS) by Pierre Nicolas Durette (MIT),
  for the endpoint, the slow speed parameter and the way to cut a text.
- The `google_translate` integration of
  [Home Assistant](https://github.com/home-assistant/core) (Apache-2.0).
- Cover: the Google Translate logo from
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Google_Translate_logo.svg)
  (public domain, trademark of Google LLC).
- Built on the official
  [JavaScript template](https://github.com/GladysAssistant/integration-template-js)
  and [SDK](https://github.com/GladysAssistant/integration-sdk-js) of Gladys.

Not affiliated with Google. Google Translate is a trademark of Google LLC.

## License

Apache-2.0
