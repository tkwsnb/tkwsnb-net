import { getAllPosts } from "@/data/post";
import { siteConfig } from "@/site.config";
import { getFormattedDate } from "@/utils/date";
import type { APIContext, InferGetStaticPropsType } from "astro";

type Props = InferGetStaticPropsType<typeof getStaticPaths>;

export async function GET(context: APIContext) {
	const { pubDate, title } = context.props as Props;
	const postDate = getFormattedDate(pubDate);

	// 一時的にOG画像の生成を無効にして、テキストレスポンスを返す
	return new Response(`OG Image for: ${title} (${postDate})`, {
		headers: {
			"Content-Type": "text/plain",
		},
	});
}

export async function getStaticPaths() {
	const posts = await getAllPosts();
	return posts
		.filter(({ data }) => !data.ogImage)
		.map((post) => ({
			params: { slug: post.id },
			props: {
				pubDate: post.data.updatedDate ?? post.data.publishDate,
				title: post.data.title,
			},
		}));
}
