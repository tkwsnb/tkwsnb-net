import RobotoMonoBold from "@/assets/roboto-mono-700.ttf";
import RobotoMono from "@/assets/roboto-mono-regular.ttf";
import { getAllPosts } from "@/data/post";
import { siteConfig } from "@/site.config";
import { getFormattedDate } from "@/utils/date";
import { Resvg } from "@resvg/resvg-js";
import type { APIContext, InferGetStaticPropsType } from "astro";
import satori, { type SatoriOptions } from "satori";
import { html } from "satori-html";
import fs from "node:fs/promises";
import path from "node:path";

const ogOptions: SatoriOptions = {
	// debug: true,
	fonts: [
		{
			data: Buffer.from(RobotoMono),
			name: "Roboto Mono",
			style: "normal",
			weight: 400,
		},
		{
			data: Buffer.from(RobotoMonoBold),
			name: "Roboto Mono",
			style: "normal",
			weight: 700,
		},
	],
	height: 630,
	width: 1200,
};

const markup = (title: string, pubDate: string) =>
	html`<div tw="flex flex-col w-full h-full bg-[#1d1f21] text-[#c9cacc]" style="font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Meiryo', 'Roboto Mono', sans-serif">
		<div tw="flex flex-col flex-1 w-full p-10 justify-center">
			<p tw="text-2xl mb-6">${pubDate}</p>
			<h1 tw="text-6xl font-bold leading-snug text-white" style="font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Meiryo', 'Roboto Mono', sans-serif">${title}</h1>
		</div>
		<div tw="flex items-center justify-between w-full p-10 border-t border-[#2bbc89] text-xl">
			<div tw="flex items-center">
				<div tw="flex items-center justify-center w-8 h-8 rounded-full bg-[#2bbc89] text-white font-bold text-sm mr-3">
					t
				</div>
				<span tw="text-xl font-semibold">${title}</span>
			</div>
			<div tw="flex items-center text-white">
				<span tw="text-lg">by tkwsnb</span>
			</div>
		</div>
	</div>`;

type Props = InferGetStaticPropsType<typeof getStaticPaths>;

export async function GET(context: APIContext) {
	const { pubDate, title } = context.props as Props;

	const postDate = getFormattedDate(pubDate);

    // Load Japanese-capable TTF fonts locally (M PLUS 1p) to render Japanese text
    const regularPath = path.resolve("src/assets/fonts/MPLUS1p-Regular.ttf");
    const boldPath = path.resolve("src/assets/fonts/MPLUS1p-Bold.ttf");
    const [jpRegular, jpBold] = await Promise.all([
        fs.readFile(regularPath),
        fs.readFile(boldPath),
    ]);

    const optionsWithJP: SatoriOptions = {
		...ogOptions,
		fonts: [
			...(ogOptions.fonts ?? []),
            { data: jpRegular, name: "M PLUS 1p", style: "normal", weight: 400 },
            { data: jpBold, name: "M PLUS 1p", style: "normal", weight: 700 },
		],
	};

	const svg = await satori(markup(title, postDate), optionsWithJP);
	const png = new Resvg(svg).render().asPng();
	return new Response(png, {
		headers: {
			"Cache-Control": "public, max-age=31536000, immutable",
			"Content-Type": "image/png",
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
