// Проверка результата сборки. Запускается в GitHub Actions после `npm run build`.
// Если что-то не так, сборка падает и публикация не происходит.
// Использование: node scripts/verify-build.mjs <папка_сборки> <base>
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2] ?? 'dist';
const base = process.argv[3] ?? '/';
const errors = [];
const fail = (message) => errors.push(message);
const read = (name) => readFileSync(join(dist, name), 'utf8');

if (!base.startsWith('/') || !base.endsWith('/')) fail(`base должен начинаться и заканчиваться на "/": ${base}`);

// 1. Страница и пути с учётом base
if (!existsSync(join(dist, 'index.html'))) fail('нет index.html');
else {
  const html = read('index.html');
  if (!html.includes(`src="${base}assets/`) && !html.includes(`href="${base}assets/`))
    fail(`в index.html нет путей вида ${base}assets/...: base не применился`);
}

// 2. Значки лежат в сборке
const iconFiles = ['icon-192.png', 'icon-512.png', 'icon-512-maskable.png'];
for (const name of iconFiles) if (!existsSync(join(dist, 'icons', name))) fail(`нет файла icons/${name}`);

// 3. Манифест
const manifestPath = join(dist, 'manifest.webmanifest');
if (!existsSync(manifestPath)) fail('нет manifest.webmanifest');
else {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  if (manifest.start_url !== base) fail(`start_url=${manifest.start_url}, ожидалось ${base}`);
  if (manifest.scope !== base) fail(`scope=${manifest.scope}, ожидалось ${base}`);
  const sizes = new Set();
  for (const icon of manifest.icons ?? []) {
    const rel = String(icon.src).replace(/^\.?\//, '');
    if (!existsSync(join(dist, rel))) fail(`значок из манифеста не найден в сборке: ${icon.src}`);
    sizes.add(`${icon.sizes}:${icon.purpose ?? 'any'}`);
  }
  for (const need of ['192x192:any', '512x512:any', '512x512:maskable'])
    if (!sizes.has(need)) fail(`в манифесте нет значка ${need}`);
}

// 4. Service Worker: что он кладёт в кэш для работы без сети
if (!existsSync(join(dist, 'sw.js'))) fail('нет sw.js');
else {
  const sw = read('sw.js');
  const required = ['index.html', 'manifest.webmanifest', ...iconFiles.map((n) => `icons/${n}`)];
  const assets = existsSync(join(dist, 'assets')) ? readdirSync(join(dist, 'assets')) : [];
  for (const file of assets.filter((n) => /\.(js|css)$/.test(n))) required.push(`assets/${file}`);
  if (assets.length === 0) fail('нет папки assets: сборка пустая');
  for (const item of required) if (!sw.includes(item)) fail(`sw.js не кэширует: ${item}`);
}

if (errors.length > 0) {
  console.error('ПРОВЕРКА СБОРКИ НЕ ПРОЙДЕНА:\n - ' + errors.join('\n - '));
  process.exit(1);
}
console.log(`Проверка сборки пройдена (base=${base}).`);
