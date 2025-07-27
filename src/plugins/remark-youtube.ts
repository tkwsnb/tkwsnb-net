import type { Plugin } from "unified";
import type { Root } from "mdast";
import { visit } from "unist-util-visit";
import { createYouTubeEmbedHtml, type YouTubeEmbedOptions } from "../utils/youtube";

// 属性を安全に取得する関数
function getAttributes(node: any): YouTubeEmbedOptions {
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
		result.start = parseInt(attributes.start as string);
	}
	if (attributes.end) {
		result.end = parseInt(attributes.end as string);
	}
	
	return result;
}

// remarkプラグイン
export const remarkYouTube: Plugin<[], Root> = () => {
	return (tree) => {
		visit(tree, "containerDirective", (node: any) => {
			if (node.name === "youtube") {
				const attributes = getAttributes(node);
				const embedHtml = createYouTubeEmbedHtml(attributes);
				
				// コンテナディレクティブをHTMLに変換
				node.type = "html";
				node.value = embedHtml;
			}
		});
	};
}; 