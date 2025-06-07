// /integrations/obsidian-links.ts
import type { AstroIntegration } from 'astro';
import path from 'node:path';
import fs from 'node:fs';

const WIKILINK_IMAGE_REGEX = /<p>!\[\[([^\]]+\.(?:png|jpg|jpeg|webp|gif|svg))\]\]<\/p>/g;
const WIKILINK_VIDEO_REGEX = /<p>!\[\[([^\]]+\.(?:mp4|webm))\]\]<\/p>/g;
const ASSETS_DIR = path.resolve(process.cwd(), 'src/content/assets');

// 指定されたファイル名が src/content/assets に存在するかどうかをチェックする
function assetExists(fileName: string): boolean {
    return fs.existsSync(path.join(ASSETS_DIR, fileName));
}

export default function obsidianLinks(): AstroIntegration {
    return {
        name: 'astro-obsidian-links',
        hooks: {
            'astro:build:done': async ({ dir, routes, pages }) => {
                console.log('Obsidian Links Integration: Processing final HTML...');
                
                // ビルドされたHTMLファイルへのパスを取得
                const htmlFiles = pages
                    .map((p) => path.join(dir.pathname, p.pathname, 'index.html'))
                    .filter((p) => fs.existsSync(p));

                for (const filePath of htmlFiles) {
                    let content = await fs.promises.readFile(filePath, 'utf-8');
                    let changed = false;

                    const htmlDir = path.dirname(filePath);

                    // 画像リンクの置換
                    content = content.replace(WIKILINK_IMAGE_REGEX, (match, fileName) => {
                        if (assetExists(fileName)) {
                            // HTMLファイルからアセットへの相対パスを計算
                            const relativeAssetPath = path.relative(htmlDir, path.join(dir.pathname, '_astro', fileName));
                            const altText = fileName.split('.').slice(0, -1).join('.');
                            console.log(`  - Replacing image ${fileName} in ${path.basename(filePath)}`);
                            changed = true;
                            // Astroの画像最適化によって生成されたパスを参照する
                            return `<img src="/_astro/${path.basename(relativeAssetPath)}" alt="${altText}">`;
                        }
                        return match; // 見つからない場合は変更しない
                    });

                    // 動画リンクの置換
                    content = content.replace(WIKILINK_VIDEO_REGEX, (match, fileName) => {
                        if (assetExists(fileName)) {
                            const relativeAssetPath = path.relative(htmlDir, path.join(dir.pathname, fileName));
                             console.log(`  - Replacing video ${fileName} in ${path.basename(filePath)}`);
                            changed = true;
                            // 動画はそのままのパスでOK
                            return `<video src="/${fileName}" controls autoplay muted loop playsinline style="width: 100%; max-width: 100%; border-radius: 8px;"></video>`;
                        }
                        return match; // 見つからない場合は変更しない
                    });

                    if (changed) {
                        await fs.promises.writeFile(filePath, content);
                    }
                }
                 console.log('Obsidian Links Integration: Done.');
            },
        },
    };
}