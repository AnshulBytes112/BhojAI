'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar, TopBar, ToastContainer, IconCheck, type ToastItem } from '../components/shared';
import { API_BASE, getStoredUser } from '../lib/api';

const API = API_BASE;

type KOTStatus = 'PENDING' | 'KITCHEN' | 'READY' | 'SERVED' | 'COMPLETED' | 'CANCELLED';

interface KOTItem {
  id: string;
  name: string;
  quantity: number;
  notes?: string;
}

interface KOT {
  id: string;
  tableId: string;
  tableName: string;
  orderNumber: string;
  type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  status: KOTStatus;
  items: KOTItem[];
  createdAt: string;
  updatedAt?: string;
}

interface InFlightStatus {
  status: KOTStatus;
  expiresAt: number;
}

type KDSRole = 'ADMIN' | 'MANAGER' | 'CHEF' | 'WAITER';

function normalizeKDSRole(role?: string | null): KDSRole {
  const value = (role || '').toUpperCase();
  if (value === 'ADMIN' || value === 'MANAGER') return value;
  if (value.includes('CHEF') || value.includes('KITCHEN')) return 'CHEF';
  if (value.includes('WAITER') || value.includes('SERVER') || value.includes('CAPTAIN') || value.includes('SERVICE')) return 'WAITER';
  return 'WAITER';
}

