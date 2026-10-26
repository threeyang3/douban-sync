# Changelog

## Unreleased

### Fixed

- Import previews preserve unchecked entries and apply custom-property aliases before comparing fields.
- Records and thoughts participate in the import diff and support keep, overwrite, and smart merge strategies.
- Imports update the latest file content atomically, preserving edits made after preview.
- Frontmatter updates preserve adjacent fields, replace complete block values, and safely serialize string values and quoted keys.
- Text-file writes preserve the requested extension; backup recovery also works from hidden directories.
- Force sync checks ownership again when an ID-suffixed filename is already occupied.

## 2.2.1 - 2026-10-27

### Fixed

- Book descriptions now prefer the expanded summary on current Douban pages, avoiding duplicated short/full paragraphs and the expand control text.

### Validation

- Added three regression tests for current expanded summaries, legacy expanded summaries, and descriptions without a collapsed version.
- 23 test suites and 101 tests pass; TypeScript checking and production build pass.
- Validated real search and batch imports in the local Obsidian Sandbox, including cover downloads and invalid/duplicate/existing-file handling.
- Redeployed the fix and reimported a book and a theater entry successfully; no runtime errors were captured during verification.

## 2.2.0 - 2026-10-25

### Added

- QR code login for desktop and mobile, with manual Cookie login retained as a fallback.
- Batch import from multiple Douban URLs, including progress, cancellation, deduplication, and per-item failure details.
- Semantic page parsing for tags, comments, descriptions, and theater pages.
- Independent theater parsing and template, including multi-version performance metadata.
- Array field length limits by subject type and field name.
- `imageName` template variable and book `popularComments` template variable.
- Open-after-create setting for search imports.
- Click-to-copy template variables in plugin settings.

### Improved

- Desktop requests now have absolute timeouts, bounded GET/HEAD retries, redirect limits, and active aborts.
- Mobile requests now send complete headers and handle timeouts, retries, and relative redirects.
- Movie and teleplay URLs are detected from JSON-LD, Open Graph, and page structure.
- Settings pages adapt to narrow containers with wrapped controls, scrollable tabs, and scrollable wide tables.
- Internationalization follows the current Obsidian locale at runtime.
- Search Enter handling no longer propagates to underlying Obsidian components or submits twice.

### Fixed

- Login, challenge, access-denied, empty, and incomplete pages no longer create blank notes.
- Search API JSON responses containing HTML fragments are no longer rejected by the page guard.
- Force sync no longer overwrites a different Douban subject that resolves to the same filename.
- Failed login attempts no longer overwrite previously valid saved credentials.
- Search result count no longer displays repeated `[object Object]` values.
- Invalid or duplicate batch URLs no longer stop later imports.

### Security

- Cookie, Authorization, and login query parameters are excluded from ordinary diagnostics.
- Credentials are stripped when redirects leave trusted Douban domains.
- Cookie headers are not forwarded to cover image hosts.
- Unsupported or changing challenge pages fail closed without creating notes.

### Validation

- 22 test suites and 98 tests pass.
- TypeScript type checking and production build pass.
- Real Sandbox validation completed for QR login, restart persistence, search import, batch import, and theater import.
- Compatibility regression tests cover ID priority, custom templates, output path rules, and legacy template migration.
