export type ReadingStatus = "unread" | "reading" | "read";

export type ReadingPriority = "low" | "normal" | "high";

export type ReadingKind =
	| "article"
	| "video"
	| "book"
	| "podcast"
	| "note"
	| "other";

export interface ReadingItem {
	title: string;
	url: string;
	description: string;
	favicon: string;
	kind: ReadingKind;
	status: ReadingStatus;
	tags: string[];
	priority: ReadingPriority;
	added: string;
}

export interface NewReadingItem {
	title?: string;
	url?: string;
	description?: string;
	favicon?: string;
	kind?: ReadingKind;
	status?: ReadingStatus;
	tags?: string[];
	priority?: ReadingPriority;
}

export const READING_KINDS: ReadingKind[] = [
	"article",
	"video",
	"book",
	"podcast",
	"note",
	"other",
];

export const READING_STATUSES: ReadingStatus[] = [
	"unread",
	"reading",
	"read",
];

export const READING_PRIORITIES: ReadingPriority[] = [
	"low",
	"normal",
	"high",
];
