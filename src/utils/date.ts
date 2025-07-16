import type { CollectionEntry } from "astro:content";

/**
 * 日付をYYYY/MM/DD形式でフォーマットする
 * @param date フォーマットする日付
 * @returns YYYY/MM/DD形式の文字列、または無効な日付の場合は"Invalid Date"
 */
export function getFormattedDate(date: Date | undefined): string {
	if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
		return "Invalid Date";
	}

	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");

	return `${year}/${month}/${day}`;
}

/**
 * コレクションエントリを公開日時で降順ソートする
 * @param a 比較対象のエントリA
 * @param b 比較対象のエントリB
 * @returns ソート用の数値（負の値、0、正の値）
 */
export function collectionDateSort(
	a: CollectionEntry<"post" | "note">,
	b: CollectionEntry<"post" | "note">,
): number {
	return b.data.publishDate.getTime() - a.data.publishDate.getTime();
}

/**
 * 日付が有効かどうかをチェックする
 * @param date チェックする日付
 * @returns 有効な日付の場合true
 */
export function isValidDate(date: unknown): date is Date {
	return date instanceof Date && !isNaN(date.getTime());
}
