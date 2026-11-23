import { requestUrl } from "obsidian";

import type { ReadingKind } from "../types";

export interface PageMetadata {
	title: string;
	description: string;
	url: string;
	favicon: string;
}

const PROTOCOL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

export function normalizeUrl(input: string): URL | null {
	const trimmed = input.trim();

	if (!trimmed || /\s/.test(trimmed)) return null;

	const candidate = PROTOCOL_PATTERN.test(trimmed)
		? trimmed
		: `https://${trimmed}`;

	try {
		const url = new URL(candidate);

		if (url.protocol !== "http:" && url.protocol !== "https:") {
			return null;
		}

		if (!url.hostname.includes(".") && url.hostname !== "localhost") {
			return null;
		}

		return url;
	} catch {
		return null;
	}
}

export function looksLikeUrl(input: string): boolean {
	return normalizeUrl(input) !== null;
}

export function guessKind(url: string): ReadingKind {
	let hostname: string;

	try {
		hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
	} catch {
		return "article";
	}

	if (/youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com/.test(hostname)) {
		return "video";
	}

	if (/spotify\.com|podcasts\.apple\.com|overcast\.fm|pocketcasts\.com/.test(hostname)) {
		return "podcast";
	}

	if (/goodreads\.com|amazon\.|books\.google|openlibrary\.org/.test(hostname)) {
		return "book";
	}

	return "article";
}

function absoluteUrl(value: string, base: URL): string {
	try {
		const url = new URL(value, base);

		if (url.protocol === "http:" || url.protocol === "https:") {
			return url.href;
		}
	} catch {
		return "";
	}

	return "";
}

function safeDecode(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

export async function fetchMetadata(inputUrl: string): Promise<PageMetadata> {
	const parsedUrl = normalizeUrl(inputUrl);

	if (!parsedUrl) {
		throw new Error("That does not look like a valid link");
	}

	const response = await requestUrl({
		url: parsedUrl.href,
		method: "GET",
		throw: false,
	});

	if (response.status < 200 || response.status >= 400) {
		throw new Error(`Could not load the page (HTTP ${response.status})`);
	}

	const lastSegment = parsedUrl.pathname.split("/").filter(Boolean).pop() ?? "";
	const fallbackTitle = safeDecode(lastSegment) || parsedUrl.hostname;

	const contentType = (response.headers["content-type"] ?? "").toLowerCase();

	if (contentType && !contentType.includes("html") && !contentType.includes("xml")) {
		return {
			title: fallbackTitle,
			description: "",
			url: parsedUrl.href,
			favicon: absoluteUrl("/favicon.ico", parsedUrl),
		};
	}

	const doc = new DOMParser().parseFromString(response.text, "text/html");

	const getMeta = (...selectors: string[]): string => {
		for (const selector of selectors) {
			const value = doc
				.querySelector(selector)
				?.getAttribute("content");

			if (value?.trim()) return value.trim();
		}

		return "";
	};

	const title =
		getMeta('meta[property="og:title"]') ||
		getMeta('meta[name="twitter:title"]') ||
		doc.title.trim() ||
		fallbackTitle;

	const description =
		getMeta('meta[property="og:description"]') ||
		getMeta('meta[name="description"]') ||
		getMeta('meta[name="twitter:description"]');

	const faviconPath =
		doc.querySelector('link[rel~="icon"]')
			?.getAttribute("href") ||
		doc.querySelector('link[rel="shortcut icon"]')
			?.getAttribute("href");

	return {
		title,
		description,
		url: parsedUrl.href,
		favicon: faviconPath
			? absoluteUrl(faviconPath, parsedUrl) || absoluteUrl("/favicon.ico", parsedUrl)
			: absoluteUrl("/favicon.ico", parsedUrl),
	};
}
