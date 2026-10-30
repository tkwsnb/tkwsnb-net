import { describe, expect, test } from "bun:test";
import {
	decodeRemotelySaveS3Config,
	getAssetContentType,
	syncMissingAssets,
	type R2StorageAdapter,
} from "./sync-assets";

describe("R2アセット同期スクリプトの検証", () => {
	test("Remotely Saveの難読化設定JSONからS3設定を復号できること", () => {
		const sampleConfig = {
			s3: {
				s3Endpoint: "https://example.r2.cloudflarestorage.com",
				s3Region: "auto",
				s3AccessKeyID: "test-key",
				s3SecretAccessKey: "test-secret",
				s3BucketName: "tkwsnb-net",
			},
		};
		const base64 = Buffer.from(JSON.stringify(sampleConfig), "utf8").toString("base64");
		const reversed = base64.split("").reverse().join("");
		const rawJson = JSON.stringify({ d: reversed });

		const parsed = decodeRemotelySaveS3Config(rawJson);
		expect(parsed).toEqual({
			endpoint: "https://example.r2.cloudflarestorage.com",
			region: "auto",
			accessKeyId: "test-key",
			secretAccessKey: "test-secret",
			bucket: "tkwsnb-net",
		});
	});

	test("拡張子から適切なContent-Typeを返すこと", () => {
		expect(getAssetContentType("image 3.png")).toBe("image/png");
		expect(getAssetContentType("photo.jpg")).toBe("image/jpeg");
		expect(getAssetContentType("photo.jpeg")).toBe("image/jpeg");
		expect(getAssetContentType("poster.webp")).toBe("image/webp");
		expect(getAssetContentType("anim.gif")).toBe("image/gif");
		expect(getAssetContentType("icon.svg")).toBe("image/svg+xml");
		expect(getAssetContentType("movie.mp4")).toBe("video/mp4");
		expect(getAssetContentType("clip.webm")).toBe("video/webm");
	});

	test("R2上に未存在のアセットのみをアップロードし、既存アセットはスキップすること", async () => {
		const uploaded: Array<{ key: string; filePath: string; contentType: string }> = [];
		const existingKeys = new Set(["assets/existing.png"]);

		const mockAdapter: R2StorageAdapter = {
			exists: async (key: string) => existingKeys.has(key),
			upload: async (key: string, filePath: string, contentType: string) => {
				uploaded.push({ key, filePath, contentType });
			},
		};

		const result = await syncMissingAssets(
			[
				{ name: "existing.png", fullPath: "/vault/assets/existing.png" },
				{ name: "image 3.png", fullPath: "/vault/assets/image 3.png" },
				{ name: "image 4.png", fullPath: "/vault/assets/image 4.png" },
			],
			mockAdapter,
		);

		expect(result.skipped).toEqual(["existing.png"]);
		expect(result.uploaded).toEqual(["image 3.png", "image 4.png"]);
		expect(uploaded).toEqual([
			{
				key: "assets/image 3.png",
				filePath: "/vault/assets/image 3.png",
				contentType: "image/png",
			},
			{
				key: "assets/image 4.png",
				filePath: "/vault/assets/image 4.png",
				contentType: "image/png",
			},
		]);
	});
});
