import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { recordVisit, requestPersistence, type PersistState, type VisitInfo } from './probe';

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

export function App() {
  const online = useOnline();
  const [visit, setVisit] = useState<VisitInfo | null>(null);
  const [visitError, setVisitError] = useState<string | null>(null);
  const [persist, setPersist] = useState<PersistState | null>(null);

  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

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
          value={offlineReady ? 'Готов, приложение откроется без сети' : 'Ещё не готов'}
          status={offlineReady ? 'ok' : 'wait'}
          hint={
            offlineReady
              ? undefined
              : 'Кэш заполняется при первом запуске. Если не готов после минуты, перезагрузите страницу.'
          }
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
    </main>
  );
}
