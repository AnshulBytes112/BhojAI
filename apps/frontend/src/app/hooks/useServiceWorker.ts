'use client';

import { useEffect, useState } from 'react';

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isOffline: boolean;
  queuedCount: number;
}

export function useServiceWorker(): ServiceWorkerState {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    isOffline: false,
    queuedCount: 0,
  });

  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator;
    setState((prev) => ({ ...prev, isSupported: supported, isOffline: !navigator.onLine }));

    if (!supported) {
      return;
    }

    let mounted = true;

    const requestQueueStatus = () => {
      if (!navigator.serviceWorker.controller) {
        return;
      }

      navigator.serviceWorker.controller.postMessage({ type: 'GET_QUEUE_STATUS' });
    };

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register('/service-worker.js');
        const readyRegistration = await navigator.serviceWorker.ready;
        readyRegistration.active?.postMessage({ type: 'GET_QUEUE_STATUS' });
        if (mounted) {
          setState((prev) => ({ ...prev, isRegistered: true }));
        }
      } catch {
        if (mounted) {
          setState((prev) => ({ ...prev, isRegistered: false }));
        }
      }
    };

    void registerServiceWorker();

    const handleOnline = () => {
      setState((prev) => ({ ...prev, isOffline: false }));
      navigator.serviceWorker.controller?.postMessage({ type: 'SYNC_OFFLINE_QUEUE' });
      requestQueueStatus();
    };

    const handleOffline = () => {
      setState((prev) => ({ ...prev, isOffline: true }));
    };

    const handleMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string } | undefined;
      if (!data?.type) return;

      if (data.type === 'OFFLINE_REQUEST_QUEUED') {
        setState((prev) => ({ ...prev, queuedCount: prev.queuedCount + 1 }));
      }

      if (data.type === 'OFFLINE_REQUEST_SYNCED') {
        setState((prev) => ({ ...prev, queuedCount: Math.max(0, prev.queuedCount - 1) }));
      }

      if (data.type === 'QUEUE_STATUS') {
        const queuedCount = Number((event.data as { queuedCount?: number }).queuedCount || 0);
        setState((prev) => ({ ...prev, queuedCount }));
      }
    };

    const handleControllerChange = () => {
      requestQueueStatus();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    navigator.serviceWorker.addEventListener('message', handleMessage);
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      mounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  return state;
}
