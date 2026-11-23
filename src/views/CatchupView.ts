import {
	ItemView,
	Menu,
	Notice,
	Platform,
	setIcon,
	TFile,
	WorkspaceLeaf,
} from "obsidian";

import type CatchupPlugin from "../main";
import type { CatchupEntry } from "../services/CatchupRepository";
import {
	ITEM_STATUSES,
	type ItemKind,
	type ItemPriority,
	type ItemStatus,
} from "../types";

export const VIEW_TYPE_CATCHUP = "catchup-view";

type StatusFilter = ItemStatus | "all";

const STATUS_LABELS: Record<ItemStatus, string> = {
	unread: "Unread",
	reading: "Reading",
	read: "Read",
};

const STATUS_ORDER: Record<ItemStatus, number> = {
	unread: 0,
	reading: 1,
	read: 2,
};

const PRIORITY_ORDER: Record<ItemPriority, number> = {
	high: 0,
	normal: 1,
	low: 2,
};

const KIND_ICONS: Record<ItemKind, string> = {
	article: "file-text",
	video: "video",
	book: "book",
	podcast: "mic",
	note: "sticky-note",
	other: "link",
};

function hostnameOf(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return "";
	}
}

function formatDate(value: string): string {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) return "";

	const sameYear = date.getFullYear() === new Date().getFullYear();

	return date.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		...(sameYear ? {} : { year: "numeric" }),
	});
}

interface FilterButton {
	status: StatusFilter;
	el: HTMLButtonElement;
}

