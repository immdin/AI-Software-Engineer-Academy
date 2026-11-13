// Проверочные функции Шага 0. Они нужны только для того, чтобы убедиться:
// на вашем телефоне хранилище работает, переживает перезапуск и офлайн.
// Настоящая база данных (Dexie) появится на Шаге 1, и этот файл будет удалён.

const DB_NAME = 'academy-probe';
const STORE = 'visits';
const TIMEOUT_MS = 8000;

/** Не даёт операции висеть вечно: через TIMEOUT_MS она завершается ошибкой, и экран это покажет. */
function withTimeout<T>(promise: Promise<T>, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${what}: нет ответа за ${TIMEOUT_MS / 1000} с`)),
      TIMEOUT_MS,
    );
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
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Если IndexedDB недоступна (например, запрещена настройками), open() бросит исключение:
    // внутри Promise оно превратится в отклонённый промис, а не в «вечную загрузку».
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB: ошибка открытия'));
    request.onblocked = () => reject(new Error('IndexedDB: открытие заблокировано другой вкладкой'));
  });
}

export interface VisitInfo {
  total: number;
  lastVisit: string | null;
}

interface Visit {
  id: string;
  at: string; // время в формате ISO 8601, всегда в UTC: такие строки сравниваются как время
}

async function recordVisitUnsafe(): Promise<VisitInfo> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);

    // Оба запроса ставятся сразу, без ожидания между ними: транзакция IndexedDB
    // закрывается сама, если в ней нечего выполнять. Запросы выполняются по порядку,
    // поэтому getAll() увидит только прошлые визиты, а не новый.
    const allRequest = store.getAll();
    store.add({ id: crypto.randomUUID(), at: new Date().toISOString() } satisfies Visit);

    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB: ошибка записи'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB: запись отменена'));
    });
    await done;

    // getAll() возвращает записи в порядке ключей (случайных UUID), а не времени.
    // Поэтому последний визит ищем как максимум по полю at.
    const previous = allRequest.result as Visit[];
    let lastVisit: string | null = null;
    for (const visit of previous) {
      if (lastVisit === null || visit.at > lastVisit) lastVisit = visit.at;
    }
    return { total: previous.length + 1, lastVisit };
  } finally {
    db.close();
  }
}

/** Записывает «визит» и возвращает, сколько их накопилось (с учётом нового) и время предыдущего. */
export function recordVisit(): Promise<VisitInfo> {
  return withTimeout(recordVisitUnsafe(), 'Локальная база');
}

export type PersistState = 'granted' | 'not-granted' | 'unsupported';

async function requestPersistenceUnsafe(): Promise<PersistState> {
  if (!navigator.storage || !navigator.storage.persist) return 'unsupported';
  if (await navigator.storage.persisted()) return 'granted';
  return (await navigator.storage.persist()) ? 'granted' : 'not-granted';
}

/** Просит у браузера «постоянное хранилище»: данные не будут стёрты при нехватке места. */
export function requestPersistence(): Promise<PersistState> {
  return withTimeout(requestPersistenceUnsafe(), 'Постоянное хранилище');
}
