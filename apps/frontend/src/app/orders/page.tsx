'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconCard,
  IconCheck,
  IconSearch,
  IconX,
  Sidebar,
  TopBar,
  ToastContainer,
  type ToastItem,
} from '../components/shared';
import { API_BASE, getStoredUser, apiRequest } from '../lib/api';

const API = API_BASE;

interface Order {
  id: string;
  orderNumber?: string;
  status: string;
  type: string;
  customerName?: string | null;
  createdAt: string;
  table?: { id: string; number: string; label?: string | null } | null;
  items: Array<{ 
    id: string; 
    quantity: number; 
    priceAtOrder?: number;
    modifierTotal?: number;
    menuItem?: { name?: string | null; dietaryLabel?: string | null } | null 
  }>;
  bill?: {
    id: string;
    subTotal?: number;
    taxAmount?: number;
    discountAmount?: number;
    serviceCharge?: number;
    roundOff?: number;
    totalAmount: number;
    isPaid?: boolean;
    payments?: Array<{ id: string; amount: number; method: string }>;
  } | null;
  notes?: string | null;
  customerPhone?: string | null;
  guestCount?: number | null;
}

const ORDER_STATUSES = ['PENDING', 'KITCHEN', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'] as const;
const ORDER_TYPES = ['DINE_IN', 'TAKEAWAY', 'DELIVERY'] as const;

const STATUS_COLORS = {
  PENDING: '#f59e0b',
  KITCHEN: '#3b82f6', 
  READY: '#10b981',
  SERVED: '#8b5cf6',
  COMPLETED: '#22c55e',
  CANCELLED: '#ef4444'
};

const TYPE_COLORS = {
  DINE_IN: '#22c55e',
  TAKEAWAY: '#f59e0b',
  DELIVERY: '#3b82f6'
};

export default function OrdersPage() {
  const router = useRouter();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [userRole, setUserRole] = useState('WAITER');

  useEffect(() => {
    const user = getStoredUser();
    setUserRole((user?.role || 'WAITER').toUpperCase());
  }, []);

  const addToast = (toast: Omit<ToastItem, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4200);
  };

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth.token') || '' : '';

  const callApi = async (path: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers || {});
    if (!headers.has('Content-Type') && init?.body) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const res = await fetch(`${API}${path}`, { ...init, headers });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status === 401 && typeof window !== 'undefined') {
        localStorage.removeItem('auth.token');
        localStorage.removeItem('auth.user');
        if (window.location.pathname !== '/login') {
          window.location.assign('/login');
        }
      }
      const message = data?.error || data?.message || `Request failed (${res.status})`;
      throw new Error(message);
    }
    return data;
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (statusFilter) qs.set('status', statusFilter);
      if (typeFilter) qs.set('type', typeFilter);
      if (dateFilter) qs.set('date', dateFilter);
      
      const data = await callApi(`/orders${qs.toString() ? `?${qs.toString()}` : ''}`);
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      addToast({ icon: ' ', title: 'Failed to load orders', message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter, typeFilter, dateFilter]);

  const filteredOrders = useMemo(() => {
    let filtered = orders;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(order => 
        order.orderNumber?.toLowerCase().includes(term) ||
        order.customerName?.toLowerCase().includes(term) ||
        order.table?.number?.toLowerCase().includes(term) ||
        order.items.some(item => item.menuItem?.name?.toLowerCase().includes(term))
      );
    }
    
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, searchTerm]);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await callApi(`/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      addToast({ icon: ' ', title: 'Status updated', message: 'Order status updated successfully' });
      loadOrders();
    } catch (err) {
      addToast({ icon: ' ', title: 'Failed to update status', message: (err as Error).message });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateOrderTotal = (order: Order) => {
    return order.items.reduce((total, item) => {
      const itemTotal = (item.priceAtOrder || 0) * item.quantity + (item.modifierTotal || 0);
      return total + itemTotal;
    }, 0);
  };

  const openOrderDetail = (order: Order) => {
    setSelectedOrder(order);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="pos-layout">
      <Sidebar activePath="/orders" />
      
      <div className="pos-main">
        <TopBar
          title="Orders Management"
          subtitle="View and manage all restaurant orders"
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div className="topbar-search">
                <IconSearch />
                <input placeholder="Search orders..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => router.push('/pos/order')}>
                + New Order
              </button>
            </div>
          }
        />

        <div style={{ padding: 24 }}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            <select 
              className="input-field" 
              style={{ width: 160 }} 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              {ORDER_STATUSES.map(status => (
                <option key={status} value={status}>
                  {status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' ')}
                </option>
              ))}
            </select>
            
            <select 
              className="input-field" 
              style={{ width: 140 }} 
              value={typeFilter} 
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All Types</option>
              {ORDER_TYPES.map(type => (
                <option key={type} value={type}>
                  {type.replace('_', ' ').charAt(0) + type.replace('_', ' ').slice(1).toLowerCase()}
                </option>
              ))}
            </select>
            
            <input 
              className="input-field" 
              style={{ width: 160 }} 
              type="date" 
              value={dateFilter} 
              onChange={(e) => setDateFilter(e.target.value)} 
            />
            
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => {
                setStatusFilter('');
                setTypeFilter('');
                setDateFilter('');
                setSearchTerm('');
              }}
            >
              Clear Filters
            </button>
          </div>

          {/* Orders Grid */}
          <div style={{ display: 'grid', gap: 16 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--on-surface-dim)' }}>
                Loading orders...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--on-surface-dim)' }}>
                No orders found
              </div>
            ) : (
              filteredOrders.map(order => {
                const total = calculateOrderTotal(order);
                const finalTotal = order.bill?.totalAmount || total;
                
                return (
                  <div 
                    key={order.id} 
                    className="order-card"
                    style={{
                      border: '1px solid var(--outline-variant)',
                      borderRadius: 12,
                      padding: 16,
                      backgroundColor: 'var(--surface-container-low)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => openOrderDetail(order)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--surface-container)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--surface-container-low)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ 
                          width: 8, 
                          height: 8, 
                          borderRadius: '50%', 
                          backgroundColor: STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] 
                        }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 16 }}>
                            #{order.orderNumber || order.id.slice(0, 8)}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--on-surface-dim)' }}>
                            {formatDateTime(order.createdAt)}
                          </div>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span 
                          style={{ 
                            padding: '4px 8px', 
                            borderRadius: 12, 
                            fontSize: 11, 
                            fontWeight: 600,
                            backgroundColor: `${TYPE_COLORS[order.type as keyof typeof TYPE_COLORS]}20`,
                            color: TYPE_COLORS[order.type as keyof typeof TYPE_COLORS]
                          }}
                        >
                          {order.type.replace('_', ' ')}
                        </span>
                        <span 
                          style={{ 
                            padding: '4px 8px', 
                            borderRadius: 12, 
                            fontSize: 11, 
                            fontWeight: 600,
                            backgroundColor: `${STATUS_COLORS[order.status as keyof typeof STATUS_COLORS]}20`,
                            color: STATUS_COLORS[order.status as keyof typeof STATUS_COLORS]
                          }}
                        >
                          {order.status.charAt(0) + order.status.slice(1).toLowerCase().replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--on-surface-variant)' }}>
                        {order.table && (
                          <span>Table {order.table.number}</span>
                        )}
                        {order.customerName && (
                          <span>{order.customerName}</span>
                        )}
                        <span>{order.items.length} items</span>
                      </div>
                      
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600, fontSize: 16 }}>
                          {formatCurrency(finalTotal)}
                        </div>
                        {order.bill?.isPaid && (
                          <div style={{ fontSize: 11, color: 'var(--success)' }}>
                            Paid
                          </div>
                        )}
                      </div>
                    </div>

                    {order.items.length > 0 && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--outline-variant)' }}>
                        <div style={{ fontSize: 12, color: 'var(--on-surface-dim)', marginBottom: 4 }}>
                          Items:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {order.items.slice(0, 3).map((item, idx) => (
                            <span 
                              key={idx}
                              style={{ 
                                fontSize: 11, 
                                padding: '2px 6px', 
                                backgroundColor: 'var(--surface-container-highest)', 
                                borderRadius: 4 
                              }}
                            >
                              {item.quantity}x {item.menuItem?.name || 'Item'}
                            </span>
                          ))}
                          {order.items.length > 3 && (
                            <span style={{ fontSize: 11, color: 'var(--on-surface-dim)' }}>
                              +{order.items.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Order Detail Modal */}
      {isDetailModalOpen && selectedOrder && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setIsDetailModalOpen(false)}
        >
          <div 
            style={{
              backgroundColor: 'var(--surface-container)',
              borderRadius: 16,
              padding: 24,
              maxWidth: 600,
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>
                Order #{selectedOrder.orderNumber || selectedOrder.id.slice(0, 8)}
              </h2>
              <button 
                className="btn btn-ghost btn-icon" 
                onClick={() => setIsDetailModalOpen(false)}
                style={{ width: 32, height: 32, padding: 0 }}
              >
                <IconX />
              </button>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              {/* Order Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--on-surface-dim)', marginBottom: 4 }}>Status</div>
                  <select 
                    className="input-field"
                    value={selectedOrder.status}
                    onChange={(e) => updateOrderStatus(selectedOrder.id, e.target.value)}
                    disabled={!['MANAGER', 'ADMIN'].includes(userRole)}
                  >
                    {ORDER_STATUSES.map(status => (
                      <option key={status} value={status}>{status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--on-surface-dim)', marginBottom: 4 }}>Type</div>
                  <div style={{ padding: 8, backgroundColor: 'var(--surface-container-highest)', borderRadius: 8 }}>
                    {selectedOrder.type.replace('_', ' ')}
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              <div>
                <div style={{ fontSize: 12, color: 'var(--on-surface-dim)', marginBottom: 4 }}>Customer Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {selectedOrder.customerName && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--on-surface-dim)' }}>Name</div>
                      <div>{selectedOrder.customerName}</div>
                    </div>
                  )}
                  {selectedOrder.table && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--on-surface-dim)' }}>Table</div>
                      <div>{selectedOrder.table.number}</div>
                    </div>
                  )}
                  {selectedOrder.customerPhone && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--on-surface-dim)' }}>Phone</div>
                      <div>{selectedOrder.customerPhone}</div>
                    </div>
                  )}
                  {selectedOrder.guestCount && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--on-surface-dim)' }}>Guests</div>
                      <div>{selectedOrder.guestCount}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Items */}
              <div>
                <div style={{ fontSize: 12, color: 'var(--on-surface-dim)', marginBottom: 8 }}>Order Items</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '8px 12px',
                      backgroundColor: 'var(--surface-container-highest)',
                      borderRadius: 8
                    }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{item.menuItem?.name || 'Item'}</div>
                        <div style={{ fontSize: 12, color: 'var(--on-surface-dim)' }}>
                          {item.quantity} × {formatCurrency(item.priceAtOrder || 0)}
                          {item.modifierTotal && item.modifierTotal > 0 && (
                            <> + {formatCurrency(item.modifierTotal)} modifiers</>
                          )}
                        </div>
                      </div>
                      <div style={{ fontWeight: 600 }}>
                        {formatCurrency(((item.priceAtOrder || 0) * item.quantity) + (item.modifierTotal || 0))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bill Info */}
              {selectedOrder.bill && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--on-surface-dim)', marginBottom: 8 }}>Bill Details</div>
                  <div style={{ 
                    padding: 12, 
                    backgroundColor: 'var(--surface-container-highest)', 
                    borderRadius: 8,
                    display: 'grid',
                    gap: 4
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Subtotal:</span>
                      <span>{formatCurrency(selectedOrder.bill.subTotal || 0)}</span>
                    </div>
                    {selectedOrder.bill.taxAmount && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Tax:</span>
                        <span>{formatCurrency(selectedOrder.bill.taxAmount)}</span>
                      </div>
                    )}
                    {selectedOrder.bill.discountAmount && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Discount:</span>
                        <span>-{formatCurrency(selectedOrder.bill.discountAmount)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, paddingTop: 4, borderTop: '1px solid var(--outline-variant)' }}>
                      <span>Total:</span>
                      <span>{formatCurrency(selectedOrder.bill.totalAmount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span>Status:</span>
                      <span style={{ color: selectedOrder.bill.isPaid ? 'var(--success)' : 'var(--warning)' }}>
                        {selectedOrder.bill.isPaid ? 'Paid' : 'Unpaid'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedOrder.notes && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--on-surface-dim)', marginBottom: 4 }}>Notes</div>
                  <div style={{ padding: 8, backgroundColor: 'var(--surface-container-highest)', borderRadius: 8 }}>
                    {selectedOrder.notes}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ToastContainer 
        toasts={toasts} 
        onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} 
      />
    </div>
  );
}
