import {
	App,
	normalizePath,
	TFile,
} from "obsidian";

import { PageMetadata } from "./MetadataFetcher";
import { ReadingItem } from "../types";

export class ReadingRepository {
	private readonly folder = "Reading";

	constructor(private app: App) { }

	async save(metadata: PageMetadata): Promise<TFile> {
		const folderPath = normalizePath(this.folder);

		if (!this.app.vault.getAbstractFileByPath(folderPath)) {
			await this.app.vault.createFolder(folderPath);
		}

		const item: ReadingItem = {
			...metadata,
			status: "unread",
			tags: [],
			priority: "normal",
			added: new Date().toISOString(),
		};

		const slug = metadata.title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 60) || "untitled";

		let path = `${folderPath}/${slug}.md`;

		if (this.app.vault.getAbstractFileByPath(path)) {
			path = `${folderPath}/${slug}-${Date.now()}.md`;
		}

		const frontmatter = [
			"---",
			`type: reading`,
			`status: ${item.status}`,
			`priority: ${item.priority}`,
			`title: ${JSON.stringify(item.title)}`,
			`url: ${JSON.stringify(item.url)}`,
			`description: ${JSON.stringify(item.description)}`,
			`favicon: ${JSON.stringify(item.favicon)}`,
			`tags: []`,
			`added: ${item.added}`,
			"---",
			"",
			`# ${item.title}`,
			"",
			item.description,
			"",
			`[Open resource](${item.url})`,
			"",
		].join("\n");

		return this.app.vault.create(path, frontmatter);
	}
}
