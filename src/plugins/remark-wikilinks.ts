import fs from 'node:fs';
import path from 'node:path';
import type { Root, Paragraph } from 'mdast';
import type { VFile } from 'vfile';
import { visit } from 'unist-util-visit';

const WIKILINK_REGEX = /^!\[\[([^\]]+)\]\]$/;

// src/assets フォルダ内からファイルを探す関数
const findFileInAssets = (fileName: string): { webPath: string; altText: string } | null => {
    const assetsDir = path.resolve(process.cwd(), "src/assets");
    const filePath = path.join(assetsDir, fileName);

    if (fs.existsSync(filePath)) {
        // Astroがsrc/assets内の画像を処理できるよう、Web用のパスを生成
        const webPath = `/src/assets/${fileName}`;
        // altテキストはファイル名から拡張子を除いたもの
        const altText = fileName.split('.').slice(0, -1).join('.');
        return { webPath, altText };
    }
    
    return null;
};

export function remarkWikiLinks() {
	return (tree: Root, _file: VFile) => {
		visit(tree, 'paragraph', (node: Paragraph) => {
			if (!node.children || node.children.length !== 1 || node.children[0]?.type !== 'text') {
				return;
			}

			const textNode = node.children[0];
			const match = textNode.value.match(WIKILINK_REGEX);
			if (!match || !match[1]) {
				return;
			}
			
			const fileNameFromLink = match[1]; // 例: "hoge.png"

            // 修正点: `fileNameFromLink` を直接使ってファイルを探す
            const foundFile = findFileInAssets(fileNameFromLink);

			if (foundFile) {
                const { webPath, altText } = foundFile;
                const extension = path.extname(webPath).toLowerCase();
                let htmlValue = '';

                if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extension)) {
                    htmlValue = `<img src="${webPath}" alt="${altText}">`;
                } else if (['.mp4', '.webm'].includes(extension)) {
                    htmlValue = `<video src="${webPath}" controls autoplay muted loop playsinline></video>`;
                }

				if (htmlValue) {
                    node.children = [{ type: 'html', value: htmlValue }];
				}
			} else {
				// ログをより詳細に
				console.warn(`[remark-wikilinks] File not found. Searched for "${fileNameFromLink}" in "src/assets/"`);
			}
		});
	};
}