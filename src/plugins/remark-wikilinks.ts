import fs from 'node:fs';
import path from 'node:path';
import type { Root, Paragraph } from 'mdast';
import type { VFile } from 'vfile';
import { visit } from 'unist-util-visit';

const WIKILINK_REGEX = /^!\[\[([^\]]+)\]\]$/;

const normalizeFileName = (name: string): string => {
	return name.replace(/\.md$/, "").replace(/\s/g, "-");
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

const findFile = (baseDir: string, fileName: string): string | null => {
    // 修正点1: 検索対象を記事フォルダ内の 'assets' フォルダに限定
    const searchDir = path.resolve(baseDir, "assets");
    const possibleExtensions = ["", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".mp4", ".webm"];

    if (!fs.existsSync(searchDir)) {
        return null;
    }

    for (const ext of possibleExtensions) {
        const filePath = path.join(searchDir, `${fileName}${ext}`);
        if (fs.existsSync(filePath)) {
            // ファイルのフルパスを返す
            return filePath;
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
			const currentFilePath = file.history[0];
			if (!currentFilePath) return;

			const markdownDir = path.dirname(currentFilePath);
			const normalizedFileName = normalizeFileName(fileNameFromLink);
            const foundFilePath = findFile(markdownDir, normalizedFileName);

			if (foundFilePath) {
                // 修正点2: 正しいWeb用パスを生成
                // 例: '.../src/content/notes/slug/assets/img.png' -> '/notes/slug/assets/img.png'
                const contentDir = path.resolve(process.cwd(), 'src/content');
                const webPath = '/' + path.relative(contentDir, foundFilePath).replace(/\\/g, '/');

				const altText = path.basename(foundFilePath, path.extname(foundFilePath));
				const newNode = createHtmlNode(webPath, altText);

				if (newNode) {
					parent.children[index] = newNode;
				}
			} else {
				console.warn(`[remark-wikilinks] File not found: "![[${fileNameFromLink}]]" (from: ${currentFilePath})`);
			}
		});
	};
}