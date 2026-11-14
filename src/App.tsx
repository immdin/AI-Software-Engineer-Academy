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
