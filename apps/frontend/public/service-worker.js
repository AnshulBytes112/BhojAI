/* global self, clients, indexedDB */

const STATIC_CACHE = 'bhojai-static-v1';
const API_CACHE = 'bhojai-api-v1';
const QUEUE_DB = 'bhojai-offline-queue-db';
const QUEUE_STORE = 'requests';
const SYNC_TAG = 'offline-order-queue-sync';
const BACKOFF_BASE_MS = 2000;
const BACKOFF_MAX_MS = 5 * 60 * 1000;

const CRITICAL_ASSETS = [
  '/',
  '/login',
  '/pos/tables',
  '/pos/order',
  '/kds',
  '/analytics',
  '/promotions',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(CRITICAL_ASSETS))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
      await syncOfflineQueue();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method === 'GET' && isApiRequest(url)) {
    event.respondWith(handleApiGet(request));
    return;
  }

  if (request.method === 'POST' && isApiRequest(url)) {
    event.respondWith(handleApiPost(request));
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(syncOfflineQueue());
  }
});

self.addEventListener('message', (event) => {
  if (!event.data || typeof event.data !== 'object') {
    return;
  }

  if (event.data.type === 'SYNC_OFFLINE_QUEUE') {
    event.waitUntil(syncOfflineQueue());
  }

  if (event.data.type === 'GET_QUEUE_STATUS') {
    event.waitUntil(sendQueueStatus());
  }
});

function isApiRequest(url) {
  return url.pathname.includes('/api/');
}

async function handleApiGet(request) {
  const cache = await caches.open(API_CACHE);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    return new Response(
      JSON.stringify({ error: 'Offline and no cached response available' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function handleApiPost(request) {
  try {
    return await fetch(request);
  } catch {
    const serialized = await serializeRequest(request);
    await addToQueue(serialized);

    if (self.registration && 'sync' in self.registration) {
      try {
        await self.registration.sync.register(SYNC_TAG);
      } catch {
        // Ignore and rely on online message trigger.
      }
    }

    notifyClients({
      type: 'OFFLINE_REQUEST_QUEUED',
      endpoint: serialized.endpoint,
      id: serialized.id,
    });
    await sendQueueStatus();

    return new Response(
      JSON.stringify({
        queued: true,
        offline: true,
        message: 'Request queued for background sync',
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function serializeRequest(request) {
  const bodyText = await request.clone().text();
  const headers = {};

  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let payload = {};
  if (bodyText) {
    try {
      payload = JSON.parse(bodyText);
    } catch {
      payload = { raw: bodyText };
    }
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    endpoint: request.url,
    payload,
    timestamp: Date.now(),
    retryCount: 0,
    nextRetryAt: Date.now(),
    method: request.method,
    headers,
  };
}

function openQueueDb() {
  return new Promise((resolve, reject) => {
    const openRequest = indexedDB.open(QUEUE_DB, 1);

    openRequest.onupgradeneeded = () => {
      const db = openRequest.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
      }
    };

    openRequest.onsuccess = () => resolve(openRequest.result);
    openRequest.onerror = () => reject(openRequest.error);
  });
}

async function addToQueue(entry) {
  const db = await openQueueDb();

  await new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
}

async function getQueue() {
  const db = await openQueueDb();

  const entries = await new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readonly');
    const request = tx.objectStore(QUEUE_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });

  db.close();
  return entries;
}

async function updateQueueEntry(entry) {
  const db = await openQueueDb();

  await new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
}

async function removeQueueEntry(id) {
  const db = await openQueueDb();

  await new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
}

async function syncOfflineQueue() {
  const queue = await getQueue();
  if (!queue.length) {
    await sendQueueStatus();
    return;
  }

  const now = Date.now();

  for (const item of queue) {
    if (Number(item.nextRetryAt || 0) > now) {
      continue;
    }

    try {
      const requestInit = {
        method: item.method || 'POST',
        headers: item.headers || { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload || {}),
      };

      const response = await fetch(item.endpoint, requestInit);
      if (response.ok) {
        await removeQueueEntry(item.id);
        notifyClients({
          type: 'OFFLINE_REQUEST_SYNCED',
          endpoint: item.endpoint,
          id: item.id,
        });
      } else {
        item.retryCount = Number(item.retryCount || 0) + 1;
        item.nextRetryAt = Date.now() + getRetryDelayMs(item.retryCount);
        await updateQueueEntry(item);
      }
    } catch {
      item.retryCount = Number(item.retryCount || 0) + 1;
      item.nextRetryAt = Date.now() + getRetryDelayMs(item.retryCount);
      await updateQueueEntry(item);
    }
  }

  await sendQueueStatus();
}

function getRetryDelayMs(retryCount) {
  const power = Math.max(0, Number(retryCount || 0) - 1);
  const exponential = BACKOFF_BASE_MS * Math.pow(2, power);
  const jitter = Math.floor(Math.random() * 500);
  return Math.min(BACKOFF_MAX_MS, exponential + jitter);
}

async function sendQueueStatus() {
  const queue = await getQueue();
  notifyClients({
    type: 'QUEUE_STATUS',
    queuedCount: queue.length,
  });
}

function notifyClients(message) {
  self.clients
    .matchAll({ includeUncontrolled: true, type: 'window' })
    .then((windowClients) => {
      windowClients.forEach((client) => client.postMessage(message));
    })
    .catch(() => undefined);
}
