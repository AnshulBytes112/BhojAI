'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import {
  Sidebar,
  TopBar,
  ToastContainer,
  IconPlus,
  IconTag,
  IconX,
  type ToastItem,
} from '../components/shared';
import { apiRequest, formatCurrency } from '../lib/api';

interface ModifierOption {
  id: string;
  name: string;
  price: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  options: ModifierOption[];
}

interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  isAvailable: boolean;
  dietaryLabel?: string | null;
  aiTags?: string | null;
  categoryId: string;
  modifierGroups?: ModifierGroup[];
}

interface MenuCategory {
  id: string;
  name: string;
  sortOrder?: number;
  items: MenuItem[];
}

const FALLBACK_CATEGORIES: MenuCategory[] = [
  {
    id: 'c1',
    name: 'Starters',
    items: [
      { id: 'm1', name: 'Paneer Tikka', price: 280, isAvailable: true, dietaryLabel: 'VEG', aiTags: 'popular,starter', categoryId: 'c1' },
      { id: 'm2', name: 'Chicken 65', price: 320, isAvailable: true, dietaryLabel: 'NON_VEG', aiTags: 'bestseller,spicy', categoryId: 'c1' },
      { id: 'm3', name: 'Veg Spring Roll', price: 190, isAvailable: false, dietaryLabel: 'VEG', categoryId: 'c1' },
    ],
  },
  {
    id: 'c2',
    name: 'Mains',
    items: [
      { id: 'm4', name: 'Butter Chicken', price: 390, isAvailable: true, dietaryLabel: 'NON_VEG', aiTags: 'signature,bestseller', categoryId: 'c2' },
      { id: 'm5', name: 'Dal Makhani', price: 285, isAvailable: true, dietaryLabel: 'VEG', categoryId: 'c2' },
      { id: 'm6', name: 'Paneer Makhani', price: 340, isAvailable: true, dietaryLabel: 'VEG', categoryId: 'c2' },
    ],
  },
  {
    id: 'c3',
    name: 'Beverages',
    items: [
      { id: 'm7', name: 'Mango Lassi', price: 120, isAvailable: true, dietaryLabel: 'VEG', aiTags: 'upsell,popular', categoryId: 'c3' },
      { id: 'm8', name: 'Cold Coffee', price: 130, isAvailable: true, dietaryLabel: 'VEG', categoryId: 'c3' },
    ],
  },
];

const EMPTY_ITEM_FORM = {
  name: '',
  description: '',
  price: '',
  imageUrl: '',
  categoryId: '',
  dietaryLabel: 'VEG',
  aiTags: '',
};

export default function InventoryPage() {
  return <InventoryPageContent />;
}

