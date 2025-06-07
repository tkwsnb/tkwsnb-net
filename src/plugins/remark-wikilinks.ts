// src/plugins/remark-wikilinks.ts
import fs from 'node:fs';
import path from 'node:path';
import type { Root, Paragraph } from 'mdast';
import type { VFile } from 'vfile';
import { visit } from 'unist-util-visit';

// ![[ファイル名]] という形式にマッチする正規表現
const WIKILINK_REGEX = /!\[\[([^\]]+)\]\]/;

// src/content/assets フォルダの絶対パス
// process.cwd() はプロジェクトのルートディレクトリを指します (例: C:\Users\USER\tkwsnb-net)
const ASSETS_DIR = path.resolve(process.cwd(), 'src/content/assets');

// ファイルが存在するかどうかをチェックするヘルパー関数
const fileExists = (fileName: string) => {
	return fs.existsSync(path.join(ASSETS_DIR, fileName));
};

export function remarkWikiLinks() {
	return (tree: Root, file: VFile) => {
		visit(tree, 'paragraph', (node: Paragraph, index, parent) => {
			// paragraphノードがテキストノード一つだけを含んでいるかチェック
			if (node.children.length !== 1 || node.children[0]?.type !== 'text') {
				return;
			}

			const textNode = node.children[0];
			const match = textNode.value.match(WIKILINK_REGEX);

			// Wikilink形式にマッチしない場合は何もしない
			if (!match || !match[1]) {
				return;
			}

			const fileName = match[1]; // 例: "cover.png"

			// アセットフォルダにファイルが存在するか確認
			if (fileExists(fileName)) {
				const altText = fileName.split('.').slice(0, -1).join('.');
				const extension = path.extname(fileName).toLowerCase();

				// 現在処理中のMarkdownファイルのディレクトリを取得
				const fileDir = path.dirname(file.path);
				
				// Markdownファイルからアセットファイルへの相対パスを計算
				// これにより、Astroがパスを正しく解決できるようになる
				const relativePath = path.relative(fileDir, path.join(ASSETS_DIR, fileName)).replace(/\\/g, '/');


				// 画像ファイルの場合
				if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extension)) {
					// ParagraphノードをImageノードに変換する
					// これがAstroの画像最適化をトリガーする最も良い方法
					const imageNode = {
						type: 'image',
						url: relativePath,
						alt: altText,
						title: null,
					};
					// 親ノードの子要素を新しいimageNodeで置き換える
					parent.children.splice(index, 1, imageNode);
				}
				// 動画ファイルの場合
				else if (['.mp4', '.webm'].includes(extension)) {
					// 動画は標準のMarkdown記法がないため、HTMLタグを直接生成する
					const videoHtml = `<video src="${relativePath}" controls autoplay muted loop playsinline></video>`;
					const htmlNode = {
						type: 'html',
						value: videoHtml,
					};
					// 親ノードの子要素を新しいhtmlNodeで置き換える
					parent.children.splice(index, 1, htmlNode);
				}

			} else {
				// ファイルが見つからなかった場合に警告を出す
				console.warn(`[remark-wikilinks] File not found in "src/content/assets/": ${fileName}`);
			}
		});
	};
}