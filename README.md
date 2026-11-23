# Catchup

Catchup is an Obsidian plugin for collecting articles, videos, books, podcasts,
notes, and ideas to come back to later. Saved resources are regular Markdown
files in your vault, so they remain searchable and editable outside the plugin.

## Features

- Capture a link or a standalone note, with optional description, type, priority,
  and tags.
- Fetch a link's title, description, and favicon automatically.
- Browse and search resources in a List view or a Kanban board.
- Filter the List by status. In Kanban, drag a card between columns to update its
  status.
- Open the original link or its Markdown note, and remove resources from the
  queue.
- Keep each item as a Markdown file with frontmatter and a Notes section.

Catchup requires Obsidian 1.7.2 or newer and works on desktop and mobile.

## Installation

When Catchup is available in Obsidian's Community plugins browser:

1. Open **Settings → Community plugins → Browse**.
2. Search for **Catchup**, install it, then enable it.

For manual installation, download `main.js`, `manifest.json`, and `styles.css`
from a [GitHub release](https://github.com/07CalC/ReadQueue/releases), then put
them in `<your-vault>/.obsidian/plugins/catchup/`. Reload Obsidian and enable
Catchup in Community plugins.

## Usage

- Click the book icon in the ribbon or run **Catchup: Open queue**. This opens
  the view selected in **Settings → Catchup → Default resource view**.
- Run **Catchup: Add item** to open the capture dialog. Add a link, or leave the
  link empty to save a note or idea. You can also set its type, priority, and
  tags.
- Run **Catchup: Add clipboard contents** to capture a link from your clipboard.
- Run **Catchup: Add selection** to capture selected text from a note.

Catchup recognizes bare domains such as `example.com/article` and adds the
protocol when needed. When page details are enabled, Catchup tries to fetch the
link's title, description, and favicon. If fetching is disabled or unavailable,
you can still save the link and provide a title yourself.

### Views and statuses

The **List** view opens in the right sidebar on desktop and tablets. It includes
search and status filters. On phones it opens in a tab.

The **Kanban board** opens in a workspace tab and groups resources into three
columns: **To explore**, **In progress**, and **Done**. Drag a card to another
column, or use the status dropdown on a card, to change its status. Search is
available on the board as well.

The default view is saved in plugin settings. The ribbon icon and **Open queue**
command use that preference.

## Settings

- **Saving folder**: vault folder for new resources. Defaults to `Catchup`; the
  folder is created when needed.
- **Fetch page details**: fetch a link's title, description, and favicon when
  adding it. Turn this off to avoid metadata requests.
- **Default resource view**: choose List or Kanban for the ribbon and **Open
  queue** command. List opens in the sidebar, while Kanban opens in a tab.

## Where resources are stored

Each resource is a Markdown file in the saving folder. Its frontmatter stores
the Catchup type, status, priority, resource kind, title, description, date
added, and tags. Links and fetched favicons are included when available. The
file body contains the title, description, original link, and a Notes section.

## Development

```bash
npm install
npm run dev
npm run build
npm run lint
```

The production build creates `main.js`. For a manual release, package it with
`manifest.json` and `styles.css`.

## License

Catchup is released under the [0BSD license](LICENSE).
