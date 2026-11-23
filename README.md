# Catchup

Catchup is an Obsidian plugin for saving articles, videos, books, podcasts,
notes and ideas to read later.

Every item becomes a markdown note in your vault with frontmatter for its
status, priority, type and tags, plus a notes section for your thoughts. The
Catchup view lists everything and lets you search, filter, open the original,
open the note, change status or remove an item.

Requires Obsidian 1.7.2 or newer.

## Usage

- Click the book icon in the ribbon, or run **Catchup: Open queue**.
- Run **Catchup: Add item** to open the capture dialog.
  - Paste a link and the title, description and favicon are fetched for you.
  - Leave the link empty to save a note or idea.
  - Enter a bare domain such as `example.com/article`.
- Run **Catchup: Add clipboard contents** to capture from the clipboard.
- Run **Catchup: Add selection** to capture selected text from a note.

## Settings

- **Saving folder**: where new Catchup items are saved (default `Catchup`).
- **Fetch page details**: turn off to save links without network requests.

## Mobile

Catchup works on iOS and Android. On phones the view opens as a regular tab;
on tablets and desktop it opens in the right sidebar.

The clipboard command depends on the system clipboard API and may be blocked
by iOS or Android. If the clipboard cannot be read, Catchup opens the capture
dialog so you can paste the link manually.

## Development

```bash
npm install
npm run dev
npm run build
npm run lint
```
