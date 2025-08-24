/**
 * YouTube関連のユーティリティ関数
 */

export interface YouTubeEmbedOptions {
	videoId: string;
	title?: string;
	autoplay?: boolean;
	mute?: boolean;
	rel?: boolean;
	start?: number;
	end?: number;
}

/**
 * YouTubeのvideoId形式の正規表現パターン（11文字の英数字、アンダースコア、ハイフン）
 */
const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

/**
 * YouTubeのURLからvideoIdを抽出するための正規表現パターン
 */
const URL_PATTERNS = [
	/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
	/youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
] as const;

/**
 * YouTubeのvideoIdをバリデーションする
 */
export function validateVideoId(videoId: string): boolean {
	if (!videoId || typeof videoId !== "string") {
		return false;
	}
	
	return VIDEO_ID_PATTERN.test(videoId.trim());
}

/**
 * YouTubeの埋め込みURLを生成する
 */
export function createYouTubeEmbedUrl(options: YouTubeEmbedOptions): string {
	const { videoId, autoplay = false, mute = false, rel = false, start, end } = options;
	
	if (!validateVideoId(videoId)) {
		throw new Error(`Invalid YouTube videoId: ${videoId}`);
	}
	
	const embedUrl = new URL(`https://www.youtube.com/embed/${videoId.trim()}`);
	
	// パラメータを設定
	embedUrl.searchParams.set("rel", rel ? "1" : "0");
	if (autoplay) embedUrl.searchParams.set("autoplay", "1");
	if (mute) embedUrl.searchParams.set("mute", "1");
	if (start) embedUrl.searchParams.set("start", start.toString());
	if (end) embedUrl.searchParams.set("end", end.toString());
	
	return embedUrl.toString();
}

/**
 * YouTubeのURLからvideoIdを抽出する
 */
export function extractVideoId(url: string): string | null {
	if (!url || typeof url !== "string") {
		return null;
	}
	
	for (const pattern of URL_PATTERNS) {
		const match = url.match(pattern);
		if (match?.[1]) {
			return match[1];
		}
	}
	
	return null;
}

/**
 * エラー表示用のHTMLを生成する
 */
function createErrorHtml(message: string): string {
	return `
<div class="youtube-embed-error my-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
	<p>Error: ${message}</p>
</div>
	`.trim();
}

/**
 * YouTube埋め込みプレイヤーのHTMLを生成する
 */
function createEmbedPlayerHtml(embedUrl: string, title: string): string {
	return `
<div class="youtube-embed my-6">
	<div class="relative w-full" style="padding-bottom: 56.25%;">
		<iframe
			src="${embedUrl}"
			title="${title}"
			width="100%"
			height="315"
			class="absolute top-0 left-0 h-full w-full rounded-lg border-0"
			allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
			allowfullscreen
			loading="lazy"
			sandbox="allow-same-origin allow-scripts allow-presentation allow-popups allow-popups-to-escape-sandbox"
		></iframe>
	</div>
</div>
	`.trim();
}

/**
 * YouTubeの埋め込みHTMLを生成する
 */
export function createYouTubeEmbedHtml(options: YouTubeEmbedOptions): string {
	const { videoId, title = "YouTube video" } = options;
	
	if (!validateVideoId(videoId)) {
		return createErrorHtml(`Invalid YouTube videoId: ${videoId}`);
	}
	
	try {
		const embedUrl = createYouTubeEmbedUrl(options);
		return createEmbedPlayerHtml(embedUrl, title);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Invalid YouTube video";
		return createErrorHtml(errorMessage);
	}
} 