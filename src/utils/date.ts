import type { CollectionEntry } from "astro:content";

export function getFormattedDate(
	date: Date | undefined,
): string {
	if (date === undefined) {
		return "Invalid Date";
	}

	// カスタムフォーマットでYYYY/MM/DD形式を確実に出力
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	
	return `${year}/${month}/${day}`;
}

export function collectionDateSort(
	a: CollectionEntry<"post" | "note">,
	b: CollectionEntry<"post" | "note">,
) {
	return b.data.publishDate.getTime() - a.data.publishDate.getTime();
}
