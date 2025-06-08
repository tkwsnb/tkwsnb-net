// /integrations/obsidian-links.ts (最終デバッグ用 - HTMLの中身をログ出力する)
import type { AstroIntegration } from 'astro';
import path from 'node:path';
import fs from 'node:fs';

// .envファイルから手動でURLを読み込む関数
function getAssetsUrl(): string | null {
    // Cloudflareの環境変数を最初に試す
    if (process.env.PUBLIC_ASSETS_URL) {
        return process.env.PUBLIC_ASSETS_URL;
    }
    // 見つからない場合、ローカルの.envファイルを試す
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return null;
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    const urlLine = lines.find(line => line.trim().startsWith('PUBLIC_ASSETS_URL='));
    if (urlLine) {
        return urlLine.split('=')[1]?.trim().replace(/^['"]|['"]$/g, '') || null;
    }
    return null;
}

const WIKILINK_IMAGE_REGEX = /<p>!\[\[((?:(?!\.\.).)+?\.(?:png|jpg|jpeg|webp|gif|svg))\]\]<\/p>/g;
const WIKILINK_VIDEO_REGEX = /<p>!\[\[((?:(?!\.\.).)+?\.(?:mp4|webm))\]\]<\/p>/g;

export default function obsidianLinks(): AstroIntegration {
    return {
        name: 'astro-obsidian-links-debug',
        hooks: {
            'astro:build:done': async ({ dir, pages }) => {
                const baseUrl = getAssetsUrl();

                if (!baseUrl) {
                    console.warn('[DEBUG] PUBLIC_ASSETS_URL not found. Skipping replacement.');
                    return;
                }

                console.log(`[DEBUG] Starting link replacement with base URL: ${baseUrl}`);
                let hasLoggedContent = false; // ログ出力を一度だけにするためのフラグ

                const builtPagePaths = pages.map(p => {
                    if (p.pathname === '') return path.join(dir.pathname, 'index.html');
                    return path.join(dir.pathname, p.pathname, 'index.html');
                }).filter(p => fs.existsSync(p));

                for (const filePath of builtPagePaths) {
                    let content = await fs.promises.readFile(filePath, 'utf-8');
                    
                    // --- ここからがデバッグ用のコード ---
                    // 変換したいページ(250607)のHTMLの中身をログに出力する
                    if (filePath.includes('250607') && !hasLoggedContent) {
                        console.log(`\n\n--- [DEBUG] HTML Content for ${path.basename(filePath)} ---`);
                        console.log(content);
                        console.log('--- [DEBUG] End of HTML Content ---\n\n');
                        hasLoggedContent = true;
                    }
                    // --- ここまでがデバッグ用のコード ---

                    let changed = false;
                    content = content.replace(WIKILINK_IMAGE_REGEX, (_match, fileName) => {
                        console.log(`[DEBUG] Found image match for: ${fileName}`);
                        changed = true;
                        return `<img src="${baseUrl}/${fileName}" alt="${fileName.split('.').slice(0, -1).join('')}">`;
                    });

                    content = content.replace(WIKILINK_VIDEO_REGEX, (_match, fileName) => {
                        console.log(`[DEBUG] Found video match for: ${fileName}`);
                        changed = true;
                        return `<video src="${baseUrl}/${fileName}" controls autoplay muted loop playsinline style="width: 100%; max-width: 100%; border-radius: 8px;"></video>`;
                    });

                    if (changed) {
                        await fs.promises.writeFile(filePath, content, 'utf-8');
                    }
                }
                console.log('[DEBUG] Link replacement process finished.');
            },
        },
    };
}