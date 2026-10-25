# Obsidian Douban Plugin

An Obsidian plugin for importing and syncing Douban data. It can create notes from Douban movies, TV shows, books, music, games, notes, theater productions, and personal collection records.

![background](doc/background.png)

## Features

- Search Douban items and create Obsidian notes
- Search by current file name or custom input
- Sync personal movie, TV, book, music, and game records
- Import ratings, comments, collection dates, states, and tags
- Save covers locally or through a configured image host
- Customize templates, output paths, and field variables
- Export custom properties to JSON and import them with merge or overwrite modes
- Use built-in `basic / compact / sync` template presets and write them directly to template files
- Preview templates, save them as reusable files, and restore the built-in default template
- Inherit selected frontmatter fields from existing notes during forced replacement sync
- Preview forced sync changes before execution, back up old notes automatically, and emit a structured sync report
- Export settings without login credentials by default and import settings through a whitelist-based sanitizer
- Page guards, HTTP timeouts/limited retries, and isolated per-item failures prevent blank notes
- QR code login with manual Cookie login retained as a fallback
- Batch URL import with progress, cancellation, and per-item failure details
- Per-type array length limits for fields such as actor, director, author, and aliases
- Full theater parsing and an independent theater template
- New `imageName` and book `popularComments` template variables
- Works on desktop and mobile Obsidian

## Usage

Open the Obsidian command palette with <kbd>Ctrl</kbd> + <kbd>P</kbd>, search for “Douban”, and run the plugin command you need.

![Search Data](doc/img/search_and_create_note.gif)

After logging in to Douban, the plugin can sync your personal collection records.

![Sync Data From Douban](doc/img/sync_data_from_douban.gif)

Before a forced replacement sync runs, the plugin can now show a preview of which notes will be created, replaced, or skipped. When automatic backup is enabled, the old note is backed up before the replacement step.

## Settings

- Douban account: required for syncing personal records
- Import template: controls the generated note body
- Output path: controls where notes are created
- Attachment settings: controls where cover images are stored

### New in 1.2.0

- Custom properties now support `Export JSON`, `Merge Import`, and `Overwrite Import`
- Template settings now provide built-in presets that can be copied or written to files directly
- The sync modal now supports inheriting selected frontmatter fields from the old note during forced replacement

### New in 2.2.0

- Added page guards for login, challenge, access-denied, incomplete, and empty responses
- Added desktop request timeouts, bounded GET/HEAD retries, redirect limits, and active aborts
- Completed mobile request headers, timeouts, retries, and relative redirect handling
- Added QR code login while retaining manual Cookie login on desktop and mobile
- Added batch URL import with deduplication, movie/teleplay detection, cancellation, and failure isolation
- Added array field length limits without modifying the original scraped data
- Added complete theater parsing, templates, and legacy page fallbacks
- Added `imageName` and book `popularComments` template variables
- Added the open-after-create setting, narrow settings layout, and click-to-copy template variables
- Internationalization now follows the current Obsidian locale at runtime

### New in 2.1.x

- Force sync now supports pre-execution preview and confirmation
- Old notes can be backed up automatically before destructive replacement
- Sync results now generate a structured JSON report for troubleshooting
- Settings export excludes login credentials by default
- Template preview/editor now supports `Save As File` and `Restore Default Template`

## Installation

### From Obsidian

1. Open Obsidian settings
2. Go to Community plugins
3. Search for `obsidian-douban`
4. Install and enable the plugin

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from this repository's Release page
2. Put them into `/.obsidian/plugins/obsidian-douban-plugin/` in your vault
3. Enable the plugin in Obsidian

## Development

```shell
npm install
npm run build
npm run dev
npm test
```

## Disclaimer

1. Back up your Obsidian vault before using the plugin.
2. This plugin only organizes Douban data that the user can access. It does not provide book, movie, TV, music, or game content.
3. Check your output path and overwrite settings before running sync operations.
4. Users are responsible for the consequences of using, modifying, or distributing this plugin.

