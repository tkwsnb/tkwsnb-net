import type { Plugin } from "unified";
import type { Root } from "mdast";
import { visit } from "unist-util-visit";

// YouTube動画の埋め込みHTMLを生成
function createYouTubeEmbed(videoId: string, title?: string): string {
	const embedUrl = `https://www.youtube.com/embed/${videoId}`;
	const videoTitle = title || "YouTube video";
	
	return `
<div class="youtube-embed my-6">
	<div class="relative w-full" style="padding-bottom: 56.25%;">
		<iframe
			src="${embedUrl}"
			title="${videoTitle}"
			width="100%"
			height="315"
			class="absolute top-0 left-0 w-full h-full rounded-lg"
			frameborder="0"
			allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
			allowfullscreen
		></iframe>
	</div>
</div>
	`.trim();
}

// remarkプラグイン
export const remarkYouTube: Plugin<[], Root> = () => {
	return (tree) => {
		visit(tree, "containerDirective", (node: any) => {
			if (node.name === "youtube") {
				const videoId = node.attributes?.videoId as string;
				const title = node.attributes?.title as string;
				
				if (videoId) {
					// コンテナディレクティブをHTMLに変換
					node.type = "html";
					node.value = createYouTubeEmbed(videoId, title);
				}
			}
		});
	};
}; 