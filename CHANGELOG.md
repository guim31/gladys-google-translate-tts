# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- Gladys speaks with the free voice of Google Translate (no account, no API
  key): scene announcements ("Talk on a speaker") on your speakers, once the
  voice is selected on the Artificial Intelligence page (Gladys 5.3.0 or later).
- Voice language: automatic (the language of the user, or of the first
  administrator for an announcement) or forced among 33 languages; regional
  accents (English of the United States, the United Kingdom, Australia, India;
  French of France or Canada; Spanish of Spain or Mexico; Portuguese of Brazil
  or Portugal); slow reading.
- Long texts (up to the 2,000 characters Gladys sends) are cut at the end of
  sentences, requested one at a time and joined into a single clip.
- A clip already made is served from memory, and one announcement on several
  speakers asks Google once.
- Supervision shows whether Google Translate answers, and why not.
- A "Test the voice" button in the configuration screen.
