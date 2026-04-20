'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  IconCard,
  IconCash,
  IconCheck,
  IconMinus,
  IconPlus,
  IconQR,
  IconSearch,
  IconX,
  Sidebar,
  ToastContainer,
  TopBar,
  type ToastItem,
} from '../../components/shared';
import { API_BASE, getStoredUser, apiRequest } from '../../lib/api';
import { useOrderStore } from '../../stores/orderStore';

const API = API_BASE;

interface MenuItem {
  id: string;
  name: string;
  price: number;
  available: boolean;
  categoryId: string;
  isVeg: boolean;
  aiTags?: string;
}

interface Category {
  id: string;
  name: string;
  emoji: string;
  items: MenuItem[];
}

interface CartItem extends MenuItem {
  quantity: number;
  subtotal: number;
  selectedModifiers: string;
  modifierTotal: number;
  notes: string;
}

interface OrderListItem {
  id: string;
  orderNumber?: string;
  status: string;
  type: string;
  customerName?: string | null;
  createdAt: string;
  table?: { id: string; number: string; label?: string | null } | null;
  items: Array<{ id: string; quantity: number; menuItem?: { name?: string | null } | null }>;
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
}

interface OrderDetail extends OrderListItem {
  notes?: string | null;
  customerPhone?: string | null;
  guestCount?: number | null;
}

interface AuditLog {
  id: string;
  action: string;
  description: string;
  createdAt: string;
  user?: { id: string; name?: string | null; role?: string | null } | null;
}

interface BillDetails {
  id: string;
  billNumber?: string;
  createdAt?: string;
  totalAmount?: number;
  isPaid?: boolean;
  childBills?: Array<{ id: string; totalAmount: number; isPaid: boolean }>;
}

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

interface RestaurantTableLookup {
  id: string;
  number?: string | null;
  label?: string | null;
}

interface ReprintPayload {
  bill?: {
    id: string;
    billNumber?: string;
    totalAmount?: number;
    createdAt?: string;
    order?: {
      orderNumber?: string;
      customerName?: string | null;
      table?: { number?: string | null } | null;
      items?: Array<{
        id: string;
        quantity: number;
        priceAtOrder?: number;
        modifierTotal?: number;
        menuItem?: { name?: string | null } | null;
      }>;
    };
    payments?: Array<{ id: string; amount: number; method: string }>;
    taxAmount?: number;
    serviceCharge?: number;
    discountAmount?: number;
    roundOff?: number;
  };
}

type SpeechRecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: null | (() => void);
  onend: null | (() => void);
  onerror: null | ((event: { error?: string }) => void);
  onresult: null | ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void);
  start: () => void;
  stop: () => void;
};

const VOICE_NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const VOICE_ITEM_ALIASES: Record<string, string> = {
  coke: 'soft drink',
  cola: 'soft drink',
  'coke zero': 'soft drink',
  soda: 'soft drink',
  'chicken butter masala': 'butter chicken',
  'butter naan': 'butter naan',
  'garlic bread': 'garlic naan',
  roti: 'tandoori roti',
};

