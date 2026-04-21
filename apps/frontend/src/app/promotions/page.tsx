'use client';

import { useEffect, useState } from 'react';
import {
  Sidebar,
  TopBar,
  ToastContainer,
  IconPlus,
  IconX,
  IconEdit,
  IconTrash,
  type ToastItem,
} from '../components/shared';
import { apiRequest, getStoredUser, formatCurrency } from '../lib/api';

interface PromotionRule {
  id: string;
  name: string;
  description?: string | null;
  type: 'PERCENTAGE_DISCOUNT' | 'FLAT_DISCOUNT' | 'BUY_X_GET_Y';
  value: number;
  minOrderAmount?: number | null;
  maxDiscountAmount?: number | null;
  isActive: boolean;
  priority: number;
  startsAt?: string | null;
  endsAt?: string | null;
  appliesToMenuItemId?: string | null;
  appliesToMenuItem?: { id: string; name: string } | null;
  createdAt?: string;
}

const FALLBACK_PROMOTIONS: PromotionRule[] = [
  {
    id: 'promo-1',
    name: 'Happy Hour - 20% Off',
    description: 'Daily 5-7 PM discount on all items',
    type: 'PERCENTAGE_DISCOUNT',
    value: 20,
    minOrderAmount: 200,
    isActive: true,
    priority: 1,
  },
  {
    id: 'promo-2',
    name: 'Weekend Special',
    description: 'Flat ₹100 off on Saturdays',
    type: 'FLAT_DISCOUNT',
    value: 100,
    minOrderAmount: 500,
    isActive: true,
    priority: 0,
  },
];

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<PromotionRule[]>(FALLBACK_PROMOTIONS);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [userRole, setUserRole] = useState('WAITER');

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<PromotionRule>>({
    name: '',
    description: '',
    type: 'PERCENTAGE_DISCOUNT',
    value: 0,
    minOrderAmount: undefined,
    maxDiscountAmount: undefined,
    isActive: true,
    priority: 0,
  });

  const addToast = (t: Omit<ToastItem, 'id'>) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4500);
  };

  useEffect(() => {
    const user = getStoredUser();
    setUserRole((user?.role || 'WAITER').toUpperCase());

    if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') {
      addToast({
        icon: '⚠️',
        title: 'Access Restricted',
        message: 'Promotions management is available to ADMIN/MANAGER only.',
      });
      setLoading(false);
      return;
    }

    loadPromotions();
  }, []);

  const loadPromotions = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<PromotionRule[]>('/promotions');
      setPromotions(Array.isArray(data) ? data : FALLBACK_PROMOTIONS);
    } catch {
      addToast({ icon: 'ⓘ', title: 'Demo mode', message: 'Showing sample promotions.' });
      setPromotions(FALLBACK_PROMOTIONS);
    } finally {
      setLoading(false);
    }
  };

  const openForm = (promo?: PromotionRule) => {
    if (promo) {
      setEditingId(promo.id);
      setFormData(promo);
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        description: '',
        type: 'PERCENTAGE_DISCOUNT',
        value: 0,
        minOrderAmount: undefined,
        maxDiscountAmount: undefined,
        isActive: true,
        priority: 0,
      });
    }
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.value) {
      addToast({ icon: '⚠️', title: 'Invalid input', message: 'Name and value are required.' });
      return;
    }

    try {
      if (editingId) {
        await apiRequest(`/promotions/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(formData),
        });
        addToast({ icon: '✅', title: 'Updated', message: `Promotion "${formData.name}" updated.` });
      } else {
        await apiRequest('/promotions', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
        addToast({ icon: '✅', title: 'Created', message: `Promotion "${formData.name}" created.` });
      }

      setIsFormOpen(false);
      await loadPromotions();
    } catch (err) {
      addToast({ icon: '❌', title: 'Error', message: (err as Error).message });
    }
  };

  const handleDelete = async (promoId: string, promoName: string) => {
    if (!window.confirm(`Delete promotion "${promoName}"?`)) return;

    try {
      await apiRequest(`/promotions/${promoId}`, { method: 'DELETE' });
      addToast({ icon: '✅', title: 'Deleted', message: `Promotion deleted.` });
      await loadPromotions();
    } catch (err) {
      addToast({ icon: '❌', title: 'Error', message: (err as Error).message });
    }
  };

  const isRestricted = userRole !== 'ADMIN' && userRole !== 'MANAGER';

  return (
    <div className="pos-layout">
      <Sidebar activePath="/promotions" />

      <div className="pos-main">
        <TopBar
          title="Promotions Manager"
          subtitle="Create and manage discount rules, special offers, and promotional campaigns"
          actions={
            <button className="btn btn-primary btn-sm" onClick={() => openForm()} disabled={isRestricted || loading}>
              <IconPlus style={{ width: 14, height: 14 }} />
              New Promotion
            </button>
          }
        />

        <div className="admin-shell">
          {isRestricted ? (
            <div
              style={{
                background: 'var(--surface-container)',
                border: '1px solid var(--outline-variant)',
                borderRadius: 'var(--radius-lg)',
                padding: '40px',
                textAlign: 'center',
                color: 'var(--on-surface-dim)',
              }}
            >
              <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Access Restricted</div>
              <div>Promotions management is available to ADMIN and MANAGER roles only.</div>
            </div>
          ) : (
            <div className="admin-card">
              <div className="section-header">
                <div>
                  <div className="section-title">Active Promotions</div>
                  <div className="section-subtitle">Discount rules sorted by priority (highest applies first)</div>
                </div>
                <div className="badge badge-info">{promotions.length} total</div>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--on-surface-dim)' }}>Loading...</div>
              ) : promotions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--on-surface-dim)' }}>
                  No promotions yet. Create one to get started.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {promotions.map((promo) => (
                    <div
                      key={promo.id}
                      style={{
                        background: 'var(--surface-container)',
                        border: `2px solid ${promo.isActive ? 'var(--success)' : 'var(--outline-variant)'}`,
                        borderRadius: 'var(--radius-lg)',
                        padding: '14px',
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: '12px',
                        alignItems: 'start',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 700 }}>{promo.name}</div>
                          <div className="badge badge-info" style={{ fontSize: '11px' }}>
                            P{promo.priority}
                          </div>
                          {promo.isActive ? (
                            <div className="badge badge-success">Active</div>
                          ) : (
                            <div className="badge badge-warning">Inactive</div>
                          )}
                        </div>

                        <div style={{ fontSize: '12px', color: 'var(--on-surface-dim)', marginBottom: '8px' }}>
                          {promo.description}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', fontSize: '12px' }}>
                          <div>
                            <div style={{ color: 'var(--on-surface-dim)' }}>Type</div>
                            <div style={{ fontWeight: 600 }}>{promo.type}</div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--on-surface-dim)' }}>Value</div>
                            <div style={{ fontWeight: 600 }}>
                              {promo.type === 'PERCENTAGE_DISCOUNT' ? `${promo.value}%` : formatCurrency(promo.value)}
                            </div>
                          </div>
                          {promo.minOrderAmount != null && (
                            <div>
                              <div style={{ color: 'var(--on-surface-dim)' }}>Min Order</div>
                              <div style={{ fontWeight: 600 }}>{formatCurrency(promo.minOrderAmount)}</div>
                            </div>
                          )}
                          {promo.maxDiscountAmount != null && (
                            <div>
                              <div style={{ color: 'var(--on-surface-dim)' }}>Max Cap</div>
                              <div style={{ fontWeight: 600 }}>{formatCurrency(promo.maxDiscountAmount)}</div>
                            </div>
                          )}
                          {promo.appliesToMenuItem && (
                            <div>
                              <div style={{ color: 'var(--on-surface-dim)' }}>Item</div>
                              <div style={{ fontWeight: 600 }}>{promo.appliesToMenuItem.name}</div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-ghost btn-icon"
                          onClick={() => openForm(promo)}
                          style={{ width: '32px', height: '32px' }}
                        >
                          <IconEdit style={{ width: '14px', height: '14px' }} />
                        </button>
                        <button
                          className="btn btn-ghost btn-icon"
                          onClick={() => handleDelete(promo.id, promo.name)}
                          style={{ width: '32px', height: '32px', color: 'var(--danger)' }}
                        >
                          <IconTrash style={{ width: '14px', height: '14px' }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Promotion Form Modal */}
      {isFormOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--outline-variant)',
              width: '100%',
              maxWidth: '500px',
              maxHeight: '80vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '20px',
                borderBottom: '1px solid var(--outline-variant)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: '16px', fontWeight: 700 }}>
                {editingId ? 'Edit Promotion' : 'Create Promotion'}
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="btn btn-ghost btn-icon"
                style={{ width: '32px', height: '32px' }}
              >
                <IconX style={{ width: '16px', height: '16px' }} />
              </button>
            </div>

            <div style={{ flex: 1, overflow: 'y-auto', padding: '20px', display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Promotion Name *
                </label>
                <input
                  className="input-field"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="E.g., Happy Hour Discount"
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Description
                </label>
                <textarea
                  className="input-field"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Details about this promotion"
                  rows={2}
                  style={{ resize: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Type *
                  </label>
                  <select
                    className="input-field"
                    value={formData.type || 'PERCENTAGE_DISCOUNT'}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value as any })
                    }
                  >
                    <option value="PERCENTAGE_DISCOUNT">Percentage Discount</option>
                    <option value="FLAT_DISCOUNT">Flat Discount</option>
                    <option value="BUY_X_GET_Y">Buy X Get Y</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Value * {formData.type === 'PERCENTAGE_DISCOUNT' && '(%)'}
                  </label>
                  <input
                    className="input-field"
                    type="number"
                    min={0}
                    value={formData.value || 0}
                    onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                    placeholder="Amount or percentage"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Min Order Amount
                  </label>
                  <input
                    className="input-field"
                    type="number"
                    min={0}
                    value={formData.minOrderAmount || ''}
                    onChange={(e) => setFormData({ ...formData, minOrderAmount: Number(e.target.value) || undefined })}
                    placeholder="Leave empty for no limit"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Max Discount Cap
                  </label>
                  <input
                    className="input-field"
                    type="number"
                    min={0}
                    value={formData.maxDiscountAmount || ''}
                    onChange={(e) => setFormData({ ...formData, maxDiscountAmount: Number(e.target.value) || undefined })}
                    placeholder="Leave empty for no limit"
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Priority (0-10)
                </label>
                <input
                  className="input-field"
                  type="number"
                  min={0}
                  max={10}
                  value={formData.priority || 0}
                  onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
                />
                <div style={{ fontSize: '11px', color: 'var(--on-surface-dim)', marginTop: '4px' }}>
                  Higher priority promotions apply first
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive || false}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                <label htmlFor="isActive" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Active now
                </label>
              </div>
            </div>

            <div
              style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--outline-variant)',
                display: 'grid',
                gap: '8px',
                gridTemplateColumns: '1fr 1fr',
              }}
            >
              <button className="btn btn-ghost btn-sm" onClick={() => setIsFormOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSave}>
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} />
    </div>
  );
}
