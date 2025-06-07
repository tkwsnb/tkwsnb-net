// /integrations/obsidian-links.ts (依存関係ゼロの最終版)
import type { AstroIntegration } from 'astro';
import path from 'node:path';
import fs from 'node:fs';

const WIKILINK_IMAGE_REGEX = /<p>!\[\[((?:(?!\.\.).)+?\.(?:png|jpg|jpeg|webp|gif|svg))\]\]<\/p>/g;
const WIKILINK_VIDEO_REGEX = /<p>!\[\[((?:(?!\.\.).)+?\.(?:mp4|webm))\]\]<\/p>/g;

// .envファイルから手動でURLを読み込む関数
function getAssetsUrl(): string | null {
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) {
        return null;
    }
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    const urlLine = lines.find(line => line.trim().startsWith('PUBLIC_ASSETS_URL='));

    if (urlLine) {
        // "PUBLIC_ASSETS_URL=" の部分を取り除き、引用符を削除して返す
        return urlLine.split('=')[1]?.trim().replace(/^['"]|['"]$/g, '') || null;
    }
    return null;
}

export default function obsidianLinks(): AstroIntegration {
    return {
        name: 'astro-obsidian-links',
        hooks: {
            'astro:build:done': async ({ dir, pages }) => {
                const baseUrl = getAssetsUrl();

                if (!baseUrl) {
                    console.warn('Obsidian Links Integration: PUBLIC_ASSETS_URL not found in .env file. Skipping URL replacement.');
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

                    content = content.replace(WIKILINK_IMAGE_REGEX, (_match, fileName) => {
                        const altText = fileName.split('.').slice(0, -1).join('.');
                        console.log(`  - Replacing image link for: ${fileName}`);
                        changed = true;
                        return `<img src="${baseUrl}/${fileName}" alt="${altText}">`;
                    });

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