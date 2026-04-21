'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sidebar,
  TopBar,
  ToastContainer,
  IconPlus,
  IconUsers,
  IconClock,
  IconX,
  type ToastItem,
} from '../../components/shared';
import { API_BASE, getStoredUser } from '../../lib/api';
import { useTableStore } from '../../stores/tableStore';

const API = API_BASE;

type Status = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';

interface Table {
  id: string;
  name: string;
  capacity: number;
  status: Status;
  posX?: number | null;
  posY?: number | null;
  area?: string | null;
  currentOrder?: {
    id: string;
    total: number;
    itemCount: number;
    createdAt: string;
    customerName?: string | null;
  };
}

interface TableFormState {
  number: string;
  label: string;
  seatCapacity: string;
  area: string;
}

const AREA_ZONES = [
  {
    name: 'MAIN_HALL',
    label: 'Main Hall',
    left: 0,
    top: 0,
    width: 62,
    height: 100,
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.26)',
  },
  {
    name: 'PATIO',
    label: 'Patio',
    left: 62,
    top: 0,
    width: 38,
    height: 55,
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.26)',
  },
  {
    name: 'VIP',
    label: 'VIP',
    left: 62,
    top: 55,
    width: 38,
    height: 45,
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.26)',
  },
] as const;

const GRID_SIZE_PERCENT = 4;

