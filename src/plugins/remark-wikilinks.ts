// src/plugins/remark-wikilinks.ts (最終修正版 v3)
import fs from 'node:fs';
import path from 'node:path';
import type { Root, Paragraph, Image, HTML, BlockContent, Text, PhrasingContent } from 'mdast';
import type { VFile } from 'vfile';
import { visit } from 'unist-util-visit';
import type { Parent } from 'unist';

// グローバルオプション `g` をつけて、段落内のすべてのwikilinkにマッチさせる
const WIKILINK_REGEX = /!\[\[([^\]]+)\]\]/g;
const ASSETS_DIR = path.resolve(process.cwd(), 'src/content/assets');

const fileExists = (fileName: string): boolean => {
	return fs.existsSync(path.join(ASSETS_DIR, fileName));
};

export function remarkWikiLinks() {
	return (tree: Root, file: VFile) => {
		// paragraphノードに対してvisitを実行する
		visit(tree, 'paragraph', (node: Paragraph, index?: number, parent?: Parent) => {
			if (!file?.path || parent === undefined || parent === null || index === undefined || index === null) {
				return;
			}
			
			// 段落内の子ノードを新しいノード配列で置き換えるための準備
			const newChildren: PhrasingContent[] = [];
			let lastIndex = 0;

			// 段落内の各テキストノードをチェック
			for (const child of node.children) {
				if (child.type !== 'text') {
					newChildren.push(child);
					continue;
				}

				const text = child.value;
				let match: RegExpExecArray | null;
				// 正規表現にマッチする限りループ
				while ((match = WIKILINK_REGEX.exec(text)) !== null) {
					const [fullMatch, fileName] = match;

					// マッチした部分より前のテキストを追加
					if (match.index > lastIndex) {
						newChildren.push({ type: 'text', value: text.slice(lastIndex, match.index) });
					}

					// wikilinkを画像/動画ノードに変換
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
							const htmlNode: HTML = { type: 'html', value: videoHtml };
							newChildren.push(htmlNode);
						} else {
							// 対応していない拡張子の場合は、元のテキストをそのまま追加
							newChildren.push({ type: 'text', value: fullMatch });
						}
					} else {
						// ファイルが見つからない場合は、警告を出して元のテキストをそのまま追加
						console.warn(`[remark-wikilinks] File not found for ${fullMatch}. Keeping original text.`);
						newChildren.push({ type: 'text', value: fullMatch });
					}
					
					// 検索の開始位置を更新
					lastIndex = match.index + fullMatch.length;
				}

				// 最後にマッチした部分以降の残りのテキストを追加
				if (lastIndex < text.length) {
					newChildren.push({ type: 'text', value: text.slice(lastIndex) });
				}
				// 正規表現のインデックスをリセット
				WIKILINK_REGEX.lastIndex = 0;
			}

			// 新しい子ノード配列が元の配列と異なる場合のみ置き換える
			if (newChildren.length > 0) {
				node.children = newChildren;
			}
		});
	};
}