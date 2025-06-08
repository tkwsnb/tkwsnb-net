import type { AstroIntegration } from 'astro';
import path from 'node:path';
import fs from 'node:fs';

function getAssetsUrl(): string | null {
    if (process.env.PUBLIC_ASSETS_URL) {
        return process.env.PUBLIC_ASSETS_URL;
    }
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
        name: 'astro-obsidian-links',
        hooks: {
            'astro:build:done': async ({ dir, pages }) => {
                const baseUrl = getAssetsUrl();
                if (!baseUrl) return;

                const builtPagePaths = pages.map(p => {
                    if (p.pathname === '') return path.join(dir.pathname, 'index.html');
                    return path.join(dir.pathname, p.pathname, 'index.html');
                }).filter(p => fs.existsSync(p));

                for (const filePath of builtPagePaths) {
                    let content = await fs.promises.readFile(filePath, 'utf-8');
                    let changed = false;
                    content = content.replace(WIKILINK_IMAGE_REGEX, (_match, fileName) => {
                        changed = true;
                        return `<img src="${baseUrl}/${fileName}" alt="${fileName.split('.').slice(0, -1).join('')}">`;
                    });
                    content = content.replace(WIKILINK_VIDEO_REGEX, (_match, fileName) => {
                        changed = true;
                        return `<video src="${baseUrl}/${fileName}" controls autoplay muted loop playsinline style="width: 100%; max-width: 100%; border-radius: 8px;"></video>`;
                    });
                    if (changed) {
                        await fs.promises.writeFile(filePath, content, 'utf-8');
                    }
                }
            },
        },
    };
}