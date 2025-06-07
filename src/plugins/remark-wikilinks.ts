import fs from "node:fs";
import path from "node:path";
import type { Root } from "mdast";
import type { VFile } from "vfile";
import { visit } from "unist-util-visit";

// ObsidianのWikiLink形式 `![[...]]` にマッチする正規表現
const WIKILINK_REGEX = /!\[\[([^\]]+)\]\]/g;

// ファイル名からスペースをハイフンに置換するなどの正規化処理
const normalizeFileName = (name: string): string => {
	return name.replace(/\s/g, "-");
};

// ファイルの拡張子に基づいて処理を分岐させる
const createFileNode = (filePath: string, webPath: string) => {
	const extension = path.extname(filePath).toLowerCase();
	
	// 画像ファイルの場合
	if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].includes(extension)) {
		return {
			type: "mdxJsxFlowElement",
			name: "Image", // Astroの<Image>コンポーネントを呼び出す
			attributes: [
				{ type: "mdxJsxAttribute", name: "src", value: webPath },
				{ type: "mdxJsxAttribute", name: "alt", value: path.basename(filePath) },
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

	return null; // サポート外のファイル形式
};

export function remarkWikiLinks() {
	return (tree: Root, file: VFile) => {
		visit(tree, "text", (node, index, parent) => {
			if (typeof node.value !== "string") return;

			// ノードのテキストがWikiLink形式にマッチするかチェック
			if (!WIKILINK_REGEX.test(node.value)) return;

			// マッチした部分を処理するために、元の親ノードとインデックスを保持
			const originalParent = parent;
			const originalIndex = index;
			
			// マッチしたすべてのWikiLinkを置換
			const newNodes = [];
			let lastIndex = 0;
			let match;

			// gフラグ付き正規表現でループ
			while ((match = WIKILINK_REGEX.exec(node.value)) !== null) {
				const [fullMatch, fileName] = match;
				
				// マッチ前のテキスト部分を追加
				if (match.index > lastIndex) {
					newNodes.push({ type: "text", value: node.value.slice(lastIndex, match.index) });
				}

				// 1. ファイル名を正規化
				const normalizedFileName = normalizeFileName(fileName);
				
				// 2. ファイル実体のパスを解決
				//    Markdownファイルからの相対パスとして解決します。
				const markdownFilePath = file.path;
				const markdownDir = path.dirname(markdownFilePath);
				// ここでは画像が `../assets/` にあると仮定しています。環境に合わせて変更してください。
				// 参照リポジトリでは `../images` にありました。
				const assetPath = path.resolve(markdownDir, "../assets", normalizedFileName);

				if (fs.existsSync(assetPath)) {
					// 3. Webでアクセス可能なパスを生成
					//    ここでは /assets/ からのパスを生成します。
					const webPath = path.join("/assets", normalizedFileName).replace(/\\/g, '/');
					
					// 4. ファイルタイプに応じた最適な要素へ変換
					const fileNode = createFileNode(assetPath, webPath);
					if (fileNode) {
						newNodes.push(fileNode);
					}
				} else {
					// ファイルが見つからない場合は、元のテキストをそのまま残す
					console.warn(`[remark-wikilinks] File not found: ${normalizedFileName} (resolved to: ${assetPath})`);
					newNodes.push({ type: "text", value: fullMatch });
				}
				
				lastIndex = match.index + fullMatch.length;
			}
			
			// マッチ後の残りのテキスト部分を追加
			if (lastIndex < node.value.length) {
				newNodes.push({ type: "text", value: node.value.slice(lastIndex) });
			}
			
			// 元のtextノードを、新しく生成したノード群で置き換える
			if (newNodes.length > 0) {
				originalParent.children.splice(originalIndex, 1, ...newNodes);
			}
		});
	};
}