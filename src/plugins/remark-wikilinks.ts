// src/plugins/remark-wikilinks.ts
import fs from 'node:fs';
import path from 'node:path';
// mdastから必要な型をインポートします
import type { Root, Paragraph, Image, HTML, BlockContent } from 'mdast';
import type { VFile } from 'vfile';
import { visit } from 'unist-util-visit';
// unistからParent型をインポートします
import type { Parent } from 'unist';

const WIKILINK_REGEX = /!\[\[([^\]]+)\]\]/;
const ASSETS_DIR = path.resolve(process.cwd(), 'src/content/assets');

const fileExists = (fileName: string): boolean => {
	return fs.existsSync(path.join(ASSETS_DIR, fileName));
};

export function remarkWikiLinks() {
	return (tree: Root, file: VFile) => {
		// visitのコールバック引数を修正し、オプショナルな引数に対応
		visit(tree, 'paragraph', (node: Paragraph, index?: number, parent?: Parent) => {
			// --- エラー回避のためのチェック処理 ---
			// 1. parentやindexが存在しない場合は何もしない
			if (parent === undefined || parent === null || index === undefined || index === null) {
				return;
			}
			// 2. file.pathが存在しない場合も何もしない
			if (!file.path) {
				return;
			}
			// 3. 段落が単一のテキストノードでない場合は対象外
			if (node.children.length !== 1 || node.children[0]?.type !== 'text') {
				return;
			}

			const textNode = node.children[0];
			const match = textNode.value.match(WIKILINK_REGEX);

			if (!match || !match[1]) {
				return;
			}

			const fileName = match[1];

			if (fileExists(fileName)) {
				const altText = fileName.split('.').slice(0, -1).join('.');
				const extension = path.extname(fileName).toLowerCase();
				const fileDir = path.dirname(file.path);
				const relativePath = path.relative(fileDir, path.join(ASSETS_DIR, fileName)).replace(/\\/g, '/');

				// --- ノードの置換処理を修正 ---
				// 画像の場合
				if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extension)) {
					const imageNode: Image = {
						type: 'image',
						url: relativePath,
						alt: altText,
						title: null,
					};
					// [修正点] 段落ノード(node)の中身(children)を画像ノードに置き換える
					// これで <p><img ...></p> が生成され、Astroが<p>を自動で取り除いてくれます。
					node.children = [imageNode];

				} 
				// 動画の場合
				else if (['.mp4', '.webm'].includes(extension)) {
					const videoHtml = `<video src="${relativePath}" controls autoplay muted loop playsinline style="width: 100%; max-width: 100%; border-radius: 8px;"></video>`;
					const htmlNode: HTML = {
						type: 'html',
						value: videoHtml,
					};
					// [修正点] 段落ノード(Paragraph)をHTMLブロックノードで置き換える
					// (htmlNode as BlockContent)で型エラーを解決
					parent.children.splice(index, 1, htmlNode as BlockContent);
				}
			} else {
				console.warn(`[remark-wikilinks] File not found in "src/content/assets/": ${fileName}`);
			}
		});
	};
}