# Changelog

All notable changes to Ello are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.1] - 2026-07-02

### Removed

- Removed the unfinished AI Polish settings surface and documentation claims.
- Removed the unused `geist` npm package; fonts are vendored in `src/assets/fonts`.

### Security

- Stopped surfacing Groq response bodies in transcription errors; only the HTTP
  status code is shown.

## [1.0.0] - 2026-05-29

### Added

- Initial public Windows release of Ello.

[Unreleased]: https://github.com/FadhilahAfif/Ello/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/FadhilahAfif/Ello/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/FadhilahAfif/Ello/releases/tag/v1.0.0
