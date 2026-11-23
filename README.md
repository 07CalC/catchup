# Read Queue

An Obsidian plugin for saving things you want to read later: articles, videos,
books, podcasts, or plain notes and ideas without a link.

Every item becomes a markdown note in your vault with frontmatter for its
status, priority, type and tags, plus a `## Notes` section for your thoughts.
The **Reading Queue** sidebar lists everything and lets you search, filter,
open the original, open the note, change status, or delete an item.

Requires Obsidian 1.7.2 or newer.

## Usage

- Click the book icon in the ribbon, or run **Open reading queue**.
- Run **Add to reading queue** to open the capture dialog.
  - Paste a link and the title, description and favicon are fetched for you.
  - Leave the link empty to save a note or idea.
  - You can enter a bare domain like `example.com/article`.
- Run **Add clipboard contents to reading queue** to capture from the clipboard.
- Run **Add selection to reading queue** to capture selected text from a note.

## Settings

- **Reading folder**: where new reading notes are created (default `Reading`).
- **Fetch page details**: turn off to save links without any network requests.

## Mobile

Works on iOS and Android. On phones the queue opens as a regular tab; on
tablets and desktop it opens in the right sidebar.

The **Add clipboard contents** command depends on the system clipboard API and
may be blocked by iOS/Android. If it cannot read the clipboard, it opens the
normal capture dialog so you can paste the link yourself.

## Development

```bash
npm install
npm run dev    # watch build
npm run build  # type-check and production build
npm run lint
```
