import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { recordVisit, requestPersistence, type PersistState, type VisitInfo } from './probe';
import { checkOffline, type OfflineReport, type OfflineVerdict } from './offline';

type Status = 'ok' | 'warn' | 'wait';

function Row(props: { label: string; value: string; status: Status; hint?: string }) {
  return (
    <li className={`row row-${props.status}`}>
      <span className="dot" aria-hidden="true" />
      <div>
        <div className="label">{props.label}</div>
        <div className="value">{props.value}</div>
        {props.hint ? <div className="hint">{props.hint}</div> : null}
      </div>
    </li>
  );
}

function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

const OFFLINE_TEXT: Record<OfflineVerdict, { value: string; hint?: string; status: Status }> = {
  ready: { value: 'Готов: приложение откроется без сети', status: 'ok' },
  'not-controlling': {
    value: 'Кэш создан, но страница ещё не под управлением Service Worker',
    hint: 'Полностью закройте приложение (смахните из списка недавних) и откройте снова.',
    status: 'wait',
  },
  'cache-incomplete': {
    value: 'Service Worker работает, но нужных файлов в кэше нет',
    hint: 'Откройте технический отчёт ниже и пришлите его.',
    status: 'warn',
  },
  'no-worker': {
    value: 'Service Worker не активен',
    hint: 'Первая установка занимает несколько секунд. Если не изменится, пришлите технический отчёт.',
    status: 'warn',
  },
  'wrong-scope': {
    value: 'Service Worker зарегистрирован на другой путь',
    hint: 'Пришлите технический отчёт.',
    status: 'warn',
  },
  unsupported: { value: 'Service Worker не поддерживается', status: 'warn' },
  error: { value: 'Не удалось проверить', hint: 'Пришлите технический отчёт.', status: 'warn' },
};

/** Проверяет офлайн-готовность при запуске и повторяет её до 10 раз, пока SW устанавливается. */
function useOfflineReport(recheck: number): OfflineReport | null {
  const [report, setReport] = useState<OfflineReport | null>(null);
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;
    const run = async () => {
      try {
        const result = await checkOffline();
        if (cancelled) return;
        setReport(result);
        if (result.verdict !== 'ready' && attempts++ < 10) timer = window.setTimeout(() => void run(), 2000);
      } catch (error: unknown) {
        if (!cancelled) setReport({ verdict: 'error', lines: [String(error)] });
      }
    };
    void run();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [recheck]);
  return report;
}

export function App() {
  const online = useOnline();
  const [visit, setVisit] = useState<VisitInfo | null>(null);
  const [visitError, setVisitError] = useState<string | null>(null);
  const [persist, setPersist] = useState<PersistState | null>(null);

  // Из хука нужна только кнопка обновления. Событие offlineReady не используем: оно приходит
  // один раз при самой первой установке и не показывает состояние при следующих запусках.
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const [recheck, setRecheck] = useState(0);
  const [copied, setCopied] = useState(false);
  const offline = useOfflineReport(recheck);
  const offlineText = offline ? OFFLINE_TEXT[offline.verdict] : null;

  const copyReport = async () => {
    if (!offline) return;
    try {
      await navigator.clipboard.writeText(offline.lines.join('\n'));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const installed =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  useEffect(() => {
    recordVisit()
      .then(setVisit)
      .catch((error: unknown) => setVisitError(String(error)));
    requestPersistence()
      .then(setPersist)
      .catch(() => setPersist('unsupported'));
  }, []);

  return (
    <main className="screen">
      <header>
        <h1>AI Software Engineer Academy</h1>
        <p className="sub">Шаг 0: проверка цепочки «репозиторий → публикация → телефон»</p>
      </header>

      {needRefresh ? (
        <div className="banner" role="status">
          <span>Доступна новая версия приложения.</span>
          <button type="button" onClick={() => void updateServiceWorker(true)}>
            Обновить
          </button>
        </div>
      ) : null}

      <ul className="rows">
        <Row
          label="Сборка"
          value={new Date(__BUILD_TIME__).toLocaleString('ru-RU')}
          status="ok"
          hint="Время, когда GitHub собрал эту версию. После нового коммита оно должно измениться."
        />
        <Row
          label="Режим запуска"
          value={installed ? 'Установлено как приложение' : 'Открыто во вкладке браузера'}
          status={installed ? 'ok' : 'wait'}
          hint={installed ? undefined : 'Установите: меню браузера → «Установить приложение».'}
        />
        <Row
          label="Сеть"
          value={online ? 'Есть интернет' : 'Интернета нет'}
          status={online ? 'ok' : 'warn'}
          hint="Включите режим полёта и перезапустите приложение: страница должна открыться."
        />
        <Row
          label="Офлайн-кэш"
          value={offlineText ? offlineText.value : 'Проверяю…'}
          status={offlineText ? offlineText.status : 'wait'}
          hint={offlineText?.hint}
        />
        <Row
          label="Локальная база (IndexedDB)"
          value={
            visitError
              ? `Ошибка: ${visitError}`
              : visit
                ? `Запусков записано: ${visit.total}`
                : 'Проверяю…'
          }
          status={visitError ? 'warn' : visit ? 'ok' : 'wait'}
          hint={
            visit?.lastVisit
              ? `Предыдущий запуск: ${new Date(visit.lastVisit).toLocaleString('ru-RU')}. Счётчик должен расти после каждого перезапуска, в том числе офлайн.`
              : 'Счётчик должен расти после каждого перезапуска, в том числе офлайн.'
          }
        />
        <Row
          label="Постоянное хранилище"
          value={
            persist === null
              ? 'Проверяю…'
              : persist === 'granted'
                ? 'Разрешено браузером'
                : persist === 'not-granted'
                  ? 'Браузер пока не дал разрешение'
                  : 'Не поддерживается'
          }
          status={persist === 'granted' ? 'ok' : persist === null ? 'wait' : 'warn'}
          hint="Снижает риск, что браузер сам удалит данные. Это не отменяет резервные копии: они появятся на Шаге 3."
        />
      </ul>

      <details className="report">
        <summary>Технический отчёт офлайн-режима</summary>
        <pre>{offline ? offline.lines.join('\n') : 'Проверяю…'}</pre>
        <div className="actions">
          <button type="button" onClick={() => setRecheck((n: number) => n + 1)}>
            Проверить снова
          </button>
          <button type="button" onClick={() => void copyReport()}>
            {copied ? 'Скопировано' : 'Скопировать'}
          </button>
        </div>
      </details>
    </main>
  );
}
