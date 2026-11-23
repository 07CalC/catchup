import { requestUrl } from "obsidian";

export interface PageMetadata {
	title: string;
	description: string;
	url: string;
	favicon: string;
}

export async function fetchMetadata(
	inputUrl: string
): Promise<PageMetadata> {
	let parsedUrl: URL;

	try {
		parsedUrl = new URL(inputUrl);
	} catch {
		throw new Error("Invalid URL");
	}

	if (!["http:", "https:"].includes(parsedUrl.protocol)) {
		throw new Error("Only HTTP and HTTPS URLs are supported");
	}

	const response = await requestUrl({
		url: parsedUrl.href,
		method: "GET",
		throw: false,
	});

	if (response.status < 200 || response.status >= 400) {
		throw new Error(`Failed to fetch page: HTTP ${response.status}`);
	}

	const doc = new DOMParser().parseFromString(
		response.text,
		"text/html"
	);

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
		doc.title ||
		parsedUrl.hostname;

	const description =
		getMeta('meta[property="og:description"]') ||
		getMeta('meta[name="description"]') ||
		getMeta('meta[name="twitter:description"]');

	const canonical =
		doc.querySelector('link[rel="canonical"]')
			?.getAttribute("href") || parsedUrl.href;

	const faviconPath =
		doc.querySelector('link[rel~="icon"]')
			?.getAttribute("href") ||
		doc.querySelector('link[rel="shortcut icon"]')
			?.getAttribute("href");

	return {
		title,
		description,
		url: new URL(canonical, parsedUrl).href,
		favicon: faviconPath
			? new URL(faviconPath, parsedUrl).href
			: new URL("/favicon.ico", parsedUrl).href,
	};
}
