// @ts-nocheck
import { describe, expect, test } from "bun:test";
import {
	buildNoteSpec,
	buildPostSpec,
	executeCreateNote,
	executeCreatePost,
	formatJstDate,
	renderTemplateContent,
	sanitizePostFileName,
} from "./launcher-core.cjs";

describe("JST日時フォーマット処理", () => {
	test("UTC日時からJSTのYYMMDDおよびISO8601(+09:00)文字列を正しく生成すること", () => {
		// 2026-10-21T15:30:45Z は JST で 2026-10-22T00:30:45+09:00
		const date = new Date("2026-10-21T15:30:45.000Z");
		const formatted = formatJstDate(date);

		expect(formatted.yyyy).toBe("2026");
		expect(formatted.yy).toBe("26");
		expect(formatted.mm).toBe("10");
		expect(formatted.dd).toBe("22");
		expect(formatted.yymmdd).toBe("261022");
		expect(formatted.iso).toBe("2026-10-22T00:30:45+09:00");
	});
});

describe("雑記（note）作成仕様の生成", () => {
	test("日付に応じた階層フォルダ配列・ファイルパス・フロントマターを生成すること", () => {
		const date = new Date("2026-10-21T15:02:05.000Z");
		const spec = buildNoteSpec(date);

		expect(spec.folders).toEqual(["note", "note/26", "note/26/10"]);
		expect(spec.filePath).toBe("note/26/10/261022.md");
		expect(spec.content).toBe(
			[
				"---",
				'title: "261022"',
				'description: "261022"',
				'publishDate: "2026-10-22T00:02:05+09:00"',
				"---",
				"",
				"",
				"",
			].join("\n"),
		);
	});
});

describe("映画記事（post）作成仕様の生成", () => {
	test("タイトルと日時からpost用のパスとフロントマターを生成すること", () => {
		const date = new Date("2026-10-21T15:30:00.000Z");
		const spec = buildPostSpec("爆弾(2025)", date);

		expect(spec.folders).toEqual(["post"]);
		expect(spec.filePath).toBe("post/爆弾(2025).md");
		expect(spec.content).toBe(
			[
				"---",
				"title: 爆弾(2025)",
				'description: "261022"',
				'publishDate: "2026-10-22T00:30:00+09:00"',
				"tags:",
				'  - "#movie"',
				"---",
				"",
				"",
				"",
			].join("\n"),
		);
	});

	test("ファイル名に使用できない記号（/ や : など）を全角に変換して安全なファイルパスにすること", () => {
		expect(sanitizePostFileName("スター・ウォーズ/マンダロリアン: 覚醒?(2026)")).toBe(
			"スター・ウォーズ／マンダロリアン： 覚醒？(2026)",
		);
	});

	test("空タイトルの場合はエラーを投げること", () => {
		const date = new Date("2026-10-21T15:30:00.000Z");
		expect(() => buildPostSpec("   ", date)).toThrow();
	});

	test("既存テンプレート文字列のプレースホルダーを正しく展開できること", () => {
		const template = [
			"---",
			"title: <% tp.file.title %>",
			'description: <% `"${tp.date.now("YYMMDD")}"` %>',
			'publishDate: <% `"${tp.date.now("YYYY-MM-DDTHH:mm:ssZ")}"` %>',
			"tags:",
			'  - "#movie"',
			"---",
			"",
		].join("\n");

		const rendered = renderTemplateContent(template, {
			title: "ファイト・クラブ(1999)",
			yymmdd: "261022",
			iso: "2026-10-22T00:30:00+09:00",
		});

		expect(rendered).toContain("title: ファイト・クラブ(1999)");
		expect(rendered).toContain('description: "261022"');
		expect(rendered).toContain('publishDate: "2026-10-22T00:30:00+09:00"');
	});
});

describe("Obsidian Vault 操作ワークフローの検証", () => {
	function createMockApp(existingPaths: Record<string, string> = {}) {
		const files = new Map<string, { path: string; content?: string }>();
		for (const [k, v] of Object.entries(existingPaths)) {
			files.set(k, { path: k, content: v });
		}
		const createdFolders: string[] = [];
		const openedFiles: string[] = [];

		const app = {
			vault: {
				getAbstractFileByPath(p: string) {
					return files.get(p) ?? null;
				},
				async createFolder(p: string) {
					createdFolders.push(p);
					files.set(p, { path: p });
				},
				async create(p: string, content: string) {
					const fileObj = { path: p, content };
					files.set(p, fileObj);
					return fileObj;
				},
				async read(fileObj: { path: string; content?: string }) {
					return fileObj.content ?? "";
				},
			},
			workspace: {
				getLeaf() {
					return {
						async openFile(fileObj: { path: string }) {
							openedFiles.push(fileObj.path);
						},
					};
				},
				activeEditor: null,
			},
		};

		return { app, files, createdFolders, openedFiles };
	}

	test("note作成時に未作成の親フォルダを階層順に作成し、ノートを生成して開くこと", async () => {
		const { app, files, createdFolders, openedFiles } = createMockApp();
		const date = new Date("2026-10-21T15:02:05.000Z");

		const result = await executeCreateNote(app, date);

		expect(result.isNew).toBe(true);
		expect(result.filePath).toBe("note/26/10/261022.md");
		expect(createdFolders).toEqual(["note", "note/26", "note/26/10"]);
		expect(openedFiles).toEqual(["note/26/10/261022.md"]);
		expect(files.get("note/26/10/261022.md")?.content).toContain('title: "261022"');
	});

	test("既に同日のnoteが存在する場合は上書きせずに既存ノートを開くこと", async () => {
		const { app, files, openedFiles } = createMockApp({
			note: "",
			"note/26": "",
			"note/26/10": "",
			"note/26/10/261022.md": "既存の本文",
		});
		const date = new Date("2026-10-21T15:02:05.000Z");

		const result = await executeCreateNote(app, date);

		expect(result.isNew).toBe(false);
		expect(openedFiles).toEqual(["note/26/10/261022.md"]);
		expect(files.get("note/26/10/261022.md")?.content).toBe("既存の本文");
	});

	test("post作成時にタイトルからファイルを生成して開くこと", async () => {
		const { app, files, createdFolders, openedFiles } = createMockApp();
		const date = new Date("2026-10-21T15:30:00.000Z");

		const result = await executeCreatePost(app, "爆弾(2025)", date);

		expect(result.isNew).toBe(true);
		expect(result.filePath).toBe("post/爆弾(2025).md");
		expect(createdFolders).toEqual(["post"]);
		expect(openedFiles).toEqual(["post/爆弾(2025).md"]);
		expect(files.get("post/爆弾(2025).md")?.content).toContain("title: 爆弾(2025)");
	});
});

