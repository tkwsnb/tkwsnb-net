import fs from "node:fs";
import path from "node:path";
import { S3Client } from "bun";

/**
 * R2接続設定の型定義
 */
export interface R2S3Config {
	endpoint: string;
	region: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
}

/**
 * ストレージ操作用のアダプタインターフェース
 */
export interface R2StorageAdapter {
	exists(key: string): Promise<boolean>;
	upload(key: string, filePath: string, contentType: string): Promise<void>;
}

/**
 * ローカルアセットファイルの項目
 */
export interface AssetEntry {
	name: string;
	fullPath: string;
}

/**
 * オブジェクトかどうかを判定する型ガード
 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/**
 * Remotely Save プラグインの data.json 文字列から S3(R2) 設定を復号・検証して取得する
 */
export function decodeRemotelySaveS3Config(rawJson: string): R2S3Config {
	const parsed: unknown = JSON.parse(rawJson);
	if (!isRecord(parsed) || typeof parsed.d !== "string") {
		throw new Error("Remotely Saveの設定ファイル形式が不正です");
	}

	const reversedBase64 = parsed.d.split("").reverse().join("");
	const decodedText = Buffer.from(reversedBase64, "base64").toString("utf8");
	const decodedJson: unknown = JSON.parse(decodedText);

	if (!isRecord(decodedJson) || !isRecord(decodedJson.s3)) {
		throw new Error("Remotely Save内にS3設定が見つかりません");
	}

	const s3 = decodedJson.s3;
	const endpoint = typeof s3.s3Endpoint === "string" ? s3.s3Endpoint : "";
	const region = typeof s3.s3Region === "string" && s3.s3Region ? s3.s3Region : "auto";
	const accessKeyId = typeof s3.s3AccessKeyID === "string" ? s3.s3AccessKeyID : "";
	const secretAccessKey = typeof s3.s3SecretAccessKey === "string" ? s3.s3SecretAccessKey : "";
	const bucket = typeof s3.s3BucketName === "string" ? s3.s3BucketName : "";

	if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
		throw new Error("R2への接続に必要なS3認証情報が不足しています");
	}

	return {
		endpoint,
		region,
		accessKeyId,
		secretAccessKey,
		bucket,
	};
}

/**
 * ファイル名の拡張子から Content-Type を判定する
 */
export function getAssetContentType(fileName: string): string {
	const ext = path.extname(fileName).toLowerCase();
	switch (ext) {
		case ".png":
			return "image/png";
		case ".jpg":
		case ".jpeg":
			return "image/jpeg";
		case ".webp":
			return "image/webp";
		case ".gif":
			return "image/gif";
		case ".svg":
			return "image/svg+xml";
		case ".mp4":
			return "video/mp4";
		case ".webm":
			return "video/webm";
		default:
			return "application/octet-stream";
	}
}

/**
 * ローカルのアセット一覧を走査し、R2上に存在しないファイルのみをアップロードする
 */
export async function syncMissingAssets(
	assets: AssetEntry[],
	storage: R2StorageAdapter,
): Promise<{ uploaded: string[]; skipped: string[] }> {
	const uploaded: string[] = [];
	const skipped: string[] = [];

	for (const asset of assets) {
		const key = `assets/${asset.name}`;
		const alreadyExists = await storage.exists(key);
		if (alreadyExists) {
			skipped.push(asset.name);
			continue;
		}
		const contentType = getAssetContentType(asset.name);
		await storage.upload(key, asset.fullPath, contentType);
		uploaded.push(asset.name);
	}

	return { uploaded, skipped };
}

/**
 * メイン実行処理: src/content/assets 内の未同期メディアを Cloudflare R2 へアップロードする
 */
export async function runSyncAssetsCli(projectRoot = process.cwd()): Promise<void> {
	const assetsDir = path.join(projectRoot, "src", "content", "assets");
	const configPath = path.join(
		projectRoot,
		"src",
		"content",
		".obsidian",
		"plugins",
		"remotely-save",
		"data.json",
	);

	if (!fs.existsSync(assetsDir) || !fs.existsSync(configPath)) {
		return;
	}

	const rawConfig = fs.readFileSync(configPath, "utf8");
	const s3Config = decodeRemotelySaveS3Config(rawConfig);

	const client = new S3Client({
		endpoint: s3Config.endpoint,
		region: s3Config.region,
		accessKeyId: s3Config.accessKeyId,
		secretAccessKey: s3Config.secretAccessKey,
		bucket: s3Config.bucket,
	});

	const storage: R2StorageAdapter = {
		exists: async (key: string) => client.file(key).exists(),
		upload: async (key: string, filePath: string, contentType: string) => {
			const data = await fs.promises.readFile(filePath);
			await client.write(key, data, { type: contentType });
		},
	};

	const entries = fs
		.readdirSync(assetsDir, { withFileTypes: true })
		.filter((entry) => entry.isFile() && /\.(?:png|jpg|jpeg|webp|gif|svg|mp4|webm)$/i.test(entry.name))
		.map((entry) => ({
			name: entry.name,
			fullPath: path.join(assetsDir, entry.name),
		}));

	const result = await syncMissingAssets(entries, storage);
	if (result.uploaded.length > 0) {
		console.log(`R2へアップロード完了 (${result.uploaded.length}件): ${result.uploaded.join(", ")}`);
	}
}

// スクリプトとして直接実行された場合のみCLI処理を起動する
const isDirectRun =
	typeof process !== "undefined" &&
	Array.isArray(process.argv) &&
	process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/sync-assets.ts");

if (isDirectRun) {
	await runSyncAssetsCli();
}
