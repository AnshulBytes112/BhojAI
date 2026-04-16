'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  Sidebar,
  TopBar,
  ToastContainer,
  IconPlus,
  IconX,
  type ToastItem,
} from '../components/shared';
import { API_BASE, apiRequest, formatCurrency, formatNumber, getStoredUser } from '../lib/api';

interface InventoryItem {
  id: string;
  name: string;
  sku?: string | null;
  quantity: number;
  unit: string;
  minThreshold: number | null;
  costPrice: number | null;
  updatedAt?: string;
}

interface InventoryListResponse {
  items: InventoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const FALLBACK_ITEMS: InventoryItem[] = [
  { id: 's1', name: 'Paneer Blocks', sku: 'DAI-101', quantity: 4, unit: 'kg', minThreshold: 10, costPrice: 340, updatedAt: new Date().toISOString() },
  { id: 's2', name: 'Basmati Rice', sku: 'RIC-204', quantity: 12, unit: 'kg', minThreshold: 18, costPrice: 110, updatedAt: new Date().toISOString() },
  { id: 's3', name: 'Fresh Cream', sku: 'DAI-118', quantity: 16, unit: 'ltr', minThreshold: 8, costPrice: 92, updatedAt: new Date().toISOString() },
  { id: 's4', name: 'Kulfi Cups', sku: 'DES-301', quantity: 16, unit: 'pcs', minThreshold: 20, costPrice: 28, updatedAt: new Date().toISOString() },
  { id: 's5', name: 'Tandoori Roti Flour', sku: 'FLO-020', quantity: 32, unit: 'kg', minThreshold: 12, costPrice: 46, updatedAt: new Date().toISOString() },
];

const EMPTY_STOCK_FORM = {
  name: '',
  sku: '',
  quantity: '',
  unit: 'kg',
  minThreshold: '',
  costPrice: '',
};

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>(FALLBACK_ITEMS);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(FALLBACK_ITEMS.length);
  const [totalPages, setTotalPages] = useState(1);
  const [lowStockTotal, setLowStockTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [stockForm, setStockForm] = useState(EMPTY_STOCK_FORM);
  const [editForm, setEditForm] = useState(EMPTY_STOCK_FORM);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [adjustment, setAdjustment] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [role, setRole] = useState('WAITER');

  const addToast = (toast: Omit<ToastItem, 'id'>) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 4500);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadLowStockCount = async () => {
    try {
      const data = await apiRequest<InventoryListResponse | InventoryItem[]>('/inventory?lowStock=true&page=1&pageSize=1');
      if (Array.isArray(data)) {
        setLowStockTotal(data.length);
      } else {
        setLowStockTotal(Number(data.total || 0));
      }
    } catch {
      setLowStockTotal(items.filter((item) => item.minThreshold !== null && item.quantity <= item.minThreshold).length);
    }
  };

  const loadInventory = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('page', String(page));
      qs.set('pageSize', String(pageSize));
      if (lowStockOnly) qs.set('lowStock', 'true');
      if (debouncedSearch) qs.set('search', debouncedSearch);

      const data = await apiRequest<InventoryListResponse | InventoryItem[]>(`/inventory?${qs.toString()}`);

