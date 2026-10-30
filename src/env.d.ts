/// <reference types="astro/client" />
declare module "@pagefind/default-ui" {
	declare class PagefindUI {
		constructor(arg: unknown);
	}
}

declare module "bun" {
	export interface S3ClientOptions {
		endpoint?: string;
		region?: string;
		accessKeyId?: string;
		secretAccessKey?: string;
		bucket?: string;
	}
	export interface S3FileRef {
		exists(): Promise<boolean>;
	}
	export class S3Client {
		constructor(options: S3ClientOptions);
		file(key: string): S3FileRef;
		write(key: string, data: Uint8Array, options?: { type?: string }): Promise<number>;
	}
}
