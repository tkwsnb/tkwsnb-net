// /integrations/obsidian-links.ts
import type { AstroIntegration } from "astro";
import path from "node:path";
import fs from "node:fs";

/**
 * 環境変数または .env ファイルからアセット配信用のベースURLを取得する
 */
function getAssetsUrl(): string | null {
	if (process.env.PUBLIC_ASSETS_URL) {
		return process.env.PUBLIC_ASSETS_URL.replace(/\/+$/, "");
	}
	const envPath = path.resolve(process.cwd(), ".env");
	if (!fs.existsSync(envPath)) return null;
	const envContent = fs.readFileSync(envPath, "utf-8");
	const lines = envContent.split("\n");
	const urlLine = lines.find((line) => line.trim().startsWith("PUBLIC_ASSETS_URL="));
	if (urlLine) {
		const rawUrl =
			urlLine
				.split("=")[1]
				?.trim()
				.replace(/^['"]|['"]$/g, "") || null;
		return rawUrl ? rawUrl.replace(/\/+$/, "") : null;
	}
	return null;
}

/**
 * HTML属性値用のエスケープ処理
 */
function escapeAttr(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

// ダブルクォートや不等号などの危険な文字、および .. によるパストラバーサルを除外する正規表現
const WIKILINK_IMAGE_REGEX =
	/(?:<p>)?!\[\[((?:(?!\.\.)[^"<>\\])+?\.(?:png|jpg|jpeg|webp|gif|svg))\]\](?:<\/p>)?/g;
const WIKILINK_VIDEO_REGEX =
	/(?:<p>)?!\[\[((?:(?!\.\.)[^"<>\\])+?\.(?:mp4|webm))\]\](?:<\/p>)?/g;

/**
 * HTML文字列内のObsidian形式のメディアリンクを安全なHTMLタグに変換する
 */
export function replaceObsidianMediaLinks(
	htmlContent: string,
	baseUrl: string,
): { content: string; changed: boolean } {
	let changed = false;
	const safeBaseUrl = escapeAttr(baseUrl.replace(/\/+$/, ""));

	let content = htmlContent.replace(WIKILINK_IMAGE_REGEX, (_match, fileName: string) => {
		changed = true;
		const safeFileName = escapeAttr(fileName);
		const altText = escapeAttr(fileName.split(".").slice(0, -1).join(""));
		return `<img src="${safeBaseUrl}/assets/${safeFileName}" alt="${altText}">`;
	});

	content = content.replace(WIKILINK_VIDEO_REGEX, (_match, fileName: string) => {
		changed = true;
		const safeFileName = escapeAttr(fileName);
		return `<video src="${safeBaseUrl}/assets/${safeFileName}" controls autoplay muted loop playsinline style="width: 100%; max-width: 100%; border-radius: 8px;"></video>`;
	});

	return { content, changed };
}

export default function obsidianLinks(): AstroIntegration {
	return {
		name: "astro-obsidian-links",
		hooks: {
			"astro:build:done": async ({ dir, pages }) => {
				const baseUrl = getAssetsUrl();
				if (!baseUrl) return;

				const builtPagePaths = pages
					.map((p) => {
						if (p.pathname === "") return path.join(dir.pathname, "index.html");
						return path.join(dir.pathname, p.pathname, "index.html");
					})
					.filter((p) => fs.existsSync(p));

				for (const filePath of builtPagePaths) {
					const originalContent = await fs.promises.readFile(filePath, "utf-8");
					const { content, changed } = replaceObsidianMediaLinks(originalContent, baseUrl);
					if (changed) {
						await fs.promises.writeFile(filePath, content, "utf-8");
					}
				}
			},
		},
	};
}
