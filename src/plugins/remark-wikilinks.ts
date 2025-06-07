// src/plugins/remark-wikilinks.ts (v4 - 型安全性を強化)
import fs from 'node:fs';
import path from 'node:path';
import type { Root, Paragraph, Image, Html, PhrasingContent } from 'mdast';
import type { VFile } from 'vfile';
import { visit } from 'unist-util-visit';
import type { Parent } from 'unist';

const WIKILINK_REGEX = /!\[\[([^\]]+)\]\]/g;
const ASSETS_DIR = path.resolve(process.cwd(), 'src/content/assets');

const fileExists = (fileName: string): boolean => {
	return fs.existsSync(path.join(ASSETS_DIR, fileName));
};

export function remarkWikiLinks() {
	return (tree: Root, file: VFile) => {
		visit(tree, 'paragraph', (node: Paragraph) => {
			if (!file?.path) {
				return;
			}
			
			const newChildren: PhrasingContent[] = [];
			let hasChanged = false; // 変換が行われたかどうかのフラグ

			for (const child of node.children) {
				if (child.type !== 'text') {
					newChildren.push(child);
					continue;
				}

				const text = child.value;
				let lastIndex = 0;
				WIKILINK_REGEX.lastIndex = 0; // 正規表現のインデックスをリセット
				let match: RegExpExecArray | null;

				while ((match = WIKILINK_REGEX.exec(text)) !== null) {
					hasChanged = true;
					const [fullMatch, fileName] = match; // マッチ全体とキャプチャグループを取得

					// ---【重要】fileNameの存在チェックを追加 ---
					if (fileName === undefined) continue;

					// マッチした部分より前のテキストを追加
					if (match.index > lastIndex) {
						newChildren.push({ type: 'text', value: text.slice(lastIndex, match.index) });
					}

					if (fileExists(fileName)) {
						console.log(`[remark-wikilinks] Found & converting: ${fullMatch} in ${path.basename(file.path)}`);

						const altText = fileName.split('.').slice(0, -1).join('.');
						const extension = path.extname(fileName).toLowerCase();
						const fileDir = path.dirname(file.path);
						const relativePath = path.relative(fileDir, path.join(ASSETS_DIR, fileName)).replace(/\\/g, '/');

						if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extension)) {
							const imageNode: Image = { type: 'image', url: relativePath, alt: altText, title: null };
							newChildren.push(imageNode);
						} else if (['.mp4', '.webm'].includes(extension)) {
							const videoHtml = `<video src="${relativePath}" controls autoplay muted loop playsinline style="width: 100%; max-width: 100%; border-radius: 8px;"></video>`;
							// 'HTML' は 'Html' に名称変更されたため修正
							const htmlNode: Html = { type: 'html', value: videoHtml };
							newChildren.push(htmlNode);
						} else {
							newChildren.push({ type: 'text', value: fullMatch });
						}
					} else {
						console.warn(`[remark-wikilinks] File not found for ${fullMatch}. Keeping original text.`);
						newChildren.push({ type: 'text', value: fullMatch });
					}
					
					lastIndex = match.index + fullMatch.length;
				}

				// 残りのテキストを追加
				if (lastIndex < text.length) {
					newChildren.push({ type: 'text', value: text.slice(lastIndex) });
				}
			}

			// 変更があった場合のみ、子ノードを置き換える
			if (hasChanged) {
				node.children = newChildren;
			}
		});
	};
}