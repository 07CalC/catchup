import { App, PluginSettingTab, Setting } from "obsidian";

import type ReadQueuePlugin from "./main";

export interface ReadQueueSettings {
	folder: string;
	fetchMetadata: boolean;
}

export const DEFAULT_SETTINGS: ReadQueueSettings = {
	folder: "Reading",
	fetchMetadata: true,
};

export class ReadQueueSettingTab extends PluginSettingTab {
	plugin: ReadQueuePlugin;

	constructor(app: App, plugin: ReadQueuePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Reading folder")
			.setDesc(
				"Vault folder where new reading notes are created. It will be created if it does not exist."
			)
			.addText((text) =>
				text
					.setPlaceholder("Reading")
					.setValue(this.plugin.settings.folder)
					.onChange(async (value) => {
						this.plugin.settings.folder = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Fetch page details")
			.setDesc(
				"When adding a link, fetch the page title, description and favicon automatically."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.fetchMetadata)
					.onChange(async (value) => {
						this.plugin.settings.fetchMetadata = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
