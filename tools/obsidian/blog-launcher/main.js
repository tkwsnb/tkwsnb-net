const { Plugin, Notice } = require("obsidian");

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
		`title: ${safeFileName}`,
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
 * @param {any} app
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
 * @param {any} app
 * @param {string} templatePath
 */
async function readTemplateIfExists(app, templatePath) {
	const file = app.vault.getAbstractFileByPath(templatePath);
	if (file && typeof app.vault.read === "function") {
		try {
			return await app.vault.read(file);
		} catch {
			return "";
		}
	}
	return "";
}

/**
 * 対象ファイルを新しいタブで開き、エディタ末尾にフォーカスを移動する
 * @param {any} app
 * @param {any} fileObj
 */
async function openAndFocusFile(app, fileObj) {
	const leaf = app.workspace.getLeaf("tab");
	await leaf.openFile(fileObj);

	setTimeout(() => {
		const editor = app.workspace.activeEditor?.editor;
		if (editor) {
			const lastLine = Math.max(0, editor.lineCount() - 1);
			editor.setCursor({ line: lastLine, ch: 0 });
			editor.focus();
		}
	}, 50);
}

/**
 * 雑記（note）を必要に応じてフォルダごと新規作成し、エディタで開く
 * @param {any} app
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
 * @param {any} app
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

class BlogLauncherPlugin extends Plugin {
	async onload() {
		// コードブロック ```blog-launcher をインタラクティブな作成UIとして描画する
		this.registerMarkdownCodeBlockProcessor("blog-launcher", (_source, el) => {
			this.renderLauncherWidget(el);
		});
	}

	/**
	 * ノート内に note / post 作成用のボタンとフォームを描画する
	 * @param {HTMLElement} containerEl
	 */
	renderLauncherWidget(containerEl) {
		containerEl.empty();

		const wrapper = containerEl.createDiv({ cls: "tkwsnb-launcher" });

		// --- 1. 映画・ブログ記事 (post) セクション ---
		const postCard = wrapper.createDiv({ cls: "tkwsnb-launcher-card" });
		const postHeader = postCard.createDiv({ cls: "tkwsnb-launcher-header" });
		postHeader.createEl("h3", {
			cls: "tkwsnb-launcher-title",
			text: "🎬 映画記事（post）を書く",
		});
		postHeader.createEl("span", {
			cls: "tkwsnb-launcher-path",
			text: "post/{タイトル}.md",
		});

		postCard.createEl("p", {
			cls: "tkwsnb-launcher-desc",
			text: "タイトルを入力して Enter キー（または作成ボタン）を押すと、フロントマター付きで即座に作成して開きます。",
		});

		const postRow = postCard.createDiv({ cls: "tkwsnb-launcher-row" });
		const titleInput = postRow.createEl("input", {
			cls: "tkwsnb-launcher-input",
			attr: {
				type: "text",
				placeholder: "映画タイトルを入力（例: 爆弾(2025)）",
			},
		});

		const postBtn = postRow.createEl("button", {
			cls: "tkwsnb-launcher-btn",
			text: "post を作成",
			attr: { type: "button" },
		});

		const handleCreatePost = async () => {
			const rawTitle = titleInput.value.trim();
			if (!rawTitle) {
				new Notice("映画タイトルを入力してください");
				titleInput.focus();
				return;
			}
			try {
				const result = await executeCreatePost(this.app, rawTitle, new Date());
				titleInput.value = "";
				if (result.isNew) {
					new Notice(`新規作成しました: ${result.filePath}`);
				} else {
					new Notice(`既存の記事を開きました: ${result.filePath}`);
				}
			} catch (err) {
				console.error(err);
				new Notice(`エラーが発生しました: ${err.message || err}`);
			}
		};

		// 日本語IME変換確定のEnterでは発火させず、確定後のEnterでのみ作成する
		titleInput.addEventListener("keydown", async (e) => {
			if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) {
				e.preventDefault();
				e.stopPropagation();
				await handleCreatePost();
			}
		});

		postBtn.addEventListener("click", async () => {
			await handleCreatePost();
		});

		// --- 2. 雑記 (note) セクション ---
		const noteSpec = buildNoteSpec(new Date());
		const noteCard = wrapper.createDiv({ cls: "tkwsnb-launcher-card" });
		const noteHeader = noteCard.createDiv({ cls: "tkwsnb-launcher-header" });
		noteHeader.createEl("h3", {
			cls: "tkwsnb-launcher-title",
			text: "📝 雑記（note）を書く",
		});
		const notePathBadge = noteHeader.createEl("span", {
			cls: "tkwsnb-launcher-path",
			text: noteSpec.filePath,
		});

		noteCard.createEl("p", {
			cls: "tkwsnb-launcher-desc",
			text: "今日の日付のフォルダ（note/YY/MM）とノートを自動作成して開きます（既に存在する場合はそのまま開きます）。",
		});

		const noteBtn = noteCard.createEl("button", {
			cls: "tkwsnb-launcher-btn tkwsnb-launcher-btn-full",
			text: "今日の note を作成して開く",
			attr: { type: "button" },
		});

		noteBtn.addEventListener("click", async () => {
			try {
				const now = new Date();
				const currentSpec = buildNoteSpec(now);
				notePathBadge.textContent = currentSpec.filePath;

				const result = await executeCreateNote(this.app, now);
				if (result.isNew) {
					new Notice(`新規作成しました: ${result.filePath}`);
				} else {
					new Notice(`既存のノートを開きました: ${result.filePath}`);
				}
			} catch (err) {
				console.error(err);
				new Notice(`エラーが発生しました: ${err.message || err}`);
			}
		});
	}
}

module.exports = BlogLauncherPlugin;
