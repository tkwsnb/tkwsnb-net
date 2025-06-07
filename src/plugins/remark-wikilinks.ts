import fs from 'node:fs';
import path from 'node:path';
import type { Root, Paragraph } from 'mdast';
import type { VFile } from 'vfile';
import { visit } from 'unist-util-visit';

const WIKILINK_REGEX = /^!\[\[([^\]]+)\]\]$/;

const normalizeFileName = (name: string): string => {
	// 拡張子を削除し、スペースをハイフンに置換
	const baseName = name.split('.').slice(0, -1).join('.');
	return baseName.replace(/\s/g, "-");
};

const createHtmlNode = (webPath: string, altText: string): { type: 'html', value: string } | null => {
    const extension = path.extname(webPath).toLowerCase();

    if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extension)) {
        return {
            type: 'html',
            value: `<img src="${webPath}" alt="${altText}">`,
        };
    }
    if (['.mp4', '.webm'].includes(extension)) {
        return {
            type: 'html',
            value: `<video src="${webPath}" controls autoplay muted loop playsinline></video>`,
        };
    }
    return null;
}

// src/assets フォルダ内からファイルを探す関数
const findFileInAssets = (fileName: string): { filePath: string; webPath: string } | null => {
    const assetsDir = path.resolve(process.cwd(), "src/assets");
    // ファイル名に拡張子が含まれていない場合も想定して検索
    const possibleExtensions = ["", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".mp4", ".webm"];

    for (const ext of possibleExtensions) {
        const testFileName = `${fileName}${ext}`;
        const filePath = path.join(assetsDir, testFileName);

        if (fs.existsSync(filePath)) {
            // Astroがsrc/assets内の画像を処理できるよう、パスを生成
            // 例: 'C:/.../src/assets/hoge.png' -> '/src/assets/hoge.png'
            const webPath = `/src/assets/${testFileName}`;
            return { filePath, webPath };
        }
    }
    return null;
};

export function remarkWikiLinks() {
	return (tree: Root, file: VFile) => {
		visit(tree, 'paragraph', (node: Paragraph, index, parent) => {
			if (!parent || typeof index !== 'number') return;
			if (!node.children || node.children.length !== 1 || node.children[0]?.type !== 'text') return;

			const textNode = node.children[0];
			const match = textNode.value.match(WIKILINK_REGEX);
			if (!match || !match[1]) return;
			
			const fileNameFromLink = match[1];

			// [[hoge.png]] から `hoge` を取得
			const normalizedFileName = normalizeFileName(fileNameFromLink);

            // src/assets からファイルを検索
            const foundFile = findFileInAssets(normalizedFileName);

			if (foundFile) {
                const { webPath } = foundFile;

				// altテキストは元のファイル名から拡張子を除いたもの
				const altText = fileNameFromLink.split('.').slice(0, -1).join('.');
				const newNode = createHtmlNode(webPath, altText);

				if (newNode) {
					parent.children[index] = newNode;
				}
			} else {
				console.warn(`[remark-wikilinks] File not found in src/assets/: "![[${fileNameFromLink}]]"`);
			}
		});
	};
}