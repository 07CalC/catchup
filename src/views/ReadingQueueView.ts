import {
	ItemView,
	WorkspaceLeaf,
	Notice,
	setIcon,
} from "obsidian";

import { ReadingRepository } from "../services/ReadingRepository";

export const VIEW_TYPE_READING_QUEUE = "reading-queue-view";

export class ReadingQueueView extends ItemView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_READING_QUEUE;
	}

	getDisplayText(): string {
		return "Reading Queue";
	}

	getIcon(): string {
		return "book-open";
	}

	async onOpen() {
		await this.refresh();
	}

	async refresh() {
		const { contentEl } = this;

		contentEl.empty();
		contentEl.addClass("reading-queue");

		const header = contentEl.createDiv({
			cls: "reading-queue-header",
		});

		header.createEl("h3", {
			text: "Reading Queue",
		});

		const files = this.app.vault.getMarkdownFiles()
			.filter(file => file.path.startsWith("Reading/"));

		let count = 0;

		for (const file of files) {
			const frontmatter = this.app.metadataCache
				.getFileCache(file)?.frontmatter;

			if (!frontmatter || frontmatter.type !== "reading") {
				continue;
			}

			count++;

			const item = contentEl.createDiv({
				cls: "reading-queue-item",
			});

			const title = item.createEl("div", {
				cls: "reading-queue-title",
				text: String(frontmatter.title || file.basename),
			});

			title.setAttribute("title", String(frontmatter.title || ""));

			item.createEl("div", {
				cls: "reading-queue-description",
				text: String(frontmatter.description || ""),
			});

			const footer = item.createDiv({
				cls: "reading-queue-footer",
			});

			const status = String(frontmatter.status || "unread");

			const statusButton = footer.createEl("button", {
				cls: "reading-queue-status",
				text: status === "read" ? "Read" : "Unread",
			});

			statusButton.addEventListener("click", async () => {
				const nextStatus = status === "read" ? "unread" : "read";

				await this.app.fileManager.processFrontMatter(
					file,
					(fm) => {
						fm.status = nextStatus;
					}
				);

				new Notice(`Marked as ${nextStatus}`);
				await this.refresh();
			});

			const openButton = footer.createEl("button", {
				cls: "reading-queue-open",
				text: "Open",
			});

			openButton.addEventListener("click", () => {
				const url = frontmatter.url;

				if (typeof url === "string") {
					window.open(url, "_blank");
				}
			});
		}

		if (count === 0) {
			contentEl.createEl("p", {
				text: "Your reading queue is empty.",
				cls: "reading-queue-empty",
			});
		}
	}
}
