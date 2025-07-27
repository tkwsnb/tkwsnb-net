import type { SiteConfig } from "@/types";
import type { AstroExpressiveCodeOptions } from "astro-expressive-code";

// サイト基本設定
export const siteConfig: SiteConfig = {
	author: "tkwsnb",
	title: "tkwsnb.net",
	url: "https://tkwsnb.net/",
	description: "映画と雑記のブログ",
	lang: "ja-JP",
	ogLocale: "ja-JP",
	date: {
		locale: "ja-JP",
		options: {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		},
	},
};

// ナビゲーションメニューの設定
export const menuLinks: { path: string; title: string }[] = [
	{
		path: "/",
		title: "Home",
	},
	{
		path: "/about/",
		title: "About",
	},
	{
		path: "/posts/",
		title: "Movies",
	},
	{
		path: "/notes/",
		title: "Notes",
	},
];

// Expressive Code設定
export const expressiveCodeOptions: AstroExpressiveCodeOptions = {
	styleOverrides: {
		borderRadius: "4px",
		codeFontFamily:
			'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
		codeFontSize: "0.875rem",
		codeLineHeight: "1.7142857rem",
		codePaddingInline: "1rem",
		frames: {
			frameBoxShadowCssValue: "none",
		},
		uiLineHeight: "inherit",
	},
	themeCssSelector(theme, { styleVariants }) {
		// ダークモードとライトモードのテーマセレクターを生成
		if (styleVariants.length >= 2) {
			const baseTheme = styleVariants[0]?.theme;
			const altTheme = styleVariants.find((v) => v.theme.type !== baseTheme?.type)?.theme;
			if (theme === baseTheme || theme === altTheme) return `[data-theme='${theme.type}']`;
		}
		return `[data-theme="${theme.name}"]`;
	},
	themes: ["dracula", "github-light"],
	useThemedScrollbars: false,
};
