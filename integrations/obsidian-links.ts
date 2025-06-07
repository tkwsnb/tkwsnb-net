// /integrations/obsidian-links.ts (修正版)
import type { AstroIntegration } from 'astro';
import path from 'node:path';
import fs from 'node:fs';

const WIKILINK_IMAGE_REGEX = /<p>!\[\[((?:(?!\.\.).)+?\.(?:png|jpg|jpeg|webp|gif|svg))\]\]<\/p>/g;
const WIKILINK_VIDEO_REGEX = /<p>!\[\[((?:(?!\.\.).)+?\.(?:mp4|webm))\]\]<\/p>/g;

export default function obsidianLinks(): AstroIntegration {
    return {
        name: 'astro-obsidian-links',
        hooks: {
            // このフックは `astro build` 時にのみ実行されます
            'astro:build:done': async ({ dir, pages }) => {
                console.log('Obsidian Links Integration: Processing final HTML...');

                const builtPagePaths = pages.map(p => {
                    const-path = path.join(dir.pathname, p.pathname, 'index.html');
                    // ルートの `index.html` (例: /) の場合、パスが `.../index/index.html` になるのを防ぐ
                    if (p.pathname === '') {
                        return path.join(dir.pathname, 'index.html');
                    }
                    return path.join(dir.pathname, p.pathname, 'index.html');
                }).filter(p => fs.existsSync(p));

                for (const filePath of builtPagePaths) {
                    let content = await fs.promises.readFile(filePath, 'utf-8');
                    let changed = false;

                    // 画像リンクの置換 (例: `![[image.png]]`)
                    content = content.replace(WIKILINK_IMAGE_REGEX, (match, fileName) => {
                        // Astroは画像を /_astro/image.HASH.ext のようにリネームして配置する
                        // しかし、元のファイル名は保持されることが多いので、ファイル名で探す
                        const altText = fileName.split('.').slice(0, -1).join('.');
                        console.log(`  - Replacing image link: ${fileName} in ${path.basename(filePath)}`);
                        changed = true;
                        // Astroの画像最適化によって生成されたパスを直接参照するのではなく、
                        // Astroが生成するであろうimgタグに変換する。
                        // AstroのrehypeUnwrapImagesのおかげで<p>タグは消えるはず。
                        // このフックでは、単純な文字列置換が最も効果的
                        return `<img src="/${fileName}" alt="${altText}">`;
                    });

                    // 動画リンクの置換 (例: `![[video.mp4]]`)
                    content = content.replace(WIKILINK_VIDEO_REGEX, (match, fileName) => {
                        console.log(`  - Replacing video link: ${fileName} in ${path.basename(filePath)}`);
                        changed = true;
                        // 動画は `public` フォルダと同じように扱われ、ルートにコピーされる
                        return `<video src="/${fileName}" controls autoplay muted loop playsinline style="width: 100%; max-width: 100%; border-radius: 8px;"></video>`;
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