import type { Plugin } from "unified";
import type { Root } from "mdast";
import { visit } from "unist-util-visit";
import { createYouTubeEmbedHtml, type YouTubeEmbedOptions, extractVideoId } from "../utils/youtube";

/**
 * コンテナディレクティブの属性を安全に取得してYouTubeEmbedOptionsに変換する
 */
function parseDirectiveAttributes(node: any): YouTubeEmbedOptions {
	const attributes = node.attributes || {};
	
	const result: YouTubeEmbedOptions = {
		videoId: attributes.videoId as string,
		title: attributes.title as string,
		autoplay: attributes.autoplay === "true" || attributes.autoplay === true,
		mute: attributes.mute === "true" || attributes.mute === true,
		rel: attributes.rel === "true" || attributes.rel === true,
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
function extractYouTubeLinkInfo(linkNode: any): { videoId: string; title: string } | null {
	const url = linkNode.url;
	if (!url || typeof url !== "string") {
		return null;
	}
	
	const videoId = extractVideoId(url);
	if (!videoId) {
		return null;
	}
	
	const title = linkNode.children?.[0]?.value || url;
	return { videoId, title };
}

/**
 * 段落ノード内のYouTubeリンクを検出して埋め込みプレイヤーに変換する
 */
function transformYouTubeLinksInParagraph(paragraphNode: any): boolean {
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
			const { videoId, title } = firstLink;
			const embedHtml = createYouTubeEmbedHtml({ videoId, title });
			
			paragraphNode.type = "html";
			paragraphNode.value = embedHtml;
			return true;
		}
	}
	
	// 複数のリンクがある場合や他のテキストが混在する場合は、
	// YouTubeリンクのみを埋め込みに変換
	const newChildren = [];
	
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
	
	paragraphNode.children = newChildren;
	return true;
}

/**
 * YouTubeコンテナディレクティブを埋め込みプレイヤーに変換する
 */
function transformYouTubeDirective(directiveNode: any): void {
	if (directiveNode.name !== "youtube") {
		return;
	}
	
	const attributes = parseDirectiveAttributes(directiveNode);
	const embedHtml = createYouTubeEmbedHtml(attributes);
	
	directiveNode.type = "html";
	directiveNode.value = embedHtml;
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