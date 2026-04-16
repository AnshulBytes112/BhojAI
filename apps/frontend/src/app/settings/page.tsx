'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  Sidebar,
  TopBar,
  ToastContainer,
  IconPlus,
  IconUser,
  IconX,
  type ToastItem,
} from '../components/shared';
import { apiRequest, formatCurrency, getStoredUser } from '../lib/api';

interface UserProfileResponse {
  id: string;
  name: string;
  username: string;
  role: string;
  restaurantId: string;
  restaurant?: {
    name?: string;
    theme?: string;
  };
}

interface Promotion {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  value: number;
  minOrderAmount?: number | null;
  isActive: boolean;
  appliesToMenuItem?: { id: string; name: string } | null;
}

interface MenuItemOption {
  id: string;
  name: string;
}

const FALLBACK_PROFILE: UserProfileResponse = {
  id: 'local-user',
  name: 'Priya Singh',
  username: 'priya.manager',
  role: 'MANAGER',
  restaurantId: 'rest-demo',
  restaurant: {
    name: 'Spice Garden',
    theme: 'ember',
  },
};

const FALLBACK_PROMOTIONS: Promotion[] = [
  { id: 'p1', name: 'Lunch Combo Saver', type: 'PERCENTAGE_DISCOUNT', value: 15, minOrderAmount: 699, isActive: true, description: 'Weekday lunch uplift promotion' },
  { id: 'p2', name: 'Kulfi Bounceback', type: 'FLAT_DISCOUNT', value: 60, minOrderAmount: 399, isActive: false, description: 'Re-activate on soft dessert sales days' },
];

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfileResponse>(FALLBACK_PROFILE);
  const [promotions, setPromotions] = useState<Promotion[]>(FALLBACK_PROMOTIONS);
  const [menuItems, setMenuItems] = useState<MenuItemOption[]>([]);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [staffForm, setStaffForm] = useState({
    name: '',
    username: '',
    password: '',
    role: 'WAITER',
    pin: '',
  });
  const [promotionForm, setPromotionForm] = useState({
    name: '',
    description: '',
    type: 'PERCENTAGE_DISCOUNT',
    value: '',
    minOrderAmount: '',
    appliesToMenuItemId: '',
  });

  const addToast = (toast: Omit<ToastItem, 'id'>) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 4500);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [profileData, promotionsData, itemsData] = await Promise.all([
          apiRequest<UserProfileResponse>('/auth/me'),
          apiRequest<Promotion[]>('/promotions'),
          apiRequest<Array<{ id: string; name: string }>>('/menu/items'),
        ]);
        setProfile(profileData);
        setPromotions(promotionsData.length ? promotionsData : FALLBACK_PROMOTIONS);
        setMenuItems(itemsData);
      } catch {
        const localUser = getStoredUser();
        setProfile({
          ...FALLBACK_PROFILE,
          name: localUser?.name || localUser?.username || FALLBACK_PROFILE.name,
          username: localUser?.username || FALLBACK_PROFILE.username,
          role: localUser?.role || FALLBACK_PROFILE.role,
        });
        setPromotions(FALLBACK_PROMOTIONS);
      }
    };

    load();
  }, []);

  const handleCreateStaff = async (event: FormEvent) => {
    event.preventDefault();
    if (!staffForm.name.trim() || !staffForm.username.trim() || !staffForm.password.trim()) return;
    setSaving(true);

    try {
      await apiRequest('/auth/register-staff', {
        method: 'POST',
        body: {
          name: staffForm.name.trim(),
          username: staffForm.username.trim().toLowerCase(),
          password: staffForm.password,
          role: staffForm.role,
          pin: staffForm.pin || undefined,
        },
      });
      addToast({ icon: '+', title: 'Staff registered', message: `${staffForm.name} can now sign in to the POS.` });
    } catch (error) {
      addToast({
        icon: '⚠️',
        title: 'Registration failed',
        message: error instanceof Error ? error.message : 'Could not create staff user.',
      });
      return;
    } finally {
      setSaving(false);
    }

    setShowStaffModal(false);
    setStaffForm({ name: '', username: '', password: '', role: 'WAITER', pin: '' });
  };

  const handleCreatePromotion = async (event: FormEvent) => {
    event.preventDefault();
    if (!promotionForm.name.trim() || !promotionForm.value) return;
    setSaving(true);

    const payload = {
      name: promotionForm.name.trim(),
      description: promotionForm.description.trim() || undefined,
      type: promotionForm.type,
      value: Number(promotionForm.value),
      minOrderAmount: promotionForm.minOrderAmount ? Number(promotionForm.minOrderAmount) : undefined,
      appliesToMenuItemId: promotionForm.appliesToMenuItemId || undefined,
      isActive: true,
    };

    try {
      const created = await apiRequest<Promotion>('/promotions', {
        method: 'POST',
        body: payload,
      });
      setPromotions((prev) => [created, ...prev]);
      addToast({ icon: '+', title: 'Promotion published', message: `${payload.name} is now available for billing rules.` });
    } catch {
      setPromotions((prev) => [
        {
          id: `local-promo-${Date.now()}`,
          name: payload.name,
          description: payload.description || null,
          type: payload.type,
          value: payload.value,
          minOrderAmount: payload.minOrderAmount || null,
          isActive: true,
          appliesToMenuItem: menuItems.find((item) => item.id === payload.appliesToMenuItemId) || null,
        },
        ...prev,
      ]);
      addToast({ icon: 'i', title: 'Preview promotion added', message: 'Saved locally because the backend could not be reached.' });
    } finally {
      setSaving(false);
      setShowPromotionModal(false);
      setPromotionForm({ name: '', description: '', type: 'PERCENTAGE_DISCOUNT', value: '', minOrderAmount: '', appliesToMenuItemId: '' });
    }
  };

  const togglePromotion = async (promotion: Promotion) => {
    const previous = promotions;
    setPromotions((current) =>
      current.map((entry) => (entry.id === promotion.id ? { ...entry, isActive: !entry.isActive } : entry))
    );

    try {
      await apiRequest(`/promotions/${promotion.id}`, {
        method: 'PATCH',
        body: { isActive: !promotion.isActive },
      });
    } catch {
      setPromotions(previous);
      addToast({ icon: '!', title: 'Promotion update failed', message: 'The backend did not confirm the status change.' });
    }
  };

  return (
    <div className="pos-layout">
      <Sidebar activePath="/settings" />

      <div className="pos-main">
        <TopBar
          title="Operations Control Room"
          subtitle="Restaurant identity, user onboarding and promotion management"
          actions={
            <div className="flex gap-2">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowStaffModal(true)}>
                <IconUser /> Add User
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setShowPromotionModal(true)}>
                <IconPlus /> New Promotion
              </button>
            </div>
          }
        />

        <div className="admin-shell">
          <div className="admin-grid-2">
            <div className="admin-card hero-card">
              <div className="section-header">
                <div>
                  <div className="section-title">{profile.restaurant?.name || 'Restaurant Profile'}</div>
                  <div className="section-subtitle">Primary operator and configuration identity</div>
                </div>
                <div className="badge badge-primary">{profile.role}</div>
              </div>

              <div className="metric-list">
                <div className="metric-row compact">
                  <div className="metric-label">Manager</div>
                  <div className="metric-value">{profile.name}</div>
                </div>
                <div className="metric-row compact">
                  <div className="metric-label">Username</div>
                  <div className="metric-caption">{profile.username}</div>
                </div>
                <div className="metric-row compact">
                  <div className="metric-label">Theme</div>
                  <div className="metric-caption">{profile.restaurant?.theme || 'default'}</div>
                </div>
                <div className="metric-row compact">
                  <div className="metric-label">Restaurant ID</div>
                  <div className="metric-caption">{profile.restaurantId}</div>
                </div>
              </div>
            </div>

            <div className="stack-column">
              <div className="admin-card">
                <div className="section-header">
                  <div>
                    <div className="section-title">Security Workflow</div>
                    <div className="section-subtitle">Recommended operating posture for the current setup</div>
                  </div>
                </div>
                <div className="metric-list">
                  <div className="metric-row compact">
                    <div className="metric-label">Waiters</div>
                    <div className="metric-caption">Use password + PIN on shared terminals.</div>
                  </div>
                  <div className="metric-row compact">
                    <div className="metric-label">Managers</div>
                    <div className="metric-caption">Keep promotion and stock permissions restricted to senior staff.</div>
                  </div>
                  <div className="metric-row compact">
                    <div className="metric-label">Kitchen</div>
                    <div className="metric-caption">Prefer PIN login for faster handoff on KDS screens.</div>
                  </div>
                </div>
              </div>

              <div className="admin-card">
                <div className="section-header">
                  <div>
                    <div className="section-title">Promotion Snapshot</div>
                    <div className="section-subtitle">Live discount rules available to billing</div>
                  </div>
                </div>
                <div className="metric-row compact">
                  <div className="metric-label">Active Promotions</div>
                  <div className="metric-value">{promotions.filter((item) => item.isActive).length}</div>
                </div>
                <div className="metric-row compact">
                  <div className="metric-label">Average Offer Value</div>
                  <div className="metric-value">
                    {formatCurrency(
                      promotions.length
                        ? promotions.reduce((sum, item) => sum + item.value, 0) / promotions.length
                        : 0
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="admin-grid-2">
            <div className="admin-card">
              <div className="section-header">
                <div>
                  <div className="section-title">Promotion Manager</div>
                  <div className="section-subtitle">Operational offers, minimum spend and menu-targeted pushes</div>
                </div>
              </div>

              <div className="catalog-grid">
                {promotions.map((promotion) => (
                  <div key={promotion.id} className="catalog-card">
                    <div className="catalog-card-header">
                      <div>
                        <div className="table-primary">{promotion.name}</div>
                        <div className="table-secondary">{promotion.description || 'No description provided'}</div>
                      </div>
                      <span className={`badge ${promotion.isActive ? 'badge-success' : 'badge-neutral'}`}>
                        {promotion.isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>

                    <div className="catalog-card-body">
                      <div className="metric-row compact">
                        <span className="metric-label">Type</span>
                        <span className="metric-caption">{promotion.type}</span>
                      </div>
                      <div className="metric-row compact">
                        <span className="metric-label">Value</span>
                        <span className="metric-value">
                          {promotion.type.includes('PERCENTAGE') ? `${promotion.value}%` : formatCurrency(promotion.value)}
                        </span>
                      </div>
                      <div className="metric-row compact">
                        <span className="metric-label">Minimum Order</span>
                        <span className="metric-caption">
                          {promotion.minOrderAmount ? formatCurrency(promotion.minOrderAmount) : 'None'}
                        </span>
                      </div>
                      {promotion.appliesToMenuItem && (
                        <div className="metric-row compact">
                          <span className="metric-label">Menu Target</span>
                          <span className="metric-caption">{promotion.appliesToMenuItem.name}</span>
                        </div>
                      )}
                    </div>

                    <div className="catalog-card-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => togglePromotion(promotion)}>
                        {promotion.isActive ? 'Pause Promotion' : 'Activate Promotion'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-card">
              <div className="section-header">
                <div>
                  <div className="section-title">Onboarding Notes</div>
                  <div className="section-subtitle">What a senior operator typically locks down during rollout</div>
                </div>
              </div>
              <div className="metric-list">
                <div className="metric-row compact">
                  <div className="metric-label">Create role-specific accounts</div>
                  <div className="metric-caption">Avoid shared manager credentials across shifts.</div>
                </div>
                <div className="metric-row compact">
                  <div className="metric-label">Pin the best promotions</div>
                  <div className="metric-caption">Target one or two offers to slow-moving items instead of discounting broadly.</div>
                </div>
                <div className="metric-row compact">
                  <div className="metric-label">Review weekly audit traces</div>
                  <div className="metric-caption">Especially for stock edits, bill splits and void-heavy terminals.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {showStaffModal && (
          <div className="modal-overlay" onClick={() => setShowStaffModal(false)}>
            <div className="modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Create New User</h2>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowStaffModal(false)}>
                  <IconX />
                </button>
              </div>
              <form className="modal-form-grid" onSubmit={handleCreateStaff}>
                <div className="input-group">
                  <label className="input-label">Full Name</label>
                  <input className="input-field" value={staffForm.name} onChange={(event) => setStaffForm((prev) => ({ ...prev, name: event.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Username</label>
                  <input className="input-field" value={staffForm.username} onChange={(event) => setStaffForm((prev) => ({ ...prev, username: event.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Password</label>
                  <input className="input-field" type="password" value={staffForm.password} onChange={(event) => setStaffForm((prev) => ({ ...prev, password: event.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Role</label>
                  <select className="input-field" value={staffForm.role} onChange={(event) => setStaffForm((prev) => ({ ...prev, role: event.target.value }))}>
                    <option value="WAITER">WAITER</option>
                    <option value="CHEF">CHEF</option>
                    <option value="MANAGER">MANAGER</option>
                  </select>
                </div>
                <div className="input-group span-2">
                  <label className="input-label">PIN</label>
                  <input className="input-field" value={staffForm.pin} onChange={(event) => setStaffForm((prev) => ({ ...prev, pin: event.target.value }))} placeholder="Recommended for shared-device roles" />
                </div>
                <button className="btn btn-primary btn-full span-2" type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Create User'}
                </button>
              </form>
            </div>
          </div>
        )}

        {showPromotionModal && (
          <div className="modal-overlay" onClick={() => setShowPromotionModal(false)}>
            <div className="modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Create Promotion</h2>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowPromotionModal(false)}>
                  <IconX />
                </button>
              </div>
              <form className="modal-form-grid" onSubmit={handleCreatePromotion}>
                <div className="input-group">
                  <label className="input-label">Promotion Name</label>
                  <input className="input-field" value={promotionForm.name} onChange={(event) => setPromotionForm((prev) => ({ ...prev, name: event.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Type</label>
                  <select className="input-field" value={promotionForm.type} onChange={(event) => setPromotionForm((prev) => ({ ...prev, type: event.target.value }))}>
                    <option value="PERCENTAGE_DISCOUNT">PERCENTAGE_DISCOUNT</option>
                    <option value="FLAT_DISCOUNT">FLAT_DISCOUNT</option>
                    <option value="BUY_X_GET_Y">BUY_X_GET_Y</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Value</label>
                  <input className="input-field" type="number" min="0" value={promotionForm.value} onChange={(event) => setPromotionForm((prev) => ({ ...prev, value: event.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Minimum Order</label>
                  <input className="input-field" type="number" min="0" value={promotionForm.minOrderAmount} onChange={(event) => setPromotionForm((prev) => ({ ...prev, minOrderAmount: event.target.value }))} />
                </div>
                <div className="input-group span-2">
                  <label className="input-label">Description</label>
                  <input className="input-field" value={promotionForm.description} onChange={(event) => setPromotionForm((prev) => ({ ...prev, description: event.target.value }))} />
                </div>
                <div className="input-group span-2">
                  <label className="input-label">Applies To Menu Item</label>
                  <select
                    className="input-field"
                    value={promotionForm.appliesToMenuItemId}
                    onChange={(event) => setPromotionForm((prev) => ({ ...prev, appliesToMenuItemId: event.target.value }))}
                  >
                    <option value="">All eligible items</option>
                    {menuItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="btn btn-primary btn-full span-2" type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Create Promotion'}
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
