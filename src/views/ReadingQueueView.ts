import {
	ItemView,
	Menu,
	Notice,
	setIcon,
	TFile,
	WorkspaceLeaf,
} from "obsidian";

import type ReadQueuePlugin from "../main";
import type { ReadingNote } from "../services/ReadingRepository";
import {
	READING_STATUSES,
	type ReadingKind,
	type ReadingPriority,
	type ReadingStatus,
} from "../types";

export const VIEW_TYPE_READING_QUEUE = "reading-queue-view";

type StatusFilter = ReadingStatus | "all";

const STATUS_LABELS: Record<ReadingStatus, string> = {
	unread: "Unread",
	reading: "Reading",
	read: "Read",
};

const STATUS_ORDER: Record<ReadingStatus, number> = {
	unread: 0,
	reading: 1,
	read: 2,
};

const PRIORITY_ORDER: Record<ReadingPriority, number> = {
	high: 0,
	normal: 1,
	low: 2,
};

const KIND_ICONS: Record<ReadingKind, string> = {
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

export class ReadingQueueView extends ItemView {
	private notes: ReadingNote[] = [];
	private filter: StatusFilter = "all";
	private query = "";
	private listEl: HTMLElement | null = null;
	private countEl: HTMLElement | null = null;
	private filterButtons: FilterButton[] = [];

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: ReadQueuePlugin
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_READING_QUEUE;
	}

	getDisplayText(): string {
		return "Reading queue";
	}

	getIcon(): string {
		return "book-open";
	}

	async onOpen(): Promise<void> {
		await this.refresh();
	}

	async refresh(): Promise<void> {
		this.notes = await this.plugin.repository.list();
		this.render();
	}

	private render(): void {
		const { contentEl } = this;

		contentEl.empty();
		contentEl.addClass("reading-queue");

		const header = contentEl.createDiv({
			cls: "reading-queue-header",
		});

		const heading = header.createDiv({
			cls: "reading-queue-heading",
		});

		heading.createEl("h3", {
			text: "Reading queue",
		});

		this.countEl = heading.createDiv({
			cls: "reading-queue-count",
		});

		const addButton = header.createEl("button", {
			cls: "reading-queue-add",
			attr: { "aria-label": "Add to reading queue" },
		});

		setIcon(addButton, "plus");
		addButton.createSpan({ text: "Add" });

		addButton.addEventListener("click", () => {
			this.plugin.addReading();
		});

		const toolbar = contentEl.createDiv({
			cls: "reading-queue-toolbar",
		});

		const search = toolbar.createEl("input", {
			cls: "reading-queue-search",
			type: "search",
			attr: {
				placeholder: "Search your queue…",
				"aria-label": "Search your reading queue",
			},
		});

		search.value = this.query;

		search.addEventListener("input", () => {
			this.query = search.value;
			this.renderList();
		});

		const filters = toolbar.createDiv({
			cls: "reading-queue-filters",
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
				cls: "reading-queue-filter",
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
			cls: "reading-queue-list",
		});

		this.renderList();
	}

	private renderList(): void {
		if (!this.listEl) return;

		const listEl = this.listEl;
		listEl.empty();

		const query = this.query.trim().toLowerCase();

		const filtered = this.notes
			.filter(
				(note) =>
					this.filter === "all" ||
					note.item.status === this.filter
			)
			.filter((note) => {
				if (!query) return true;

				const { title, description, url, tags } = note.item;

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

		const unread = this.notes.filter(
			(note) => note.item.status === "unread"
		).length;

		this.countEl?.setText(
			`${unread} unread · ${this.notes.length} total`
		);

		if (filtered.length === 0) {
			listEl.createEl("p", {
				cls: "reading-queue-empty",
				text: this.notes.length === 0
					? "Nothing here yet. Add a link, or save a note about something you want to read."
					: "Nothing matches this filter.",
			});

			return;
		}

		for (const note of filtered) {
			this.renderItem(note);
		}
	}

	private updateFilterLabels(): void {
		for (const { status, el } of this.filterButtons) {
			const count = status === "all"
				? this.notes.length
				: this.notes.filter(
					(note) => note.item.status === status
				).length;

			el.setText(`${status === "all" ? "All" : STATUS_LABELS[status]} ${count}`);
			el.toggleClass("is-active", this.filter === status);
		}
	}

	private renderItem(note: ReadingNote): void {
		if (!this.listEl) return;

		const { item, file } = note;

		const card = this.listEl.createDiv({
			cls: "reading-queue-item",
		});

		card.toggleClass("is-read", item.status === "read");

		const main = card.createDiv({
			cls: "reading-queue-item-main",
		});

		const kindIcon = main.createSpan({
			cls: "reading-queue-kind",
		});

		setIcon(kindIcon, KIND_ICONS[item.kind]);
		kindIcon.setAttribute("aria-label", item.kind);

		const content = main.createDiv({
			cls: "reading-queue-item-content",
		});

		const titleRow = content.createDiv({
			cls: "reading-queue-title-row",
		});

		const title = titleRow.createEl("a", {
			cls: "reading-queue-title",
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
				cls: "reading-queue-priority",
				text: "High",
			});
		}

		if (item.description) {
			content.createDiv({
				cls: "reading-queue-description",
				text: item.description,
			});
		}

		const meta = content.createDiv({
			cls: "reading-queue-meta",
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
				cls: "reading-queue-tag",
				text: `#${tag}`,
			});
		}

		const footer = card.createDiv({
			cls: "reading-queue-footer",
		});

		const statusSelect = footer.createEl("select", {
			cls: "dropdown reading-queue-status",
			attr: {
				"aria-label": "Reading status",
			},
		});

		for (const status of READING_STATUSES) {
			statusSelect.createEl("option", {
				value: status,
				text: STATUS_LABELS[status],
			});
		}

		statusSelect.value = item.status;

		statusSelect.addEventListener("change", () => {
			void this.updateStatus(
				note,
				statusSelect.value as ReadingStatus
			);
		});

		const actions = footer.createDiv({
			cls: "reading-queue-actions",
		});

		if (item.url) {
			const openButton = actions.createEl("button", {
				cls: "reading-queue-action",
				attr: { "aria-label": "Open original" },
			});

			setIcon(openButton, "external-link");

			openButton.addEventListener("click", () => {
				window.open(item.url, "_blank");
			});
		}

		const noteButton = actions.createEl("button", {
			cls: "reading-queue-action",
			attr: { "aria-label": "Open note" },
		});

		setIcon(noteButton, "file-text");

		noteButton.addEventListener("click", () => {
			void this.openNote(file);
		});

		const menuButton = actions.createEl("button", {
			cls: "reading-queue-action",
			attr: { "aria-label": "More actions" },
		});

		setIcon(menuButton, "more-horizontal");

		menuButton.addEventListener("click", (event) => {
			this.showMenu(event, note);
		});
	}

	private showMenu(event: MouseEvent, note: ReadingNote): void {
		const menu = new Menu();
		const { item, file } = note;

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

		for (const status of READING_STATUSES) {
			if (status === item.status) continue;

			menu.addItem((menuItem) =>
				menuItem
					.setTitle(`Mark as ${STATUS_LABELS[status].toLowerCase()}`)
					.onClick(() => void this.updateStatus(note, status))
			);
		}

		menu.addSeparator();

		menu.addItem((menuItem) =>
			menuItem
				.setTitle("Remove from queue")
				.setIcon("trash")
				.onClick(() => void this.removeNote(note))
		);

		menu.showAtMouseEvent(event);
	}

	private async updateStatus(
		note: ReadingNote,
		status: ReadingStatus
	): Promise<void> {
		if (note.item.status === status) return;

		await this.plugin.repository.update(note.file, { status });
		note.item.status = status;
		this.renderList();
	}

	private async removeNote(note: ReadingNote): Promise<void> {
		await this.plugin.repository.remove(note.file);

		this.notes = this.notes.filter(
			(candidate) => candidate.file.path !== note.file.path
		);

		this.renderList();

		new Notice("Removed from reading queue");
	}

	private async openNote(file: TFile): Promise<void> {
		const leaf = this.app.workspace.getLeaf("tab");
		await leaf.openFile(file);
	}
}
