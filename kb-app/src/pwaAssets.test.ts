import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(__dirname, '..', 'public', 'manifest.webmanifest');
const indexHtmlPath = join(__dirname, '..', 'index.html');
const viteConfigPath = join(__dirname, '..', 'vite.config.ts');

describe('PWA manifest', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

  it('has the required top-level fields', () => {
    expect(manifest.name).toBe('מסד ידע — AI Engineer');
    expect(manifest.short_name).toBe('מסד ידע');
    expect(manifest.lang).toBe('he');
    expect(manifest.dir).toBe('rtl');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.background_color).toBe('#0f1220');
    expect(manifest.theme_color).toBe('#0f1220');
  });

  it('lists three icons including exactly one maskable', () => {
    expect(manifest.icons).toHaveLength(3);
    const maskable = manifest.icons.filter((icon: { purpose?: string }) => icon.purpose === 'maskable');
    expect(maskable).toHaveLength(1);
    expect(maskable[0].sizes).toBe('512x512');
    for (const icon of manifest.icons as { src: string; type: string }[]) {
      expect(icon.src).toMatch(/^\/icons\/.+\.png$/);
      expect(icon.type).toBe('image/png');
    }
  });
});

describe('index.html PWA tags', () => {
  const html = readFileSync(indexHtmlPath, 'utf-8');

  it('links the manifest', () => {
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
  });

  it('links a favicon', () => {
    expect(html).toContain('<link rel="icon" href="/favicon.png" />');
  });

  it('declares iOS web-app-capable and apple-touch-icon', () => {
    expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="/icons/icon-192.png" />');
  });
});

describe('vite.config.ts runtime caching', () => {
  const configSource = readFileSync(viteConfigPath, 'utf-8');

  it('caches topic-content HTML with CacheFirst', () => {
    expect(configSource).toContain("cacheName: 'topic-content'");
    expect(configSource).toContain('urlPattern: /\\/topic-content\\/.+\\.html$/');
  });

  it('caches topic-assets images with CacheFirst', () => {
    expect(configSource).toContain("cacheName: 'topic-assets'");
    expect(configSource).toMatch(/topic-assets.*\.png/);
  });

  it('uses CacheFirst for both runtime caching rules', () => {
    const matches = configSource.match(/handler: 'CacheFirst'/g);
    expect(matches).toHaveLength(2);
  });
});
