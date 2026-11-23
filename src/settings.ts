import { App, PluginSettingTab, Setting } from "obsidian";

import type CatchupPlugin from "./main";

export interface CatchupSettings {
	folder: string;
	fetchMetadata: boolean;
}

export const DEFAULT_SETTINGS: CatchupSettings = {
	folder: "Catchup",
	fetchMetadata: true,
};

export class CatchupSettingTab extends PluginSettingTab {
	plugin: CatchupPlugin;

	constructor(app: App, plugin: CatchupPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Saving folder")
			.setDesc(
				"Vault folder where new Catchup items are saved. The folder is created if it does not exist."
			)
			.addText((text) =>
				text
					.setPlaceholder("Catchup")
					.setValue(this.plugin.settings.folder)
					.onChange(async (value) => {
						this.plugin.settings.folder = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Fetch page details")
			.setDesc(
				"Automatically fetch the page title, description and favicon when a link is added."
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
