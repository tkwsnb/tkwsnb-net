import fs from "node:fs";
import path from "node:path";
import type { Paragraph, Root } from "mdast";
import type { VFile } from "vfile";
import { visit } from "unist-util-visit";

const WIKILINK_REGEX = /^!\[\[([^\]]+)\]\]$/;

const normalizeFileName = (name: string): string => {
	return name.replace(/\.md$/, "").replace(/\s/g, "-");
};

// 型定義: mdxJsxFlowElementやhtmlノードはBlockContentとして扱える
type BlockContent = Exclude<Root['children'][number], { type: 'text' }>;

const createFileNode = (filePath: string, webPath: string): BlockContent | null => {
	const extension = path.extname(filePath).toLowerCase();
	const altText = path.basename(filePath, extension);

	if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].includes(extension)) {
		return {
			type: "mdxJsxFlowElement",
			name: "Image",
			attributes: [
				{ type: "mdxJsxAttribute", name: "src", value: webPath },
				{ type: "mdxJsxAttribute", name: "alt", value: altText },
			],
			children: [],
		};
	}

	if ([".mp4", ".webm"].includes(extension)) {
		return {
			type: "html",
			value: `<video src="${webPath}" controls autoplay muted loop playsinline></video>`,
		};
	}

	return null;
};

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
                    // public内のファイルはルートからの絶対パス
                    webPath = '/' + path.relative(path.resolve(process.cwd(), 'public'), filePath).replace(/\\/g, '/');
                } else {
                    // src内のアセットはAstroが処理できるよう、プロジェクトルートからのパス
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
		// visitに parent と index を渡してもらう
		visit(tree, "paragraph", (node: Paragraph, index, parent) => {
			// 親がない、またはインデックスが不正な場合はスキップ (ルートノードなど)
			if (!parent || typeof index !== "number") {
				return;
			}
			if (!node.children || node.children.length !== 1 || node.children[0]?.type !== "text") {
				return;
			}
			
			const textNode = node.children[0];
			const match = textNode.value.match(WIKILINK_REGEX);
			if (!match || !match[1]) {
				return;
			}
			
			const fileNameFromLink = match[1];
			const normalizedFileName = normalizeFileName(fileNameFromLink);
			const markdownDir = path.dirname(file.path);
            const foundFile = findFile(markdownDir, normalizedFileName);

			if (foundFile) {
                const { filePath, webPath } = foundFile;
				const newNode = createFileNode(filePath, webPath);

				if (newNode) {
					// ★★★ これが最も重要で安全な修正点 ★★★
					// 親のchildren配列内で、現在のノード(paragraph)を新しいノードに置き換える
					parent.children[index] = newNode;
				}
			} else {
				console.warn(`[remark-wikilinks] File not found for wikilink: "![[${fileNameFromLink}]]" (normalized to: ${normalizedFileName})`);
			}
		});
	};
}