export type ReadingStatus = "unread" | "reading" | "read";

export interface ReadingItem {
	title: string;
	url: string;
	description: string;
	favicon: string;
	status: ReadingStatus;
	tags: string[];
	priority: "low" | "normal" | "high";
	added: string;
}
