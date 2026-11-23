import {
	Plugin,
	Notice,
} from "obsidian";

import { AddReadingModal } from "./modals/AddReadingModal";
import { ReadingQueueView, VIEW_TYPE_READING_QUEUE } from "./views/ReadingQueueView";
import { fetchMetadata } from "./services/MetadataFetcher";
import { ReadingRepository } from "./services/ReadingRepository";

export default class ReadQueuePlugin extends Plugin {
	private repository!: ReadingRepository;

	async onload() {
		this.repository = new ReadingRepository(this.app);

		this.registerView(
			VIEW_TYPE_READING_QUEUE,
			(leaf) => new ReadingQueueView(leaf)
		);

		this.addRibbonIcon(
			"book-open",
			"Open reading queue",
			() => void this.activateView()
		);

		this.addCommand({
			id: "add-to-reading-queue",
			name: "Add to reading queue",
			callback: () => {
				new AddReadingModal(
					this.app,
					async (url) => {
						const metadata = await fetchMetadata(url);
						await this.repository.save(metadata);

						new Notice(`Added "${metadata.title}" to your reading queue`);

						const leaves = this.app.workspace
							.getLeavesOfType(VIEW_TYPE_READING_QUEUE);

						for (const leaf of leaves) {
							if (leaf.view instanceof ReadingQueueView) {
								await leaf.view.refresh();
							}
						}
					}
				).open();
			},
		});

		this.addCommand({
			id: "open-reading-queue",
			name: "Open reading queue",
			callback: () => void this.activateView(),
		});
	}

	async activateView() {
		const existing = this.app.workspace
			.getLeavesOfType(VIEW_TYPE_READING_QUEUE);

		const leaf = existing[0] ??
			this.app.workspace.getRightLeaf(false);

		if (!leaf) return;

		if (existing.length === 0) {
			await leaf.setViewState({
				type: VIEW_TYPE_READING_QUEUE,
				active: true,
			});
		}

		await this.app.workspace.revealLeaf(leaf);
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(
			VIEW_TYPE_READING_QUEUE
		);
	}
}
