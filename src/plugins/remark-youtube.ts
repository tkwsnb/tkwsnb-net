import type { Plugin } from "unified";
import type { Root, Paragraph, Link, HTML } from "mdast";
import type { ContainerDirective } from "mdast-util-directive";
import { visit } from "unist-util-visit";
import { createYouTubeEmbedHtml, type YouTubeEmbedOptions, extractVideoId } from "../utils/youtube";

/**
 * YouTubeリンク情報の型定義
 */
interface YouTubeLinkInfo {
	videoId: string;
	title: string;
}



/**
 * 段落ノードの型定義（YouTube埋め込み用）
 */
interface ParagraphWithEmbed {
	type: "html";
	value: string;
}

/**
 * HTMLノードの型定義
 */
interface HTMLNode {
	type: "html";
	value: string;
}

/**
 * コンテナディレクティブの属性を安全に取得してYouTubeEmbedOptionsに変換する
 */
function parseDirectiveAttributes(node: ContainerDirective): YouTubeEmbedOptions {
	const attributes = node.attributes || {};
	
	const result: YouTubeEmbedOptions = {
		videoId: attributes.videoId as string,
		title: attributes.title as string,
		autoplay: attributes.autoplay === "true",
		mute: attributes.mute === "true",
		rel: attributes.rel === "true",
	};
	
	// オプショナルな数値プロパティを条件付きで追加
	if (attributes.start) {
		result.start = parseInt(attributes.start as string, 10);
	}
	if (attributes.end) {
		result.end = parseInt(attributes.end as string, 10);
	}
	
	return result;
}

/**
 * リンクノードからYouTubeの情報を抽出する
 */
function extractYouTubeLinkInfo(linkNode: Link): YouTubeLinkInfo | null {
	const url = linkNode.url;
	if (!url || typeof url !== "string") {
		return null;
	}
	
	const videoId = extractVideoId(url);
	if (!videoId) {
		return null;
	}
	
	// リンクのテキストを取得し、URLの場合は適切なタイトルを生成
	let title = "";
	if (linkNode.children && linkNode.children.length > 0) {
		const firstChild = linkNode.children[0];
		if (firstChild && "value" in firstChild && typeof firstChild.value === "string") {
			title = firstChild.value;
		}
	}
	
	// テキストがURLそのものの場合や空の場合は、動画IDからタイトルを生成
	if (!title || title === url || title.startsWith("http")) {
		title = `YouTube video`;
	}
	
	return { videoId, title };
}

/**
 * 段落全体をYouTube埋め込みプレイヤーに置換する
 */
function replaceParagraphWithEmbed(paragraphNode: Paragraph, videoId: string, title: string): void {
	const embedHtml = createYouTubeEmbedHtml({ videoId, title });
	(paragraphNode as unknown as HTMLNode).type = "html";
	(paragraphNode as unknown as HTMLNode).value = embedHtml;
}

/**
 * 段落内のYouTubeリンクを埋め込みプレイヤーに変換する
 */
function transformMixedContentParagraph(paragraphNode: Paragraph, youtubeLinks: Array<YouTubeLinkInfo>): void {
	const newChildren: unknown[] = [];
	
	for (const child of paragraphNode.children) {
		if (child.type === "link") {
			const linkInfo = extractYouTubeLinkInfo(child);
			if (linkInfo) {
				const { videoId, title } = linkInfo;
				const embedHtml = createYouTubeEmbedHtml({ videoId, title });
				
				newChildren.push({
					type: "html",
					value: embedHtml
				});
				continue;
			}
		}
		// YouTubeリンク以外はそのまま追加
		newChildren.push(child);
	}
	
	paragraphNode.children = newChildren as typeof paragraphNode.children;
}

/**
 * 段落ノード内のYouTubeリンクを検出して埋め込みプレイヤーに変換する
 */
function transformYouTubeLinksInParagraph(paragraphNode: Paragraph): boolean {
	if (!paragraphNode.children || !Array.isArray(paragraphNode.children)) {
		return false;
	}

	// 段落内のYouTubeリンクを収集
	const youtubeLinks: Array<{ videoId: string; title: string }> = [];
	
	for (const child of paragraphNode.children) {
		if (child.type === "link") {
			const linkInfo = extractYouTubeLinkInfo(child);
			if (linkInfo) {
				youtubeLinks.push(linkInfo);
			}
		}
	}

	if (youtubeLinks.length === 0) {
		return false;
	}

	// 段落全体が単一のYouTubeリンクの場合、段落全体を埋め込みに置換
	if (paragraphNode.children.length === 1 && youtubeLinks.length === 1) {
		const firstLink = youtubeLinks[0];
		if (firstLink) {
			replaceParagraphWithEmbed(paragraphNode, firstLink.videoId, firstLink.title);
			return true;
		}
	}
	
	// 複数のリンクがある場合や他のテキストが混在する場合は、
	// YouTubeリンクのみを埋め込みに変換
	transformMixedContentParagraph(paragraphNode, youtubeLinks);
	return true;
}

/**
 * YouTubeコンテナディレクティブを埋め込みプレイヤーに変換する
 */
function transformYouTubeDirective(directiveNode: ContainerDirective): void {
	if (directiveNode.name !== "youtube") {
		return;
	}
	
	const attributes = parseDirectiveAttributes(directiveNode);
	const embedHtml = createYouTubeEmbedHtml(attributes);
	
	(directiveNode as unknown as HTMLNode).type = "html";
	(directiveNode as unknown as HTMLNode).value = embedHtml;
}

/**
 * Remarkプラグインのメインエクスポート
 * YouTubeディレクティブと通常のYouTubeリンクを埋め込みプレイヤーに変換する
 */
export const remarkYouTube: Plugin<[], Root> = () => {
	return (tree) => {
		// YouTubeコンテナディレクティブの処理
		visit(tree, "containerDirective", transformYouTubeDirective);

		// 段落内の通常のYouTubeリンクの自動変換
		visit(tree, "paragraph", transformYouTubeLinksInParagraph);
	};
}; 