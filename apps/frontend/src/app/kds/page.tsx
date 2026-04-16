'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sidebar, TopBar, ToastContainer, IconCheck, IconX, type ToastItem } from '../components/shared';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api';

type KOTStatus = 'KITCHEN' | 'READY';

interface KOTItem {
  id: string;
  name: string;
  quantity: number;
  notes?: string;
}

interface KOT {
  id: string;
  tableName: string;
  orderNumber: string;
  status: KOTStatus;
  items: KOTItem[];
  createdAt: string;
}

function getElapsed(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function isUrgent(iso: string) {
  return Date.now() - new Date(iso).getTime() > 15 * 60000;
}

const STATUS_ORDER: KOTStatus[] = ['KITCHEN', 'READY'];

export default function KDSPage() {
  const [kots, setKots] = useState<KOT[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSoundOn, setIsSoundOn] = useState(true);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [draggingKotId, setDraggingKotId] = useState('');
  const knownPendingIdsRef = useRef<Set<string>>(new Set());

  const addToast = (t: Omit<ToastItem, 'id'>) => {
    const id = Date.now().toString();
    setToasts((p) => [...p, { ...t, id }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 4000);
  };

  const playPendingAlert = useCallback(() => {
    if (!isSoundOn || typeof window === 'undefined') return;

    const audioCtx = new (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(760, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(980, audioCtx.currentTime + 0.12);
    gainNode.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.06, audioCtx.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.22);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.24);

    window.setTimeout(() => {
      void audioCtx.close();
    }, 300);
  }, [isSoundOn]);

  const fetchKOTs = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth.token');
      // Flow-aligned KDS feed: kitchen board is driven from order status.
      const [kitchenRes, readyRes] = await Promise.all([
        fetch(`${API}/orders?status=KITCHEN`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API}/orders?status=READY`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!kitchenRes.ok || !readyRes.ok) {
        throw new Error('Failed to fetch kitchen board orders');
      }

      const [kitchenOrders, readyOrders] = await Promise.all([kitchenRes.json(), readyRes.json()]);
      const combined = [...(Array.isArray(kitchenOrders) ? kitchenOrders : []), ...(Array.isArray(readyOrders) ? readyOrders : [])];

      const mapped: KOT[] = combined.map((order: any) => ({
        id: order.id,
        tableName: order.table?.number || order.table?.label || 'Walk-in',
        orderNumber: order.orderNumber || order.id?.slice(0, 8) || 'N/A',
        status: (order.status as KOTStatus) || 'KITCHEN',
        createdAt: order.createdAt,
        items: (order.items || []).map((it: any) => ({
          id: it.id,
          name: it.menuItem?.name || 'Unknown item',
          quantity: Number(it.quantity || 0),
          notes: it.notes || undefined,
        })),
      }));

      const incomingPending = new Set(mapped.filter((k) => k.status === 'KITCHEN').map((k) => k.id));
      const newlyArrived = Array.from(incomingPending).filter((id) => !knownPendingIdsRef.current.has(id));

      if (newlyArrived.length > 0) {
        playPendingAlert();
        setHighlightedIds((prev) => Array.from(new Set([...prev, ...newlyArrived])));
        addToast({
          icon: '🆕',
          title: `${newlyArrived.length} new ticket${newlyArrived.length > 1 ? 's' : ''}`,
          message: 'Incoming kitchen orders added to queue.',
        });

        window.setTimeout(() => {
          setHighlightedIds((prev) => prev.filter((id) => !newlyArrived.includes(id)));
        }, 8000);
      }

      knownPendingIdsRef.current = incomingPending;
      setKots(mapped);
    } catch {
      addToast({ icon: '⚠️', title: 'KDS sync failed', message: 'Could not fetch latest kitchen orders.' });
    } finally {
      setLoading(false);
    }
  }, [playPendingAlert]);

  useEffect(() => {
    void fetchKOTs();
    const interval = window.setInterval(() => void fetchKOTs(), 5000);
    return () => window.clearInterval(interval);
  }, [fetchKOTs]);

  const advanceStatus = async (kot: KOT) => {
    const nextStatus = STATUS_ORDER[STATUS_ORDER.indexOf(kot.status) + 1];
    if (!nextStatus) return;

    setKots((prev) => prev.map((k) => (k.id === kot.id ? { ...k, status: nextStatus } : k)));

    try {
      const token = localStorage.getItem('auth.token');
      const res = await fetch(`${API}/orders/${kot.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!res.ok) {
        throw new Error('Failed to update order status');
      }
    } catch {
      setKots((prev) => prev.map((k) => (k.id === kot.id ? { ...k, status: kot.status } : k)));
      addToast({ icon: '❌', title: 'Status update failed', message: 'Please retry.' });
    }

    if (nextStatus === 'READY') {
      addToast({ icon: '🔔', title: `${kot.tableName} is READY!`, message: `Order ${kot.orderNumber} — notify waiter` });
    }
  };

  const removeKOT = (id: string) => setKots((p) => p.filter((k) => k.id !== id));

  const stationCounts = useMemo(() => {
    return {
      KITCHEN: kots.filter((k) => k.status === 'KITCHEN').length,
      READY: kots.filter((k) => k.status === 'READY').length,
    };
  }, [kots]);

  const columns = [
    { status: 'KITCHEN' as KOTStatus, label: 'In Preparation', dotClass: 'prep', headerColor: 'var(--warning)' },
    { status: 'READY' as KOTStatus,   label: 'Completed Orders', dotClass: 'ready', headerColor: 'var(--success)' },
  ];

  return (
    <div className="pos-layout">
      <Sidebar activePath="/kds" />

      <div className="pos-main">
        <TopBar
          title="Kitchen Display System"
          subtitle={`Flow-driven board (/api/orders?status=KITCHEN) ${loading ? '· syncing...' : ''}`}
          actions={
            <div className="flex gap-2">
              <div className="topbar-chip" style={{ fontSize: 12, fontWeight: 500 }}>
                🔄 Auto-refresh 5s
              </div>
              <button className={`chip ${isSoundOn ? 'active' : ''}`} onClick={() => setIsSoundOn((v) => !v)}>
                {isSoundOn ? '🔊 Alerts On' : '🔇 Alerts Off'}
              </button>
            </div>
          }
        />

        <div style={{ flex: 1, overflow: 'hidden', padding: 16, display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <div className="topbar-chip" style={{ fontSize: 12 }}>
              In Prep: {stationCounts.KITCHEN}
            </div>
            <div className="topbar-chip" style={{ fontSize: 12 }}>
              Ready: {stationCounts.READY}
            </div>
            {kots.length === 0 && (
              <div className="topbar-chip" style={{ fontSize: 12 }}>No active KOT tickets</div>
            )}
          </div>

          <div className="kds-board" style={{ flex: 1 }}>
            {columns.map((col) => {
              const items = kots.filter((k) => k.status === col.status);
              return (
                <div
                  key={col.status}
                  className="kds-column"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (!draggingKotId || col.status !== 'READY') return;
                    const dragged = kots.find((k) => k.id === draggingKotId);
                    if (dragged && dragged.status === 'KITCHEN') {
                      void advanceStatus(dragged);
                    }
                    setDraggingKotId('');
                  }}
                >
                  <div className="kds-column-header">
                    <div className="kds-column-title">
                      <span className={`kds-dot ${col.dotClass}`} />
                      <span style={{ color: col.headerColor }}>{col.label}</span>
                    </div>
                    <span className="kds-count">{items.length}</span>
                  </div>

                  <div className="kds-cards">
                    {items.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--on-surface-dim)' }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>
                          {col.status === 'KITCHEN' ? '👨‍🍳' : '✅'}
                        </div>
                        <div style={{ fontSize: 13 }}>
                          {col.status === 'KITCHEN' ? 'Nothing cooking' : 'Queue clear'}
                        </div>
                      </div>
                    )}

                    {items.map((kot) => {
                      const urgent = isUrgent(kot.createdAt);
                      const isNewPending = kot.status === 'KITCHEN' && highlightedIds.includes(kot.id);
                      return (
                        <div key={kot.id} className={`kot-card ${isNewPending ? 'kds-new-ticket' : ''}`}>
                          <div
                            draggable={kot.status !== 'READY'}
                            onDragStart={() => setDraggingKotId(kot.id)}
                            onDragEnd={() => setDraggingKotId('')}
                          >
                          <div className="kot-card-header">
                            <div className="flex items-center gap-2">
                              <div style={{
                                width: 4, height: 32, borderRadius: 2,
                                background: urgent ? 'var(--danger)' : col.headerColor,
                                flexShrink: 0,
                              }} />
                              <div>
                                <div className="kot-table-badge">{kot.tableName}</div>
                                <div style={{ fontSize: 11, color: 'var(--on-surface-dim)' }}>{kot.orderNumber}</div>
                              </div>
                            </div>
                            <div className={`kot-timer ${urgent ? 'urgent' : ''}`}>
                              ⏱ {getElapsed(kot.createdAt)}
                              {urgent && ' ⚠'}
                            </div>
                          </div>

                          <div className="kot-items">
                            {kot.items.map((item, i) => (
                              <div key={item.id || i}>
                                <div className="kot-item-row">
                                  <span className="kot-item-qty">{item.quantity}</span>
                                  <span className="kot-item-name">{item.name}</span>
                                </div>
                                {item.notes && (
                                  <div className="kot-item-note">📝 {item.notes}</div>
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="kot-actions">
                            {kot.status !== 'READY' && (
                              <button
                                className="btn btn-success btn-sm flex-1"
                                onClick={() => advanceStatus(kot)}
                              >
                                <><IconCheck style={{ width: 13, height: 13 }} /> Mark Ready</>
                              </button>
                            )}
                            {kot.status === 'READY' && (
                              <button
                                className="btn btn-success btn-sm flex-1"
                                onClick={() => {
                                  removeKOT(kot.id);
                                  addToast({ icon: '🍽️', title: `${kot.tableName} served!`, message: 'Order completed.' });
                                }}
                              >
                                <IconCheck style={{ width: 13, height: 13 }} /> Served
                              </button>
                            )}
                            <button
                              className="btn btn-ghost btn-sm btn-icon"
                              onClick={() => removeKOT(kot.id)}
                              title="Dismiss"
                            >
                              <IconX style={{ width: 13, height: 13 }} />
                            </button>
                          </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </div>
  );
}