export class CatchupView extends ItemView {
	private entries: CatchupEntry[] = [];
	private filter: StatusFilter = "all";
	private query = "";
	private listEl: HTMLElement | null = null;
	private countEl: HTMLElement | null = null;
	private filterButtons: FilterButton[] = [];

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: CatchupPlugin
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_CATCHUP;
	}

	getDisplayText(): string {
		return "Catchup";
	}

	getIcon(): string {
		return "book-open";
	}

	async onOpen(): Promise<void> {
		await this.refresh();
	}

	async refresh(): Promise<void> {
		this.entries = await this.plugin.repository.list();
		this.render();
	}

	private render(): void {
		const { contentEl } = this;

		contentEl.empty();
		contentEl.addClass("catchup");

		const header = contentEl.createDiv({
			cls: "catchup-header",
		});

		const heading = header.createDiv({
			cls: "catchup-heading",
		});

		heading.createEl("h3", {
			text: "Catchup",
		});

		this.countEl = heading.createDiv({
			cls: "catchup-count",
		});

		const addButton = header.createEl("button", {
			cls: "mod-cta catchup-add",
			attr: { "aria-label": "Add to Catchup" },
		});

		setIcon(addButton, "plus");
		addButton.createSpan({ text: "Add" });

		addButton.addEventListener("click", () => {
			this.plugin.addItem();
		});

		const toolbar = contentEl.createDiv({
			cls: "catchup-toolbar",
		});

		const search = toolbar.createEl("input", {
			cls: "catchup-search",
			type: "search",
			attr: {
				placeholder: "Search Catchup…",
				"aria-label": "Search Catchup",
			},
		});

		search.value = this.query;

		search.addEventListener("input", () => {
			this.query = search.value;
			this.renderList();
		});

		const filters = toolbar.createDiv({
			cls: "catchup-filters",
		});

		this.filterButtons = [];

		const filtersList: Array<{ status: StatusFilter; label: string }> = [
			{ status: "all", label: "All" },
			{ status: "unread", label: "Unread" },
			{ status: "reading", label: "Reading" },
			{ status: "read", label: "Read" },
		];

		for (const filter of filtersList) {
			const button = filters.createEl("button", {
				cls: "catchup-filter",
			});

			button.addEventListener("click", () => {
				this.filter = filter.status;
				this.renderList();
			});

			this.filterButtons.push({
				status: filter.status,
				el: button,
			});
		}

		this.listEl = contentEl.createDiv({
			cls: "catchup-list",
		});

		this.renderList();
	}

	private renderList(): void {
		if (!this.listEl) return;

		const listEl = this.listEl;
		listEl.empty();

		const query = this.query.trim().toLowerCase();

		const filtered = this.entries
			.filter(
				(entry) =>
					this.filter === "all" ||
					entry.item.status === this.filter
			)
			.filter((entry) => {
				if (!query) return true;

				const { title, description, url, tags } = entry.item;

				return [title, description, url, tags.join(" ")]
					.some((value) => value.toLowerCase().includes(query));
			})
			.sort(
				(a, b) =>
					STATUS_ORDER[a.item.status] -
					STATUS_ORDER[b.item.status] ||
					PRIORITY_ORDER[a.item.priority] -
					PRIORITY_ORDER[b.item.priority] ||
					b.item.added.localeCompare(a.item.added)
			);

		this.updateFilterLabels();

		const unread = this.entries.filter(
			(entry) => entry.item.status === "unread"
		).length;

		this.countEl?.setText(
			`${unread} unread · ${this.entries.length} total`
		);

		if (filtered.length === 0) {
			listEl.createEl("p", {
				cls: "catchup-empty",
				text: this.entries.length === 0
					? "Nothing here yet. Add a link or save a note for later."
					: "Nothing matches this filter.",
			});

			return;
		}

		for (const entry of filtered) {
			this.renderItem(entry);
		}
	}

	private updateFilterLabels(): void {
		for (const { status, el } of this.filterButtons) {
			const count = status === "all"
				? this.entries.length
				: this.entries.filter(
					(entry) => entry.item.status === status
				).length;

			el.setText(
				`${status === "all" ? "All" : STATUS_LABELS[status]} ${count}`
			);
			el.toggleClass("is-active", this.filter === status);
		}
	}

	private renderItem(entry: CatchupEntry): void {
		if (!this.listEl) return;

		const { item, file } = entry;

		const card = this.listEl.createDiv({
			cls: "catchup-item",
		});

		card.toggleClass("is-read", item.status === "read");

		const main = card.createDiv({
			cls: "catchup-item-main",
		});

		const kindIcon = main.createSpan({
			cls: "catchup-kind",
		});

		setIcon(kindIcon, KIND_ICONS[item.kind]);
		kindIcon.setAttribute("aria-label", item.kind);

		const content = main.createDiv({
			cls: "catchup-item-content",
		});

		const titleRow = content.createDiv({
			cls: "catchup-title-row",
		});

		const title = titleRow.createEl("a", {
			cls: "catchup-title",
			text: item.title,
			href: item.url || undefined,
		});

		title.setAttribute("title", item.title);

		title.addEventListener("click", (event) => {
			event.preventDefault();

			if (item.url) {
				window.open(item.url, "_blank");
			} else {
				void this.openNote(file);
			}
		});

		if (item.priority === "high") {
			titleRow.createSpan({
				cls: "catchup-priority",
				text: "High",
			});
		}

		if (item.description) {
			content.createDiv({
				cls: "catchup-description",
				text: item.description,
			});
		}

		const meta = content.createDiv({
			cls: "catchup-meta",
		});

		const hostname = hostnameOf(item.url);

		if (hostname) {
			meta.createSpan({ text: hostname });
		}

		const added = formatDate(item.added);

		if (added) {
			meta.createSpan({ text: added });
		}

		for (const tag of item.tags) {
			meta.createSpan({
				cls: "catchup-tag",
				text: `#${tag}`,
			});
		}

		const footer = card.createDiv({
			cls: "catchup-footer",
		});

		const statusSelect = footer.createEl("select", {
			cls: "dropdown catchup-status",
			attr: {
				"aria-label": "Reading status",
			},
		});

		for (const status of ITEM_STATUSES) {
			statusSelect.createEl("option", {
				value: status,
				text: STATUS_LABELS[status],
			});
		}

		statusSelect.value = item.status;

		statusSelect.addEventListener("change", () => {
			void this.updateStatus(
				entry,
				statusSelect.value as ItemStatus
			);
		});

		const actions = footer.createDiv({
			cls: "catchup-actions",
		});

		if (item.url) {
			const openButton = actions.createEl("button", {
				cls: "clickable-icon",
				attr: { "aria-label": "Open original" },
			});

			setIcon(openButton, "external-link");

			openButton.addEventListener("click", () => {
				window.open(item.url, "_blank");
			});
		}

		const noteButton = actions.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": "Open note" },
		});

		setIcon(noteButton, "file-text");

		noteButton.addEventListener("click", () => {
			void this.openNote(file);
		});

		const menuButton = actions.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": "More actions" },
		});

		setIcon(menuButton, "more-horizontal");

		menuButton.addEventListener("click", (event) => {
			this.showMenu(event, entry);
		});
	}

	private showMenu(event: MouseEvent, entry: CatchupEntry): void {
		const menu = new Menu();
		const { item, file } = entry;

		if (item.url) {
			const url = item.url;

			menu.addItem((menuItem) =>
				menuItem
					.setTitle("Open original")
					.setIcon("external-link")
					.onClick(() => window.open(url, "_blank"))
			);
		}

		menu.addItem((menuItem) =>
			menuItem
				.setTitle("Open note")
				.setIcon("file-text")
				.onClick(() => void this.openNote(file))
		);

		if (item.url) {
			const url = item.url;

			menu.addItem((menuItem) =>
				menuItem
					.setTitle("Copy link")
					.setIcon("copy")
					.onClick(async () => {
						try {
							await navigator.clipboard.writeText(url);
							new Notice("Link copied");
						} catch {
							new Notice("Could not copy the link");
						}
					})
			);
		}

		menu.addSeparator();

		for (const status of ITEM_STATUSES) {
			if (status === item.status) continue;

			menu.addItem((menuItem) =>
				menuItem
					.setTitle(`Mark as ${STATUS_LABELS[status].toLowerCase()}`)
					.onClick(() => void this.updateStatus(entry, status))
			);
		}

		menu.addSeparator();

		menu.addItem((menuItem) =>
			menuItem
				.setTitle("Remove from Catchup")
				.setIcon("trash")
				.onClick(() => void this.removeItem(entry))
		);

		menu.showAtMouseEvent(event);
	}

	private async updateStatus(
		entry: CatchupEntry,
		status: ItemStatus
	): Promise<void> {
		if (entry.item.status === status) return;

		await this.plugin.repository.update(entry.file, { status });
		entry.item.status = status;
		this.renderList();
	}

	private async removeItem(entry: CatchupEntry): Promise<void> {
		await this.plugin.repository.remove(entry.file);

		this.entries = this.entries.filter(
			(candidate) => candidate.file.path !== entry.file.path
		);

		this.renderList();

		new Notice("Removed from Catchup");
	}

	private async openNote(file: TFile): Promise<void> {
		const leaf = Platform.isPhone
			? this.app.workspace.getLeaf(false)
			: this.app.workspace.getLeaf("tab");

		await leaf.openFile(file);
	}
}
