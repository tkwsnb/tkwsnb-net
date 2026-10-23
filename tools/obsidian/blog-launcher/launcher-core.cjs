/**
 * Obsidian 記事作成ランチャーのコアロジック
 */

/**
 * Date オブジェクトから日本標準時（JST: Asia/Tokyo）の各パーツを生成する
 * @param {Date} [date]
 */
function formatJstDate(date = new Date()) {
	const formatter = new Intl.DateTimeFormat("en-GB", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});

	const parts = Object.fromEntries(
		formatter.formatToParts(date).map((part) => [part.type, part.value]),
	);

	const yyyy = parts.year;
	const yy = yyyy.slice(-2);
	const mm = parts.month;
	const dd = parts.day;
	// 24時表記が "24" になる環境への対策
	const hh = parts.hour === "24" ? "00" : parts.hour;
	const min = parts.minute;
	const sec = parts.second;
	const yymmdd = `${yy}${mm}${dd}`;
	const iso = `${yyyy}-${mm}-${dd}T${hh}:${min}:${sec}+09:00`;

	return {
		yyyy,
		yy,
		mm,
		dd,
		yymmdd,
		iso,
	};
}

/**
 * ファイル名として使用できないOS禁止文字を全角文字へ安全に置換する
 * @param {string} rawTitle
 */
