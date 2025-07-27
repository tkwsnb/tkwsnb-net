---
title: YouTube埋め込みテスト（リファクタリング版）
description: リファクタリング後のYouTube動画の埋め込み機能をテストする記事です
publishDate: 2025-01-27
tags:
  - テスト
  - YouTube
  - リファクタリング
---

この記事では、リファクタリング後のYouTube動画の埋め込み機能をテストします。

## 基本的な埋め込み

:::youtube{videoId="dQw4w9WgXcQ" title="Rick Astley - Never Gonna Give You Up"}
:::

## オプション付きの埋め込み

:::youtube{videoId="9bZkp7q19f0" title="PSY - GANGNAM STYLE" autoplay="true" mute="true"}
:::

## 時間指定付きの埋め込み

:::youtube{videoId="jNQXAC9IVRw" title="Me at the zoo" start="30" end="60"}
:::

## 直接HTMLを使用した埋め込み

<div class="youtube-embed my-6">
	<div class="relative w-full" style="padding-bottom: 56.25%;">
		<iframe
			src="https://www.youtube.com/embed/9bZkp7q19f0"
			title="PSY - GANGNAM STYLE"
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

## 新機能

- **バリデーション**: 無効なvideoIdの場合はエラーメッセージを表示
- **セキュリティ強化**: sandbox属性の追加
- **パフォーマンス向上**: lazy loading対応
- **アクセシビリティ**: 適切なtitle属性とaria-label
- **レスポンシブ対応**: モバイルでもデスクトップでも適切に表示
- **ダークモード対応**: ダークモード時に自動調整

これで、記事内でYouTube動画を安全かつ効率的に埋め込めるようになりました！ 