      if (Array.isArray(data)) {
        setItems(data.length ? data : FALLBACK_ITEMS);
        setTotalItems(data.length);
        setTotalPages(1);
      } else {
        setItems(Array.isArray(data.items) ? data.items : []);
        setTotalItems(Number(data.total || 0));
        setTotalPages(Math.max(1, Number(data.totalPages || 1)));
        if (page !== Number(data.page || 1)) {
          setPage(Number(data.page || 1));
        }
      }
    } catch {
      setItems(FALLBACK_ITEMS);
      setTotalItems(FALLBACK_ITEMS.length);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const user = getStoredUser();
    setRole((user?.role || 'WAITER').toUpperCase());
    void loadLowStockCount();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [lowStockOnly, debouncedSearch]);

  useEffect(() => {
    void loadInventory();
  }, [lowStockOnly, debouncedSearch, page, pageSize]);

  const canManageInventory = role === 'ADMIN' || role === 'MANAGER';
  const canDeleteInventory = role === 'ADMIN';

  const lowStockCount = lowStockOnly
    ? totalItems
    : lowStockTotal;
  const inventoryValue = items.reduce((sum, item) => sum + item.quantity * (item.costPrice || 0), 0);
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

  const exportCsv = async () => {
    try {
      const token = localStorage.getItem('auth.token') || '';
      const qs = new URLSearchParams();
      if (lowStockOnly) qs.set('lowStock', 'true');
      if (debouncedSearch) qs.set('search', debouncedSearch);
      const url = `${API_BASE}/inventory/export.csv${qs.toString() ? `?${qs.toString()}` : ''}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to export CSV');
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      addToast({ icon: '📤', title: 'CSV exported', message: `Exported ${totalItems} inventory rows.` });
    } catch (error) {
      addToast({ icon: '❌', title: 'Export failed', message: (error as Error).message });
    }
  };

  const handleCreateItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!stockForm.name.trim() || !stockForm.quantity || !stockForm.unit) return;
    setSaving(true);

    const payload = {
      name: stockForm.name.trim(),
      sku: stockForm.sku.trim() || undefined,
      quantity: Number(stockForm.quantity),
      unit: stockForm.unit,
      minThreshold: stockForm.minThreshold ? Number(stockForm.minThreshold) : undefined,
      costPrice: stockForm.costPrice ? Number(stockForm.costPrice) : undefined,
    };

    try {
      await apiRequest('/inventory', { method: 'POST', body: payload });
      await loadInventory();
      await loadLowStockCount();
      addToast({ icon: '+', title: 'Stock item created', message: 'The SKU has been added to the inventory ledger.' });
    } catch {
      setItems((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          ...payload,
          minThreshold: payload.minThreshold ?? null,
          costPrice: payload.costPrice ?? null,
        },
      ]);
      addToast({ icon: 'i', title: 'Preview item added', message: 'Saved locally because the backend could not be reached.' });
    } finally {
      setStockForm(EMPTY_STOCK_FORM);
      setShowCreateModal(false);
      setSaving(false);
    }
  };

  const openAdjustModal = (item: InventoryItem) => {
    if (!canManageInventory) {
      addToast({ icon: '⚠️', title: 'Manager/Admin only', message: 'You do not have access to stock adjustments.' });
      return;
    }
    setSelectedItem(item);
    setAdjustment('');
    setReason('');
    setShowAdjustModal(true);
  };

  const openEditModal = (item: InventoryItem) => {
    if (!canManageInventory) {
      addToast({ icon: '⚠️', title: 'Manager/Admin only', message: 'You do not have access to update stock items.' });
      return;
    }
    setSelectedItem(item);
    setEditForm({
      name: item.name,
      sku: item.sku || '',
      quantity: String(item.quantity),
      unit: item.unit,
      minThreshold: item.minThreshold === null ? '' : String(item.minThreshold),
      costPrice: item.costPrice === null ? '' : String(item.costPrice),
    });
    setShowEditModal(true);
  };

  const handleUpdateItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedItem || !canManageInventory) return;
    setSaving(true);
    const payload = {
      name: editForm.name.trim(),
      sku: editForm.sku.trim() || undefined,
      quantity: Number(editForm.quantity),
      unit: editForm.unit,
      minThreshold: editForm.minThreshold ? Number(editForm.minThreshold) : null,
      costPrice: editForm.costPrice ? Number(editForm.costPrice) : null,
    };
    try {
      await apiRequest(`/inventory/${selectedItem.id}`, { method: 'PATCH', body: payload });
      await loadInventory();
      await loadLowStockCount();
      addToast({ icon: '✅', title: 'Stock item updated', message: `${payload.name} updated successfully.` });
      setShowEditModal(false);
      setSelectedItem(null);
    } catch (error) {
      addToast({ icon: '❌', title: 'Update failed', message: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedItem || !canDeleteInventory) return;
    setSaving(true);
    try {
      await apiRequest(`/inventory/${selectedItem.id}`, { method: 'DELETE' });
      await loadInventory();
      await loadLowStockCount();
      addToast({ icon: '🗑️', title: 'Stock item removed', message: `${selectedItem.name} deleted.` });
      setShowEditModal(false);
      setSelectedItem(null);
    } catch (error) {
      addToast({ icon: '❌', title: 'Delete failed', message: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustStock = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedItem || !adjustment) return;
    setSaving(true);

    const adjustmentValue = Number(adjustment);

    try {
      await apiRequest(`/inventory/${selectedItem.id}/adjust`, {
        method: 'PATCH',
        body: { adjustment: adjustmentValue, reason: reason || 'Manual adjustment' },
      });
      await loadInventory();
      await loadLowStockCount();
      addToast({ icon: 'i', title: 'Stock adjusted', message: `${selectedItem.name} updated successfully.` });
    } catch {
      setItems((prev) =>
        prev.map((item) =>
          item.id === selectedItem.id ? { ...item, quantity: item.quantity + adjustmentValue } : item
        )
      );
      addToast({ icon: 'i', title: 'Preview adjustment applied', message: 'Updated locally because the backend could not be reached.' });
    } finally {
      setSaving(false);
      setShowAdjustModal(false);
      setSelectedItem(null);
      setAdjustment('');
      setReason('');
    }
  };

  return (
    <div className="pos-layout">
      <Sidebar activePath="/inventory" />

      <div className="pos-main">
        <TopBar
          title="Inventory Control"
          subtitle="Track par levels, cost exposure and real-time replenishment pressure"
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search SKU or ingredient..."
          actions={
            <div className="flex gap-2">
              <button className={`chip ${lowStockOnly ? 'active' : ''}`} onClick={() => setLowStockOnly((prev) => !prev)}>
                Low Stock Alert
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => void loadInventory()}>
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => void exportCsv()}>
                Export CSV
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  if (!canManageInventory) {
                    addToast({ icon: '⚠️', title: 'Manager/Admin only', message: 'Only managers can add inventory items.' });
                    return;
                  }
                  setShowCreateModal(true);
                }}
              >
                <IconPlus /> New SKU
              </button>
            </div>
          }
        />

        <div className="admin-shell">
          <div className="kpi-grid">
            <div className="kpi-card orange">
              <div className="kpi-value">{items.length}</div>
              <div className="kpi-label">Tracked SKUs</div>
            </div>
            <div className="kpi-card yellow">
              <div className="kpi-value">{lowStockCount}</div>
              <div className="kpi-label">Low Stock Alerts</div>
            </div>
            <div className="kpi-card blue">
              <div className="kpi-value">{formatNumber(totalUnits)}</div>
              <div className="kpi-label">Units On Hand</div>
            </div>
            <div className="kpi-card green">
              <div className="kpi-value">{formatCurrency(inventoryValue)}</div>
              <div className="kpi-label">Inventory Value</div>
            </div>
          </div>

          <div className="admin-grid-2">
            <div className="admin-card">
              <div className="section-header">
                <div>
                  <div className="section-title">Stock Ledger</div>
                  <div className="section-subtitle">Server-paginated inventory with quick adjust and update tools</div>
                </div>
                <div className="badge badge-info">{items.length} shown · {totalItems} total</div>
              </div>

              <div className="data-table">
                <div className="data-table-head inventory">
                  <span>Ingredient</span>
                  <span>On Hand</span>
                  <span>Value</span>
                  <span>Action</span>
                </div>

                {items.map((item) => {
                  const health = item.minThreshold ? Math.min((item.quantity / item.minThreshold) * 100, 100) : 100;
                  const low = item.minThreshold !== null && item.quantity <= item.minThreshold;

                  return (
                    <div key={item.id} className="inventory-row">
                      <div>
                        <div className="table-primary">{item.name}</div>
                        <div className="table-secondary">{item.sku || 'No SKU'} · {item.unit}</div>
                        <div className="bar-track">
                          <div className={`bar-fill ${low ? 'tone-2' : 'tone-1'}`} style={{ width: `${Math.max(10, health)}%` }} />
                        </div>
                      </div>
                      <div className="table-primary">
                        {item.quantity} {item.unit}
                        {low && <div className="table-secondary text-danger">Below threshold</div>}
                      </div>
                      <div className="table-primary">{formatCurrency(item.quantity * (item.costPrice || 0))}</div>
                      <div className="inventory-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => openAdjustModal(item)}>
                          Adjust
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(item)}>
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                })}

                {items.length === 0 && (
                  <div style={{ color: 'var(--on-surface-dim)', fontSize: 13, padding: '10px 2px' }}>
                    No inventory items found for the current filter.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Previous
                </button>
                <div style={{ fontSize: 12, color: 'var(--on-surface-dim)' }}>
                  Page {page} of {totalPages}
                </div>
                <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Next
                </button>
              </div>
            </div>

            <div className="stack-column">
              <div className="admin-card">
                <div className="section-header">
                  <div>
                    <div className="section-title">Replenishment Queue</div>
                    <div className="section-subtitle">Items closest to affecting service continuity</div>
                  </div>
                </div>
                <div className="metric-list">
                  {items
                    .filter((item) => item.minThreshold !== null)
                    .sort((a, b) => (a.quantity - (a.minThreshold || 0)) - (b.quantity - (b.minThreshold || 0)))
                    .slice(0, 4)
                    .map((item) => (
                      <div key={item.id} className="metric-row compact">
                        <div>
                          <div className="metric-label">{item.name}</div>
                          <div className="metric-caption">
                            Threshold {item.minThreshold} {item.unit}
                          </div>
                        </div>
                        <div className={item.minThreshold !== null && item.quantity <= item.minThreshold ? 'text-danger' : ''}>
                          {item.quantity} {item.unit}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="admin-card">
                <div className="section-header">
                  <div>
                    <div className="section-title">Warehouse Notes</div>
                    <div className="section-subtitle">Small process upgrades that reduce rush-hour surprises</div>
                  </div>
                </div>
                <div className="metric-list">
                  <div className="metric-row compact">
                    <div className="metric-label">Use threshold bands</div>
                    <div className="metric-caption">Set realistic par levels for high-turn items like rice, paneer and naan dough.</div>
                  </div>
                  <div className="metric-row compact">
                    <div className="metric-label">Adjust with reasons</div>
                    <div className="metric-caption">Restock, wastage and variance tags make audit trails easier later.</div>
                  </div>
                  <div className="metric-row compact">
                    <div className="metric-label">Review cost spikes weekly</div>
                    <div className="metric-caption">Rising ingredient cost usually shows up here before it shows up in margin reports.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Create Stock Item</h2>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowCreateModal(false)}>
                  <IconX />
                </button>
              </div>
              <form className="modal-form-grid" onSubmit={handleCreateItem}>
                <div className="input-group">
                  <label className="input-label">Item Name</label>
                  <input className="input-field" value={stockForm.name} onChange={(event) => setStockForm((prev) => ({ ...prev, name: event.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">SKU</label>
                  <input className="input-field" value={stockForm.sku} onChange={(event) => setStockForm((prev) => ({ ...prev, sku: event.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Quantity</label>
                  <input className="input-field" type="number" min="0" value={stockForm.quantity} onChange={(event) => setStockForm((prev) => ({ ...prev, quantity: event.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Unit</label>
                  <input className="input-field" value={stockForm.unit} onChange={(event) => setStockForm((prev) => ({ ...prev, unit: event.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Min Threshold</label>
                  <input className="input-field" type="number" min="0" value={stockForm.minThreshold} onChange={(event) => setStockForm((prev) => ({ ...prev, minThreshold: event.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Cost Price</label>
                  <input className="input-field" type="number" min="0" value={stockForm.costPrice} onChange={(event) => setStockForm((prev) => ({ ...prev, costPrice: event.target.value }))} />
                </div>
                <button className="btn btn-primary btn-full span-2" type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Create Item'}
                </button>
              </form>
            </div>
          </div>
        )}

        {showEditModal && selectedItem && (
          <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Update {selectedItem.name}</h2>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowEditModal(false)}>
                  <IconX />
                </button>
              </div>
              <form className="modal-form-grid" onSubmit={handleUpdateItem}>
                <div className="input-group">
                  <label className="input-label">Item Name</label>
                  <input className="input-field" value={editForm.name} onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">SKU</label>
                  <input className="input-field" value={editForm.sku} onChange={(event) => setEditForm((prev) => ({ ...prev, sku: event.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Quantity</label>
                  <input className="input-field" type="number" min="0" value={editForm.quantity} onChange={(event) => setEditForm((prev) => ({ ...prev, quantity: event.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Unit</label>
                  <input className="input-field" value={editForm.unit} onChange={(event) => setEditForm((prev) => ({ ...prev, unit: event.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Min Threshold</label>
                  <input className="input-field" type="number" min="0" value={editForm.minThreshold} onChange={(event) => setEditForm((prev) => ({ ...prev, minThreshold: event.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Cost Price</label>
                  <input className="input-field" type="number" min="0" value={editForm.costPrice} onChange={(event) => setEditForm((prev) => ({ ...prev, costPrice: event.target.value }))} />
                </div>
                <button className="btn btn-primary btn-full" type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Item'}
                </button>
                <button className="btn btn-ghost btn-full" type="button" onClick={handleDeleteItem} disabled={saving || !canDeleteInventory}>
                  {canDeleteInventory ? 'Delete Item (Admin)' : 'Delete (Admin only)'}
                </button>
              </form>
            </div>
          </div>
        )}

        {showAdjustModal && selectedItem && (
          <div className="modal-overlay" onClick={() => setShowAdjustModal(false)}>
            <div className="modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Adjust {selectedItem.name}</h2>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowAdjustModal(false)}>
                  <IconX />
                </button>
              </div>
              <form className="input-group" onSubmit={handleAdjustStock}>
                <label className="input-label">Adjustment</label>
                <input className="input-field" type="number" value={adjustment} onChange={(event) => setAdjustment(event.target.value)} placeholder="Use negative values for consumption or wastage" />
                <label className="input-label">Reason</label>
                <input className="input-field" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Restock, variance, wastage..." />
                <button className="btn btn-primary btn-full" type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Apply Adjustment'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} />
    </div>
  );
}
