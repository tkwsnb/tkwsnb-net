/**
 * Templater User Script: 雑記 note を即作成
 *
 * 設置: Vault の `.obsidian/templater/scripts/` にコピー
 * 割当: ホットキー（例: Ctrl+Alt+N）
 *
 * Vault ルートが src/content の場合、folder は "note/YY/MM"。
 * リポジトリ全体が Vault なら CONTENT_PREFIX を "src/content/" に変更。
 */
async function newNote(tp) {
	const CONTENT_PREFIX = "";

	const yymmdd = tp.date.now("YYMMDD", 0, "YYYY-MM-DD", "Asia/Tokyo");
	const yy = yymmdd.slice(0, 2);
	const mm = yymmdd.slice(2, 4);
	const dateOnly = tp.date.now("YYYY-MM-DD", 0, "YYYY-MM-DD", "Asia/Tokyo");

	const folder = `${CONTENT_PREFIX}note/${yy}/${mm}`;
	const content = `---
title: "${yymmdd}"
description: "${yymmdd}"
publishDate: "${dateOnly}"
---


`;

	return tp.file.create_new(content, yymmdd, folder, true);
}

module.exports = newNote;
