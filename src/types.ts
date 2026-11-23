export type ItemStatus = "unread" | "reading" | "read";

export type ItemPriority = "low" | "normal" | "high";

export type ItemKind =
	| "article"
	| "video"
	| "book"
	| "podcast"
	| "note"
	| "other";

export interface CatchupItem {
	title: string;
	url: string;
	description: string;
	favicon: string;
	kind: ItemKind;
	status: ItemStatus;
	tags: string[];
	priority: ItemPriority;
	added: string;
}

export interface NewCatchupItem {
	title?: string;
	url?: string;
	description?: string;
	favicon?: string;
	kind?: ItemKind;
	status?: ItemStatus;
	tags?: string[];
	priority?: ItemPriority;
}

export const ITEM_KINDS: ItemKind[] = [
	"article",
	"video",
	"book",
	"podcast",
	"note",
	"other",
];

export const ITEM_STATUSES: ItemStatus[] = [
	"unread",
	"reading",
	"read",
];

export const ITEM_PRIORITIES: ItemPriority[] = [
	"low",
	"normal",
	"high",
];
