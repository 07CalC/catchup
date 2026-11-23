import {
	App,
	Modal,
	Notice,
	Setting,
} from "obsidian";

export class AddReadingModal extends Modal {
	constructor(
		app: App,
		private onSubmit: (url: string) => Promise<void>
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.empty();
		contentEl.createEl("h2", {
			text: "Add to reading queue",
		});

		let url = "";

		new Setting(contentEl)
			.setName("URL")
			.setDesc("Enter the resource URL")
			.addText((text) => {
				text.setPlaceholder("https://example.com/article")
					.onChange((value) => {
						url = value;
					});

				text.inputEl.focus();
				text.inputEl.addEventListener("keydown", (event) => {
					if (event.key === "Enter") {
						void submit();
					}
				});
			});

		const submit = async () => {
			if (!url.trim()) {
				new Notice("Please enter a URL");
				return;
			}
			console.log("got url", url);
			console.log("Submitting URL:", url.trim());

			try {
				await this.onSubmit(url.trim());
				this.close();
			} catch (error) {
				new Notice(
					error instanceof Error
						? error.message
						: "Something went wrong"
				);
			}
		};

		new Setting(contentEl)
			.addButton((button) => {
				button
					.setButtonText("Add to queue")
					.setCta()
					.onClick(() => void submit());
			});
	}

	onClose() {
		this.contentEl.empty();
	}
}
