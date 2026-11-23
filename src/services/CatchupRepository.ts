import {
	App,
	normalizePath,
	stringifyYaml,
	TFile,
	TFolder,
} from "obsidian";

import {
	ITEM_KINDS,
	ITEM_PRIORITIES,
	ITEM_STATUSES,
} from "../types";
import type {
	CatchupItem,
	ItemKind,
	ItemPriority,
	ItemStatus,
	NewCatchupItem,
} from "../types";

export interface CatchupEntry {
	file: TFile;
	item: CatchupItem;
}

const ITEM_TYPE = "catchup";
const LEGACY_ITEM_TYPE = "reading";

export function isCatchupType(value: unknown): boolean {
	return value === ITEM_TYPE || value === LEGACY_ITEM_TYPE;
}

function toKind(value: unknown): ItemKind {
	return ITEM_KINDS.includes(value as ItemKind)
		? (value as ItemKind)
		: "article";
}

function toStatus(value: unknown): ItemStatus {
	return ITEM_STATUSES.includes(value as ItemStatus)
		? (value as ItemStatus)
		: "unread";
}

function toPriority(value: unknown): ItemPriority {
	return ITEM_PRIORITIES.includes(value as ItemPriority)
		? (value as ItemPriority)
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

export class CatchupRepository {
	constructor(
		private readonly app: App,
		private readonly getFolder: () => string
	) { }

	get folderPath(): string {
		const folder = this.getFolder()
			.trim()
			.replace(/^\/+|\/+$/g, "");

		return normalizePath(folder || "Catchup");
	}

	async list(): Promise<CatchupEntry[]> {
		const entries: CatchupEntry[] = [];

		for (const file of this.app.vault.getMarkdownFiles()) {
			const frontmatter = this.app.metadataCache
				.getFileCache(file)?.frontmatter;

			if (!frontmatter || !isCatchupType(frontmatter.type)) {
				continue;
			}

			entries.push({
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

		return entries;
	}

	async findByUrl(url: string): Promise<CatchupEntry | null> {
		const target = url.replace(/\/+$/, "");
		const entries = await this.list();

		return entries.find(
			(entry) => entry.item.url.replace(/\/+$/, "") === target
		) ?? null;
	}

	async create(input: NewCatchupItem): Promise<CatchupEntry> {
		const folderPath = this.folderPath;

		await this.ensureFolder(folderPath);

		const item: CatchupItem = {
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
			type: ITEM_TYPE,
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
			Pick<CatchupItem, "status" | "priority" | "kind" | "tags">
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