function sanitizePostFileName(rawTitle) {
	const trimmed = (rawTitle ?? "").trim();
	if (!trimmed) {
		throw new Error("タイトルを入力してください");
	}
	const map = {
		"/": "／",
		"\\": "＼",
		":": "：",
		"*": "＊",
		"?": "？",
		'"': "”",
		"<": "＜",
		">": "＞",
		"|": "｜",
	};
	return trimmed.replace(/[/\\:*?"<>|]/g, (ch) => map[ch] || "_");
}

/**
 * Templater形式のテンプレート文字列を実際の値で展開する
 * @param {string} templateText
 * @param {{ title: string, yymmdd: string, iso: string }} vars
 */
function renderTemplateContent(templateText, { title, yymmdd, iso }) {
	return templateText
		.replace(/<%\s*tp\.file\.title\s*%>/g, title)
		.replace(/<%\s*`"\$\{tp\.date\.now\("YYMMDD"\)\}"`\s*%>/g, `"${yymmdd}"`)
		.replace(
			/<%\s*`"\$\{tp\.date\.now\("YYYY-MM-DDTHH:mm:ssZ"\)\}"`\s*%>/g,
			`"${iso}"`,
		);
}

/**
 * 雑記（note）の新規作成仕様を組み立てる
 * @param {Date} [date]
 * @param {string} [customTemplate]
 */
function buildNoteSpec(date = new Date(), customTemplate = "") {
	const { yy, mm, yymmdd, iso } = formatJstDate(date);
	const folders = ["note", `note/${yy}`, `note/${yy}/${mm}`];
	const filePath = `note/${yy}/${mm}/${yymmdd}.md`;

	const defaultTemplate = [
		"---",
		`title: "${yymmdd}"`,
		`description: "${yymmdd}"`,
		`publishDate: "${iso}"`,
		"---",
		"",
		"",
		"",
	].join("\n");

	const content = customTemplate
		? renderTemplateContent(customTemplate, { title: yymmdd, yymmdd, iso })
		: defaultTemplate;

	return {
		folders,
		filePath,
		yymmdd,
		content,
	};
}

/**
 * 映画記事（post）の新規作成仕様を組み立てる
 * @param {string} rawTitle
 * @param {Date} [date]
 * @param {string} [customTemplate]
 */
function buildPostSpec(rawTitle, date = new Date(), customTemplate = "") {
	const safeFileName = sanitizePostFileName(rawTitle);
	const cleanTitle = rawTitle.trim();
	const { yymmdd, iso } = formatJstDate(date);
	const folders = ["post"];
	const filePath = `post/${safeFileName}.md`;

	const defaultTemplate = [
		"---",
		`title: ${ safeFileName }`,
		`description: "${yymmdd}"`,
		`publishDate: "${iso}"`,
		"tags:",
		'  - "#movie"',
		"---",
		"",
		"",
		"",
	].join("\n");

	const content = customTemplate
		? renderTemplateContent(customTemplate, {
				title: safeFileName,
				yymmdd,
				iso,
			})
		: defaultTemplate;

	return {
		folders,
		filePath,
		title: cleanTitle,
		safeFileName,
		content,
	};
}

/**
 * 指定されたフォルダ階層がVault内に存在しない場合は順番に作成する
 * @param {any} app Obsidian App インスタンス
 * @param {string[]} folders
 */
async function ensureVaultFolders(app, folders) {
	for (const folderPath of folders) {
		const existing = app.vault.getAbstractFileByPath(folderPath);
		if (!existing) {
			await app.vault.createFolder(folderPath);
		}
	}
}

/**
 * テンプレートファイルが存在すれば読み込む
 * @param {any} app Obsidian App インスタンス
 * @param {string} templatePath
 */
async function readTemplateIfExists(app, templatePath) {
	const file = app.vault.getAbstractFileByPath(templatePath);
	if (file && typeof app.vault.read === "function" && file.content !== "") {
		try {
			return await app.vault.read(file);
		} catch {
			return "";
		}
	}
	return "";
}

/**
 * 対象ファイルを開き、エディタ末尾にフォーカスを移動する
 * @param {any} app Obsidian App インスタンス
 * @param {any} fileObj Vault ファイルオブジェクト
 */
async function openAndFocusFile(app, fileObj) {
	const leaf = app.workspace.getLeaf("tab");
	await leaf.openFile(fileObj);

	const editor = app.workspace.activeEditor?.editor;
	if (editor) {
		const lastLine = Math.max(0, editor.lineCount() - 1);
		editor.setCursor({ line: lastLine, ch: 0 });
		editor.focus();
	}
}

/**
 * 雑記（note）を必要に応じてフォルダごと新規作成し、エディタで開く
 * @param {any} app Obsidian App インスタンス
 * @param {Date} [date]
 */
async function executeCreateNote(app, date = new Date()) {
	const customTemplate = await readTemplateIfExists(app, "temp/Template note.md");
	const spec = buildNoteSpec(date, customTemplate);

	await ensureVaultFolders(app, spec.folders);

	const existingFile = app.vault.getAbstractFileByPath(spec.filePath);
	if (existingFile) {
		await openAndFocusFile(app, existingFile);
		return { isNew: false, filePath: spec.filePath, file: existingFile };
	}

	const createdFile = await app.vault.create(spec.filePath, spec.content);
	await openAndFocusFile(app, createdFile);
	return { isNew: true, filePath: spec.filePath, file: createdFile };
}

/**
 * 映画記事（post）をタイトルから新規作成し、エディタで開く
 * @param {any} app Obsidian App インスタンス
 * @param {string} rawTitle
 * @param {Date} [date]
 */
async function executeCreatePost(app, rawTitle, date = new Date()) {
	const customTemplate = await readTemplateIfExists(app, "temp/Template post.md");
	const spec = buildPostSpec(rawTitle, date, customTemplate);

	await ensureVaultFolders(app, spec.folders);

	const existingFile = app.vault.getAbstractFileByPath(spec.filePath);
	if (existingFile) {
		await openAndFocusFile(app, existingFile);
		return { isNew: false, filePath: spec.filePath, file: existingFile };
	}

	const createdFile = await app.vault.create(spec.filePath, spec.content);
	await openAndFocusFile(app, createdFile);
	return { isNew: true, filePath: spec.filePath, file: createdFile };
}

module.exports = {
	formatJstDate,
	sanitizePostFileName,
	renderTemplateContent,
	buildNoteSpec,
	buildPostSpec,
	executeCreateNote,
	executeCreatePost,
};
