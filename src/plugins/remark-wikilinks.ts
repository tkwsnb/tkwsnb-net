import fs from 'node:fs';
import path from 'node:path';
import type { Root, Paragraph } from 'mdast';
import type { VFile } from 'vfile';
import { visit } from 'unist-util-visit';

const WIKILINK_REGEX = /^!\[\[([^\]]+)\]\]$/;

const normalizeFileName = (name: string): string => {
	return name.replace(/\.md$/, "").replace(/\s/g, "-");
};

// HTMLノードを生成する関数 (画像・動画共通)
const createHtmlNode = (filePath: string, webPath: string): { type: 'html', value: string } | null => {
    const extension = path.extname(filePath).toLowerCase();
    const altText = path.basename(filePath, extension);

    // 画像ファイルの場合、<img> タグを生成
    if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extension)) {
        return {
            type: 'html',
            value: `<img src="${webPath}" alt="${altText}">`,
        };
    }

    // 動画ファイルの場合、<video> タグを生成
    if (['.mp4', '.webm'].includes(extension)) {
        return {
            type: 'html',
            value: `<video src="${webPath}" controls autoplay muted loop playsinline></video>`,
        };
    }

    return null;
}

const findFile = (baseDir: string, fileName: string): { filePath: string; webPath: string } | null => {
    const searchDirs = [
        path.resolve(baseDir, "../assets"), // e.g., src/content/posts -> src/assets
        path.resolve(process.cwd(), "public"),
    ];
    const possibleExtensions = ["", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".mp4", ".webm"];

    for (const dir of searchDirs) {
        for (const ext of possibleExtensions) {
            const filePath = path.join(dir, `${fileName}${ext}`);
            if (fs.existsSync(filePath)) {
                const isPublic = dir.startsWith(path.resolve(process.cwd(), "public"));
                let webPath;

                if (isPublic) {
                    webPath = '/' + path.relative(path.resolve(process.cwd(), 'public'), filePath).replace(/\\/g, '/');
                } else {
                    // src内のアセットはAstroがビルド時に処理する。devサーバーでは/src/assets...のパスが必要。
                    webPath = '/' + path.relative(process.cwd(), filePath).replace(/\\/g, '/');
                }
                return { filePath, webPath };
            }
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

			// `file.path` が undefined の可能性に対応
			const currentFilePath = file.history[0];
			if (!currentFilePath) return;

			const markdownDir = path.dirname(currentFilePath);
			const normalizedFileName = normalizeFileName(fileNameFromLink);
            const foundFile = findFile(markdownDir, normalizedFileName);

			if (foundFile) {
                const { filePath, webPath } = foundFile;
				const newNode = createHtmlNode(filePath, webPath);

				if (newNode) {
					// 親のchildren配列内で、現在のノードを新しいHTMLノードに置き換える
					parent.children[index] = newNode;
				}
			} else {
				console.warn(`[remark-wikilinks] File not found: "![[${fileNameFromLink}]]" (from: ${currentFilePath})`);
			}
		});
	};
}