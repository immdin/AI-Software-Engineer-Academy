import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Адрес приложения на GitHub Pages: https://<логин>.github.io/<репозиторий>/
// Поэтому все пути должны начинаться с /<репозиторий>/. Это значение задаёт
// workflow при сборке (переменная VITE_BASE). Локально, при `npm run dev`, база обычная "/".
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  define: {
    // Время сборки: по нему на телефоне видно, что пришла именно новая версия.
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      // "prompt": новая версия не заменяет текущую сама, а показывает кнопку «Обновить».
      // Для учебного приложения это важно: обновление не должно прервать тест.
      registerType: 'prompt',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'AI Software Engineer Academy',
        short_name: 'Academy',
        description: 'Личная образовательная академия: уроки, практика и тесты офлайн.',
        lang: 'ru',
        display: 'standalone',
        orientation: 'portrait',
        // Задаём явно, а не полагаемся на значения по умолчанию: приложение живёт в подпапке
        // /<репозиторий>/, и запуск с значка должен открывать именно её (base всегда с "/" на конце).
        scope: base,
        start_url: base,
        background_color: '#1e1b4b',
        theme_color: '#312e81',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Всё, что нужно приложению для работы без интернета, кладётся в кэш при установке.
        globPatterns: ['**/*.{js,css,html,png,svg,json,webmanifest}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
});
