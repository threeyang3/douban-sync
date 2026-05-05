# Obsidian Douban Plugin

An Obsidian plugin for importing and syncing Douban data. It can create notes from Douban movies, TV shows, books, music, games, notes, and personal collection records.

![background](doc/background.png)

## Features

- Search Douban items and create Obsidian notes
- Search by current file name or custom input
- Sync personal movie, TV, book, music, and game records
- Import ratings, comments, collection dates, states, and tags
- Save covers locally or through a configured image host
- Customize templates, output paths, and field variables
- Works on desktop and mobile Obsidian

## Usage

Open the Obsidian command palette with <kbd>Ctrl</kbd> + <kbd>P</kbd>, search for “Douban”, and run the plugin command you need.

![Search Data](doc/img/search_and_create_note.gif)

After logging in to Douban, the plugin can sync your personal collection records.

![Sync Data From Douban](doc/img/sync_data_from_douban.gif)

## Settings

- Douban account: required for syncing personal records
- Import template: controls the generated note body
- Output path: controls where notes are created
- Attachment settings: controls where cover images are stored

## Installation

### From Obsidian

1. Open Obsidian settings
2. Go to Community plugins
3. Search for `obsidian-douban`
4. Install and enable the plugin

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from this repository's Release page
2. Put them into `/.obsidian/plugins/obsidian-douban/` in your vault
3. Enable the plugin in Obsidian

## Development

```shell
npm install
npm run build
npm run dev
```

## Disclaimer

1. Back up your Obsidian vault before using the plugin.
2. This plugin only organizes Douban data that the user can access. It does not provide book, movie, TV, music, or game content.
3. Check your output path and overwrite settings before running sync operations.
4. Users are responsible for the consequences of using, modifying, or distributing this plugin.

