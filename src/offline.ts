// Проверка того, что приложение действительно откроется без сети.
// Смотрит на реальное состояние браузера, а не на одноразовое событие библиотеки.
// Отвечает на четыре вопроса: зарегистрирован ли Service Worker (SW), управляет ли он этой
// страницей, есть ли кэш, лежат ли в нём нужные файлы по путям с учётом base репозитория.

const TIMEOUT_MS = 5000;

export type OfflineVerdict =
  | 'ready'
  | 'unsupported'
  | 'no-worker'
  | 'wrong-scope'
  | 'not-controlling'
  | 'cache-incomplete'
  | 'error';

export interface OfflineReport {
  verdict: OfflineVerdict;
  /** Технический отчёт: его можно скопировать и прислать. */
  lines: string[];
}

function withTimeout<T>(promise: Promise<T>, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what}: нет ответа за ${TIMEOUT_MS / 1000} с`)), TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  if (registration.active) lines.push(`скрипт SW: ${registration.active.scriptURL}`);

  // 2. Управляет ли SW этой страницей
  const controller = navigator.serviceWorker.controller;
  lines.push(`controller (SW управляет страницей): ${controller ? 'да' : 'нет'}`);

  // 3. Cache Storage: какие кэши есть и сколько в них записей
  let indexCached = false;
  let bundleCached = false;
  if (!('caches' in window)) {
    lines.push('Cache Storage: недоступен');
  } else {
    const names = await withTimeout(caches.keys(), 'caches.keys');
    if (names.length === 0) lines.push('кэши: нет ни одного');
    for (const name of names) {
      const cache = await withTimeout(caches.open(name), 'caches.open');
      const keys = await withTimeout(cache.keys(), 'cache.keys');
      lines.push(`кэш "${name}": записей ${keys.length}`);
    }
    // 4. Пути: лежат ли в кэше именно те адреса, по которым работает эта страница.
    // ignoreSearch: записи с версией хранятся как index.html?__WB_REVISION__=..., это штатно.
    const indexUrl = new URL('index.html', `${location.origin}${base}`).href;
    indexCached = Boolean(await withTimeout(caches.match(indexUrl, { ignoreSearch: true }), 'caches.match'));
    bundleCached = Boolean(await withTimeout(caches.match(import.meta.url, { ignoreSearch: true }), 'caches.match'));
    lines.push(`в кэше есть ${indexUrl}: ${indexCached ? 'да' : 'нет'}`);
    lines.push(`в кэше есть исполняемый скрипт приложения (${import.meta.url}): ${bundleCached ? 'да' : 'нет'}`);
  }

  // Вердикт
  if (new URL(registration.scope).pathname !== base) {
    lines.push(`ОШИБКА: scope ${new URL(registration.scope).pathname} не равен base ${base}`);
    return { verdict: 'wrong-scope', lines };
  }
  if (!registration.active) return { verdict: 'no-worker', lines };
  if (!controller) return { verdict: 'not-controlling', lines };
  if (!indexCached || !bundleCached) return { verdict: 'cache-incomplete', lines };
  return { verdict: 'ready', lines };
