import { describe, expect, test } from "bun:test";
import { createYouTubeEmbedHtml } from "./youtube";
import { replaceObsidianMediaLinks } from "../../integrations/obsidian-links";

describe("YouTube埋め込みHTMLのセキュリティ検証", () => {
	test("タイトルに含まれるHTML特殊文字やダブルクォートがエスケープされ属性インジェクションを防ぐこと", () => {
		const maliciousTitle = '"><script>alert(1)</script><iframe title="';
		const html = createYouTubeEmbedHtml({
			videoId: "dQw4w9WgXcQ",
			title: maliciousTitle,
		});

		// 生の <script> タグや未エスケープのダブルクォートが埋め込まれないこと
		expect(html).not.toContain("<script>");
		expect(html).toContain("&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;");
	});
});

describe("Obsidianメディアリンク変換のセキュリティ検証", () => {
	test("正常な画像・動画のWikilinkがR2のURLに変換されること", () => {
		const input = "<p>![[poster_2026.webp]]</p><p>![[clip_01.mp4]]</p>";
		const result = replaceObsidianMediaLinks(input, "https://assets.tkwsnb.net");

		expect(result.changed).toBe(true);
		expect(result.content).toContain('<img src="https://assets.tkwsnb.net/assets/poster_2026.webp" alt="poster_2026">');
		expect(result.content).toContain('<video src="https://assets.tkwsnb.net/assets/clip_01.mp4"');
	});

	test("ファイル名にダブルクォートやHTMLタグが含まれる不正なリンクはimgタグに変換されないこと", () => {
		const maliciousInput = '<p>![[bad" onerror="alert(1).png]]</p>';
		const result = replaceObsidianMediaLinks(maliciousInput, "https://assets.tkwsnb.net");

		// 不正な文字を含むためimgタグへ展開されず、属性インジェクションが成立しないこと
		expect(result.changed).toBe(false);
		expect(result.content).not.toContain("<img");
	});

	test("パストラバーサル（..）を含むファイル名は変換されないこと", () => {
		const traversalInput = "<p>![[../../secret.png]]</p>";
		const result = replaceObsidianMediaLinks(traversalInput, "https://assets.tkwsnb.net");

		expect(result.changed).toBe(false);
		expect(result.content).toBe(traversalInput);
	});
});
