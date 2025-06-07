// /integrations/obsidian-links.ts (R2のURLを直接参照する版)
import type { AstroIntegration } from 'astro';
import path from 'node:path';
import fs from 'node:fs';
import { loadEnv } from 'vite';

const WIKILINK_IMAGE_REGEX = /<p>!\[\[((?:(?!\.\.).)+?\.(?:png|jpg|jpeg|webp|gif|svg))\]\]<\/p>/g;
const WIKILINK_VIDEO_REGEX = /<p>!\[\[((?:(?!\.\.).)+?\.(?:mp4|webm))\]\]<\/p>/g;

export default function obsidianLinks(): AstroIntegration {
    return {
        name: 'astro-obsidian-links',
        hooks: {
            'astro:build:done': async ({ dir, pages }) => {
                // .envファイルから環境変数を読み込む
                const env = loadEnv(process.env.NODE_ENV || 'production', process.cwd(), '');
                const baseUrl = env.PUBLIC_ASSETS_URL;

                if (!baseUrl) {
                    console.warn('Obsidian Links Integration: PUBLIC_ASSETS_URL is not set in .env file. Skipping URL replacement.');
                    return;
                }

                console.log(`Obsidian Links Integration: Processing final HTML with base URL: ${baseUrl}`);

                const builtPagePaths = pages.map(p => {
                    if (p.pathname === '') {
                        return path.join(dir.pathname, 'index.html');
                    }
                    return path.join(dir.pathname, p.pathname, 'index.html');
                }).filter(p => fs.existsSync(p));

                for (const filePath of builtPagePaths) {
                    let content = await fs.promises.readFile(filePath, 'utf-8');
                    let changed = false;

                    // 画像リンクの置換
                    content = content.replace(WIKILINK_IMAGE_REGEX, (_match, fileName) => {
                        const altText = fileName.split('.').slice(0, -1).join('.');
                        console.log(`  - Replacing image link for: ${fileName}`);
                        changed = true;
                        return `<img src="${baseUrl}/${fileName}" alt="${altText}">`;
                    });

                    // 動画リンクの置換
                    content = content.replace(WIKILINK_VIDEO_REGEX, (_match, fileName) => {
                        console.log(`  - Replacing video link for: ${fileName}`);
                        changed = true;
                        return `<video src="${baseUrl}/${fileName}" controls autoplay muted loop playsinline style="width: 100%; max-width: 100%; border-radius: 8px;"></video>`;
                    });

                    if (changed) {
                        await fs.promises.writeFile(filePath, content, 'utf-8');
                    }
                }
                console.log('Obsidian Links Integration: Done.');
            },
        },
    };
}