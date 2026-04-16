'use client';

import { create } from 'zustand';
import { apiRequest } from '../lib/api';

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';

export interface TableOrderSummary {
  id: string;
  total: number;
  itemCount: number;
  createdAt: string;
}

export interface TableRecord {
  id: string;
  name: string;
  capacity: number;
  status: TableStatus;
  posX?: number | null;
  posY?: number | null;
  area?: string | null;
  currentOrder?: TableOrderSummary;
}

interface TableStore {
  tables: TableRecord[];
  selectedTableId: string | null;
  isLoading: boolean;
  setTables: (tables: TableRecord[]) => void;
  setSelectedTableId: (tableId: string | null) => void;
  fetchTables: () => Promise<TableRecord[]>;
}

function normalizeTable(table: any): TableRecord {
  const liveOrder = Array.isArray(table.orders) ? table.orders[0] : undefined;
  const itemCount = Array.isArray(liveOrder?.items)
    ? liveOrder.items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0)
    : 0;

  return {
    id: table.id,
    name: table.number || table.label || table.id.slice(0, 4),
    capacity: Number(table.seatCapacity || table.capacity || 0),
    status: (table.status as TableStatus) || 'AVAILABLE',
    posX: typeof table.posX === 'number' ? table.posX : null,
    posY: typeof table.posY === 'number' ? table.posY : null,
    area: table.area || null,
    currentOrder: liveOrder
      ? {
          id: liveOrder.id,
          total: Number(liveOrder.bill?.totalAmount || 0),
          itemCount,
          createdAt: liveOrder.createdAt,
        }
      : undefined,
  };
}

export const useTableStore = create<TableStore>((set) => ({
  tables: [],
  selectedTableId: null,
  isLoading: false,

  setTables: (tables) => set({ tables }),
  setSelectedTableId: (tableId) => set({ selectedTableId: tableId }),

  fetchTables: async () => {
    set({ isLoading: true });
    try {
      const data = await apiRequest<any[]>('/tables');
      const tables = Array.isArray(data) ? data.map(normalizeTable) : [];
      set({ tables });
      return tables;
    } finally {
      set({ isLoading: false });
    }
  },
}));