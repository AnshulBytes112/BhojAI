'use client';

import { useServiceWorker } from '../hooks/useServiceWorker';

export function ServiceWorkerProvider() {
  const { isOffline, queuedCount } = useServiceWorker();

  if (!isOffline && queuedCount === 0) {
    return null;
  }

  return (
    <div className="offline-banner">
      <span>{isOffline ? 'Offline mode: requests will be queued.' : 'Back online: syncing queued requests.'}</span>
      {queuedCount > 0 ? <span>Queued: {queuedCount}</span> : null}
    </div>
  );
}