function TablesPage() {
  const router = useRouter();
  const setTablesInStore = useTableStore((state) => state.setTables);
  const setSelectedTableId = useTableStore((state) => state.setSelectedTableId);

  const [tables, setTables] = useState<Table[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | Status>('ALL');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [layoutMode, setLayoutMode] = useState<'GRID' | 'LAYOUT'>('GRID');
  const [draggingTableId, setDraggingTableId] = useState<string>('');
  const [role, setRole] = useState('WAITER');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [tableForm, setTableForm] = useState<TableFormState>({ number: '', label: '', seatCapacity: '4', area: 'MAIN_HALL' });
  const [statusDraft, setStatusDraft] = useState<Status>('AVAILABLE');
  const [pressingTableId, setPressingTableId] = useState<string>('');
  const [statusFlashTableId, setStatusFlashTableId] = useState<string>('');
  const longPressTimerRef = useRef<number | null>(null);
  const floorRef = useRef<HTMLDivElement>(null);
  const initialFetchRef = useRef<boolean>(true);

  const hapticPulse = (pattern: number | number[] = 12) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  const clearSessionAndRedirect = useCallback(() => {
    sessionStorage.removeItem('auth.token');
    sessionStorage.removeItem('auth.user');
    router.replace('/login');
  }, [router]);

  const syncTablesToStore = useCallback(
    (nextTables: Table[]) => {
      setTablesInStore(nextTables);
    },
    [setTablesInStore]
  );

  // Update clock every minute
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch tables from API
  const fetchTables = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('auth.token');
      if (!token) {
        clearSessionAndRedirect();
        return;
      }

      const res = await fetch(`${API}/tables`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        clearSessionAndRedirect();
        return;
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch tables (${res.status})`);
      }

      const data = await res.json();
      const normalized: Table[] = (Array.isArray(data) ? data : []).map((table: any) => {
        const liveOrder = Array.isArray(table.orders) ? table.orders[0] : undefined;
        const billTotal = Number(liveOrder?.bill?.totalAmount || 0);
        const itemCount = Array.isArray(liveOrder?.items)
          ? liveOrder.items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0)
          : 0;

        return {
          id: table.id,
          name: table.number || table.label || table.id.slice(0, 4),
          capacity: Number(table.seatCapacity || 0),
          status: (table.status as Status) || 'AVAILABLE',
          posX: typeof table.posX === 'number' ? table.posX : null,
          posY: typeof table.posY === 'number' ? table.posY : null,
          area: table.area || null,
          currentOrder: liveOrder
            ? {
                id: liveOrder.id,
                total: billTotal,
                itemCount,
                createdAt: liveOrder.createdAt,
                customerName: liveOrder.customerName || null,
              }
            : undefined,
        };
      });
      setTables(normalized);
      syncTablesToStore(normalized);
    } catch {
      setTables([]);
      syncTablesToStore([]);
    } finally {
      if (initialFetchRef.current) {
         setLoading(false);
         initialFetchRef.current = false;
      }
    }
  }, [clearSessionAndRedirect, syncTablesToStore]);

  useEffect(() => {
    const user = getStoredUser();
    setRole((user?.role || 'WAITER').toUpperCase());
  }, []);

  useEffect(() => {
    fetchTables();
    const interval = setInterval(fetchTables, 3000);
    return () => clearInterval(interval);
  }, [fetchTables]);

  const canManageTables = role === 'ADMIN' || role === 'MANAGER';
  const canDeleteTables = role === 'ADMIN';

  const showToast = (t: Omit<ToastItem, 'id'>) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  };

  const handleTableClick = (table: Table) => {
    setSelectedTableId(table.id);
    if (table.status === 'OCCUPIED' && table.currentOrder) {
      router.push(`/pos/order?tableId=${table.id}&orderId=${table.currentOrder.id}&tableName=${table.name}`);
    } else if (table.status === 'AVAILABLE') {
      router.push(`/pos/order?tableId=${table.id}&tableName=${table.name}`);
    } else {
      showToast({ icon: '⚠️', title: 'Table Reserved', message: `${table.name} is reserved. Check with manager.` });
    }
  };

  const startLongPress = (table: Table) => {
    if (!canManageTables) return;
    setPressingTableId(table.id);
    hapticPulse(8);
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = window.setTimeout(() => {
      setSelectedTable(table);
      setTableForm({
        number: table.name,
        label: table.name,
        seatCapacity: String(table.capacity || 4),
        area: table.area || 'MAIN_HALL',
      });
      setStatusDraft(table.status);
      setShowEditModal(true);
      hapticPulse([10, 24, 10]);
      longPressTimerRef.current = null;
    }, 550);
  };

  const cancelLongPress = () => {
    setPressingTableId('');
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const filtered = tables.filter((t) => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'ALL' || t.status === filter;
    return matchSearch && matchFilter;
  });

  const layoutTables = useMemo(() => {
    return filtered.map((table, index) => {
      if (typeof table.posX === 'number' && typeof table.posY === 'number') {
        return table;
      }
      const col = index % 6;
      const row = Math.floor(index / 6);
      return {
        ...table,
        posX: 8 + col * 15,
        posY: 12 + row * 18,
      };
    });
  }, [filtered]);

  const saveTablePosition = async (tableId: string, posX: number, posY: number) => {
    const getAreaFor = (x: number, y: number) => {
      const zone = AREA_ZONES.find(
        (z) => x >= z.left && x <= z.left + z.width && y >= z.top && y <= z.top + z.height
      );
      return zone?.name || 'MAIN_HALL';
    };

    const area = getAreaFor(posX, posY);

    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, posX, posY, area } : t)));
    try {
      const token = sessionStorage.getItem('auth.token');
      await fetch(`${API}/tables/${tableId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ posX, posY, area }),
      });
    } catch {
      showToast({ icon: '⚠️', title: 'Layout save failed', message: 'Position updated locally but failed to save.' });
    }
  };

  const handleLayoutDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!draggingTableId || !floorRef.current) return;

    const rect = floorRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * 100;
    const relY = ((e.clientY - rect.top) / rect.height) * 100;
    const snap = (value: number) => Math.round(value / GRID_SIZE_PERCENT) * GRID_SIZE_PERCENT;
    const posX = Math.min(96, Math.max(4, snap(Number(relX.toFixed(2)))));
    const posY = Math.min(92, Math.max(8, snap(Number(relY.toFixed(2)))));

    void saveTablePosition(draggingTableId, posX, posY);
    setDraggingTableId('');
    showToast({ icon: '🧭', title: 'Snapped to grid', message: `Saved at ${posX}%, ${posY}%` });
  };

  const createTable = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canManageTables || !tableForm.number.trim()) return;
    setLoading(true);
    
    const tableName = tableForm.number.trim();
    const token = localStorage.getItem('auth.token');
    
    try {
<<<<<<< HEAD
      const token = sessionStorage.getItem('auth.token');
=======
      console.log('Creating table:', { tableName, token: token ? 'Present' : 'Missing', API });
      
      const requestBody = {
        number: tableName,
        label: tableForm.label.trim() || tableName,
        seatCapacity: Number(tableForm.seatCapacity || 4),
        area: tableForm.area || 'MAIN_HALL',
      };
      
      console.log('Request payload:', requestBody);
      
>>>>>>> d581031 (first phase almost done)
      const res = await fetch(`${API}/tables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log('Response status:', res.status);
      
      const payload = await res.json().catch(() => ({}));
      console.log('Response payload:', payload);
      
      if (!res.ok) throw new Error(payload?.error || `Failed to create table (${res.status})`);
      
      // Reset form and close modal first
      setTableForm({ number: '', label: '', seatCapacity: '4', area: 'MAIN_HALL' });
      setShowCreateModal(false);
      
      // Fetch tables to show the new one immediately
      await fetchTables();
      
      // Show success toast after data is loaded
      showToast({ icon: '✅', title: 'Table created', message: `${tableName} is now available.` });
    } catch (error) {
      console.error('Create table error:', error);
      showToast({ icon: '❌', title: 'Create failed', message: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const updateTable = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTable || !canManageTables) return;
    setLoading(true);
    try {
      const token = sessionStorage.getItem('auth.token');
      const [metaRes, statusRes] = await Promise.all([
        fetch(`${API}/tables/${selectedTable.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            number: tableForm.number.trim(),
            label: tableForm.label.trim() || tableForm.number.trim(),
            seatCapacity: Number(tableForm.seatCapacity || 4),
            area: tableForm.area || 'MAIN_HALL',
          }),
        }),
        fetch(`${API}/tables/${selectedTable.id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: statusDraft }),
        }),
      ]);

      if (!metaRes.ok || !statusRes.ok) {
        const metaPayload = await metaRes.json().catch(() => ({}));
        const statusPayload = await statusRes.json().catch(() => ({}));
        throw new Error(metaPayload?.error || statusPayload?.error || 'Failed to update table');
      }

      showToast({ icon: '✅', title: 'Table updated', message: `${tableForm.number.trim()} saved successfully.` });
      setStatusFlashTableId(selectedTable.id);
      window.setTimeout(() => setStatusFlashTableId(''), 650);
      hapticPulse([12, 30, 14]);
      setShowEditModal(false);
      setSelectedTable(null);
      await fetchTables();
    } catch (error) {
      showToast({ icon: '❌', title: 'Update failed', message: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const removeTable = async () => {
    if (!selectedTable || !canDeleteTables) return;
    setLoading(true);
    try {
      const token = sessionStorage.getItem('auth.token');
      const res = await fetch(`${API}/tables/${selectedTable.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 204) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to remove table');
      }
      showToast({ icon: '🗑️', title: 'Table removed', message: `${selectedTable.name} deleted.` });
      setShowEditModal(false);
      setSelectedTable(null);
      await fetchTables();
    } catch (error) {
      showToast({ icon: '❌', title: 'Delete failed', message: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const counts = {
    total: tables.length,
    available: tables.filter((t) => t.status === 'AVAILABLE').length,
    occupied:  tables.filter((t) => t.status === 'OCCUPIED').length,
    reserved:  tables.filter((t) => t.status === 'RESERVED').length,
  };

  const totalRevenue = tables
    .filter((t) => t.currentOrder)
    .reduce((sum, t) => sum + (t.currentOrder?.total || 0), 0);

  const getElapsed = (createdAt: string) => {
    const elapsedMinutes = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60000));
    if (elapsedMinutes < 60) {
      return `${elapsedMinutes}m`;
    }

    const hours = Math.floor(elapsedMinutes / 60);
    const minutes = elapsedMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  const isLongWait = (createdAt: string) => {
    const elapsedMinutes = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60000));
    return elapsedMinutes >= 30;
  };

  return (
    <div className="pos-layout">
      <Sidebar activePath="/pos/tables" />

      <div className="pos-main">
        <TopBar
          title="Table Management"
          subtitle="Spice Garden · Floor View"
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Find table..."
          actions={
            <div className="flex gap-2">
              <button className={`chip ${layoutMode === 'GRID' ? 'active' : ''}`} onClick={() => setLayoutMode('GRID')}>
                Grid View
              </button>
              <button className={`chip ${layoutMode === 'LAYOUT' ? 'active' : ''}`} onClick={() => setLayoutMode('LAYOUT')}>
                Drag Layout
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => {
                if (!canManageTables) {
                  showToast({ icon: '⚠️', title: 'Manager/Admin only', message: 'Only managers can create tables.' });
                  return;
                }
                setShowCreateModal(true);
              }}>
                <IconPlus /> New Table
              </button>
            </div>
          }
        />

        <div className="pos-content">
          {/* Stats Row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Tables', value: counts.total, color: 'var(--on-surface)' },
              { label: 'Available', value: counts.available, color: 'var(--success)' },
              { label: 'Occupied', value: counts.occupied, color: 'var(--danger)' },
              { label: 'Reserved', value: counts.reserved, color: 'var(--warning)' },
              { label: 'Live Revenue', value: `₹${totalRevenue.toLocaleString('en-IN')}`, color: 'var(--primary)' },
            ].map((s) => (
              <div key={s.label} className="card-sm flex-1" style={{ textAlign: 'center', minWidth: 100 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color, letterSpacing: '-0.03em' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--on-surface-dim)', fontWeight: 500, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Filter Chips */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {(['ALL', 'AVAILABLE', 'OCCUPIED', 'RESERVED'] as const).map((f) => (
              <button
                key={f}
                className={`chip ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'AVAILABLE' && <span className="table-status-dot available" style={{ width: 6, height: 6 }} />}
                {f === 'OCCUPIED'  && <span className="table-status-dot occupied"  style={{ width: 6, height: 6 }} />}
                {f === 'RESERVED'  && <span className="table-status-dot reserved"  style={{ width: 6, height: 6 }} />}
                {f === 'ALL' ? `All (${counts.total})` :
                 f === 'AVAILABLE' ? `Available (${counts.available})` :
                 f === 'OCCUPIED'  ? `Occupied (${counts.occupied})` :
                 `Reserved (${counts.reserved})`}
              </button>
            ))}

            {/* Legend */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center' }}>
              {[
                { dot: 'available', label: 'Free' },
                { dot: 'occupied',  label: 'In service' },
                { dot: 'reserved',  label: 'Booked' },
              ].map((l) => (
                <div key={l.dot} className="status-legend">
                  <span className={`table-status-dot ${l.dot}`} style={{ width: 7, height: 7 }} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>

          {layoutMode === 'LAYOUT' && (
            <div
              ref={floorRef}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleLayoutDrop}
              style={{
                position: 'relative',
                minHeight: 360,
                marginBottom: 18,
                borderRadius: 'var(--radius-xl)',
                border: '1px dashed var(--outline-variant)',
                background:
                  'radial-gradient(circle at 20% 20%, rgba(62,117,255,0.08), transparent 40%), radial-gradient(circle at 80% 75%, rgba(34,197,94,0.08), transparent 45%), var(--surface-low)',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
              {AREA_ZONES.map((zone) => (
                <div
                  key={zone.name}
                  className="table-layout-zone"
                  style={{
                    left: `${zone.left}%`,
                    top: `${zone.top}%`,
                    width: `${zone.width}%`,
                    height: `${zone.height}%`,
                    background: zone.bg,
                    borderColor: zone.border,
                  }}
                >
                  <span className="table-layout-zone-label">{zone.label}</span>
                </div>
              ))}
              <div style={{ position: 'absolute', top: 10, left: 12, fontSize: 12, color: 'var(--on-surface-dim)', zIndex: 2 }}>
                Drag tables to snap-to-grid and auto-assign zone (Main Hall, Patio, VIP).
              </div>
              <div style={{ position: 'absolute', top: 10, right: 12, display: 'flex', gap: 6, zIndex: 2 }}>
                {AREA_ZONES.map((zone) => {
                  const count = layoutTables.filter((table) => (table.area || 'MAIN_HALL') === zone.name).length;
                  return (
                    <span key={zone.name} className="table-layout-chip">
                      {zone.label}: {count}
                    </span>
                  );
                })}
              </div>

              {layoutTables.map((table) => (
                <button
                  key={table.id}
                  draggable
                  onDragStart={() => setDraggingTableId(table.id)}
                  onMouseDown={() => startLongPress(table)}
                  onMouseUp={cancelLongPress}
                  onMouseLeave={cancelLongPress}
                  onTouchStart={() => startLongPress(table)}
                  onTouchEnd={cancelLongPress}
                  onClick={() => handleTableClick(table)}
                  style={{
                    position: 'absolute',
                    left: `${table.posX}%`,
                    top: `${table.posY}%`,
                    transform: 'translate(-50%, -50%)',
                    minWidth: 92,
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid var(--outline-variant)',
                    background:
                      table.status === 'AVAILABLE'
                        ? 'rgba(34,197,94,0.16)'
                        : table.status === 'OCCUPIED'
                        ? 'rgba(244,63,94,0.16)'
                        : 'rgba(245,158,11,0.16)',
                    color: 'var(--on-surface)',
                    fontSize: 12,
                    fontWeight: 700,
                    zIndex: 3,
                    cursor: 'grab',
                  }}
                >
                  <div>{table.name}</div>
                  <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--on-surface-dim)' }}>{table.capacity} seats</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-surface-muted)', marginTop: 1 }}>{(table.area || 'MAIN_HALL').replace('_', ' ')}</div>
                </button>
              ))}
            </div>
          )}

          {/* Grid */}
          {loading && initialFetchRef.current ? (
            <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--on-surface-dim)' }}>
              <img src="/placeholder-loading.svg" alt="Loading..." style={{ width: 48, height: 48, filter: 'grayscale(1)', opacity: 0.5, animation: 'spin 1s linear infinite', marginBottom: 12 }} />
              <div>Loading Tables...</div>
            </div>
          ) : filtered.length > 0 && layoutMode === 'GRID' ? (
            <div className="table-grid">
              {filtered.map((table) => (
                <div
                  key={table.id}
                  className={`table-card ${table.status.toLowerCase()} ${pressingTableId === table.id ? 'table-card-longpress' : ''} ${statusFlashTableId === table.id ? 'table-card-status-flash' : ''}`}
                  onMouseDown={() => startLongPress(table)}
                  onMouseUp={cancelLongPress}
                  onMouseLeave={cancelLongPress}
                  onTouchStart={() => startLongPress(table)}
                  onTouchEnd={cancelLongPress}
                  onClick={() => handleTableClick(table)}
                >
                  {/* Status indicator + capacity */}
                  <div className="flex items-center justify-between">
                    <span className={`table-status-dot ${table.status.toLowerCase()}`} />
                    <div className="flex items-center gap-1" style={{ color: 'var(--on-surface-dim)', fontSize: 11 }}>
                      <IconUsers style={{ width: 11, height: 11 }} />
                      {table.capacity}
                    </div>
                  </div>

                  {/* Table number */}
                  <div className="table-number">{table.name}</div>

                  {/* Status label */}
                  <div className="table-meta">
                    {table.status === 'AVAILABLE' && <span className="text-success">Available</span>}
                    {table.status === 'RESERVED'  && <span className="text-warning">Reserved</span>}
                    {table.status === 'OCCUPIED'  && <span className="text-danger">Active Order</span>}
                  </div>

                  {/* Order info */}
                  {table.currentOrder && (
                    <>
                      {table.currentOrder.customerName && (
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--on-surface)', marginTop: 4, padding: '4px 6px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 6 }}>
                          👤 {table.currentOrder.customerName}
                        </div>
                      )}
                      <div className="table-amount">
                        ₹{table.currentOrder.total.toLocaleString('en-IN')}
                        <span style={{ fontSize: 11, color: 'var(--on-surface-dim)', fontWeight: 500, marginLeft: 4 }}>
                          · {table.currentOrder.itemCount} items
                        </span>
                      </div>
                      <div className={`table-timer flex items-center gap-1 ${isLongWait(table.currentOrder.createdAt) ? 'text-danger' : ''}`}>
                        <IconClock style={{ width: 10, height: 10 }} />
                        {getElapsed(table.currentOrder.createdAt)}
                        {isLongWait(table.currentOrder.createdAt) && ' ⚠'}
                      </div>
                    </>
                  )}

                  {/* Action cue */}
                  {table.status === 'AVAILABLE' && (
                    <div style={{
                      marginTop: 10, fontSize: 11, color: 'var(--on-surface-dim)',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <IconPlus style={{ width: 10, height: 10 }} />
                      Tap to seat
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--on-surface-dim)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--on-surface)' }}>No tables found</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Try a different filter or search term</div>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create Table</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCreateModal(false)}>
                <IconX />
              </button>
            </div>
            <form className="modal-form-grid" onSubmit={createTable}>
              <div className="input-group">
                <label className="input-label">Table Number</label>
                <input
                  className="input-field"
                  value={tableForm.number}
                  onChange={(event) => setTableForm((prev) => ({ ...prev, number: event.target.value }))}
                  placeholder="T21"
                />
              </div>
              <div className="input-group">
                <label className="input-label">Display Label</label>
                <input
                  className="input-field"
                  value={tableForm.label}
                  onChange={(event) => setTableForm((prev) => ({ ...prev, label: event.target.value }))}
                  placeholder="Family Booth 1"
                />
              </div>
              <div className="input-group">
                <label className="input-label">Seats</label>
                <input
                  className="input-field"
                  type="number"
                  min="1"
                  value={tableForm.seatCapacity}
                  onChange={(event) => setTableForm((prev) => ({ ...prev, seatCapacity: event.target.value }))}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Area</label>
                <select
                  className="input-field"
                  value={tableForm.area}
                  onChange={(event) => setTableForm((prev) => ({ ...prev, area: event.target.value }))}
                >
                  {AREA_ZONES.map((zone) => (
                    <option key={zone.name} value={zone.name}>
                      {zone.label}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary btn-full span-2" type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Create Table'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedTable && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit {selectedTable.name}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowEditModal(false)}>
                <IconX />
              </button>
            </div>
            <form className="modal-form-grid" onSubmit={updateTable}>
              <div className="input-group">
                <label className="input-label">Table Number</label>
                <input
                  className="input-field"
                  value={tableForm.number}
                  onChange={(event) => setTableForm((prev) => ({ ...prev, number: event.target.value }))}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Display Label</label>
                <input
                  className="input-field"
                  value={tableForm.label}
                  onChange={(event) => setTableForm((prev) => ({ ...prev, label: event.target.value }))}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Seats</label>
                <input
                  className="input-field"
                  type="number"
                  min="1"
                  value={tableForm.seatCapacity}
                  onChange={(event) => setTableForm((prev) => ({ ...prev, seatCapacity: event.target.value }))}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Status</label>
                <select
                  className="input-field"
                  value={statusDraft}
                  onChange={(event) => {
                    setStatusDraft(event.target.value as Status);
                    hapticPulse(10);
                  }}
                >
                  <option value="AVAILABLE">AVAILABLE</option>
                  <option value="OCCUPIED">OCCUPIED</option>
                  <option value="RESERVED">RESERVED</option>
                </select>
              </div>
              <div className="input-group span-2">
                <label className="input-label">Area</label>
                <select
                  className="input-field"
                  value={tableForm.area}
                  onChange={(event) => setTableForm((prev) => ({ ...prev, area: event.target.value }))}
                >
                  {AREA_ZONES.map((zone) => (
                    <option key={zone.name} value={zone.name}>
                      {zone.label}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                className="btn btn-ghost btn-full"
                type="button"
                onClick={removeTable}
                disabled={loading || !canDeleteTables}
              >
                {canDeleteTables ? 'Delete Table (Admin)' : 'Delete (Admin only)'}
              </button>
            </form>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </div>
  );
}

export default TablesPage;
