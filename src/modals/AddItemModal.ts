import {
	App,
	ButtonComponent,
	DropdownComponent,
	Modal,
	Notice,
	Setting,
} from "obsidian";

import type CatchupPlugin from "../main";
import { guessKind, looksLikeUrl, normalizeUrl } from "../services/MetadataFetcher";
import type { ItemKind, ItemPriority } from "../types";

export interface AddItemSeed {
	url?: string;
	title?: string;
	description?: string;
	kind?: ItemKind;
}

export class AddItemModal extends Modal {
	private submitting = false;
	private submitButton: ButtonComponent | null = null;

	constructor(
		app: App,
		private readonly plugin: CatchupPlugin,
		private readonly seed: AddItemSeed = {}
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;

		titleEl.setText("Add to Catchup");
		contentEl.addClass("catchup-modal");

		let url = this.seed.url ?? "";
		let title = this.seed.title ?? "";
		let description = this.seed.description ?? "";
		let kind: ItemKind = this.seed.kind ??
			(this.seed.url ? "article" : "note");
		let priority: ItemPriority = "normal";
		let tags = "";
		let kindTouched = Boolean(this.seed.kind);
		let kindDropdown: DropdownComponent | null = null;

		new Setting(contentEl)
			.setName("Link")
			.setDesc("Optional. Leave empty to save something without a link.")
			.addText((text) => {
				text
					.setPlaceholder("Paste a link, for example example.com/article")
					.setValue(url)
					.onChange((value) => {
						url = value;
					});

				text.inputEl.addEventListener("keydown", (event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						void submit();
					}
				});

				text.inputEl.addEventListener("blur", () => {
					const parsed = normalizeUrl(url);

					if (!parsed || kindTouched) return;

					kind = guessKind(parsed.href);
					kindDropdown?.setValue(kind);
				});

				window.setTimeout(() => text.inputEl.focus(), 0);
			});

		new Setting(contentEl)
			.setName("Title")
			.setDesc("Fetched automatically from the link when available.")
			.addText((text) => {
				text
					.setPlaceholder("What do you want to read?")
					.setValue(title)
					.onChange((value) => {
						title = value;
					});

				text.inputEl.addEventListener("keydown", (event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						void submit();
					}
				});
			});

		new Setting(contentEl)
			.setName("Notes")
			.setDesc("Optional description, quote or thought to go with this item.")
			.addTextArea((text) => {
				text
					.setPlaceholder("Why did you save this?")
					.setValue(description)
					.onChange((value) => {
						description = value;
					});

				text.inputEl.rows = 3;
			});

		new Setting(contentEl)
			.setName("Type")
			.addDropdown((dropdown) => {
				kindDropdown = dropdown;

				for (const option of [
					["article", "Article"],
					["video", "Video"],
					["book", "Book"],
					["podcast", "Podcast"],
					["note", "Note"],
					["other", "Other"],
				] as const) {
					dropdown.addOption(option[0], option[1]);
				}

				dropdown.setValue(kind);

				dropdown.onChange((value) => {
					kind = value as ItemKind;
					kindTouched = true;
				});
			});

		new Setting(contentEl)
			.setName("Priority")
			.addDropdown((dropdown) => {
				dropdown.addOption("low", "Low");
				dropdown.addOption("normal", "Normal");
				dropdown.addOption("high", "High");
				dropdown.setValue(priority);

				dropdown.onChange((value) => {
					priority = value as ItemPriority;
				});
			});

		new Setting(contentEl)
			.setName("Tags")
			.setDesc("Comma-separated, optional.")
			.addText((text) =>
				text
					.setPlaceholder("Design, AI")
					.onChange((value) => {
						tags = value;
					})
			);

		new Setting(contentEl)
			.addButton((button) => {
				this.submitButton = button;
			})
			.addButton((button) =>
				button
					.setButtonText("Cancel")
					.onClick(() => this.close())
			);

		const submit = async (): Promise<void> => {
			if (this.submitting) return;

			const trimmedUrl = url.trim();
			const trimmedTitle = title.trim();

			if (!trimmedUrl && !trimmedTitle) {
				new Notice("Add a link or a title");
				return;
			}

			if (trimmedUrl && !looksLikeUrl(trimmedUrl)) {
				new Notice("That does not look like a valid link");
				return;
			}

			this.setSubmitting(true);

			try {
				await this.plugin.createItem({
					url: trimmedUrl,
					title: trimmedTitle,
					description: description.trim(),
					kind,
					priority,
					tags: tags
						.split(",")
						.map((tag) => tag.trim().replace(/^#/, ""))
						.filter(Boolean),
				});

				this.close();
			} catch (error) {
				new Notice(
					error instanceof Error
						? error.message
						: "Could not add this item"
				);
			} finally {
				this.setSubmitting(false);
			}
		};

		this.submitButton
			?.setButtonText("Add to Catchup")
			.setCta()
			.onClick(() => void submit());
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private setSubmitting(value: boolean): void {
		this.submitting = value;
		this.submitButton?.setDisabled(value).setButtonText(
			value ? "Adding…" : "Add to Catchup"
		);
	}
}