const PAYMENT_METHODS = ['CASH', 'CARD', 'UPI', 'WALLET', 'CHECK'] as const;
const ORDER_STATUSES = ['PENDING', 'KITCHEN', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'] as const;

function OrderEntryContent() {
  const router = useRouter();
  const params = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedTableFromStore = useOrderStore((state) => state.selectedTableId);
  const setSelectedTableInStore = useOrderStore((state) => state.setSelectedTableId);

  const preselectedTableId = params.get('tableId') || '';
  const tableName = params.get('tableName') || 'Walk-in';

  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [type, setType] = useState<'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'>('DINE_IN');
  const [tableId, setTableId] = useState(preselectedTableId || selectedTableFromStore || '');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [guestCount, setGuestCount] = useState(2);
  const [orderNotes, setOrderNotes] = useState('');

  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [billDetails, setBillDetails] = useState<BillDetails | null>(null);
  const [isLiveSyncOn, setIsLiveSyncOn] = useState(true);
  const [lastKnownStatus, setLastKnownStatus] = useState('');

  const [statusToSet, setStatusToSet] = useState<(typeof ORDER_STATUSES)[number]>('PENDING');
  const [billDiscount, setBillDiscount] = useState(0);
  const [billDiscountNote, setBillDiscountNote] = useState('');
  const [billSplitType, setBillSplitType] = useState('NONE');
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [splitAssignments, setSplitAssignments] = useState<Record<string, 'A' | 'B'>>({});

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]>('CASH');
  const [transactionId, setTransactionId] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [billEmail, setBillEmail] = useState('');
  const [isBillHistoryModalOpen, setIsBillHistoryModalOpen] = useState(false);
  const [billHistory, setBillHistory] = useState<BillHistoryItem[]>([]);
  const [billHistoryDate, setBillHistoryDate] = useState('');
  const [billHistoryPaidOnly, setBillHistoryPaidOnly] = useState(true);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [reprintPayload, setReprintPayload] = useState<ReprintPayload | null>(null);
  const [swipeHintSeen, setSwipeHintSeen] = useState(false);
  const billTouchStartXRef = useRef<number | null>(null);

  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterTable, setFilterTable] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [userRole, setUserRole] = useState('WAITER');

  // AI Upsell Suggestions
  const [upsellSuggestions, setUpsellSuggestions] = useState<Array<{ id: string; name: string; price: number; score: number }>>([]);
  const [upsellSource, setUpsellSource] = useState<'ai_tags' | 'popular'>('ai_tags');
  const [lastUpsellCart, setLastUpsellCart] = useState<string>('');
  const upsellTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const upsellShownRef = useRef<Set<string>>(new Set());

  // Combo Suggestions
  const [comboSuggestions, setComboSuggestions] = useState<Array<{ id: string; name: string; price: number; count: number }>>([]);
  const [isComboModalOpen, setIsComboModalOpen] = useState(false);
  const [comboSourceItem, setComboSourceItem] = useState<MenuItem | null>(null);
  const [basedOnOrders, setBasedOnOrders] = useState(0);

  const [isVoiceSupported, setIsVoiceSupported] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [pendingVoiceSuggestion, setPendingVoiceSuggestion] = useState<{ id: string; name: string; price: number } | null>(null);
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);

  const [loading, setLoading] = useState({
    creatingOrder: false,
    loadingOrders: false,
    loadingOrder: false,
    loadingCategories: false,
    addingItems: false,
    updatingStatus: false,
    generatingBill: false,
    orderPayment: false,
    topPayment: false,
    loadingLogs: false,
    splittingBill: false,
    mergingBill: false,
    reprintingBill: false,
    emailingBill: false,
    loadingBillsHistory: false,
  });

  useEffect(() => {
    // Left intentionally blank because we have a useCallback for loadMenu
  }, []);

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth.token') || '' : '';

  const callApi = useCallback(
    async (path: string, init?: RequestInit) => {
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
    },
    [token]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const user = getStoredUser();
    setUserRole((user?.role || 'WAITER').toUpperCase());
  }, []);

  useEffect(() => {
    if (preselectedTableId || selectedTableFromStore) {
      setTableId(preselectedTableId || selectedTableFromStore || '');
    }
  }, [preselectedTableId, selectedTableFromStore]);

  useEffect(() => {
    setSelectedTableInStore(tableId || null);
  }, [setSelectedTableInStore, tableId]);

  const loadMenu = useCallback(async () => {
    setLoading((s) => ({ ...s, loadingCategories: true }));
    try {
      const [categoriesData, menuItemsData] = await Promise.all([callApi('/menu/categories'), callApi('/menu/items')]);
      const itemsByCategory = new Map<string, any[]>();

      if (Array.isArray(menuItemsData)) {
        for (const item of menuItemsData) {
          const categoryId = item?.categoryId;
          if (!categoryId) continue;
          const bucket = itemsByCategory.get(categoryId) || [];
          bucket.push(item);
          itemsByCategory.set(categoryId, bucket);
        }
      }

      const normalized: Category[] = (Array.isArray(categoriesData) ? categoriesData : []).map((cat) => ({
        id: cat.id,
        name: cat.name,
        emoji: cat.emoji || '🍽️',
        items: ((cat.items && cat.items.length > 0 ? cat.items : itemsByCategory.get(cat.id)) || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          price: Number(item.price || 0),
          available: Boolean(item.isAvailable ?? item.available),
          categoryId: cat.id,
          isVeg: (item.dietaryLabel || '').toUpperCase().includes('VEG'),
          aiTags: item.aiTags || '',
        })),
      }));

      if (normalized.length > 0) {
        setCategories(normalized);
        setActiveCategory(normalized[0].id);
      } else {
        setCategories([]);
      }
    } catch {
      addToast({ icon: '⚠️', title: 'Menu load failed', message: 'Failed to load menu data.' });
    } finally {
      setLoading((s) => ({ ...s, loadingCategories: false }));
    }
  }, [addToast, callApi]);

  const loadOrders = useCallback(async () => {
    setLoading((s) => ({ ...s, loadingOrders: true }));
    try {
      const qs = new URLSearchParams();
      if (filterStatus) qs.set('status', filterStatus);
      if (filterDate) qs.set('date', filterDate);
      if (filterTable) qs.set('tableId', filterTable);
      const data = await callApi(`/orders${qs.toString() ? `?${qs.toString()}` : ''}`);
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      addToast({ icon: '⚠️', title: 'Orders load failed', message: (err as Error).message });
    } finally {
      setLoading((s) => ({ ...s, loadingOrders: false }));
    }
  }, [addToast, callApi, filterDate, filterStatus, filterTable]);

  const loadOrderDetail = useCallback(
    async (orderId: string) => {
      if (!orderId) return;
      setLoading((s) => ({ ...s, loadingOrder: true }));
      try {
        const data = await callApi(`/orders/${orderId}`);
        setSelectedOrder(data as OrderDetail);
        setStatusToSet((data?.status as (typeof ORDER_STATUSES)[number]) || 'PENDING');

        const billTotal = Number(data?.bill?.totalAmount || 0);
        const paid = (data?.bill?.payments || []).reduce((sum: number, p: { amount: number }) => sum + Number(p.amount || 0), 0);
        const due = Math.max(billTotal - paid, 0);
        setPaymentAmount(due > 0 ? due.toFixed(2) : '');
      } catch (err) {
        addToast({ icon: '⚠️', title: 'Order details failed', message: (err as Error).message });
      } finally {
        setLoading((s) => ({ ...s, loadingOrder: false }));
      }
    },
    [addToast, callApi]
  );

  const loadAuditLogs = useCallback(async () => {
    if (!selectedOrderId) return;
    setLoading((s) => ({ ...s, loadingLogs: true }));
    try {
      const data = await callApi(`/orders/${selectedOrderId}/audit-logs`);
      setAuditLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      addToast({ icon: '⚠️', title: 'Audit logs failed', message: (err as Error).message });
    } finally {
      setLoading((s) => ({ ...s, loadingLogs: false }));
    }
  }, [addToast, callApi, selectedOrderId]);

  const loadBillDetails = useCallback(
    async (billId: string) => {
      if (!billId) {
        setBillDetails(null);
        return;
      }
      try {
        const details = await callApi(`/bills/${billId}`);
        setBillDetails(details as BillDetails);
      } catch {
        setBillDetails(null);
      }
    },
    [callApi]
  );

  useEffect(() => {
    void loadMenu();
    void loadOrders();
  }, [loadMenu, loadOrders]);

  // AI Upsell Suggestions - fetch when cart changes
  useEffect(() => {
    if (cart.length < 2) {
      setUpsellSuggestions([]);
      return;
    }

    // Debounce: only fetch if cart composition actually changed
    const cartKey = cart.map((c) => c.id).join(',');
    if (cartKey === lastUpsellCart) return;
    setLastUpsellCart(cartKey);

    // Clear previous timeout
    if (upsellTimeoutRef.current) clearTimeout(upsellTimeoutRef.current);

    // Set new debounce timeout
    upsellTimeoutRef.current = setTimeout(async () => {
      try {
        const menuItemIds = cart.map((c) => c.id).join(',');
        const suggestions = await callApi(`/ai/upsell?menuItemIds=${menuItemIds}`);

        if (suggestions.suggestions && suggestions.suggestions.length > 0) {
          setUpsellSuggestions(suggestions.suggestions);
          setUpsellSource(suggestions.source || 'ai_tags');

          // Show toast for each new suggestion (not shown before)
          for (const sugg of suggestions.suggestions) {
            if (!upsellShownRef.current.has(sugg.id)) {
              upsellShownRef.current.add(sugg.id);
              addToast({
                icon: '💡',
                title: 'Popular with this combo',
                message: `${sugg.name} (₹${sugg.price})`,
              });
              break; // Show one at a time
            }
          }
        }
      } catch {
        // Silent fail - AI upsell is non-critical
      }
    }, 800);

    return () => {
      if (upsellTimeoutRef.current) clearTimeout(upsellTimeoutRef.current);
    };
  }, [cart, lastUpsellCart, callApi, addToast]);

  useEffect(() => {
    if (selectedOrderId) {
      void loadOrderDetail(selectedOrderId);
      void loadAuditLogs();
    } else {
      setSelectedOrder(null);
      setAuditLogs([]);
      setBillDetails(null);
      setLastKnownStatus('');
    }
  }, [loadAuditLogs, loadOrderDetail, selectedOrderId]);

  useEffect(() => {
    if (selectedOrder?.bill?.id) {
      void loadBillDetails(selectedOrder.bill.id);
    } else {
      setBillDetails(null);
    }
  }, [loadBillDetails, selectedOrder?.bill?.id]);

  useEffect(() => {
    if (!selectedOrder?.status) return;

    if (lastKnownStatus && selectedOrder.status !== lastKnownStatus && selectedOrder.status === 'READY') {
      addToast({
        icon: '🔔',
        title: 'Kitchen update',
        message: `Order ${selectedOrder.orderNumber || selectedOrder.id.slice(0, 8)} is READY.`,
      });
    }

    setLastKnownStatus(selectedOrder.status);
  }, [addToast, lastKnownStatus, selectedOrder]);

  useEffect(() => {
    if (!isLiveSyncOn) return;

    const interval = window.setInterval(() => {
      void loadOrders();
      if (selectedOrderId) {
        void loadOrderDetail(selectedOrderId);
        void loadAuditLogs();
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [isLiveSyncOn, loadAuditLogs, loadOrderDetail, loadOrders, selectedOrderId]);

  useEffect(() => {
    if (!isLiveSyncOn || !selectedOrderId) return;

    const wsBase = API.replace(/^http/i, 'ws').replace(/\/api$/, '');
    const socket = new WebSocket(`${wsBase}/ws/orders`);

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.orderId === selectedOrderId) {
          void loadOrderDetail(selectedOrderId);
          void loadAuditLogs();
        }
      } catch {
        // Ignore malformed payloads and rely on polling.
      }
    };

    socket.onerror = () => {
      socket.close();
    };

    return () => {
      socket.close();
    };
  }, [isLiveSyncOn, loadAuditLogs, loadOrderDetail, selectedOrderId]);

  const addToCart = (item: MenuItem) => {
    if (!item.available) return;

    // Immediately add to cart
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.id === item.id
            ? {
              ...c,
              quantity: c.quantity + 1,
              subtotal: (c.quantity + 1) * c.price + c.modifierTotal,
            }
            : c
        );
      }
      return [
        ...prev,
        {
          ...item,
          quantity: 1,
          subtotal: item.price,
          selectedModifiers: '',
          modifierTotal: 0,
          notes: '',
        },
      ];
    });

    // Fetch combo suggestions for this item
    void fetchComboSuggestions(item);
  };

  const fetchComboSuggestions = async (item: MenuItem) => {
    try {
      const result = await callApi('/ai/combo-suggest', {
        method: 'POST',
        body: JSON.stringify({ menuItemId: item.id }),
      });

      if (result.combos && result.combos.length > 0) {
        setComboSourceItem(item);
        setComboSuggestions(result.combos);
        setBasedOnOrders(result.basedOnOrders || 0);
        setIsComboModalOpen(true);
      }
    } catch {
      // Silent fail - combo suggestions are non-critical
    }
  };

  const addComboItemToCart = (comboId: string, comboName: string, comboPrice: number) => {
    const fullItem = categories
      .flatMap((cat) => cat.items)
      .find((item) => item.id === comboId);

    const itemToAdd: MenuItem = fullItem || {
      id: comboId,
      name: comboName,
      price: comboPrice,
      available: true,
      categoryId: '',
      isVeg: false,
      aiTags: '',
    };

    setCart((prev) => {
      const existing = prev.find((c) => c.id === itemToAdd.id);
      if (existing) {
        return prev.map((c) =>
          c.id === itemToAdd.id
            ? {
              ...c,
              quantity: c.quantity + 1,
              subtotal: (c.quantity + 1) * c.price + c.modifierTotal,
            }
            : c
        );
      }
      return [
        ...prev,
        {
          ...itemToAdd,
          quantity: 1,
          subtotal: itemToAdd.price,
          selectedModifiers: '',
          modifierTotal: 0,
          notes: '',
        },
      ];
    });
    addToast({ icon: '✅', title: 'Added combo', message: `${comboName} added!` });
  };

  const addSuggestedItemToCart = (suggestionId: string, suggestionName: string, suggestionPrice: number) => {
    // Find full item details in categories if available
    const fullItem = categories
      .flatMap((cat) => cat.items)
      .find((item) => item.id === suggestionId);

    const itemToAdd: MenuItem = fullItem || {
      id: suggestionId,
      name: suggestionName,
      price: suggestionPrice,
      available: true,
      categoryId: '',
      isVeg: false,
      aiTags: '',
    };

    addToCart(itemToAdd);
    setUpsellSuggestions([]);
    upsellShownRef.current.delete(suggestionId);
    addToast({
      icon: '✅',
      title: 'Added to cart',
      message: `${suggestionName} added!`,
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id !== id) return item;
          const nextQty = item.quantity + delta;
          return {
            ...item,
            quantity: nextQty,
            subtotal: nextQty * item.price + item.modifierTotal,
          };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const patchCartItem = (id: string, partial: Partial<CartItem>) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...partial };
        const parsedModifier = Number(next.modifierTotal || 0);
        return {
          ...next,
          modifierTotal: Number.isFinite(parsedModifier) ? parsedModifier : 0,
          subtotal: next.quantity * next.price + (Number.isFinite(parsedModifier) ? parsedModifier : 0),
        };
      })
    );
  };

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.subtotal, 0), [cart]);

  const filteredMenu = useMemo(() => {
    if (!search.trim()) {
      return categories.find((cat) => cat.id === activeCategory)?.items || [];
    }
    const q = search.toLowerCase();
    return categories.flatMap((cat) => cat.items).filter((item) => item.name.toLowerCase().includes(q));
  }, [activeCategory, categories, search]);

  const menuCatalog = useMemo(() => categories.flatMap((cat) => cat.items), [categories]);

  const findMenuItemFromPhrase = useCallback(
    (phrase: string) => {
      const normalized = phrase.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!normalized) return null;

      const aliasResolved = VOICE_ITEM_ALIASES[normalized] || normalized;
      const direct = menuCatalog.find((item) => item.name.toLowerCase() === aliasResolved);
      if (direct) return direct;

      const includes = menuCatalog.find((item) => {
        const name = item.name.toLowerCase();
        return name.includes(aliasResolved) || aliasResolved.includes(name);
      });
      if (includes) return includes;

      const tokens = new Set(aliasResolved.split(' ').filter(Boolean));
      let bestMatch: MenuItem | null = null;
      let bestScore = 0;

      for (const item of menuCatalog) {
        const nameTokens = item.name.toLowerCase().split(' ').filter(Boolean);
        const overlap = nameTokens.reduce((score, token) => score + (tokens.has(token) ? 1 : 0), 0);
        if (overlap > bestScore) {
          bestScore = overlap;
          bestMatch = item;
        }
      }

      return bestScore >= 1 ? bestMatch : null;
    },
    [menuCatalog]
  );

  const parseVoiceItems = useCallback(
    (transcript: string) => {
      const cleaned = transcript
        .toLowerCase()
        .replace(/\b(and|plus|with|please|add|to cart|order)\b/g, ',')
        .replace(/\s+/g, ' ')
        .trim();

      const segments = cleaned
        .split(',')
        .map((segment) => segment.trim())
        .filter(Boolean);

      const parsed: Array<{ item: MenuItem; quantity: number }> = [];
      const unknownSegments: string[] = [];

      for (const segment of segments) {
        const qtyMatch = segment.match(/^(\d+)\s+(.*)$/);
        const wordMatch = segment.match(/^([a-z]+)\s+(.*)$/);

        let quantity = 1;
        let phrase = segment;

        if (qtyMatch) {
          quantity = Math.max(1, Number(qtyMatch[1]));
          phrase = qtyMatch[2].trim();
        } else if (wordMatch && VOICE_NUMBER_WORDS[wordMatch[1]]) {
          quantity = VOICE_NUMBER_WORDS[wordMatch[1]];
          phrase = wordMatch[2].trim();
        }

        const matched = findMenuItemFromPhrase(phrase);
        if (!matched) {
          unknownSegments.push(segment);
          continue;
        }

        parsed.push({ item: matched, quantity });
      }

      return { parsed, unknownSegments };
    },
    [findMenuItemFromPhrase]
  );

  const addVoiceParsedItemsToCart = useCallback((items: Array<{ item: MenuItem; quantity: number }>) => {
    if (items.length === 0) return;

    setCart((prev) => {
      const next = [...prev];
      for (const { item, quantity } of items) {
        const idx = next.findIndex((existing) => existing.id === item.id);
        if (idx >= 0) {
          const current = next[idx];
          const nextQty = current.quantity + quantity;
          next[idx] = {
            ...current,
            quantity: nextQty,
            subtotal: nextQty * current.price + current.modifierTotal,
          };
        } else {
          next.push({
            ...item,
            quantity,
            subtotal: quantity * item.price,
            selectedModifiers: '',
            modifierTotal: 0,
            notes: '',
          });
        }
      }
      return next;
    });
  }, []);

  const processVoiceOrder = useCallback(
    async (rawTranscript: string) => {
      const transcript = rawTranscript.trim();
      if (!transcript) return;

      setVoiceTranscript(transcript);
      const lower = transcript.toLowerCase();

      if (pendingVoiceSuggestion && /\b(yes|haan|ha|ok|okay|sure|add it|confirm)\b/.test(lower)) {
        addSuggestedItemToCart(pendingVoiceSuggestion.id, pendingVoiceSuggestion.name, pendingVoiceSuggestion.price);
        setPendingVoiceSuggestion(null);
        addToast({ icon: '🎤', title: 'Voice confirmed', message: `${pendingVoiceSuggestion.name} added.` });
        return;
      }

      if (pendingVoiceSuggestion && /\b(no|nah|skip|cancel|not now)\b/.test(lower)) {
        addToast({ icon: '🎤', title: 'Voice update', message: `Skipped ${pendingVoiceSuggestion.name}.` });
        setPendingVoiceSuggestion(null);
        return;
      }

      const { parsed, unknownSegments } = parseVoiceItems(transcript);
      if (parsed.length === 0) {
        addToast({ icon: '🎤', title: 'No menu items detected', message: 'Try: "Add 2 butter chicken and 1 soft drink".' });
        return;
      }

      addVoiceParsedItemsToCart(parsed);
      addToast({
        icon: '🎤',
        title: 'Voice items added',
        message: `${parsed.reduce((sum, row) => sum + row.quantity, 0)} item(s) added to cart.`,
      });

      if (unknownSegments.length > 0) {
        addToast({
          icon: 'ℹ️',
          title: 'Some items not matched',
          message: unknownSegments.slice(0, 2).join(', '),
        });
      }

      try {
        const menuItemIds = parsed.map((row) => row.item.id).join(',');
        const suggestions = await callApi(`/ai/upsell?menuItemIds=${menuItemIds}`);
        const topSuggestion = suggestions?.suggestions?.[0];
        if (topSuggestion) {
          setPendingVoiceSuggestion(topSuggestion);
          addToast({
            icon: '💡',
            title: 'Voice suggestion',
            message: `${topSuggestion.name} is popular. Say "yes" to add.`,
          });
        }
      } catch {
        // Keep voice flow resilient if upsell fails.
      }
    },
    [addSuggestedItemToCart, addToast, addVoiceParsedItemsToCart, callApi, parseVoiceItems, pendingVoiceSuggestion]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const ctor = (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition
      || (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition;

    if (!ctor) {
      setIsVoiceSupported(false);
      return;
    }

    setIsVoiceSupported(true);
    const recognition = new ctor();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsVoiceListening(true);
    recognition.onend = () => setIsVoiceListening(false);
    recognition.onerror = () => {
      setIsVoiceListening(false);
      addToast({ icon: '🎤', title: 'Voice error', message: 'Could not capture speech. Try again.' });
    };
    recognition.onresult = (event) => {
      const text = event?.results?.[0]?.[0]?.transcript || '';
      void processVoiceOrder(text);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [addToast, processVoiceOrder]);

  const startVoiceListening = () => {
    if (!isVoiceSupported || !recognitionRef.current) {
      addToast({ icon: '🎤', title: 'Not supported', message: 'Voice input is not supported in this browser.' });
      return;
    }

    try {
      recognitionRef.current.start();
    } catch {
      addToast({ icon: '🎤', title: 'Voice busy', message: 'Voice recognizer is already running.' });
    }
  };

  const stopVoiceListening = () => {
    recognitionRef.current?.stop();
    setIsVoiceListening(false);
  };

  const resolveTableIdForDineIn = useCallback(
    async (rawInput: string) => {
      const input = rawInput.trim();
      if (!input) return '';

      const normalized = input.toLowerCase();
      const tables = (await callApi('/tables')) as RestaurantTableLookup[];

      const exactId = tables.find((table) => table.id === input);
      if (exactId) return exactId.id;

      const byNumber = tables.find((table) => (table.number || '').toLowerCase() === normalized);
      if (byNumber) return byNumber.id;

      const byLabel = tables.find((table) => (table.label || '').toLowerCase() === normalized);
      if (byLabel) return byLabel.id;

      return '';
    },
    [callApi]
  );

  const createOrder = async () => {
    if (cart.length === 0) {
      addToast({ icon: '⚠️', title: 'Cart is empty', message: 'Add items before creating an order.' });
      return;
    }

    if (type === 'DINE_IN' && !tableId) {
      addToast({ icon: '⚠️', title: 'Table required', message: 'Select or enter a table ID for dine-in orders.' });
      return;
    }

    setLoading((s) => ({ ...s, creatingOrder: true }));
    try {
      let resolvedTableId = tableId.trim();
      if (type === 'DINE_IN') {
        resolvedTableId = await resolveTableIdForDineIn(resolvedTableId);
        if (!resolvedTableId) {
          addToast({
            icon: '⚠️',
            title: 'Invalid table',
            message: 'Use a valid table ID/number from Tables screen (e.g. T5).',
          });
          return;
        }
        if (resolvedTableId !== tableId) {
          setTableId(resolvedTableId);
        }
      }

      const payload = {
        tableId: type === 'DINE_IN' ? resolvedTableId : undefined,
        type,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        guestCount,
        notes: orderNotes || undefined,
        items: cart.map((item) => ({
          menuItemId: item.id,
          quantity: item.quantity,
          selectedModifiers: item.selectedModifiers || undefined,
          modifierTotal: Number(item.modifierTotal || 0),
          notes: item.notes || undefined,
        })),
      };

      const created = await callApi('/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSelectedOrderId(created.id);
      setCart([]);
      addToast({ icon: '✅', title: 'Order created', message: `Order ${created.orderNumber || created.id.slice(0, 8)} created.` });
      await loadOrders();
    } catch (err) {
      addToast({ icon: '❌', title: 'Create order failed', message: (err as Error).message });
    } finally {
      setLoading((s) => ({ ...s, creatingOrder: false }));
    }
  };

  const addItemsToOrder = async () => {
    if (!selectedOrderId || cart.length === 0) {
      addToast({ icon: '⚠️', title: 'Nothing to add', message: 'Select an order and keep items in cart.' });
      return;
    }

    setLoading((s) => ({ ...s, addingItems: true }));
    try {
      await callApi(`/orders/${selectedOrderId}/items`, {
        method: 'PATCH',
        body: JSON.stringify({
          items: cart.map((item) => ({
            menuItemId: item.id,
            quantity: item.quantity,
            selectedModifiers: item.selectedModifiers || undefined,
            modifierTotal: Number(item.modifierTotal || 0),
            notes: item.notes || undefined,
          })),
        }),
      });

      setCart([]);
      addToast({ icon: '➕', title: 'Items added', message: 'Additional items sent to kitchen.' });
      await loadOrderDetail(selectedOrderId);
      await loadOrders();
    } catch (err) {
      addToast({ icon: '❌', title: 'Add items failed', message: (err as Error).message });
    } finally {
      setLoading((s) => ({ ...s, addingItems: false }));
    }
  };

  const updateOrderStatus = async () => {
    if (!selectedOrderId) return;
    setLoading((s) => ({ ...s, updatingStatus: true }));
    try {
      await callApi(`/orders/${selectedOrderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: statusToSet }),
      });
      addToast({ icon: '🔄', title: 'Status updated', message: `Order moved to ${statusToSet}.` });
      await loadOrderDetail(selectedOrderId);
      await loadOrders();
      await loadAuditLogs();
    } catch (err) {
      addToast({ icon: '❌', title: 'Status update failed', message: (err as Error).message });
    } finally {
      setLoading((s) => ({ ...s, updatingStatus: false }));
    }
  };

  const generateBill = async () => {
    if (!selectedOrderId) return;
    setLoading((s) => ({ ...s, generatingBill: true }));
    try {
      await callApi(`/orders/${selectedOrderId}/bill`, {
        method: 'POST',
        body: JSON.stringify({
          discountAmount: billDiscount > 0 ? billDiscount : undefined,
          discountNote: billDiscountNote || undefined,
          splitType: billSplitType !== 'NONE' ? billSplitType : undefined,
        }),
      });
      addToast({ icon: '🧾', title: 'Bill generated', message: 'Bill created for selected order.' });
      await loadOrderDetail(selectedOrderId);
      await loadOrders();
      await loadAuditLogs();
    } catch (err) {
      addToast({ icon: '❌', title: 'Bill generation failed', message: (err as Error).message });
    } finally {
      setLoading((s) => ({ ...s, generatingBill: false }));
    }
  };

  const payOrderScoped = async () => {
    if (!selectedOrderId || !paymentAmount) return;
    setLoading((s) => ({ ...s, orderPayment: true }));
    try {
      await callApi(`/orders/${selectedOrderId}/payment`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(paymentAmount),
          method: paymentMethod,
          transactionId: transactionId || undefined,
        }),
      });
      addToast({ icon: '💳', title: 'Payment captured', message: `₹${paymentAmount} via ${paymentMethod}` });
      setTransactionId('');
      await loadOrderDetail(selectedOrderId);
      await loadOrders();
      await loadAuditLogs();
      setIsPaymentModalOpen(false);
      router.push('/pos/bills');
    } catch (err) {
      addToast({ icon: '❌', title: 'Order payment failed', message: (err as Error).message });
    } finally {
      setLoading((s) => ({ ...s, orderPayment: false }));
    }
  };

  const payTopLevel = async () => {
    if (!selectedOrderId || !paymentAmount) return;
    setLoading((s) => ({ ...s, topPayment: true }));
    try {
      await callApi('/payments', {
        method: 'POST',
        body: JSON.stringify({
          orderId: selectedOrderId,
          amount: Number(paymentAmount),
          method: paymentMethod,
          transactionId: transactionId || undefined,
        }),
      });
      addToast({ icon: '💰', title: 'Payment posted', message: 'Top-level payments endpoint used successfully.' });
      setTransactionId('');
      await loadOrderDetail(selectedOrderId);
      await loadOrders();
      await loadAuditLogs();
      setIsPaymentModalOpen(false);
      router.push('/pos/bills');
    } catch (err) {
      addToast({ icon: '❌', title: 'Top-level payment failed', message: (err as Error).message });
    } finally {
      setLoading((s) => ({ ...s, topPayment: false }));
    }
  };

  const openSplitModal = () => {
    if (!selectedOrder?.bill?.id) {
      addToast({ icon: '⚠️', title: 'No bill found', message: 'Generate bill first before splitting.' });
      return;
    }

    const items = selectedOrder.items || [];
    if (items.length < 2) {
      addToast({ icon: '⚠️', title: 'Not enough items', message: 'Need at least 2 order items to split.' });
      return;
    }

    // Pre-fill alternating groups so staff can quickly adjust exact assignment.
    const seeded = items.reduce<Record<string, 'A' | 'B'>>((acc, item, index) => {
      acc[item.id] = index % 2 === 0 ? 'A' : 'B';
      return acc;
    }, {});

    setSplitAssignments(seeded);
    setIsSplitModalOpen(true);
  };

  const submitManualSplit = async () => {
    if (!selectedOrder?.bill?.id) {
      addToast({ icon: '⚠️', title: 'No bill found', message: 'Generate bill first before splitting.' });
      return;
    }

    const items = selectedOrder.items || [];
    const first = items.filter((item) => splitAssignments[item.id] === 'A').map((item) => item.id);
    const second = items.filter((item) => splitAssignments[item.id] === 'B').map((item) => item.id);

    const unassigned = items.filter((item) => !splitAssignments[item.id]);
    if (unassigned.length > 0) {
      addToast({ icon: '⚠️', title: 'Assign all items', message: 'Every line item must be assigned to Group A or Group B.' });
      return;
    }

    if (!first.length || !second.length) {
      addToast({ icon: '⚠️', title: 'Invalid groups', message: 'Both Group A and Group B need at least one item.' });
      return;
    }

    setLoading((s) => ({ ...s, splittingBill: true }));
    try {
      await callApi(`/bills/${selectedOrder.bill.id}/split`, {
        method: 'POST',
        body: JSON.stringify({
          splits: [{ itemIds: first }, { itemIds: second }],
        }),
      });

      setIsSplitModalOpen(false);
      addToast({ icon: '✂️', title: 'Bill split complete', message: 'Manual split created into two child bills.' });
      await loadOrderDetail(selectedOrderId);
      await loadBillDetails(selectedOrder.bill.id);
      await loadAuditLogs();
    } catch (err) {
      addToast({ icon: '❌', title: 'Bill split failed', message: (err as Error).message });
    } finally {
      setLoading((s) => ({ ...s, splittingBill: false }));
    }
  };

  const mergeChildBills = async () => {
    if (!selectedOrder?.bill?.id) {
      addToast({ icon: '⚠️', title: 'No bill found', message: 'Generate bill first before merge.' });
      return;
    }

    const childIds = (billDetails?.childBills || []).map((bill) => bill.id);
    if (childIds.length === 0) {
      addToast({ icon: '⚠️', title: 'No child bills', message: 'Split this bill first, then merge.' });
      return;
    }

    setLoading((s) => ({ ...s, mergingBill: true }));
    try {
      await callApi(`/bills/${selectedOrder.bill.id}/merge`, {
        method: 'POST',
        body: JSON.stringify({ billIds: childIds }),
      });
      addToast({ icon: '🔗', title: 'Bills merged', message: `Merged ${childIds.length} child bills.` });
      await loadOrderDetail(selectedOrderId);
      await loadBillDetails(selectedOrder.bill.id);
      await loadAuditLogs();
    } catch (err) {
      addToast({ icon: '❌', title: 'Bill merge failed', message: (err as Error).message });
    } finally {
      setLoading((s) => ({ ...s, mergingBill: false }));
    }
  };

  const reprintBill = async () => {
    if (!selectedOrder?.bill?.id) {
      addToast({ icon: '⚠️', title: 'No bill', message: 'Generate a bill before reprint.' });
      return;
    }

    setLoading((s) => ({ ...s, reprintingBill: true }));
    try {
      const payload = (await callApi(`/bills/${selectedOrder.bill.id}/reprint`, { method: 'POST' })) as ReprintPayload;
      setReprintPayload(payload || null);
      setIsPrintPreviewOpen(true);
      addToast({ icon: '🖨️', title: 'Print preview ready', message: 'Thermal receipt layout is ready to print.' });
      await loadAuditLogs();
    } catch (err) {
      addToast({ icon: '❌', title: 'Reprint failed', message: (err as Error).message });
    } finally {
      setLoading((s) => ({ ...s, reprintingBill: false }));
    }
  };

  const openEmailModal = () => {
    if (!selectedOrder?.bill?.id) {
      addToast({ icon: '⚠️', title: 'No bill', message: 'Generate a bill before emailing.' });
      return;
    }
    setIsEmailModalOpen(true);
  };

  const emailBillToCustomer = async () => {
    if (!selectedOrder?.bill?.id) return;

    const email = billEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      addToast({ icon: '⚠️', title: 'Invalid email', message: 'Enter a valid customer email address.' });
      return;
    }

    setLoading((s) => ({ ...s, emailingBill: true }));
    try {
      await callApi(`/bills/${selectedOrder.bill.id}/email-bill`, {
        method: 'POST',
        body: JSON.stringify({ customerEmail: email }),
      });
      addToast({ icon: '📧', title: 'Bill emailed', message: `Invoice sent to ${email}` });
      setIsEmailModalOpen(false);
      setBillEmail('');
      await loadAuditLogs();
    } catch (err) {
      addToast({ icon: '❌', title: 'Email failed', message: (err as Error).message });
    } finally {
      setLoading((s) => ({ ...s, emailingBill: false }));
    }
  };

  const loadBillHistory = useCallback(async () => {
    setLoading((s) => ({ ...s, loadingBillsHistory: true }));
    try {
      const qs = new URLSearchParams();
      if (billHistoryPaidOnly) qs.set('isPaid', 'true');
      const data = await callApi(`/bills${qs.toString() ? `?${qs.toString()}` : ''}`);
      const rows = (Array.isArray(data) ? data : []) as BillHistoryItem[];
      const filtered = billHistoryDate
        ? rows.filter((row) => {
          const d = new Date(row.createdAt);
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}` === billHistoryDate;
        })
        : rows;
      setBillHistory(filtered);
    } catch (err) {
      addToast({ icon: '❌', title: 'Bill history failed', message: (err as Error).message });
    } finally {
      setLoading((s) => ({ ...s, loadingBillsHistory: false }));
    }
  }, [addToast, billHistoryDate, billHistoryPaidOnly, callApi]);

  const openBillHistoryModal = () => {
    if (!(userRole === 'MANAGER' || userRole === 'ADMIN')) {
      addToast({ icon: '⚠️', title: 'Role restricted', message: 'Bill history is manager/admin only.' });
      return;
    }
    setIsBillHistoryModalOpen(true);
    void loadBillHistory();
  };

  const onBillTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    billTouchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const onBillTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const startX = billTouchStartXRef.current;
    billTouchStartXRef.current = null;
    if (startX === null) return;

    const endX = e.changedTouches[0]?.clientX ?? startX;
    const deltaX = endX - startX;

    if (Math.abs(deltaX) < 70) return;

    if (deltaX > 0) {
      openSplitModal();
      addToast({ icon: '👉', title: 'Swipe right detected', message: 'Opened Split Bill modal.' });
    } else {
      void mergeChildBills();
      addToast({ icon: '👈', title: 'Swipe left detected', message: 'Triggered Merge Bills action.' });
    }
  };

  const printThermalPreview = () => {
    document.body.classList.add('print-thermal-mode');
    window.print();
    window.setTimeout(() => {
      document.body.classList.remove('print-thermal-mode');
    }, 300);
  };

  const paidAmount = (selectedOrder?.bill?.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const billTotal = Number(selectedOrder?.bill?.totalAmount || 0);
  const billDue = Math.max(billTotal - paidAmount, 0);
  const billSubTotal = Number(selectedOrder?.bill?.subTotal || 0);
  const billTax = Number(selectedOrder?.bill?.taxAmount || 0);
  const billDiscountAmount = Number(selectedOrder?.bill?.discountAmount || 0);
  const billServiceCharge = Number(selectedOrder?.bill?.serviceCharge || 0);
  const billRoundOff = Number(selectedOrder?.bill?.roundOff || 0);

  const filteredAuditLogs = useMemo(() => {
    if (!auditActionFilter.trim()) return auditLogs;
    const q = auditActionFilter.trim().toLowerCase();
    return auditLogs.filter((log) => log.action.toLowerCase().includes(q) || log.description.toLowerCase().includes(q));
  }, [auditActionFilter, auditLogs]);

  const openPaymentModal = () => {
    if (!selectedOrderId) {
      addToast({ icon: '⚠️', title: 'Select order', message: 'Choose an order first for payment.' });
      return;
    }
    if (!selectedOrder?.bill?.id) {
      addToast({ icon: '⚠️', title: 'No bill', message: 'Generate a bill before taking payment.' });
      return;
    }
    if (!paymentAmount && billDue > 0) {
      setPaymentAmount(billDue.toFixed(2));
    }
    setIsPaymentModalOpen(true);
  };

  const canManageAudit = userRole === 'MANAGER' || userRole === 'ADMIN';

  return (
    <div className="pos-layout">
      <Sidebar activePath="/pos/order" />

      <div className="pos-main">
        <TopBar
          title="RestroBit"
          subtitle=""
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div className="topbar-search">
                <IconSearch />
                <input placeholder="Search (Ctrl+/)" />
              </div>
              <div style={{ width: 20, height: 20, color: 'var(--on-surface-dim)' }}><IconCard /></div>
              <div className="topbar-avatar">S</div>
            </div>
          }
        />
        <div className="pos-redesign">
          {/* LEFT COLUMN: Menu Panel */}
          <div className="pos-left-side">
            <div style={{ padding: 16, borderBottom: '1px solid var(--outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>Point of Sale (POS)</div>
                <div style={{ fontSize: 12, color: 'var(--on-surface-dim)' }}>Dashboard • Pos</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={() => setCart([])}>+ New</button>
                <button className="btn btn-secondary btn-sm" onClick={() => router.push('/pos/tables')}>QR Menu Orders</button>
                <button className="btn btn-secondary btn-sm">Draft List</button>
                <button className="btn btn-secondary btn-sm" onClick={() => router.push('/pos/tables')}>Table Order</button>
              </div>
            </div>

            <div className="pos-top-filters">
              <div className="input-with-icon" style={{ flex: 1 }}>
                <span className="input-icon"><IconSearch /></span>
                <input
                  ref={searchRef}
                  className="input-field"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search in products"
                />
              </div>
              <select className="input-field" style={{ width: 150 }} value={activeCategory} onChange={(e) => setActiveCategory(e.target.value)}>
                <option value="">All Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select className="input-field" style={{ width: 140 }}>
                <option>Select Brand</option>
              </select>
            </div>
            
            {/* Order Filters */}
            <div className="pos-top-filters" style={{ marginTop: 8, padding: '8px 16px', backgroundColor: 'var(--surface-container-low)' }}>
              <select className="input-field" style={{ width: 140 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">All Status</option>
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>{status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' ')}</option>
                ))}
              </select>
              <input 
                className="input-field" 
                style={{ width: 140 }} 
                type="date" 
                value={filterDate} 
                onChange={(e) => setFilterDate(e.target.value)} 
              />
              <select className="input-field" style={{ width: 140 }} value={filterTable} onChange={(e) => setFilterTable(e.target.value)}>
                <option value="">All Tables</option>
                <option value="T1">Table 1</option>
                <option value="T2">Table 2</option>
                <option value="T3">Table 3</option>
                <option value="T4">Table 4</option>
              </select>
              <button className="btn btn-secondary btn-sm" onClick={() => {
                setFilterStatus('');
                setFilterDate('');
                setFilterTable('');
              }}>Clear Filters</button>
            </div>

            <div className="category-pill-scroll">
              <button
                className={`category-pill ${activeCategory === '' || activeCategory === categories[0]?.id ? 'active' : ''}`}
                onClick={() => { setActiveCategory(''); setSearch(''); }}
              >
                Show All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  className={`category-pill ${activeCategory === cat.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setSearch('');
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="menu-redesign-grid">
              {loading.loadingCategories ? (
                <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--on-surface-dim)' }}>
                  <img src="/placeholder-loading.svg" alt="Loading..." style={{ width: 48, height: 48, filter: 'grayscale(1)', opacity: 0.5, animation: 'spin 1s linear infinite', marginBottom: 12 }} />
                  <div>Loading Menu...</div>
                </div>
              ) : (
                <>
                  {filteredMenu.map((item) => (
                    <div key={item.id} className="menu-redesign-card" onClick={() => addToCart(item)}>
                      {item.aiTags?.includes('bestseller') && (
                        <span className="badge badge-warning" style={{ position: 'absolute', top: 6, left: 6, fontSize: 10 }}>Best</span>
                      )}
                      <div className="menu-redesign-img-placeholder">
                        {categories.find(c => c.id === item.categoryId)?.emoji || '🍽️'}
                      </div>
                      <div className="menu-redesign-title">{item.name}</div>
                      <div className="menu-redesign-price">${item.price.toFixed(2)}</div>
                      <button className="menu-add-btn" onClick={(e) => { e.stopPropagation(); addToCart(item); }}>
                        <div style={{ width: 12, height: 12, marginTop: 4, marginLeft: 6 }}><IconPlus /></div>
                      </button>
                    </div>
                  ))}
                  {filteredMenu.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', color: 'var(--on-surface-dim)', textAlign: 'center', padding: '40px 0' }}>
                      No items found
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Cart Panel */}
          <div className="pos-right-side">
            <div className="pos-top-filters">
              <div className="input-with-icon" style={{ flex: 1 }}>
                <span className="input-icon"><IconSearch /></span>
                <input className="input-field" placeholder="Search in Existing" />
              </div>
            </div>
            <div style={{ padding: '0 16px 16px', display: 'flex', gap: 8, borderBottom: '1px solid var(--outline-variant)' }}>
              <select className="input-field" style={{ flex: 1 }} value={type} onChange={(e) => setType(e.target.value as any)}>
                <option value="DINE_IN">Dine In</option>
                <option value="TAKEAWAY">Takeaway</option>
                <option value="DELIVERY">Delivery</option>
              </select>
              <select className="input-field" style={{ flex: 1 }} value={tableId} onChange={(e) => setTableId(e.target.value)}>
                <option value="">Select Table</option>
                <option value={preselectedTableId || 'T1'}>{tableName !== 'Walk-in' ? tableName : (preselectedTableId || 'T1')}</option>
              </select>
            </div>

            <div className="cart-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 18, height: 18 }}><IconCard /></div>
                Order #{selectedOrder?.orderNumber || selectedOrderId?.slice(0, 4) || 'New'}
              </span>
              <span style={{ color: 'var(--primary)' }}></span>
            </div>

            <div className="cart-item-list">
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--on-surface-dim)', marginTop: 40 }}>Cart is empty</div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="cart-item-card">
                    <div className="cart-item-top">
                      <span className="cart-item-title">{item.name}</span>
                      <button className="btn btn-ghost btn-icon" onClick={() => setCart((prev) => prev.filter((x) => x.id !== item.id))} style={{ color: 'var(--danger)', width: 24, height: 24, padding: 0 }}>
                        <div style={{ width: 14, height: 14, marginTop: 4, marginLeft: 2 }}><IconX /></div>
                      </button>
                    </div>
                    <div className="cart-item-price-calc">
                      ${item.price.toFixed(2)} × {item.quantity} = ${item.subtotal.toFixed(2)}
                    </div>
                    <div className="cart-item-bot">
                      <div className="qty-control">
                        <button className="qty-btn" onClick={() => updateQuantity(item.id, -1)}>-</button>
                        <span className="qty-val">{item.quantity}</span>
                        <button className="qty-btn" onClick={() => updateQuantity(item.id, 1)}>+</button>
                      </div>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '4px 8px', border: '1px solid var(--outline-variant)' }}>
                        📝 Add Notes
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="cart-summary">
              <div className="summary-row">
                <span>Sub total :</span>
                <strong>${subtotal.toFixed(2)}</strong>
              </div>
              <div className="summary-row">
                <span>Product Discount :</span>
                <strong>0.00$</strong>
              </div>
              <div className="summary-row">
                <span>Extra Discount :</span>
                <strong>0.00$</strong>
              </div>
              <div className="summary-row">
                <span>Coupon discount :</span>
                <strong>0.00$</strong>
              </div>
              <div className="summary-row total">
                <span>Total :</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="cart-actions-grid">
              <button className="btn btn-primary btn-full" onClick={createOrder} disabled={loading.creatingOrder || cart.length === 0}>
                {loading.creatingOrder ? 'Creating...' : 'Place Order'}
              </button>
              <button className="btn btn-col-1 btn-full" onClick={createOrder} disabled={loading.creatingOrder || cart.length === 0}>KOT & Print</button>
              <button className="btn btn-col-2 btn-full">Draft</button>
              <button className="btn btn-col-3 btn-full" onClick={openPaymentModal}>Bill & Payment</button>
              <button className="btn btn-col-4 btn-full" onClick={generateBill}>Bill & Print</button>
            </div>
          </div>
        </div>
      </div>

      {isSplitModalOpen && selectedOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.42)',
            backdropFilter: 'blur(2px)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: 'min(760px, 96vw)',
              maxHeight: '86vh',
              overflow: 'hidden',
              background: 'var(--surface)',
              border: '1px solid var(--outline-variant)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 30px 80px rgba(0,0,0,0.22)',
              display: 'grid',
              gridTemplateRows: 'auto 1fr auto',
            }}
          >
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>Manual Bill Split</div>
                <div style={{ fontSize: 12, color: 'var(--on-surface-dim)' }}>Assign each order item to Group A or Group B.</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsSplitModalOpen(false)}>
                <IconX style={{ width: 12, height: 12 }} /> Close
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: 12, display: 'grid', gap: 8 }}>
              {(selectedOrder.items || []).map((item) => {
                const group = splitAssignments[item.id];
                return (
                  <div key={item.id} style={{ border: '1px solid var(--outline-variant)', borderRadius: 'var(--radius-md)', padding: 10, display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', background: 'var(--surface-low)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{item.menuItem?.name || `Item ${item.id.slice(0, 8)}`}</div>
                      <div style={{ fontSize: 11, color: 'var(--on-surface-dim)' }}>Qty: {item.quantity}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className={`btn btn-sm ${group === 'A' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setSplitAssignments((prev) => ({ ...prev, [item.id]: 'A' }))}
                      >
                        Group A
                      </button>
                      <button
                        className={`btn btn-sm ${group === 'B' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setSplitAssignments((prev) => ({ ...prev, [item.id]: 'B' }))}
                      >
                        Group B
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ borderTop: '1px solid var(--outline-variant)', padding: '10px 12px', display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--on-surface-dim)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Group A items: {(selectedOrder.items || []).filter((item) => splitAssignments[item.id] === 'A').length}</span>
                <span>Group B items: {(selectedOrder.items || []).filter((item) => splitAssignments[item.id] === 'B').length}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setIsSplitModalOpen(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary btn-sm" onClick={submitManualSplit} disabled={loading.splittingBill}>
                  {loading.splittingBill ? 'Splitting...' : 'Confirm Split'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isPaymentModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.42)',
            backdropFilter: 'blur(2px)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: 'min(480px, 96vw)',
              background: 'var(--surface)',
              border: '1px solid var(--outline-variant)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 24px 65px rgba(0,0,0,0.22)',
              display: 'grid',
              gap: 10,
              padding: 14,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>Payment Modal</div>
                <div style={{ fontSize: 12, color: 'var(--on-surface-dim)' }}>Post payment through /api/payments</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsPaymentModalOpen(false)}>
                <IconX style={{ width: 12, height: 12 }} /> Close
              </button>
            </div>

            <div style={{ border: '1px solid var(--outline-variant)', borderRadius: 'var(--radius-md)', background: 'var(--surface-low)', padding: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Order</span><strong>{selectedOrder?.orderNumber || selectedOrderId}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Bill total</span><strong>₹{billTotal.toLocaleString('en-IN')}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Outstanding due</span><strong style={{ color: 'var(--danger)' }}>₹{billDue.toLocaleString('en-IN')}</strong></div>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 6 }}>
                {[
                  { key: 'CASH', icon: <IconCash style={{ width: 16, height: 16 }} /> },
                  { key: 'CARD', icon: <IconCard style={{ width: 16, height: 16 }} /> },
                  { key: 'UPI', icon: <IconQR style={{ width: 16, height: 16 }} /> },
                ].map((method) => (
                  <button
                    key={method.key}
                    className={`payment-method-btn ${paymentMethod === method.key ? 'selected' : ''}`}
                    style={{ padding: '8px 6px', fontSize: 11 }}
                    onClick={() => setPaymentMethod(method.key as (typeof PAYMENT_METHODS)[number])}
                  >
                    {method.icon}
                    {method.key}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <input className="input-field" style={{ fontSize: 12, padding: '8px 10px' }} type="number" min={0} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Amount" />
                <input className="input-field" style={{ fontSize: 12, padding: '8px 10px' }} value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="Txn ID (optional)" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsPaymentModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={async () => {
                  await payTopLevel();
                  setIsPaymentModalOpen(false);
                }}
                disabled={!selectedOrderId || !paymentAmount || loading.topPayment}
              >
                {loading.topPayment ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isEmailModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.42)',
            backdropFilter: 'blur(2px)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: 'min(460px, 96vw)',
              background: 'var(--surface)',
              border: '1px solid var(--outline-variant)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 24px 65px rgba(0,0,0,0.22)',
              display: 'grid',
              gap: 10,
              padding: 14,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>Email Bill</div>
                <div style={{ fontSize: 12, color: 'var(--on-surface-dim)' }}>Send invoice to customer email</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsEmailModalOpen(false)}>
                <IconX style={{ width: 12, height: 12 }} /> Close
              </button>
            </div>

            <div style={{ border: '1px solid var(--outline-variant)', borderRadius: 'var(--radius-md)', background: 'var(--surface-low)', padding: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Bill</span><strong>{billDetails?.billNumber || selectedOrder?.bill?.id}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Total</span><strong>₹{billTotal.toLocaleString('en-IN')}</strong></div>
            </div>

            <input
              className="input-field"
              style={{ fontSize: 13, padding: '10px 12px' }}
              placeholder="customer@example.com"
              value={billEmail}
              onChange={(e) => setBillEmail(e.target.value)}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsEmailModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={emailBillToCustomer} disabled={loading.emailingBill}>
                {loading.emailingBill ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isBillHistoryModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.42)',
            backdropFilter: 'blur(2px)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: 'min(860px, 96vw)',
              maxHeight: '88vh',
              overflow: 'hidden',
              background: 'var(--surface)',
              border: '1px solid var(--outline-variant)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 24px 65px rgba(0,0,0,0.22)',
              display: 'grid',
              gridTemplateRows: 'auto auto 1fr',
            }}
          >
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>Bill History</div>
                <div style={{ fontSize: 12, color: 'var(--on-surface-dim)' }}>Manager audit of bills, payments, and split state</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsBillHistoryModalOpen(false)}>
                <IconX style={{ width: 12, height: 12 }} /> Close
              </button>
            </div>

            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--outline-variant)', display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8 }}>
              <input className="input-field" type="date" value={billHistoryDate} onChange={(e) => setBillHistoryDate(e.target.value)} />
              <button className={`btn btn-sm ${billHistoryPaidOnly ? 'btn-success' : 'btn-ghost'}`} onClick={() => setBillHistoryPaidOnly((v) => !v)}>
                {billHistoryPaidOnly ? 'Paid Only' : 'All Bills'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => void loadBillHistory()} disabled={loading.loadingBillsHistory}>
                {loading.loadingBillsHistory ? 'Loading...' : 'Refresh'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setBillHistoryDate(''); setBillHistoryPaidOnly(true); }}>
                Reset
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: 12, display: 'grid', gap: 8 }}>
              {billHistory.map((bill) => {
                const paid = (bill.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
                const due = Math.max(Number(bill.totalAmount || 0) - paid, 0);
                return (
                  <div key={bill.id} style={{ border: '1px solid var(--outline-variant)', background: 'var(--surface-low)', borderRadius: 'var(--radius-lg)', padding: 10, display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800 }}>{bill.billNumber || bill.id.slice(0, 8)}</div>
                        <div style={{ fontSize: 11, color: 'var(--on-surface-dim)' }}>
                          {bill.order?.orderNumber || bill.order?.id || 'Order unavailable'}
                          {bill.order?.table?.number ? ` • Table ${bill.order.table.number}` : ''}
                          {bill.order?.customerName ? ` • ${bill.order.customerName}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span className={`badge ${bill.isPaid ? 'badge-success' : 'badge-warning'}`}>{bill.isPaid ? 'Paid' : 'Unpaid'}</span>
                        {(bill.childBills || []).length > 0 && <span className="badge badge-info">Split {(bill.childBills || []).length}</span>}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8, fontSize: 11 }}>
                      <div><span style={{ color: 'var(--on-surface-dim)' }}>Total</span><div style={{ fontWeight: 700 }}>₹{Number(bill.totalAmount || 0).toLocaleString('en-IN')}</div></div>
                      <div><span style={{ color: 'var(--on-surface-dim)' }}>Paid</span><div style={{ fontWeight: 700 }}>₹{paid.toLocaleString('en-IN')}</div></div>
                      <div><span style={{ color: 'var(--on-surface-dim)' }}>Due</span><div style={{ fontWeight: 700, color: due > 0 ? 'var(--danger)' : 'var(--success)' }}>₹{due.toLocaleString('en-IN')}</div></div>
                      <div><span style={{ color: 'var(--on-surface-dim)' }}>Created</span><div style={{ fontWeight: 700 }}>{new Date(bill.createdAt).toLocaleString('en-IN')}</div></div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          if (bill.order?.id) {
                            setSelectedOrderId(bill.order.id);
                            setIsBillHistoryModalOpen(false);
                            addToast({ icon: '🧾', title: 'Order selected', message: `Loaded ${bill.order.orderNumber || bill.order.id.slice(0, 8)}` });
                          } else {
                            addToast({ icon: '⚠️', title: 'Order missing', message: 'This bill is not linked to a retrievable order.' });
                          }
                        }}
                      >
                        Open Related Order
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedOrderId(bill.order?.id || ''); setIsBillHistoryModalOpen(false); }}>
                        Close
                      </button>
                    </div>
                  </div>
                );
              })}
              {billHistory.length === 0 && <div style={{ fontSize: 12, color: 'var(--on-surface-dim)', padding: '8px 2px' }}>No bills found for current filter.</div>}
            </div>
          </div>
        </div>
      )}

      {isPrintPreviewOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.42)',
            backdropFilter: 'blur(2px)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: 'min(520px, 96vw)',
              maxHeight: '88vh',
              overflow: 'hidden',
              background: 'var(--surface)',
              border: '1px solid var(--outline-variant)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 24px 65px rgba(0,0,0,0.22)',
              display: 'grid',
              gridTemplateRows: 'auto 1fr auto',
            }}
          >
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>Thermal Print Preview</div>
                <div style={{ fontSize: 12, color: 'var(--on-surface-dim)' }}>Receipt-sized output optimized for thermal printers</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsPrintPreviewOpen(false)}>
                <IconX style={{ width: 12, height: 12 }} /> Close
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: 14, display: 'grid', placeItems: 'center', background: 'var(--surface-low)' }}>
              <div className="thermal-print-root">
                <div className="thermal-print-header">
                  <h3>BhojAI Restaurant</h3>
                  <p>{new Date().toLocaleString('en-IN')}</p>
                </div>
                <div className="thermal-print-meta">
                  <div>Bill: {reprintPayload?.bill?.billNumber || selectedOrder?.bill?.id || 'N/A'}</div>
                  <div>Order: {reprintPayload?.bill?.order?.orderNumber || selectedOrder?.orderNumber || selectedOrderId || 'N/A'}</div>
                  <div>Customer: {reprintPayload?.bill?.order?.customerName || selectedOrder?.customerName || 'Walk-in'}</div>
                  <div>Table: {reprintPayload?.bill?.order?.table?.number || selectedOrder?.table?.number || '-'}</div>
                </div>
                <div className="thermal-divider" />
                <div className="thermal-print-items">
                  {(reprintPayload?.bill?.order?.items || selectedOrder?.items || []).map((item) => {
                    const name = item.menuItem?.name || `Item ${item.id.slice(0, 6)}`;
                    const quantity = Number(item.quantity || 0);
                    const unit = Number((item as any).priceAtOrder || 0) + Number((item as any).modifierTotal || 0);
                    const amount = Math.max(quantity * unit, 0);
                    return (
                      <div key={item.id} className="thermal-item-row">
                        <span>{quantity} x {name}</span>
                        <span>₹{amount.toLocaleString('en-IN')}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="thermal-divider" />
                <div className="thermal-print-totals">
                  <div><span>Subtotal</span><span>₹{billSubTotal.toLocaleString('en-IN')}</span></div>
                  <div><span>Tax</span><span>₹{billTax.toLocaleString('en-IN')}</span></div>
                  <div><span>Service</span><span>₹{billServiceCharge.toLocaleString('en-IN')}</span></div>
                  <div><span>Discount</span><span>- ₹{billDiscountAmount.toLocaleString('en-IN')}</span></div>
                  <div><span>Round Off</span><span>₹{billRoundOff.toLocaleString('en-IN')}</span></div>
                  <div className="thermal-total"><span>Total</span><span>₹{billTotal.toLocaleString('en-IN')}</span></div>
                </div>
                <div className="thermal-divider" />
                <p className="thermal-footer">Thank you for dining with us!</p>
              </div>
            </div>

            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--outline-variant)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsPrintPreviewOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={printThermalPreview}>
                Print Thermal Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Combo Suggestions Modal */}
      {isComboModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--outline-variant)',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{
              padding: '20px',
              borderBottom: '1px solid var(--outline-variant)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700 }}>Also Popular</div>
                <div style={{ fontSize: '12px', color: 'var(--on-surface-dim)' }}>
                  Often ordered with {comboSourceItem?.name}
                  {basedOnOrders > 0 && ` (${basedOnOrders} orders)`}
                </div>
              </div>
              <button
                onClick={() => setIsComboModalOpen(false)}
                className="btn btn-ghost btn-icon"
                style={{ width: '32px', height: '32px' }}
              >
                <IconX style={{ width: '16px', height: '16px' }} />
              </button>
            </div>

            <div style={{
              flex: 1,
              overflow: 'y-auto',
              padding: '16px',
              display: 'grid',
              gap: '12px',
            }}>
              {comboSuggestions.map((combo, idx) => (
                <div
                  key={combo.id}
                  style={{
                    background: 'var(--surface-container)',
                    border: '1px solid var(--outline-variant)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{combo.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--on-surface-dim)' }}>
                      ₹{combo.price} · {combo.count}x ordered
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      addComboItemToCart(combo.id, combo.name, combo.price);
                      // Remove from suggestions
                      setComboSuggestions((prev) => prev.filter((_, i) => i !== idx));
                    }}
                  >
                    + Add
                  </button>
                </div>
              ))}

              {comboSuggestions.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  color: 'var(--on-surface-dim)',
                  padding: '40px 20px',
                  fontSize: '13px',
                }}>
                  No combo suggestions available for this item.
                </div>
              )}
            </div>

            <div style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--outline-variant)',
              display: 'grid',
              gap: '8px',
              gridTemplateColumns: '1fr 1fr',
            }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setIsComboModalOpen(false)}
              >
                Skip
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setIsComboModalOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={<div style={{ height: '100vh', display: 'grid', placeItems: 'center', color: 'var(--on-surface-dim)' }}>Loading order module...</div>}>
      <OrderEntryContent />
    </Suspense>
  );
}
