---
title: YouTube埋め込みテスト
description: YouTube動画の埋め込み機能をテストする記事です
publishDate: 2025-01-27
tags:
  - テスト
  - YouTube
---

この記事では、YouTube動画の埋め込み機能をテストします。

## カスタムディレクティブを使用した埋め込み

:::youtube{videoId="dQw4w9WgXcQ" title="Rick Astley - Never Gonna Give You Up"}
:::

## 直接HTMLを使用した埋め込み

<div class="youtube-embed my-6">
	<div class="relative w-full" style="padding-bottom: 56.25%;">
		<iframe
			src="https://www.youtube.com/embed/9bZkp7q19f0"
			title="PSY - GANGNAM STYLE"
			width="100%"
			height="315"
			class="absolute top-0 left-0 w-full h-full rounded-lg"
			frameborder="0"
			allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
			allowfullscreen
		></iframe>
	</div>
</div>

これで、記事内でYouTube動画を簡単に埋め込めるようになりました！ 