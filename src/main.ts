import {
	Notice,
	Platform,
	Plugin,
	TAbstractFile,
	TFile,
} from "obsidian";

import {
	AddItemModal,
	type AddItemSeed,
} from "./modals/AddItemModal";
import {
	CatchupView,
	VIEW_TYPE_CATCHUP_BOARD,
	VIEW_TYPE_CATCHUP_LIST,
} from "./views/CatchupView";
import {
	fetchMetadata,
	guessKind,
	looksLikeUrl,
	normalizeUrl,
} from "./services/MetadataFetcher";
import {
	CatchupRepository,
	isCatchupType,
	type CatchupEntry,
} from "./services/CatchupRepository";
import {
	CatchupSettingTab,
	DEFAULT_SETTINGS,
	type CatchupSettings,
} from "./settings";
import type { NewCatchupItem } from "./types";

export default class CatchupPlugin extends Plugin {
	settings: CatchupSettings = { ...DEFAULT_SETTINGS };
	repository!: CatchupRepository;

	private refreshTimer: number | null = null;

	async onload() {
		await this.loadSettings();

		this.repository = new CatchupRepository(
			this.app,
			() => this.settings.folder
		);

		this.registerView(
			VIEW_TYPE_CATCHUP_LIST,
			(leaf) => new CatchupView(leaf, this, "list")
		);

		this.registerView(
			VIEW_TYPE_CATCHUP_BOARD,
			(leaf) => new CatchupView(leaf, this, "board")
		);

		this.addSettingTab(new CatchupSettingTab(this.app, this));

		this.addRibbonIcon(
			"book-open",
			"Open Catchup",
			() => void this.activateView()
		);

		this.addCommand({
			id: "add-item",
			name: "Add item",
			callback: () => this.addItem(),
		});

		this.addCommand({
			id: "add-clipboard",
			name: "Add clipboard contents",
			callback: () => void this.addFromClipboard(),
		});

		this.addCommand({
			id: "add-selection",
			name: "Add selection",
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
			id: "open-queue",
			name: "Open queue",
			callback: () => void this.activateView(),
		});

		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (this.isCatchupFile(file)) {
					this.scheduleRefresh();
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (this.isCatchupFile(file)) {
					this.scheduleRefresh();
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (this.isCatchupPath(oldPath) || this.isCatchupFile(file)) {
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
			Partial<CatchupSettings> | null;

		this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		await this.refreshViews();
	}

	async setPreferredView(view: "list" | "board"): Promise<void> {
		this.settings.view = view;
		await this.saveSettings();
		await this.activateView(view);
	}

	addItem(seed: AddItemSeed = {}): void {
		new AddItemModal(this.app, this, seed).open();
	}

	addFromText(text: string): void {
		const trimmed = text.trim();

		if (!trimmed) {
			new Notice("There is nothing to add");
			return;
		}

		if (looksLikeUrl(trimmed)) {
			this.addItem({ url: trimmed });
			return;
		}

		const lines = trimmed.split(/\r?\n/);
		const firstLine = lines[0]?.trim() ?? "";
		const rest = lines.slice(1).join("\n").trim();

		this.addItem({
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
			this.addItem();
			return;
		}

		if (!text.trim()) {
			new Notice("The clipboard is empty");
			return;
		}

		this.addFromText(text);
	}

	async createItem(draft: NewCatchupItem): Promise<CatchupEntry> {
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
					`"${existing.item.title}" is already in Catchup`
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

		const entry = await this.repository.create({
			title,
			url,
			description,
			favicon,
			kind: kind ?? (url ? "article" : "note"),
			priority: draft.priority,
			tags: draft.tags,
			status: draft.status,
		});

		new Notice(`Added "${entry.item.title}" to Catchup`);

		await this.refreshViews();

		return entry;
	}

	async refreshViews(): Promise<void> {
		const leaves = [
			...this.app.workspace.getLeavesOfType(VIEW_TYPE_CATCHUP_LIST),
			...this.app.workspace.getLeavesOfType(VIEW_TYPE_CATCHUP_BOARD),
		];
		for (const leaf of leaves) {
			if (leaf.view instanceof CatchupView) {
				await leaf.view.refresh();
			}
		}
	}

	async activateView(view: "list" | "board" = this.settings.view): Promise<void> {
		const viewType = view === "board"
			? VIEW_TYPE_CATCHUP_BOARD
			: VIEW_TYPE_CATCHUP_LIST;
		const existing = this.app.workspace
			.getLeavesOfType(viewType);

		const existingLeaf = existing[0];

		if (existingLeaf) {
			await this.app.workspace.revealLeaf(existingLeaf);
			return;
		}

		const leaf = view === "board" || Platform.isPhone
			? this.app.workspace.getLeaf("tab")
			: this.app.workspace.getRightLeaf(false);

		if (!leaf) return;

		await leaf.setViewState({
			type: viewType,
			active: true,
		});

		await this.app.workspace.revealLeaf(leaf);
	}

	private isCatchupPath(path: string): boolean {
		const folder = this.repository.folderPath;

		return path === folder || path.startsWith(`${folder}/`);
	}

	private isCatchupFile(file: TAbstractFile): boolean {
		if (!(file instanceof TFile) || file.extension !== "md") {
			return false;
		}

		if (this.isCatchupPath(file.path)) {
			return true;
		}

		return isCatchupType(
			this.app.metadataCache.getFileCache(file)?.frontmatter?.type
		);
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
