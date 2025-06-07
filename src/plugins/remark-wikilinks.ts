// src/plugins/remark-wikilinks.ts (v5 - flatMapによる堅牢な実装)
import fs from 'node:fs';
import path from 'node:path';
import type { Root, Paragraph, Image, Html, PhrasingContent } from 'mdast';
import type { VFile } from 'vfile';
import { visit } from 'unist-util-visit';

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

			// flatMap を使って、テキストノードを安全に複数のノードに展開する
			const newChildren = node.children.flatMap((child): PhrasingContent | PhrasingContent[] => {
				// テキストノード以外は、何もせずそのまま返す
				if (child.type !== 'text') {
					return [child]; // 配列で返す
				}

				const text = child.value;
				const parts: PhrasingContent[] = [];
				let lastIndex = 0;
				WIKILINK_REGEX.lastIndex = 0;
				let match: RegExpExecArray | null;

				while ((match = WIKILINK_REGEX.exec(text)) !== null) {
					const [fullMatch, fileName] = match;
					if (fileName === undefined) continue;

					// マッチ部分より前のテキストを追加
					if (match.index > lastIndex) {
						parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
					}
					
					// wikilinkを処理
					if (fileExists(fileName)) {
						console.log(`[remark-wikilinks] Found & converting: ${fullMatch} in ${path.basename(file.path)}`);
						const altText = fileName.split('.').slice(0, -1).join('.');
						const extension = path.extname(fileName).toLowerCase();
						const fileDir = path.dirname(file.path);
						const relativePath = path.relative(fileDir, path.join(ASSETS_DIR, fileName)).replace(/\\/g, '/');

						if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extension)) {
							parts.push({ type: 'image', url: relativePath, alt: altText, title: null });
						} else if (['.mp4', '.webm'].includes(extension)) {
							const videoHtml = `<video src="${relativePath}" controls autoplay muted loop playsinline style="width: 100%; max-width: 100%; border-radius: 8px;"></video>`;
							parts.push({ type: 'html', value: videoHtml });
						} else {
							parts.push({ type: 'text', value: fullMatch });
						}
					} else {
						console.warn(`[remark-wikilinks] File not found for ${fullMatch}. Keeping original text.`);
						parts.push({ type: 'text', value: fullMatch });
					}

					lastIndex = match.index + fullMatch.length;
				}

				// 最後のマッチ以降のテキストを追加
				if (lastIndex < text.length) {
					parts.push({ type: 'text', value: text.slice(lastIndex) });
				}
				
				// 何も変換されなかった場合は元のノードを、変換された場合は新しいノードの配列を返す
				return parts.length > 0 ? parts : [child];
			});

			// 新しく生成したchildrenで、元のノードを更新
			node.children = newChildren;
		});
	};
}