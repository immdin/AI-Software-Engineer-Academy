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