function getElapsed(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function isUrgent(iso: string) {
  return Date.now() - new Date(iso).getTime() > 15 * 60000;
}

const STATUS_ORDER: KOTStatus[] = ['PENDING', 'KITCHEN', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'];
const RECENT_FINISHED_MINUTES = 45;
const MAX_RECENT_FINISHED = 8;
const STATUS_STABILIZATION_MS = 10000;

function isNextWorkflowStep(current: KOTStatus, next: KOTStatus) {
  const nextFromFlow = STATUS_ORDER[STATUS_ORDER.indexOf(current) + 1];
  return nextFromFlow === next;
}

export default function KDSPage() {
  const router = useRouter();
  const [kots, setKots] = useState<KOT[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSoundOn, setIsSoundOn] = useState(true);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [expandedKotIds, setExpandedKotIds] = useState<string[]>([]);
  const [draggingKotId, setDraggingKotId] = useState('');
  const [userRole, setUserRole] = useState<KDSRole>('WAITER');
  const [orderTypeFilter, setOrderTypeFilter] = useState<'ALL' | 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'>('ALL');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const knownPendingIdsRef = useRef<Set<string>>(new Set());
  const inFlightStatusRef = useRef<Map<string, InFlightStatus>>(new Map());

  const addToast = (t: Omit<ToastItem, 'id'>) => {
    const id = Date.now().toString();
    setToasts((p) => [...p, { ...t, id }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 4000);
  };

  const toggleKotItems = useCallback((kotId: string) => {
    setExpandedKotIds((prev) => (prev.includes(kotId) ? prev.filter((id) => id !== kotId) : [...prev, kotId]));
  }, []);

  const clearSessionAndRedirect = useCallback(() => {
    sessionStorage.removeItem('auth.token');
    sessionStorage.removeItem('auth.user');
    router.replace('/login');
  }, [router]);

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

  const canTransition = useCallback(
    (current: KOTStatus, next: KOTStatus) => {
      if (!isNextWorkflowStep(current, next)) return false;

      if (userRole === 'ADMIN' || userRole === 'MANAGER') return true;

      // Waiter can only complete orders from Served section.
      if (userRole === 'WAITER') {
        return current === 'SERVED' && next === 'COMPLETED';
      }

      // Chef controls kitchen flow before service completion.
      if (userRole === 'CHEF') {
        return (
          (current === 'PENDING' && next === 'KITCHEN') ||
          (current === 'KITCHEN' && next === 'READY') ||
          (current === 'READY' && next === 'SERVED')
        );
      }

      return false;
    },
    [userRole]
  );

  const fetchKOTs = useCallback(async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('auth.token');
      if (!token) {
        clearSessionAndRedirect();
        return;
      }

      const res = await fetch(`${API}/orders`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        clearSessionAndRedirect();
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to fetch kitchen board orders');
      }

      const combined = (await res.json()) as Array<any>;

      const mapped: KOT[] = combined
        .map((order: any) => ({
          id: order.id,
          tableId: order.table?.id || '',
          tableName: order.table?.number || order.table?.label || (order.type === 'TAKEAWAY' ? '🥡 Takeaway' : order.type === 'DELIVERY' ? '🛵 Delivery' : 'Walk-in'),
          orderNumber: order.orderNumber || order.id?.slice(0, 8) || 'N/A',
          type: (order.type as KOT['type']) || 'DINE_IN',
          status: (order.status as KOTStatus) || 'PENDING',
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          items: (order.items || []).map((it: any) => ({
            id: it.id,
            name: it.menuItem?.name || 'Unknown item',
            quantity: Number(it.quantity || 0),
            notes: it.notes || undefined,
          })),
        }));

      // Keep optimistic status transitions stable while a PATCH is still in-flight.
      const now = Date.now();
      const stabilized = mapped.map((ticket) => {
        const forced = inFlightStatusRef.current.get(ticket.id);
        if (!forced) return ticket;

        // Clear in-flight override once backend reflects the target status.
        if (ticket.status === forced.status) {
          inFlightStatusRef.current.delete(ticket.id);
          return ticket;
        }

        // Keep optimistic status briefly to prevent polling bounce/flicker.
        if (forced.expiresAt > now) {
          return { ...ticket, status: forced.status };
        }

        // Expired override: trust backend payload again.
        inFlightStatusRef.current.delete(ticket.id);
        return ticket;
      });

      const incomingKitchen = new Set(stabilized.filter((k) => k.status === 'PENDING').map((k) => k.id));
      const newlyArrived = Array.from(incomingKitchen).filter((id) => !knownPendingIdsRef.current.has(id));

      if (newlyArrived.length > 0) {
        playPendingAlert();
        setHighlightedIds((prev) => Array.from(new Set([...prev, ...newlyArrived])));
        addToast({
          icon: '🆕',
          title: `${newlyArrived.length} new ticket${newlyArrived.length > 1 ? 's' : ''}`,
          message: 'Incoming pending orders added to queue.',
        });

        window.setTimeout(() => {
          setHighlightedIds((prev) => prev.filter((id) => !newlyArrived.includes(id)));
        }, 8000);
      }

      knownPendingIdsRef.current = incomingKitchen;
      setKots(stabilized);
      setLastRefreshed(new Date());
    } catch {
      addToast({ icon: '⚠️', title: 'KDS sync failed', message: 'Could not fetch latest kitchen orders.' });
    } finally {
      setLoading(false);
    }
  }, [clearSessionAndRedirect, playPendingAlert]);

  useEffect(() => {
    const user = getStoredUser();
    setUserRole(normalizeKDSRole(user?.role));

    void fetchKOTs();
    const interval = window.setInterval(() => void fetchKOTs(), 3000);
    return () => window.clearInterval(interval);
  }, [fetchKOTs]);

  const updateStatus = async (kot: KOT, nextStatus: KOTStatus) => {
    if (!canTransition(kot.status, nextStatus)) {
      addToast({ icon: '🔒', title: 'Action not allowed', message: `${userRole} cannot move ${kot.status} to ${nextStatus}.` });
      return;
    }

    inFlightStatusRef.current.set(kot.id, {
      status: nextStatus,
      expiresAt: Date.now() + STATUS_STABILIZATION_MS,
    });
    setKots((prev) => prev.map((k) => (k.id === kot.id ? { ...k, status: nextStatus } : k)));

    try {
      const token = sessionStorage.getItem('auth.token');
      if (!token) {
        clearSessionAndRedirect();
        return;
      }

      const res = await fetch(`${API}/orders/${kot.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.status === 401) {
        clearSessionAndRedirect();
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to update order status');
      }

      // Keep transition override until polling reflects backend state.
      void fetchKOTs();
    } catch {
      inFlightStatusRef.current.delete(kot.id);
      setKots((prev) => prev.map((k) => (k.id === kot.id ? { ...k, status: kot.status } : k)));
      addToast({ icon: '❌', title: 'Status update failed', message: 'Please retry.' });
    }

    if (nextStatus === 'READY') {
      addToast({ icon: '🔔', title: `${kot.tableName} is READY!`, message: `Order ${kot.orderNumber} — notify waiter` });
    }
  };

  const advanceStatus = (kot: KOT) => {
    const nextStatus = STATUS_ORDER[STATUS_ORDER.indexOf(kot.status) + 1];
    if (!nextStatus) return;
    void updateStatus(kot, nextStatus);
  };

  const stationCounts = useMemo(() => {
    const nowTs = Date.now();
    const cutoffTs = nowTs - RECENT_FINISHED_MINUTES * 60000;

    // Apply order type filter first
    const typeFiltered = orderTypeFilter === 'ALL' ? kots : kots.filter((k) => k.type === orderTypeFilter);

    const finishedSorted = typeFiltered
      .filter((k) => k.status === 'COMPLETED' || k.status === 'CANCELLED')
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime()
      );

    const keepRecentFinishedIds = new Set(
      finishedSorted
        .filter((k, index) => index < MAX_RECENT_FINISHED || new Date(k.updatedAt || k.createdAt).getTime() >= cutoffTs)
        .map((k) => k.id)
    );

    const visibleKots = typeFiltered.filter(
      (k) =>
        (k.status !== 'COMPLETED' && k.status !== 'CANCELLED') ||
        keepRecentFinishedIds.has(k.id)
    );

    const hiddenFinished = finishedSorted.filter((k) => !keepRecentFinishedIds.has(k.id));

    return {
      visibleKots,
      hiddenCompleted: hiddenFinished.filter((k) => k.status === 'COMPLETED').length,
      hiddenCancelled: hiddenFinished.filter((k) => k.status === 'CANCELLED').length,
      PENDING: visibleKots.filter((k) => k.status === 'PENDING').length,
      KITCHEN: visibleKots.filter((k) => k.status === 'KITCHEN').length,
      READY: visibleKots.filter((k) => k.status === 'READY').length,
      SERVED: visibleKots.filter((k) => k.status === 'SERVED').length,
      COMPLETED: visibleKots.filter((k) => k.status === 'COMPLETED').length,
      CANCELLED: visibleKots.filter((k) => k.status === 'CANCELLED').length,
    };
  }, [kots, orderTypeFilter]);

  const columns = [
    { status: 'PENDING' as KOTStatus, label: 'Pending', dotClass: 'prep', headerColor: 'var(--warning)' },
    { status: 'KITCHEN' as KOTStatus, label: 'Preparing', dotClass: 'prep', headerColor: 'var(--warning)' },
    { status: 'READY' as KOTStatus, label: 'Ready', dotClass: 'ready', headerColor: 'var(--success)' },
    { status: 'SERVED' as KOTStatus, label: 'Served', dotClass: 'ready', headerColor: 'var(--success)' },
    { status: 'COMPLETED' as KOTStatus, label: 'Completed', dotClass: 'ready', headerColor: 'var(--success)' },
    { status: 'CANCELLED' as KOTStatus, label: 'Cancelled', dotClass: 'ready', headerColor: 'var(--danger)' },
  ];

  const totalVisibleTickets = Math.max(stationCounts.visibleKots.length, 1);

  return (
    <div className="pos-layout">
      <Sidebar activePath="/kds" />

      <div className="pos-main">
        <TopBar
          title="Kitchen Display System"
          subtitle={`Live kitchen board · auto-updates every 3s ${loading ? '· syncing…' : '· ✓ live'}`}
          actions={
            <div className="flex gap-2" style={{ alignItems: 'center' }}>
              <select
                value={orderTypeFilter}
                onChange={(e) => setOrderTypeFilter(e.target.value as typeof orderTypeFilter)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--outline-variant)',
                  background: 'var(--surface)',
                  color: 'var(--on-surface)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="ALL">🍽️ All Orders</option>
                <option value="DINE_IN">🪑 Dine-In</option>
                <option value="TAKEAWAY">🥡 Takeaway</option>
                <option value="DELIVERY">🛵 Delivery</option>
              </select>
              <div className="topbar-chip" style={{ fontSize: 12, fontWeight: 600, background: 'var(--primary-container)', color: 'var(--on-primary-container)' }}>
                👤 {userRole}
              </div>
              <div className="topbar-chip" style={{ fontSize: 12, fontWeight: 500 }}>
                🔄 {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <button className="btn btn-sm btn-secondary" onClick={() => void fetchKOTs()} title="Refresh now">
                ↻ Refresh
              </button>
              <button className={`chip ${isSoundOn ? 'active' : ''}`} onClick={() => setIsSoundOn((v) => !v)}>
                {isSoundOn ? '🔊 Alerts On' : '🔇 Alerts Off'}
              </button>
            </div>
          }
        />

        <div style={{ flex: 1, overflow: 'hidden', padding: 16, display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <div className="topbar-chip" style={{ fontSize: 12 }}>
              Pending: {stationCounts.PENDING}
            </div>
            <div className="topbar-chip" style={{ fontSize: 12 }}>
              In Prep: {stationCounts.KITCHEN}
            </div>
            <div className="topbar-chip" style={{ fontSize: 12 }}>
              Ready: {stationCounts.READY}
            </div>
            <div className="topbar-chip" style={{ fontSize: 12 }}>
              Served: {stationCounts.SERVED}
            </div>
            <div className="topbar-chip" style={{ fontSize: 12 }}>
              Completed: {stationCounts.COMPLETED}
            </div>
            <div className="topbar-chip" style={{ fontSize: 12 }}>
              Cancelled: {stationCounts.CANCELLED}
            </div>
            {(stationCounts.hiddenCompleted > 0 || stationCounts.hiddenCancelled > 0) && (
              <div className="topbar-chip" style={{ fontSize: 12 }}>
                Older finished hidden: {stationCounts.hiddenCompleted + stationCounts.hiddenCancelled}
              </div>
            )}
            {kots.length === 0 && (
              <div className="topbar-chip" style={{ fontSize: 12 }}>No active KOT tickets</div>
            )}
          </div>

          <div className="kds-board" style={{ flex: 1, minHeight: 0 }}>
            {columns.map((col) => {
              const items = stationCounts.visibleKots.filter((k) => k.status === col.status);
              return (
                <div
                  key={col.status}
                  className="kds-column"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (!draggingKotId) return;
                    const dragged = stationCounts.visibleKots.find((k) => k.id === draggingKotId);
                    if (dragged && dragged.status !== col.status && canTransition(dragged.status, col.status)) {
                      void updateStatus(dragged, col.status);
                    } else if (dragged && dragged.status !== col.status) {
                      addToast({ icon: '🔒', title: 'Action not allowed', message: `${userRole} cannot move ${dragged.status} to ${col.status}.` });
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

                  <div style={{ padding: '8px 12px 6px 12px', borderBottom: '1px solid var(--outline-variant)' }}>
                    <div style={{ height: 6, borderRadius: 999, background: 'var(--surface-highest)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.round((items.length / totalVisibleTickets) * 100)}%`,
                          height: '100%',
                          background: col.headerColor,
                          transition: 'width 220ms ease',
                        }}
                      />
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11, color: 'var(--on-surface-dim)' }}>
                      Load: {Math.round((items.length / totalVisibleTickets) * 100)}%
                    </div>
                  </div>

                  <div className="kds-cards">
                    {items.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--on-surface-dim)' }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>
                          {col.status === 'PENDING' ? '🕒' : col.status === 'KITCHEN' ? '👨🍳' : col.status === 'CANCELLED' ? '⛔' : '✅'}
                        </div>
                        <div style={{ fontSize: 13 }}>
                          {col.status === 'PENDING'
                            ? 'No pending orders'
                            : col.status === 'KITCHEN'
                              ? 'Nothing preparing'
                              : col.status === 'READY'
                                ? 'Nothing ready yet'
                                : col.status === 'SERVED'
                                  ? 'Nothing served yet'
                                  : col.status === 'COMPLETED'
                                    ? 'Nothing completed yet'
                                    : 'Queue clear'}
                        </div>
                      </div>
                    )}

                    {items.map((kot) => {
                      const urgent = isUrgent(kot.createdAt);
                      const isNewPending = kot.status === 'PENDING' && highlightedIds.includes(kot.id);
                      const nextStatus = STATUS_ORDER[STATUS_ORDER.indexOf(kot.status) + 1];
                      const canAdvance = Boolean(nextStatus && canTransition(kot.status, nextStatus));
                      // Auto-expand for PENDING orders so kitchen sees items immediately
                      const isExpanded = expandedKotIds.includes(kot.id) || kot.status === 'PENDING';
                      const nextSectionLabel: Partial<Record<KOTStatus, string>> = {
                        PENDING: 'Kitchen',
                        KITCHEN: 'Ready',
                        READY: 'Served',
                        SERVED: 'Completed',
                      };
                      return (
                        <div key={kot.id} className={`kot-card ${isNewPending ? 'kds-new-ticket' : ''}`}>
                          <div
                            draggable={(userRole === 'ADMIN' || userRole === 'MANAGER' || userRole === 'CHEF') && kot.status !== 'COMPLETED' && kot.status !== 'CANCELLED'}
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
                                  <div style={{ fontSize: 11, color: 'var(--on-surface-dim)', display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <span>{kot.orderNumber}</span>
                                    <span style={{
                                      background: kot.type === 'DINE_IN' ? '#e8f5e9' : kot.type === 'TAKEAWAY' ? '#fff3e0' : '#e3f2fd',
                                      color: kot.type === 'DINE_IN' ? '#2e7d32' : kot.type === 'TAKEAWAY' ? '#e65100' : '#1565c0',
                                      padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                                    }}>
                                      {kot.type === 'DINE_IN' ? '🪑 Dine-In' : kot.type === 'TAKEAWAY' ? '🥡 Takeaway' : '🛵 Delivery'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'grid', justifyItems: 'end', gap: 6, minWidth: 116, alignSelf: 'flex-start' }}>
                                {kot.status === 'COMPLETED' ? (
                                  <div className="kot-done-badge">Done</div>
                                ) : (
                                  <div className={`kot-timer ${urgent ? 'urgent' : ''}`}>
                                    ⏱ {getElapsed(kot.createdAt)}
                                    {urgent && ' ⚠'}
                                  </div>
                                )}
                                {nextStatus && kot.status !== 'COMPLETED' && kot.status !== 'CANCELLED' && (
                                  <button
                                    className={`btn btn-sm ${canAdvance ? 'btn-success' : 'btn-secondary'}`}
                                    onClick={() => advanceStatus(kot)}
                                    disabled={!canAdvance}
                                    title={canAdvance ? `Move to ${nextSectionLabel[kot.status] || nextStatus}` : `${userRole} cannot move from ${kot.status}`}
                                    style={{ minWidth: 130, padding: '6px 10px' }}
                                  >
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                      <IconCheck style={{ width: 13, height: 13 }} />
                                      <span>
                                        {canAdvance
                                          ? `→ ${nextSectionLabel[kot.status] || nextStatus}`
                                          : `Locked (${userRole})`}
                                      </span>
                                    </span>
                                  </button>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              className="kot-items-toggle"
                              onClick={() => toggleKotItems(kot.id)}
                              aria-expanded={isExpanded}
                            >
                              <span style={{ fontWeight: 700 }}>{kot.items.length} item{kot.items.length === 1 ? '' : 's'} ordered</span>
                              <span style={{ color: 'var(--on-surface-dim)' }}>{isExpanded ? 'Hide items' : 'Show items'}</span>
                            </button>

                            {isExpanded && (
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
                            )}

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
