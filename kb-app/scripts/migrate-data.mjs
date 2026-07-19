// kb-app/scripts/migrate-data.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashId, extractBase64Images, buildCleanTopicMeta } from './migrate-helpers.ts';
import { normalize } from '../src/lib/normalize.ts';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
const rawPath = join(root, 'data/topics.raw.json');
const modulesPath = join(root, 'data/modules.json');
const assetsDir = join(root, 'public/topic-assets');
const contentDir = join(root, 'public/topic-content');
const outDir = join(root, 'src/data');

mkdirSync(assetsDir, { recursive: true });
mkdirSync(contentDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const rawTopics = JSON.parse(readFileSync(rawPath, 'utf-8'));
const modules = JSON.parse(readFileSync(modulesPath, 'utf-8'));

const cleanTopics = [];
const searchIndex = [];
let imagesExtracted = 0;
let contentFilesWritten = 0;
const knownIds = new Set(rawTopics.map((t) => t.id));
const brokenLinks = [];

for (const raw of rawTopics) {
  const idHash = hashId(raw.id);
  const contentPath = `/topic-content/${idHash}.html`;

  const { html, images } = extractBase64Images(raw.content_html);
  for (const img of images) {
    const file = join(assetsDir, `${img.hash}.${img.ext}`);
    if (!existsSync(file)) {
      writeFileSync(file, img.buffer);
    }
    imagesExtracted += 1;
  }

  writeFileSync(join(contentDir, `${idHash}.html`), html, 'utf-8');
  contentFilesWritten += 1;

  cleanTopics.push(buildCleanTopicMeta(raw, contentPath));
  searchIndex.push({ id: raw.id, search: normalize(`${raw.title} ${raw.definition}`) });

  for (const target of raw.related_match) {
    if (target !== null && !knownIds.has(target)) {
      brokenLinks.push({ from: raw.id, to: target });
    }
  }
}

writeFileSync(join(outDir, 'topics.clean.json'), JSON.stringify(cleanTopics, null, 2));
writeFileSync(join(outDir, 'modules.json'), JSON.stringify(modules, null, 2));
writeFileSync(join(outDir, 'search-index.json'), JSON.stringify(searchIndex, null, 2));

console.log('--- Migration report ---');
console.log(`Topics processed:       ${rawTopics.length}`);
console.log(`Content files written:  ${contentFilesWritten}`);
console.log(`Images extracted:       ${imagesExtracted}`);
console.log(`Broken related_match:   ${brokenLinks.length}`);
if (brokenLinks.length > 0) {
  console.log(JSON.stringify(brokenLinks, null, 2));
}

if (brokenLinks.length > 0) {
  process.exitCode = 1;
}
