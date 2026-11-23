import {
	Notice,
	Platform,
	Plugin,
	TAbstractFile,
	TFile,
} from "obsidian";

import {
	AddReadingModal,
	type AddReadingSeed,
} from "./modals/AddReadingModal";
import {
	ReadingQueueView,
	VIEW_TYPE_READING_QUEUE,
} from "./views/ReadingQueueView";
import {
	fetchMetadata,
	guessKind,
	looksLikeUrl,
	normalizeUrl,
} from "./services/MetadataFetcher";
import {
	ReadingRepository,
	type ReadingNote,
} from "./services/ReadingRepository";
import {
	DEFAULT_SETTINGS,
	ReadQueueSettingTab,
	type ReadQueueSettings,
} from "./settings";
import type { NewReadingItem } from "./types";

export default class ReadQueuePlugin extends Plugin {
	settings: ReadQueueSettings = { ...DEFAULT_SETTINGS };
	repository!: ReadingRepository;

	private refreshTimer: number | null = null;

	async onload() {
		await this.loadSettings();

		this.repository = new ReadingRepository(
			this.app,
			() => this.settings.folder
		);

		this.registerView(
			VIEW_TYPE_READING_QUEUE,
			(leaf) => new ReadingQueueView(leaf, this)
		);

		this.addSettingTab(new ReadQueueSettingTab(this.app, this));

		this.addRibbonIcon(
			"book-open",
			"Open reading queue",
			() => void this.activateView()
		);

		this.addCommand({
			id: "add-to-reading-queue",
			name: "Add to reading queue",
			callback: () => this.addReading(),
		});

		this.addCommand({
			id: "add-clipboard-to-reading-queue",
			name: "Add clipboard contents to reading queue",
			callback: () => void this.addFromClipboard(),
		});

		this.addCommand({
			id: "add-selection-to-reading-queue",
			name: "Add selection to reading queue",
			editorCheckCallback: (checking, editor) => {
				const selection = editor.getSelection().trim();

				if (!selection) return false;

				if (!checking) {
					this.addFromText(selection);
				}

				return true;
			},
		});

		this.addCommand({
			id: "open-reading-queue",
			name: "Open reading queue",
			callback: () => void this.activateView(),
		});

		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (this.isReadingFile(file)) {
					this.scheduleRefresh();
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (this.isReadingFile(file)) {
					this.scheduleRefresh();
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (this.isReadingPath(oldPath) || this.isReadingFile(file)) {
					this.scheduleRefresh();
				}
			})
		);
	}

	onunload() {
		if (this.refreshTimer !== null) {
			window.clearTimeout(this.refreshTimer);
			this.refreshTimer = null;
		}
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as
			Partial<ReadQueueSettings> | null;

		this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		await this.refreshViews();
	}

	addReading(seed: AddReadingSeed = {}): void {
		new AddReadingModal(this.app, this, seed).open();
	}

	addFromText(text: string): void {
		const trimmed = text.trim();

		if (!trimmed) {
			new Notice("There is nothing to add");
			return;
		}

		if (looksLikeUrl(trimmed)) {
			this.addReading({ url: trimmed });
			return;
		}

		const lines = trimmed.split(/\r?\n/);
		const firstLine = lines[0]?.trim() ?? "";
		const rest = lines.slice(1).join("\n").trim();

		this.addReading({
			title: firstLine.slice(0, 200),
			description: rest || (firstLine.length > 200 ? trimmed : ""),
		});
	}

	async addFromClipboard(): Promise<void> {
		let text: string;

		try {
			text = await navigator.clipboard.readText();
		} catch {
			new Notice("Could not read the clipboard. Paste the link instead.");
			this.addReading();
			return;
		}

		if (!text.trim()) {
			new Notice("The clipboard is empty");
			return;
		}

		this.addFromText(text);
	}

	/**
	 * Validates and saves a new reading item, filling in page details
	 * when a URL is available. Returns the existing note on duplicates.
	 */
	async createReading(draft: NewReadingItem): Promise<ReadingNote> {
		let url = draft.url
			? normalizeUrl(draft.url)?.href ?? ""
			: "";

		if (draft.url && !url) {
			throw new Error("That does not look like a valid link");
		}

		let title = draft.title?.trim() ?? "";
		let description = draft.description?.trim() ?? "";
		let favicon = draft.favicon ?? "";
		let kind = draft.kind;

		if (url) {
			const existing = await this.repository.findByUrl(url);

			if (existing) {
				new Notice(
					`"${existing.item.title}" is already in your reading queue`
				);
				await this.activateView();
				return existing;
			}

			if (this.settings.fetchMetadata) {
				try {
					const metadata = await fetchMetadata(url);

					if (!title) title = metadata.title;
					if (!description) description = metadata.description;
					favicon = metadata.favicon;
					if (!kind) kind = guessKind(url);
				} catch (error) {
					if (!title) {
						title = new URL(url).hostname;
					}

					new Notice(
						error instanceof Error
							? `Saved without page details: ${error.message}`
							: "Saved without page details"
					);
				}
			} else if (!title) {
				title = new URL(url).hostname;
			}
		}

		if (!title) {
			throw new Error("Add a link or a title");
		}

		const note = await this.repository.create({
			title,
			url,
			description,
			favicon,
			kind: kind ?? (url ? "article" : "note"),
			priority: draft.priority,
			tags: draft.tags,
			status: draft.status,
		});

		new Notice(`Added "${note.item.title}" to your reading queue`);

		await this.refreshViews();

		return note;
	}

	async refreshViews(): Promise<void> {
		for (const leaf of this.app.workspace.getLeavesOfType(
			VIEW_TYPE_READING_QUEUE
		)) {
			if (leaf.view instanceof ReadingQueueView) {
				await leaf.view.refresh();
			}
		}
	}

	async activateView(): Promise<void> {
		const existing = this.app.workspace
			.getLeavesOfType(VIEW_TYPE_READING_QUEUE);

		const existingLeaf = existing[0];

		if (existingLeaf) {
			await this.app.workspace.revealLeaf(existingLeaf);
			return;
		}

		const leaf = Platform.isPhone
			? this.app.workspace.getLeaf("tab")
			: this.app.workspace.getRightLeaf(false);

		if (!leaf) return;

		await leaf.setViewState({
			type: VIEW_TYPE_READING_QUEUE,
			active: true,
		});

		await this.app.workspace.revealLeaf(leaf);
	}

	private isReadingPath(path: string): boolean {
		const folder = this.repository.folderPath;

		return path === folder || path.startsWith(`${folder}/`);
	}

	private isReadingFile(file: TAbstractFile): boolean {
		if (!(file instanceof TFile) || file.extension !== "md") {
			return false;
		}

		if (this.isReadingPath(file.path)) {
			return true;
		}

		return this.app.metadataCache
			.getFileCache(file)?.frontmatter?.type === "reading";
	}

	private scheduleRefresh(): void {
		if (this.refreshTimer !== null) {
			window.clearTimeout(this.refreshTimer);
		}

		this.refreshTimer = window.setTimeout(() => {
			this.refreshTimer = null;
			void this.refreshViews();
		}, 250);
	}
}
