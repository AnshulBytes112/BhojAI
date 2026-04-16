'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar, TopBar, ToastContainer, type ToastItem } from '../../components/shared';
import { API_BASE, getStoredUser } from '../../lib/api';

const API = API_BASE;

interface BillHistoryItem {
  id: string;
  billNumber?: string;
  totalAmount: number;
  isPaid: boolean;
  createdAt: string;
  order?: {
    id: string;
    orderNumber?: string;
    customerName?: string | null;
    table?: { number?: string | null } | null;
  } | null;
  payments?: Array<{ id: string; amount: number; method: string }>;
  childBills?: Array<{ id: string; totalAmount: number; isPaid: boolean }>;
}

const PAGE_SIZE = 10;

export default function BillsHistoryPage() {
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [allBills, setAllBills] = useState<BillHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState('');
  const [paidOnly, setPaidOnly] = useState(true);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('WAITER');

  const addToast = (toast: Omit<ToastItem, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4200);
  };

  const fetchBills = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth.token') || '';
      const qs = new URLSearchParams();
      if (paidOnly) qs.set('isPaid', 'true');
      const res = await fetch(`${API}/bills${qs.toString() ? `?${qs.toString()}` : ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || 'Failed to load bill history');
      setAllBills(Array.isArray(data) ? data : []);
    } catch (err) {
      addToast({ icon: '❌', title: 'Bill history failed', message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const user = getStoredUser();
    const userRole = (user?.role || 'WAITER').toUpperCase();
    setRole(userRole);
    if (!(userRole === 'MANAGER' || userRole === 'ADMIN')) {
      addToast({ icon: '⚠️', title: 'Access restricted', message: 'Bill history is manager/admin only.' });
    }
  }, []);

  useEffect(() => {
    void fetchBills();
  }, [paidOnly]);

  const filteredBills = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allBills.filter((bill) => {
      const d = new Date(bill.createdAt);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateText = `${year}-${month}-${day}`;
      const dateMatch = dateFilter ? dateText === dateFilter : true;
      const searchMatch =
        !q ||
        (bill.billNumber || '').toLowerCase().includes(q) ||
        (bill.order?.orderNumber || '').toLowerCase().includes(q) ||
        (bill.order?.customerName || '').toLowerCase().includes(q) ||
        (bill.order?.table?.number || '').toLowerCase().includes(q);
      return dateMatch && searchMatch;
    });
  }, [allBills, dateFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredBills.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedBills = filteredBills.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [dateFilter, search, paidOnly]);

  const exportCsv = () => {
    const rows = filteredBills.map((bill) => {
      const paidAmount = (bill.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const due = Math.max(Number(bill.totalAmount || 0) - paidAmount, 0);
      return [
        bill.billNumber || bill.id,
        bill.order?.orderNumber || bill.order?.id || '',
        bill.order?.table?.number || '',
        bill.order?.customerName || '',
        new Date(bill.createdAt).toLocaleString('en-IN'),
        Number(bill.totalAmount || 0).toFixed(2),
        paidAmount.toFixed(2),
        due.toFixed(2),
        bill.isPaid ? 'PAID' : 'UNPAID',
        (bill.childBills || []).length > 0 ? `SPLIT_${(bill.childBills || []).length}` : 'SINGLE',
      ];
    });

    const header = ['Bill', 'Order', 'Table', 'Customer', 'CreatedAt', 'Total', 'Paid', 'Due', 'Status', 'SplitState'];
    const csv = [header, ...rows]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bill-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    addToast({ icon: '📤', title: 'CSV exported', message: `Exported ${filteredBills.length} bill rows.` });
  };

  const hasManagerAccess = role === 'MANAGER' || role === 'ADMIN';

  return (
    <div className="pos-layout">
      <Sidebar activePath="/pos/bills" />

      <div className="pos-main">
        <TopBar
          title="Bill History"
          subtitle="Manager ledger with pagination and CSV export"
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search bill/order/customer/table"
          actions={
            <div className="flex gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => router.push('/pos/order')}>
                Back to Orders
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => void fetchBills()} disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={exportCsv} disabled={filteredBills.length === 0}>
                Export CSV
              </button>
            </div>
          }
        />

        <div className="admin-shell" style={{ gap: 14 }}>
          {!hasManagerAccess && (
            <div className="admin-card">
              <div className="section-title">Access Restricted</div>
              <div className="section-subtitle">Only MANAGER or ADMIN accounts can view bill history.</div>
            </div>
          )}

          {hasManagerAccess && (
            <>
              <div className="admin-card" style={{ padding: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
                  <input className="input-field" type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
                  <button className={`btn btn-sm ${paidOnly ? 'btn-success' : 'btn-ghost'}`} onClick={() => setPaidOnly((v) => !v)}>
                    {paidOnly ? 'Paid Only' : 'All Bills'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setDateFilter(''); setSearch(''); setPaidOnly(true); }}>
                    Reset
                  </button>
                </div>
              </div>

              <div className="admin-card" style={{ padding: 14 }}>
                <div className="section-header" style={{ marginBottom: 10 }}>
                  <div>
                    <div className="section-title">Results</div>
                    <div className="section-subtitle">{filteredBills.length} bills matched · page {safePage}/{totalPages}</div>
                  </div>
                </div>

                <div className="data-table">
                  <div className="data-table-head" style={{ gridTemplateColumns: '1.4fr 1.1fr 1fr 0.9fr 0.9fr' }}>
                    <span>Bill / Order</span>
                    <span>Created</span>
                    <span>Total</span>
                    <span>Status</span>
                    <span>Split</span>
                  </div>

                  {pagedBills.map((bill) => {
                    const paidAmount = (bill.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
                    const due = Math.max(Number(bill.totalAmount || 0) - paidAmount, 0);
                    const splitCount = (bill.childBills || []).length;
                    return (
                      <div key={bill.id} className="data-table-row" style={{ gridTemplateColumns: '1.4fr 1.1fr 1fr 0.9fr 0.9fr' }}>
                        <div>
                          <div className="table-primary">{bill.billNumber || bill.id.slice(0, 8)}</div>
                          <div className="table-secondary">
                            {bill.order?.orderNumber || bill.order?.id || 'Order unavailable'}
                            {bill.order?.table?.number ? ` • Table ${bill.order.table.number}` : ''}
                            {bill.order?.customerName ? ` • ${bill.order.customerName}` : ''}
                          </div>
                        </div>
                        <div className="table-primary" style={{ fontSize: 12 }}>
                          {new Date(bill.createdAt).toLocaleString('en-IN')}
                        </div>
                        <div>
                          <div className="table-primary">₹{Number(bill.totalAmount || 0).toLocaleString('en-IN')}</div>
                          <div className="table-secondary">Due: ₹{due.toLocaleString('en-IN')}</div>
                        </div>
                        <div>
                          <span className={`badge ${bill.isPaid ? 'badge-success' : 'badge-warning'}`}>
                            {bill.isPaid ? 'PAID' : 'UNPAID'}
                          </span>
                        </div>
                        <div>
                          {splitCount > 0 ? <span className="badge badge-info">{splitCount} child</span> : <span className="badge badge-neutral">single</span>}
                        </div>
                      </div>
                    );
                  })}

                  {pagedBills.length === 0 && (
                    <div style={{ color: 'var(--on-surface-dim)', fontSize: 13, padding: '10px 2px' }}>
                      No bills found for current filters.
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <button className="btn btn-ghost btn-sm" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Previous
                  </button>
                  <div style={{ fontSize: 12, color: 'var(--on-surface-dim)' }}>
                    Page {safePage} of {totalPages}
                  </div>
                  <button className="btn btn-ghost btn-sm" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} />
    </div>
  );
}
