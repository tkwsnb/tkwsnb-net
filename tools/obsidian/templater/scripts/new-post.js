/**
 * Templater User Script: 映画 post を即作成
 *
 * 設置: Vault の `.obsidian/templater/scripts/` にコピー
 * 割当: ホットキー（例: Ctrl+Alt+P）— note とは別キーにすると選択不要
 */
async function newPost(tp) {
	const CONTENT_PREFIX = "";

	const title = await tp.system.prompt("映画タイトル（例: 爆弾(2025)）");
	if (!title?.trim()) {
		new Notice("タイトルが空なので中止しました");
		return;
	}

	const yymmdd = tp.date.now("YYMMDD", 0, "YYYY-MM-DD", "Asia/Tokyo");
	const iso = `${tp.date.now("YYYY-MM-DDTHH:mm:ss", 0, "YYYY-MM-DD", "Asia/Tokyo")}+09:00`;

	const folder = `${CONTENT_PREFIX}post`;
	const content = `---
title: ${title.trim()}
description: "${yymmdd}"
publishDate: ${iso}
tags:
  - movie
draft: true
---


`;

	const safeName = title.trim().replace(/[\\/:*?"<>|]/g, "_");
	return tp.file.create_new(content, safeName, folder, true);
}

module.exports = newPost;
