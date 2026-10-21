import type { Plugin } from "unified";
import type { Html, Link, Paragraph, Parent, Root } from "mdast";
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
 * 親ノード内の対象インデックスをHTMLノードに置換する共通関数
 */
function replaceNodeWithHtml(parent: Parent | undefined, index: number | undefined, embedHtml: string): void {
	if (!parent || index === undefined) return;
	const htmlNode: Html = {
		type: "html",
		value: embedHtml,
	};
	parent.children[index] = htmlNode;
}

/**
 * コンテナディレクティブの属性を安全に取得してYouTubeEmbedOptionsに変換する
 */
function parseDirectiveAttributes(node: ContainerDirective): YouTubeEmbedOptions {
	const attributes = node.attributes || {};

	const result: YouTubeEmbedOptions = {
		videoId: typeof attributes.videoId === "string" ? attributes.videoId : "",
		autoplay: attributes.autoplay === "true",
		mute: attributes.mute === "true",
		rel: attributes.rel === "true",
	};

	// オプショナルなプロパティを条件付きで追加（exactOptionalPropertyTypes対応）
	if (typeof attributes.title === "string") {
		result.title = attributes.title;
	}
	if (typeof attributes.start === "string") {
		result.start = Number.parseInt(attributes.start, 10);
	}
	if (typeof attributes.end === "string") {
		result.end = Number.parseInt(attributes.end, 10);
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
	const title = extractLinkTitle(linkNode);

	return { videoId, title };
}

/**
 * リンクノードからタイトルを抽出する
 */
function extractLinkTitle(linkNode: Link): string {
	if (!linkNode.children || linkNode.children.length === 0) {
		return "YouTube video";
	}

	const firstChild = linkNode.children[0];
	if (!firstChild || !("value" in firstChild) || typeof firstChild.value !== "string") {
		return "YouTube video";
	}

	const title = firstChild.value;
	const url = linkNode.url;

	// テキストがURLそのものの場合や空の場合は、デフォルトタイトルを生成
	if (!title || title === url || title.startsWith("http")) {
		return "YouTube video";
	}

	return title;
}

/**
 * 段落内のYouTubeリンクを埋め込みプレイヤーに変換する
 */
function transformMixedContentParagraph(paragraphNode: Paragraph): void {
	const newChildren = paragraphNode.children.map((child) => {
		if (child.type === "link") {
			const linkInfo = extractYouTubeLinkInfo(child);
			if (linkInfo) {
				const { videoId, title } = linkInfo;
				const embedHtml = createYouTubeEmbedHtml({ videoId, title });

				return {
					type: "html",
					value: embedHtml,
				} as const;
			}
		}
		return child;
	});

	paragraphNode.children = newChildren;
}

/**
 * 段落ノード内のYouTubeリンクを検出して埋め込みプレイヤーに変換する
 */
function transformYouTubeLinksInParagraph(
	paragraphNode: Paragraph,
	index: number | undefined,
	parent: Parent | undefined,
): boolean {
	if (!paragraphNode.children || !Array.isArray(paragraphNode.children)) {
		return false;
	}

	// 段落内のYouTubeリンクを収集
	const youtubeLinks = paragraphNode.children
		.filter((child): child is Link => child.type === "link")
		.map((child) => extractYouTubeLinkInfo(child))
		.filter((info): info is YouTubeLinkInfo => info !== null);

	if (youtubeLinks.length === 0) {
		return false;
	}

	// 段落全体が単一のYouTubeリンクの場合、段落全体を埋め込みに置換
	if (paragraphNode.children.length === 1 && youtubeLinks.length === 1) {
		const firstLink = youtubeLinks[0];
		if (firstLink) {
			const embedHtml = createYouTubeEmbedHtml({
				videoId: firstLink.videoId,
				title: firstLink.title,
			});
			replaceNodeWithHtml(parent, index, embedHtml);
			return true;
		}
	}

	// 複数のリンクがある場合や他のテキストが混在する場合は、YouTubeリンクのみを埋め込みに変換
	transformMixedContentParagraph(paragraphNode);
	return true;
}

/**
 * YouTubeコンテナディレクティブを埋め込みプレイヤーに変換する
 */
function transformYouTubeDirective(
	directiveNode: ContainerDirective,
	index: number | undefined,
	parent: Parent | undefined,
): void {
	if (directiveNode.name !== "youtube") {
		return;
	}

	const attributes = parseDirectiveAttributes(directiveNode);
	const embedHtml = createYouTubeEmbedHtml(attributes);
	replaceNodeWithHtml(parent, index, embedHtml);
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
		visit(tree, "paragraph", (node: Paragraph, index, parent) => {
			transformYouTubeLinksInParagraph(node, index, parent);
		});
	};
};
