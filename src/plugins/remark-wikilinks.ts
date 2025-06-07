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
        for (const ext of possibleExtensions) {
            const filePath = path.join(dir, `${fileName}${ext}`);
            if (fs.existsSync(filePath)) {
                // publicディレクトリ内のファイルはルートからのパス、それ以外は/assets/からのパス
                const isPublic = dir.startsWith(path.resolve(process.cwd(), "public"));
                const webPathPrefix = isPublic ? "" : "/assets";
                const webPath = path.join(webPathPrefix, `${fileName}${ext}`).replace(/\\/g, '/');
                return { filePath, webPath };
            }
        }
    }
    return null;
};


export function remarkWikiLinks() {
	return (tree: Root, file: VFile) => {
		// paragraph (段落) ノードを走査する
		visit(tree, "paragraph", (node: Paragraph) => {
			// 段落の子要素が1つだけで、それがtextノードでなければ処理しない
			if (node.children.length !== 1 || node.children[0].type !== "text") {
				return;
			}
			const textNode = node.children[0];
			
			// テキストがWikiLink形式に完全に一致するかチェック
			const match = textNode.value.match(WIKILINK_REGEX);
			
			// マッチしない、またはファイル名が取得できない場合は何もしない
			if (!match || !match[1]) {
				return;
			}
			
			const fileNameFromLink = match[1];

			// 1. ファイル名を正規化
			const normalizedFileName = normalizeFileName(fileNameFromLink);
			
			// 2. ファイル実体のパスを解決 (src/assets と public を検索)
			const markdownDir = path.dirname(file.path);
            const foundFile = findFile(markdownDir, normalizedFileName);

			if (foundFile) {
                const { filePath, webPath } = foundFile;

				// 3. ファイルタイプに応じた最適なノードへ変換
				const newNode = createFileNode(filePath, webPath);

				if (newNode) {
					// 4. paragraphノード自体を、新しいノードで置き換える
					//    これにより型エラーを根本的に回避する
					Object.assign(node, newNode);
				}
			} else {
				console.warn(`[remark-wikilinks] File not found for wikilink: "![[${fileNameFromLink}]]" (normalized to: ${normalizedFileName})`);
			}
		});
	};
}