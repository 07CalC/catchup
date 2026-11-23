import {
	App,
	normalizePath,
	stringifyYaml,
	TFile,
	TFolder,
} from "obsidian";

import {
	READING_KINDS,
	READING_PRIORITIES,
	READING_STATUSES,
} from "../types";
import type {
	NewReadingItem,
	ReadingItem,
	ReadingKind,
	ReadingPriority,
	ReadingStatus,
} from "../types";

export interface ReadingNote {
	file: TFile;
	item: ReadingItem;
}

function toKind(value: unknown): ReadingKind {
	return READING_KINDS.includes(value as ReadingKind)
		? (value as ReadingKind)
		: "article";
}

function toStatus(value: unknown): ReadingStatus {
	return READING_STATUSES.includes(value as ReadingStatus)
		? (value as ReadingStatus)
		: "unread";
}

function toPriority(value: unknown): ReadingPriority {
	return READING_PRIORITIES.includes(value as ReadingPriority)
		? (value as ReadingPriority)
		: "normal";
}

function toDateString(value: unknown): string {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value.toISOString();
	}

	return typeof value === "string" ? value : "";
}

function toTags(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value
			.map((tag) => String(tag).trim())
			.filter(Boolean);
	}

	if (typeof value === "string") {
		return value
			.split(/[,\s]+/)
			.map((tag) => tag.replace(/^#/, "").trim())
			.filter(Boolean);
	}

	return [];
}

function slugify(text: string): string {
	const ascii = text
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60);

	if (ascii) return ascii;

	const fallback = text
		.replace(/[\\/:*?"<>|#^[\]]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 60);

	return fallback || "untitled";
}

export class ReadingRepository {
	constructor(
		private readonly app: App,
		private readonly getFolder: () => string
	) { }

	get folderPath(): string {
		const folder = this.getFolder()
			.trim()
			.replace(/^\/+|\/+$/g, "");

		return normalizePath(folder || "Reading");
	}

	async list(): Promise<ReadingNote[]> {
		const notes: ReadingNote[] = [];

		for (const file of this.app.vault.getMarkdownFiles()) {
			const frontmatter = this.app.metadataCache
				.getFileCache(file)?.frontmatter;

			if (!frontmatter || frontmatter.type !== "reading") {
				continue;
			}

			notes.push({
				file,
				item: {
					title: String(frontmatter.title || file.basename),
					url: typeof frontmatter.url === "string"
						? frontmatter.url
						: "",
					description: typeof frontmatter.description === "string"
						? frontmatter.description
						: "",
					favicon: typeof frontmatter.favicon === "string"
						? frontmatter.favicon
						: "",
					kind: toKind(frontmatter.kind),
					status: toStatus(frontmatter.status),
					tags: toTags(frontmatter.tags),
					priority: toPriority(frontmatter.priority),
					added: toDateString(frontmatter.added),
				},
			});
		}

		return notes;
	}

	async findByUrl(url: string): Promise<ReadingNote | null> {
		const target = url.replace(/\/+$/, "");

		const notes = await this.list();

		return notes.find(
			(note) => note.item.url.replace(/\/+$/, "") === target
		) ?? null;
	}

	async create(input: NewReadingItem): Promise<ReadingNote> {
		const folderPath = this.folderPath;

		await this.ensureFolder(folderPath);

		const item: ReadingItem = {
			title: input.title?.trim() || input.url?.trim() || "Untitled",
			url: input.url?.trim() ?? "",
			description: input.description?.trim() ?? "",
			favicon: input.favicon ?? "",
			kind: input.kind ?? "article",
			status: input.status ?? "unread",
			tags: (input.tags ?? [])
				.map((tag) => tag.replace(/^#/, "").trim())
				.filter(Boolean),
			priority: input.priority ?? "normal",
			added: new Date().toISOString(),
		};

		const path = this.uniquePath(folderPath, slugify(item.title));

		const frontmatter: Record<string, unknown> = {
			type: "reading",
			status: item.status,
			priority: item.priority,
			kind: item.kind,
			title: item.title,
			description: item.description,
			added: item.added,
			tags: item.tags,
		};

		if (item.url) frontmatter.url = item.url;
		if (item.favicon) frontmatter.favicon = item.favicon;

		const body = [
			`# ${item.title}`,
			"",
			item.description,
			"",
			item.url ? `[Open original](${item.url})` : "",
			"",
			"## Notes",
			"",
			"",
		].join("\n");

		const content = [
			"---",
			stringifyYaml(frontmatter).trimEnd(),
			"---",
			"",
			body,
		].join("\n");

		const file = await this.app.vault.create(path, content);

		return { file, item };
	}

	async update(
		file: TFile,
		patch: Partial<
			Pick<ReadingItem, "status" | "priority" | "kind" | "tags">
		>
	): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			Object.assign(frontmatter, patch);
		});
	}

	async remove(file: TFile): Promise<void> {
		await this.app.fileManager.trashFile(file);
	}

	private uniquePath(folderPath: string, slug: string): string {
		let path = normalizePath(`${folderPath}/${slug}.md`);
		let counter = 1;

		while (this.app.vault.getAbstractFileByPath(path)) {
			path = normalizePath(`${folderPath}/${slug}-${counter}.md`);
			counter++;
		}

		return path;
	}

	private async ensureFolder(path: string): Promise<void> {
		const existing = this.app.vault.getAbstractFileByPath(path);

		if (existing instanceof TFolder) return;

		if (existing) {
			throw new Error(`A file already exists at "${path}"`);
		}

		const parent = path.split("/").slice(0, -1).join("/");

		if (parent) {
			await this.ensureFolder(normalizePath(parent));
		}

		await this.app.vault.createFolder(path);
	}
}
