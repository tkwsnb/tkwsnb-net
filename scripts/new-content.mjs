#!/usr/bin/env node
/**
 * 新規 note / post を正しいパス・frontmatter 付きで作成する。
 *
 *   pnpm new:note
 *   pnpm new:post "作品名(2025)"
 *   pnpm new:post          # タイトルを対話入力
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_DIR = path.join(ROOT, "src", "content");

/** @returns {{ yymmdd: string, yyyy: string, mm: string, dd: string, iso: string, dateOnly: string }} */
function jstNow() {
	const formatter = new Intl.DateTimeFormat("en-GB", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});
	const parts = Object.fromEntries(
		formatter.formatToParts(new Date()).map((p) => [p.type, p.value]),
	);
	const yyyy = parts.year;
	const mm = parts.month;
	const dd = parts.day;
	const hh = parts.hour;
	const min = parts.minute;
	const sec = parts.second;
	const yymmdd = `${yyyy.slice(-2)}${mm}${dd}`;

	return {
		yymmdd,
		yyyy,
		mm,
		dd,
		iso: `${yyyy}-${mm}-${dd}T${hh}:${min}:${sec}+09:00`,
		dateOnly: `${yyyy}-${mm}-${dd}`,
	};
}

function ensureDir(dir) {
	fs.mkdirSync(dir, { recursive: true });
}

function writeNewFile(filePath, content) {
	if (fs.existsSync(filePath)) {
		console.error(`既に存在します: ${filePath}`);
		process.exit(1);
	}
	ensureDir(path.dirname(filePath));
	fs.writeFileSync(filePath, content, "utf8");
	console.log(filePath);
}

function createNote() {
	const { yymmdd, yyyy, mm, dd, dateOnly } = jstNow();
	const dir = path.join(CONTENT_DIR, "note", yyyy.slice(-2), mm);
	const filePath = path.join(dir, `${yymmdd}.md`);
	const content = `---
title: "${yymmdd}"
description: "${yymmdd}"
publishDate: "${dateOnly}"
---


`;
	writeNewFile(filePath, content);
}

function createPost(title) {
	const { yymmdd, iso } = jstNow();
	const safeTitle = title.trim();
	if (!safeTitle) {
		console.error("post にはタイトルが必要です。例: pnpm new:post \"爆弾(2025)\"");
		process.exit(1);
	}
	const filePath = path.join(CONTENT_DIR, "post", `${safeTitle}.md`);
	const content = `---
title: ${safeTitle}
description: "${yymmdd}"
publishDate: ${iso}
tags:
  - movie
draft: true
---


`;
	writeNewFile(filePath, content);
}

async function main() {
	const [type, ...rest] = process.argv.slice(2);

	if (type === "note") {
		createNote();
		return;
	}

	if (type === "post") {
		let title = rest.join(" ").trim();
		if (!title) {
			const rl = readline.createInterface({ input, output });
			title = (await rl.question("タイトル（例: 爆弾(2025)）: ")).trim();
			rl.close();
		}
		createPost(title);
		return;
	}

	console.log(`使い方:
  pnpm new:note
  pnpm new:post "作品名(2025)"
`);
	process.exit(type ? 1 : 0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
