'use client';

import { create } from 'zustand';
import { apiRequest } from '../lib/api';

export interface OrderCartItem {
  id: string;
  name: string;
  price: number;
  available: boolean;
  categoryId: string;
  isVeg: boolean;
  aiTags?: string;
  quantity: number;
  subtotal: number;
  selectedModifiers: string;
  modifierTotal: number;
  notes: string;
}

export interface CurrentOrderSummary {
  id: string;
  orderNumber?: string;
  status?: string;
  type?: string;
  tableId?: string | null;
  createdAt?: string;
}

export interface OrderItemInput {
  menuItemId: string;
  quantity: number;
  selectedModifiers?: string;
  modifierTotal?: number;
  notes?: string;
}

export interface SubmitOrderInput {
  tableId?: string;
  type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  customerName?: string;
  customerPhone?: string;
  guestCount?: number;
  notes?: string;
  items?: OrderItemInput[];
}

interface OrderStore {
  currentOrder: CurrentOrderSummary | null;
  cart: OrderCartItem[];
  selectedTableId: string | null;
  isSubmitting: boolean;
  setSelectedTableId: (tableId: string | null) => void;
  setCurrentOrder: (order: CurrentOrderSummary | null) => void;
  setCart: (cart: OrderCartItem[]) => void;
  addToCart: (item: Omit<OrderCartItem, 'quantity' | 'subtotal' | 'selectedModifiers' | 'modifierTotal' | 'notes'>, quantity?: number) => void;
  updateCartItem: (itemId: string, partial: Partial<OrderCartItem>) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  submitOrder: (input: SubmitOrderInput) => Promise<CurrentOrderSummary>;
}

function normalizeCartItem(
  item: Omit<OrderCartItem, 'quantity' | 'subtotal' | 'selectedModifiers' | 'modifierTotal' | 'notes'>,
  quantity: number
): OrderCartItem {
  return {
    ...item,
    quantity,
    subtotal: item.price * quantity,
    selectedModifiers: '',
    modifierTotal: 0,
    notes: '',
  };
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  currentOrder: null,
  cart: [],
  selectedTableId: null,
  isSubmitting: false,

  setSelectedTableId: (tableId) => set({ selectedTableId: tableId }),
  setCurrentOrder: (order) => set({ currentOrder: order }),
  setCart: (cart) => set({ cart }),

  addToCart: (item, quantity = 1) => {
    set((state) => {
      const existing = state.cart.find((cartItem) => cartItem.id === item.id);
      if (existing) {
        return {
          cart: state.cart.map((cartItem) => {
            if (cartItem.id !== item.id) return cartItem;
            const nextQuantity = cartItem.quantity + quantity;
            return {
              ...cartItem,
              quantity: nextQuantity,
              subtotal: nextQuantity * cartItem.price + cartItem.modifierTotal,
            };
          }),
        };
      }

      return {
        cart: [...state.cart, normalizeCartItem(item, quantity)],
      };
    });
  },

  updateCartItem: (itemId, partial) => {
    set((state) => ({
      cart: state.cart.map((item) => {
        if (item.id !== itemId) return item;
        const next = { ...item, ...partial };
        const parsedModifier = Number(next.modifierTotal || 0);
        return {
          ...next,
          modifierTotal: Number.isFinite(parsedModifier) ? parsedModifier : 0,
          subtotal: next.quantity * next.price + (Number.isFinite(parsedModifier) ? parsedModifier : 0),
        };
      }),
    }));
  },

  removeFromCart: (itemId) => set((state) => ({ cart: state.cart.filter((item) => item.id !== itemId) })),

  clearCart: () => set({ cart: [] }),

  submitOrder: async (input) => {
    const state = get();
    const items = input.items || state.cart.map((item) => ({
      menuItemId: item.id,
      quantity: item.quantity,
      selectedModifiers: item.selectedModifiers || undefined,
      modifierTotal: Number(item.modifierTotal || 0),
      notes: item.notes || undefined,
    }));

    set({ isSubmitting: true });
    try {
      const created = await apiRequest<CurrentOrderSummary>('/orders', {
        method: 'POST',
        body: {
          tableId: input.tableId ?? state.selectedTableId ?? undefined,
          type: input.type,
          customerName: input.customerName || undefined,
          customerPhone: input.customerPhone || undefined,
          guestCount: input.guestCount,
          notes: input.notes || undefined,
          items,
        },
      });

      set({ currentOrder: created, cart: [] });
      return created;
    } finally {
      set({ isSubmitting: false });
    }
  },
}));