function InventoryPageContent() {
  const [categories, setCategories] = useState<MenuCategory[]>(FALLBACK_CATEGORIES);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState<'ALL' | 'AVAILABLE' | 'UNAVAILABLE'>('ALL');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (toast: Omit<ToastItem, 'id'>) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 4500);
  };

  const loadMenu = async () => {
    try {
      const [categoriesData, itemsData] = await Promise.all([
        apiRequest<MenuCategory[]>('/menu/categories'),
        apiRequest<MenuItem[]>('/menu/items'),
      ]);

      if (categoriesData.length) {
        const itemsByCategory = new Map<string, MenuItem[]>();

        for (const item of itemsData || []) {
          const bucket = itemsByCategory.get(item.categoryId) || [];
          bucket.push(item);
          itemsByCategory.set(item.categoryId, bucket);
        }

        const normalized = categoriesData.map((category) => ({
          ...category,
          items: itemsByCategory.get(category.id) || category.items || [],
        }));

        setCategories(normalized);
        return;
      }
    } catch (_error) {
      setCategories(FALLBACK_CATEGORIES);
      return;
    }

    setCategories(FALLBACK_CATEGORIES);
  };

  useEffect(() => {
    loadMenu();
  }, []);

  useEffect(() => {
    if (activeCategory === 'ALL' && categories.length) {
      setItemForm((prev) => ({ ...prev, categoryId: categories[0].id }));
      return;
    }

    if (activeCategory !== 'ALL') {
      setItemForm((prev) => ({ ...prev, categoryId: activeCategory }));
    }
  }, [activeCategory, categories]);

  const allItems = categories.flatMap((category) => category.items.map((item) => ({ ...item, categoryName: category.name })));
  const filteredItems = allItems.filter((item) => {
    const matchesCategory = activeCategory === 'ALL' || item.categoryId === activeCategory;
    const matchesAvailability =
      availability === 'ALL' ||
      (availability === 'AVAILABLE' ? item.isAvailable : !item.isAvailable);
    const matchesSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.aiTags?.toLowerCase().includes(search.toLowerCase()) ||
      item.description?.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesAvailability && matchesSearch;
  });

  const availableCount = allItems.filter((item) => item.isAvailable).length;
  const unavailableCount = allItems.length - availableCount;

  const handleToggleAvailability = async (item: MenuItem) => {
    const previous = categories;
    setCategories((current) =>
      current.map((category) => ({
        ...category,
        items: category.items.map((entry) => (entry.id === item.id ? { ...entry, isAvailable: !entry.isAvailable } : entry)),
      }))
    );

    try {
      await apiRequest(`/menu/items/${item.id}/toggle`, { method: 'PATCH' });
      addToast({
        icon: 'i',
        title: `${item.name} updated`,
        message: item.isAvailable ? 'Marked unavailable for the live order flow.' : 'Returned to the active menu.',
      });
    } catch {
      setCategories(previous);
      addToast({
        icon: '!',
        title: 'Availability change failed',
        message: 'The backend could not confirm this toggle. Your previous state was restored.',
      });
    }
  };

  const handleCreateCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!categoryName.trim()) return;
    setSaving(true);

    try {
      await apiRequest('/menu/categories', {
        method: 'POST',
        body: { name: categoryName.trim(), sortOrder: categories.length + 1 },
      });
      await loadMenu();
      setCategoryName('');
      setShowCategoryModal(false);
      addToast({ icon: '+', title: 'Category created', message: 'The new section is ready for menu items.' });
    } catch {
      const fallbackCategory: MenuCategory = {
        id: `demo-category-${Date.now()}`,
        name: categoryName.trim(),
        items: [],
      };
      setCategories((prev) => [...prev, fallbackCategory]);
      setCategoryName('');
      setShowCategoryModal(false);
      addToast({ icon: 'i', title: 'Preview category added', message: 'Saved locally because the backend was unavailable.' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!itemForm.name.trim() || !itemForm.price || !itemForm.categoryId) return;
    setSaving(true);

    const payload = {
      name: itemForm.name.trim(),
      description: itemForm.description.trim() || undefined,
      price: Number(itemForm.price),
      imageUrl: itemForm.imageUrl || undefined,
      categoryId: itemForm.categoryId,
      dietaryLabel: itemForm.dietaryLabel,
      aiTags: itemForm.aiTags.trim() || undefined,
    };

    try {
      await apiRequest('/menu/items', { method: 'POST', body: payload });
      await loadMenu();
      setItemForm(EMPTY_ITEM_FORM);
      setShowItemModal(false);
      addToast({ icon: '+', title: 'Menu item created', message: 'The item is now available to the POS flow.' });
    } catch (error) {
      addToast({
        icon: '!',
        title: 'Create failed',
        message: (error as Error).message || 'Could not save item to server, so it was not added to POS order flow.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleItemImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setItemForm((prev) => ({ ...prev, imageUrl: '' }));
      return;
    }

    if (!file.type.startsWith('image/')) {
      addToast({ icon: '!', title: 'Invalid file', message: 'Please select an image file.' });
      event.target.value = '';
      return;
    }

    if (file.size > 1024 * 1024) {
      addToast({ icon: '!', title: 'Image too large', message: 'Please use an image under 1MB.' });
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setItemForm((prev) => ({ ...prev, imageUrl: String(reader.result || '') }));
    };
    reader.onerror = () => {
      addToast({ icon: '!', title: 'Upload failed', message: 'Could not read the selected image.' });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="pos-layout">
      <Sidebar activePath="/inventory" />

      <div className="pos-main">
        <TopBar
          title="Inventory Studio"
          subtitle="Catalog control for categories, availability and AI merchandising tags"
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search items or tags..."
          actions={
            <div className="flex gap-2">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCategoryModal(true)}>
                <IconTag /> New Category
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setShowItemModal(true)}>
                <IconPlus /> New Item
              </button>
            </div>
          }
        />

        <div className="admin-shell">
          <div className="kpi-grid">
            <div className="kpi-card orange">
              <div className="kpi-value">{allItems.length}</div>
              <div className="kpi-label">Catalog Items</div>
            </div>
            <div className="kpi-card green">
              <div className="kpi-value">{availableCount}</div>
              <div className="kpi-label">Orderable Now</div>
            </div>
            <div className="kpi-card yellow">
              <div className="kpi-value">{unavailableCount}</div>
              <div className="kpi-label">Paused Items</div>
            </div>
            <div className="kpi-card blue">
              <div className="kpi-value">{categories.length}</div>
              <div className="kpi-label">Categories</div>
            </div>
          </div>

          <div className="admin-grid-2 wide-left">
            <div className="admin-card">
              <div className="section-header">
                <div>
                  <div className="section-title">Item Catalog</div>
                  <div className="section-subtitle">Quick toggle availability and monitor AI-ready merchandising tags</div>
                </div>
                <div className="filter-tabs">
                  {(['ALL', 'AVAILABLE', 'UNAVAILABLE'] as const).map((option) => (
                    <button
                      key={option}
                      className={`chip ${availability === option ? 'active' : ''}`}
                      onClick={() => setAvailability(option)}
                    >
                      {option === 'ALL' ? 'All' : option === 'AVAILABLE' ? 'Available' : 'Unavailable'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="catalog-grid">
                {filteredItems.map((item) => (
                  <div key={item.id} className="catalog-card">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        style={{ width: '100%', height: 132, objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: 10, border: '1px solid var(--outline-variant)' }}
                      />
                    ) : null}
                    <div className="catalog-card-header">
                      <div>
                        <div className="table-primary">{item.name}</div>
                        <div className="table-secondary">{item.categoryName}</div>
                      </div>
                      <span className={`badge ${item.isAvailable ? 'badge-success' : 'badge-danger'}`}>
                        {item.isAvailable ? 'Available' : 'Unavailable'}
                      </span>
                    </div>

                    <div className="catalog-card-body">
                      <div className="metric-row compact">
                        <span className="metric-label">Price</span>
                        <span className="metric-value">{formatCurrency(item.price)}</span>
                      </div>
                      <div className="metric-row compact">
                        <span className="metric-label">Dietary</span>
                        <span className="metric-caption">{item.dietaryLabel || 'Not tagged'}</span>
                      </div>
                      <div className="catalog-tags">
                        {(item.aiTags || 'no-tags')
                          .split(',')
                          .filter(Boolean)
                          .map((tag) => (
                            <span key={tag} className="badge badge-neutral">
                              {tag.trim()}
                            </span>
                          ))}
                      </div>
                    </div>

                    <div className="catalog-card-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => handleToggleAvailability(item)}>
                        {item.isAvailable ? 'Pause Item' : 'Enable Item'}
                      </button>
                      <div className="table-secondary">
                        {item.modifierGroups?.length || 0} modifier groups
                      </div>
                    </div>
                  </div>
                ))}

                {filteredItems.length === 0 && (
                  <div className="empty-state">
                    <div className="section-title">No items matched this filter</div>
                    <div className="section-subtitle">Try a broader search, or switch to another category.</div>
                  </div>
                )}
              </div>
            </div>

            <div className="stack-column">
              <div className="admin-card">
                <div className="section-header">
                  <div>
                    <div className="section-title">Category Rail</div>
                    <div className="section-subtitle">Use this to focus a service station or meal period quickly</div>
                  </div>
                </div>
                <div className="sidebar-list">
                  <button className={`sidebar-list-item ${activeCategory === 'ALL' ? 'active' : ''}`} onClick={() => setActiveCategory('ALL')}>
                    <span>All Categories</span>
                    <span>{allItems.length}</span>
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      className={`sidebar-list-item ${activeCategory === category.id ? 'active' : ''}`}
                      onClick={() => setActiveCategory(category.id)}
                    >
                      <span>{category.name}</span>
                      <span>{category.items.length}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="admin-card">
                <div className="section-header">
                  <div>
                    <div className="section-title">Editor Notes</div>
                    <div className="section-subtitle">Suggested guardrails for a polished live menu</div>
                  </div>
                </div>
                <div className="metric-list">
                  <div className="metric-row compact">
                    <div className="metric-label">Keep AI tags actionable</div>
                    <div className="metric-caption">Use tags like `bestseller`, `combo`, `upsell`, `spicy`.</div>
                  </div>
                  <div className="metric-row compact">
                    <div className="metric-label">Limit unavailable clutter</div>
                    <div className="metric-caption">Pause items temporarily rather than deleting them during service.</div>
                  </div>
                  <div className="metric-row compact">
                    <div className="metric-label">Use clear dietary labels</div>
                    <div className="metric-caption">They drive faster selection on touch-first order entry screens.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {showCategoryModal && (
          <div className="modal-overlay" onClick={() => setShowCategoryModal(false)}>
            <div className="modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Create Category</h2>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowCategoryModal(false)}>
                  <IconX />
                </button>
              </div>
              <form className="input-group" onSubmit={handleCreateCategory}>
                <label className="input-label">Category Name</label>
                <input className="input-field" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Example: Tandoor Specials" />
                <button className="btn btn-primary btn-full" type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Create Category'}
                </button>
              </form>
            </div>
          </div>
        )}

        {showItemModal && (
          <div className="modal-overlay" onClick={() => setShowItemModal(false)}>
            <div className="modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Create Menu Item</h2>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowItemModal(false)}>
                  <IconX />
                </button>
              </div>
              <form className="modal-form-grid" onSubmit={handleCreateItem}>
                <div className="input-group">
                  <label className="input-label">Item Name</label>
                  <input className="input-field" value={itemForm.name} onChange={(event) => setItemForm((prev) => ({ ...prev, name: event.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Category</label>
                  <select
                    className="input-field"
                    value={itemForm.categoryId}
                    onChange={(event) => setItemForm((prev) => ({ ...prev, categoryId: event.target.value }))}
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Price</label>
                  <input
                    className="input-field"
                    type="number"
                    min="0"
                    value={itemForm.price}
                    onChange={(event) => setItemForm((prev) => ({ ...prev, price: event.target.value }))}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Dietary Label</label>
                  <select
                    className="input-field"
                    value={itemForm.dietaryLabel}
                    onChange={(event) => setItemForm((prev) => ({ ...prev, dietaryLabel: event.target.value }))}
                  >
                    <option value="VEG">VEG</option>
                    <option value="NON_VEG">NON_VEG</option>
                    <option value="EGG">EGG</option>
                    <option value="VEGAN">VEGAN</option>
                  </select>
                </div>
                <div className="input-group span-2">
                  <label className="input-label">Description</label>
                  <input
                    className="input-field"
                    value={itemForm.description}
                    onChange={(event) => setItemForm((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Short service-facing description"
                  />
                </div>
                <div className="input-group span-2">
                  <label className="input-label">Item Photo</label>
                  <input className="input-field" type="file" accept="image/*" onChange={handleItemImageUpload} />
                  {itemForm.imageUrl ? (
                    <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                      <img
                        src={itemForm.imageUrl}
                        alt="Item preview"
                        style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--outline-variant)' }}
                      />
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setItemForm((prev) => ({ ...prev, imageUrl: '' }))}>
                        Remove photo
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="input-group span-2">
                  <label className="input-label">AI Tags</label>
                  <input
                    className="input-field"
                    value={itemForm.aiTags}
                    onChange={(event) => setItemForm((prev) => ({ ...prev, aiTags: event.target.value }))}
                    placeholder="Comma-separated tags like bestseller, combo, upsell"
                  />
                </div>
                <button className="btn btn-primary btn-full span-2" type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Create Item'}
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
