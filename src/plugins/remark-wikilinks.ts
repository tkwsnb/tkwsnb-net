import fs from 'node:fs';
import path from 'node:path';
import type { Root, Paragraph } from 'mdast';
import type { VFile } from 'vfile';
import { visit } from 'unist-util-visit';

const WIKILINK_REGEX = /^!\[\[([^\]]+)\]\]$/;

// [[hoge.png]] から `hoge` のように、拡張子を除いたベース名を取得し、スペースをハイフンに置換
const normalizeFileName = (name: string): string => {
	const baseName = name.split('.').slice(0, -1).join('.');
	return baseName.replace(/\s/g, "-");
};

// src/assets フォルダ内からファイルを探す関数
const findFileInAssets = (normalizedName: string): { filePath: string; webPath: string } | null => {
    const assetsDir = path.resolve(process.cwd(), "src/assets");
    const possibleExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".mp4", ".webm"];

    for (const ext of possibleExtensions) {
        const testFileName = `${normalizedName}${ext}`;
        const filePath = path.join(assetsDir, testFileName);

        if (fs.existsSync(filePath)) {
            // Astroがsrc/assets内の画像を処理できるよう、Web用のパスを生成
            const webPath = `/src/assets/${testFileName}`;
            return { filePath, webPath };
        }
    }
    return null;
};

export function remarkWikiLinks() {
    // 修正点1: 未使用の 'file' 引数を '_' で無視してエラーを解消
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
			const normalizedFileName = normalizeFileName(fileNameFromLink); // 例: "hoge"
            const foundFile = findFileInAssets(normalizedFileName);

			if (foundFile) {
                const { webPath } = foundFile;
                const altText = normalizedFileName;
                const extension = path.extname(webPath).toLowerCase();
                let htmlValue = '';

                if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extension)) {
                    htmlValue = `<img src="${webPath}" alt="${altText}">`;
                } else if (['.mp4', '.webm'].includes(extension)) {
                    htmlValue = `<video src="${webPath}" controls autoplay muted loop playsinline></video>`;
                }

				if (htmlValue) {
                    // ★★★これが最も重要な修正点★★★
                    // paragraphノード自体は変更せず、その中身(children)をhtmlノードで置き換える
                    node.children = [{ type: 'html', value: htmlValue }];
				}
			} else {
				console.warn(`[remark-wikilinks] File not found in src/assets/: "![[${fileNameFromLink}]]"`);
			}
		});
	};
}