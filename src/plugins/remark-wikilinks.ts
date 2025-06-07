// src/plugins/remark-wikilinks.ts (最終修正版)
import fs from 'node:fs';
import path from 'node:path';
import type { Root, Paragraph, Image, HTML, BlockContent } from 'mdast';
import type { VFile } from 'vfile';
import { visit } from 'unist-util-visit';
import type { Parent } from 'unist';

const WIKILINK_REGEX = /!\[\[([^\]]+)\]\]/;
const ASSETS_DIR = path.resolve(process.cwd(), 'src/content/assets');

const fileExists = (fileName: string): boolean => {
	return fs.existsSync(path.join(ASSETS_DIR, fileName));
};

export function remarkWikiLinks() {
	return (tree: Root, file: VFile) => {
		// file オブジェクトが存在し、かつ path プロパティを持つ場合のみログを出力
		if (file?.path) {
			console.log(`[remark-wikilinks] Processing file: ${file.path}`);
		}

		visit(tree, 'paragraph', (node: Paragraph, index?: number, parent?: Parent) => {
			// [最重要] visitのコールバック内で、毎回file.pathの存在をチェックする
			if (!file?.path || parent === undefined || parent === null || index === undefined || index === null) {
				return;
			}
			
			if (node.children.length !== 1 || node.children[0]?.type !== 'text') {
				return;
			}

			const textNode = node.children[0];
			const match = textNode.value.match(WIKILINK_REGEX);

			if (!match || !match[1]) {
				return;
			}
			
			console.log(`[remark-wikilinks] Found wikilink in ${path.basename(file.path)}: ${textNode.value}`);

			const fileName = match[1];

			if (fileExists(fileName)) {
				console.log(`[remark-wikilinks] File "${fileName}" exists. Converting...`);

				const altText = fileName.split('.').slice(0, -1).join('.');
				const extension = path.extname(fileName).toLowerCase();
				const fileDir = path.dirname(file.path); // この時点で file.path は存在が保証されている
				const relativePath = path.relative(fileDir, path.join(ASSETS_DIR, fileName)).replace(/\\/g, '/');

				if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extension)) {
					const imageNode: Image = {
						type: 'image',
						url: relativePath,
						alt: altText,
						title: null,
					};
					node.children = [imageNode];
				} 
				else if (['.mp4', '.webm'].includes(extension)) {
					const videoHtml = `<video src="${relativePath}" controls autoplay muted loop playsinline style="width: 100%; max-width: 100%; border-radius: 8px;"></video>`;
					const htmlNode: HTML = {
						type: 'html',
						value: videoHtml,
					};
					parent.children.splice(index, 1, htmlNode as BlockContent);
				}
			} else {
				console.warn(`[remark-wikilinks] File not found in "src/content/assets/": ${fileName}`);
			}
		});
	};
}