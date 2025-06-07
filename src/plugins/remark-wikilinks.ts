import fs from "node:fs";
import path from "node:path";
import type { Paragraph, Root } from "mdast";
import type { VFile } from "vfile";
import { visit } from "unist-util-visit";

// ObsidianのWikiLink形式 `![[...]]` に段落全体が完全に一致する正規表現
const WIKILINK_REGEX = /^!\[\[([^\]]+)\]\]$/;

// ファイル名を正規化する (スペースをハイフンに、.md拡張子を削除)
const normalizeFileName = (name: string): string => {
	return name.replace(/\.md$/, "").replace(/\s/g, "-");
};

// ファイルの拡張子に基づいてASTノードを生成する
const createFileNode = (filePath: string, webPath: string) => {
	const extension = path.extname(filePath).toLowerCase();
	const altText = path.basename(filePath, extension);

	// 画像ファイルの場合
	if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].includes(extension)) {
		return {
			type: "mdxJsxFlowElement", // Astroの<Image>コンポーネントを呼び出す
			name: "Image",
			attributes: [
				{ type: "mdxJsxAttribute", name: "src", value: webPath },
				{ type: "mdxJsxAttribute", name: "alt", value: altText },
			],
			children: [],
		};
	}

	// 動画ファイルの場合
	if ([".mp4", ".webm"].includes(extension)) {
		return {
			type: "html", // 純粋なHTMLタグとして出力
			value: `<video src="${webPath}" controls autoplay muted loop playsinline></video>`,
		};
	}

	return null;
};

// アセットファイルを検索する関数
const findFile = (baseDir: string, fileName: string): { filePath: string; webPath: string } | null => {
    // 検索対象のディレクトリ (環境に合わせてカスタマイズしてください)
    const searchDirs = [
        path.resolve(baseDir, "../assets"),  // src/content/posts -> src/assets
        path.resolve(process.cwd(), "public") // プロジェクトルート/public
    ];

    const possibleExtensions = ["", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".mp4", ".webm"];

    for (const dir of searchDirs) {
        // ▼▼▼ ここが修正点です ▼▼▼
        for (const ext of possibleExtensions) {
            const filePath = path.join(dir, `${fileName}${ext}`);
            if (fs.existsSync(filePath)) {
                // publicディレクトリ内のファイルはルートからのパス、それ以外はプロジェクトルートからの相対パス
                const isPublic = dir.startsWith(path.resolve(process.cwd(), "public"));
                const relativeDir = path.relative(process.cwd(), dir);
                const webPath = `/${path.join(relativeDir, `${fileName}${ext}`)}`.replace(/\\/g, '/');

                // public内のファイルパスから 'public' を削除
                const finalWebPath = webPath.startsWith('/public/') ? webPath.replace('/public', '') : webPath;

                return { filePath, webPath: finalWebPath };
            }
        }
    }
    return null;
};


export function remarkWikiLinks() {
	return (tree: Root, file: VFile) => {
		// paragraph (段落) ノードを走査する
		visit(tree, "paragraph", (node: Paragraph) => {
			// TypeScriptエラー(Object is possibly 'undefined')を回避するためのチェック
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
					// paragraphノードを安全に置き換える
					// 'children'と'value'を削除し、新しいプロパティを追加
					const paragraph = node as any;
					delete paragraph.children;
					paragraph.type = newNode.type;

					if (newNode.type === 'html') {
						paragraph.value = (newNode as { value: string }).value;
					} else if (newNode.type === 'mdxJsxFlowElement') {
						paragraph.name = (newNode as { name: string }).name;
						paragraph.attributes = (newNode as { attributes: any[] }).attributes;
						paragraph.children = (newNode as { children: any[] }).children;
					}
				}
			} else {
				console.warn(`[remark-wikilinks] File not found for wikilink: "![[${fileNameFromLink}]]" (normalized to: ${normalizedFileName})`);
			}
		});
	};
}