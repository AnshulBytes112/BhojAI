# BhojAI POS Frontend RoadMap & Implementation Guide

**Status**: Backend fully implemented | Frontend: UI flows to be built

This document outlines all backend features implemented and maps them to frontend components. Use this as a specification for building the React/Next.js POS interface.

---

## 🎯 Architecture Overview

```
Frontend (React/Next.js) ← REST API (Express/Node) ← SQLite (Prisma ORM)
- POS UI flows         - Order/Bill/Payment   - Multi-tenant data
- Offline sync         - Auth (JWT + 2FA)     - Audit trails  
- Service Worker       - AI suggestions       - Promotions
- Local queue          - KOT routing
```

---

## 📊 Backend Feature Inventory (✅ COMPLETE)

### Authentication & Authorization
| Endpoint | Method | Purpose | Notes |
|----------|--------|---------|-------|
| `/api/auth/login` | POST | Password + optional 2FA PIN login | Waiter 2FA: send `{ username, password, pin }` |
| `/api/auth/pin-login` | POST | Quick POS terminal login | For tablet/mobile quick sign-in |
| `/api/auth/me` | GET | Get logged-in user profile | Returns user + restaurant theme |
| `/api/auth/register-staff` | POST | Register waiter/chef/manager | ADMIN/MANAGER only |

**Frontend Mapping**:
- `LoginScreen` → `/api/auth/login` + optional PIN flow
- `PINPad` component → Fast waiter login
- `UserProfile` → `/api/auth/me`
- `StaffManagement` (admin) → `/api/auth/register-staff`

---

### Menu Management
| Endpoint | Method | Purpose | Notes |
|----------|--------|---------|-------|
| `/api/menu/categories` | GET | Fetch all menu categories + items | Includes availability & modifiers |
| `/api/menu/categories` | POST | Create category | ADMIN/MANAGER |
| `/api/menu/items` | GET | List menu items (filterable) | Query: `categoryId`, `available` |
| `/api/menu/items` | POST | Add menu item | ADMIN/MANAGER |
| `/api/menu/items/:id` | PATCH | Update item (price, availability, AI tags) | ADMIN/MANAGER |
| `/api/menu/items/:id` | DELETE | Remove item | ADMIN only |
| `/api/menu/items/:id/toggle` | PATCH | Quick toggle availability | ADMIN/MANAGER |
| `/api/menu/items/:menuItemId/modifiers` | POST | Add modifier group (e.g., size, toppings) | ADMIN/MANAGER |

**Frontend Mapping**:
- `MenuBrowser` → `/api/menu/categories` + `/api/menu/items`
- `MenuSearch` → `/api/menu/items?categoryId=X`
- `ItemSelector` (order entry) → Menu items with modifiers
- `MenuEditor` (admin) → `/api/menu/items` CRUD
- `Quick-Filter` (busy orders) → `/api/menu/items/:id/toggle`

**Implementation Notes**:
- Cache categories/items in local state
- Implement quick-search with fuzzy matching (Ctrl+F or voice)
- Show availability badge (red if unavailable, green if in stock)
- Drag-and-drop or swipe to add items to cart

---

### Order Management

#### Create Order
| Endpoint | Method | Details |
|----------|--------|---------|
| `/api/orders` | POST | Create order with initial items |

**Request**:
```json
{
  "tableId": "table-123",
  "type": "DINE_IN",
  "customerName": "John",
  "customerPhone": "9876543210",
  "guestCount": 4,
  "notes": "No onions",
  "items": [
    {
      "menuItemId": "item-1",
      "quantity": 2,
      "selectedModifiers": "300ml,ExtraSpice",
      "modifierTotal": 50,
      "notes": "Half-cooked"
    }
  ]
}
```

#### Manage Order Items
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/orders/:id` | GET | Fetch order + all items + bill |
| `/api/orders` | GET | List orders (filterable by status, date, table) |
| `/api/orders/:id/items` | PATCH | Add more items mid-order |
| `/api/orders/:id/status` | PATCH | Change status (PENDING→KITCHEN→READY→SERVED→COMPLETED) |

#### Billing & Payment
| Endpoint | Method | Purpose | Notes |
|----------|--------|---------|-------|
| `/api/orders/:id/bill` | POST | Generate bill | Optional discount & splitType |
| `/api/orders/:id/payment` | POST | Accept payment (order-scoped) | Multi-part payment safe |
| `/api/payments` | POST | Top-level payment endpoint | JSON: `{ orderId, amount, method, transactionId }` |
| `/api/orders/:id/audit-logs` | GET | Track all edits/payments (fraud control) | For verification |

**Payment Methods**: CASH, CARD, UPI, WALLET, CHECK, etc.

#### KOT (Kitchen Order Ticket)
```
Flow: Order Created → KOT auto-generated → Chef views in Kitchen Display System (KDS)
- `station: 'KITCHEN'` (default)
- Items grouped by station for multi-counter restaurants
- Status: PENDING → IN_PROGRESS → READY
```

**Frontend Mapping**:
- `TableLayout` (drag-n-drop) → Select table → `/api/tables`
- `OrderEntry` (quick search + add) → `/api/orders` POST
- `CartSummary` → Display items + mods + running total
- `OrderStatus` → `/api/orders/:id` GET (polling or WebSocket)
- `BillReview` (before payment) → Show totals + tax + discounts
- `PaymentModal` → `/api/payments` POST
- `AuditTrail` (manager view) → `/api/orders/:id/audit-logs`

---

### Bill Management (Split/Merge)

#### Split a Bill
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/bills/:id/split` | POST | Split 1 bill into N bills for table sharing |

**Request**:
```json
{
  "splits": [
    { "itemIds": ["item-1", "item-2"] },
    { "itemIds": ["item-3", "item-4"] }
  ]
}
```

**Response**:
```json
{
  "parentBillId": "bill-123",
  "childBillIds": ["bill-456", "bill-789"]
}
```

#### Merge Bills
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/bills/:id/merge` | POST | Combine child bills back to one |

**Request**: `{ "billIds": ["bill-456", "bill-789"] }`

#### Check & Print
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/bills/:id/reprint` | POST | Reprint bill (thermal printer format) |
| `/api/bills/:id/email-bill` | POST | Email bill to customer |

**Request**: `{ "customerEmail": "user@example.com" }`

#### List Bills
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/bills` | GET | Fetch bills (filterable) |
| `/api/bills/:id` | GET | Fetch single bill + items + payments + splits info |

**Frontend Mapping**:
- `SplitBillModal` (swipe gesture) → `/api/bills/:id/split`
- `MergeBillModal` → `/api/bills/:id/merge`
- `PrintDialog` → `/api/bills/:id/reprint` + trigger print queue
- `EmailBill` (takeaway) → `/api/bills/:id/email-bill`
- `BillHistory` (manager) → `/api/bills?date=X&isPaid=true`

---

### Table Management
| Endpoint | Method | Purpose | Notes |
|----------|--------|---------|-------|
| `/api/tables` | GET | List all tables + active orders | Status: AVAILABLE, OCCUPIED, RESERVED |
| `/api/tables` | POST | Create table | ADMIN/MANAGER |
| `/api/tables/:id` | PATCH | Rename/relocate table | ADMIN/MANAGER |
| `/api/tables/:id/status` | PATCH | Change status | PATCH `{ "status": "AVAILABLE\|OCCUPIED\|RESERVED" }` |
| `/api/tables/:id` | DELETE | Remove table | ADMIN only |

**Frontend Mapping**:
- `TableLayout` (drag-n-drop grid) → `/api/tables` GET
  - Visual status (green=AVAILABLE, red=OCCUPIED, yellow=RESERVED)
  - Click to select → Opens order entry or existing order
  - Long-press to edit/delete (admin only)
- `TableConfig` (admin) → CRUD endpoints
- **Real-time Update**: Use WebSocket or polling every 2-3 seconds

---

### Inventory
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/inventory` | GET | List stock items |
| `/api/inventory` | POST | Add item | ADMIN/MANAGER |
| `/api/inventory/:id` | PATCH | Update quantity/threshold | ADMIN/MANAGER |
| `/api/inventory/:id/adjust` | PATCH | Add/remove stock with reason | `{ "adjustment": 10, "reason": "Restock" }` |
| `/api/inventory/:id` | DELETE | Remove item | ADMIN only |

**Frontend Mapping**:
- `StockDashboard` → Fetch `?lowStock=true`
- `LowStockAlert` → Highlight red if `quantity <= minThreshold`
- `StockAdjustment` → `/api/inventory/:id/adjust`

---

### AI-Driven Features

#### Upsell Suggestions
| Endpoint | Method | Purpose | Notes |
|----------|--------|---------|-------|
| `/api/ai/upsell?menuItemIds=id1,id2` | GET | Suggest add-ons based on cart | Uses `aiTags` field in menu |

**Response**:
```json
{
  "suggestions": [
    { "id": "item-5", "name": "French Fries", "price": 100, "score": 2 },
    { "id": "item-6", "name": "Beverage", "price": 50, "score": 1 }
  ],
  "source": "ai_tags"
}
```

**Frontend Integration**:
- Show toast: "💡 **Popular with this combo**: French Fries?" [+Add]
- Appear after selecting 2+ items
- Max 3-5 suggestions

#### Combo Suggestions
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ai/combo-suggest` | POST | Learn co-ordered items | Request: `{ "menuItemId": "item-1" }` |

**Response**:
```json
{
  "combos": [
    { "id": "item-2", "name": "Drink", "price": 30, "count": 45 },
    { "id": "item-3", "name": "Dessert", "price": 120, "count": 32 }
  ],
  "basedOnOrders": 150
}
```

**Frontend Integration**:
- "Also popular:" combo list when item is selected
- Click to add pre-combo

#### Sales Analytics
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ai/insights` | GET | Hot/slow items + trends |

**Response**:
```json
{
  "insights": [
    {
      "type": "HOT_ITEM",
      "message": "🔥 Butter Chicken is a bestseller!",
      "data": { "id": "...", "name": "Butter Chicken", "count": 200, "revenue": 8000 }
    },
    {
      "type": "SLOW_ITEM",
      "message": "📉 Veg Biryani has low sales. Consider a discount.",
      "data": { "id": "...", "name": "Veg Biryani", "count": 12, "revenue": 480 }
    }
  ]
}
```

**Frontend Mapping**:
- `Analytics Dashboard` → Display insights
- `MenuEditor` → Show slow items with discount suggestion button
- `HomeScreen` → Feature hot items prominently

---

### Promotions & Discounts (Configurable)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/promotions` | GET | Fetch all active promotions |
| `/api/promotions` | POST | Create promotion rule | ADMIN/MANAGER |
| `/api/promotions/:id` | PATCH | Update rule (enable/disable, dates) | ADMIN/MANAGER |
| `/api/promotions/:id` | DELETE | Remove promotion | ADMIN/MANAGER |

**Promotion Types**: PERCENTAGE_DISCOUNT, FLAT_DISCOUNT, BUY_X_GET_Y, etc.

**Frontend Mapping**:
- `PromotionManager` (admin) → CRUD promotions
- `BillReview` → Auto-calculate applicable promotions
- `CouponInput` → Manual coupon code entry

---

### Dashboard & Analytics
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/dashboard/summary` | GET | Sales KPIs (revenue, orders, avg order value) |
| `/api/dashboard/top-items` | GET | Best-selling menu items + revenue |
| `/api/dashboard/hourly` | GET | Hourly revenue breakdown (today) |

**Frontend Mapping**:
- `DashboardHome` (manager) → `/api/dashboard/summary`
- `TopItemsChart` (bar chart) → `/api/dashboard/top-items`
- `RevenueGraph` (line chart) → `/api/dashboard/hourly`

---

## 🎨 Frontend Components & Data Flow

### Recommended Architecture Tree

```
App (Layout)
├── POS Module (Waiters)
│   ├── TableLayout
│   │   ├── TableGrid (drag-drop)
│   │   └── TableContextMenu
│   ├── OrderEntry
│   │   ├── MenuBrowser (categories + search)
│   │   ├── ItemSelector (with modifiers)
│   │   ├── CartSummary
│   │   └── AddItemButton
│   ├── OrderStatus
│   │   ├── KOTDisplay (live kitchen ticker)
│   │   └── ReadyItems
│   ├── BillGenerator
│   │   ├── BillPreview
│   │   ├── SplitBillFlow
│   │   ├── DiscountInput
│   │   └── ApplyCoupon
│   ├── PaymentFlow
│   │   ├── PaymentMethodSelector
│   │   ├── AmountInput
│   │   ├── CardReader (if integrated)
│   │   └── PaymentStatusIndicator
│   └── PrintFlow
│       ├── InvoicePrint (thermal format)
│       └── ReorderButton
│
├── KDS Module (Kitchen)
│   ├── KOTBoard (station-wise)
│   │   ├── KOTCard (drag-ready→preparing→done)
│   │   └── TimerBadge
│   └── CompletedOrders
│
├── Admin Module
│   ├── MenuEditor
│   │   ├── CategoryCRUD
│   │   └── ItemCRUD (with AI tags)
│   ├── PromotionManager
│   │   └── RuleBuilder
│   ├── TableConfig
│   │   └── GridBuilder
│   ├── StaffManager
│   │   └── RoleAssignment
│   ├── AnalyticsDashboard
│   │   ├── SummaryStat
│   │   ├── TopItemsChart
│   │   └── RevenueGraph
│   └── AuditLog
│       └── OrderHistory
│
└── Shared
    ├── Auth (Login + PIN)
    ├── UserProfile
    └── Offline Sync (Service Worker queue)
```

---

## 🔌 Frontend-to-Backend Mapping (Data Flows)

### Flow 1: Create Order & Billing

```
User selects Table
    ↓
[TableLayout] → GET /api/tables
    ↓
User clicks "New Order" → [OrderEntry]
    ↓
[MenuBrowser] → GET /api/menu/categories + /api/menu/items
    ↓
User selects item + modifiers + qty → [CartSummary]
    ↓
[AI] → GET /api/ai/upsell?menuItemIds=X,Y (show suggestions)
    ↓
User clicks "Finalize"
    ↓
POST /api/orders {tableId, items, customerName, ...}
    ↓
Response: order + auto-generated KOT
    ↓
[OrderStatus] displays "Order placed, kitchen notified"
    ↓
User can poll GET /api/orders/:id or WebSocket for KOT status
    ↓
When kitchen marks "READY", [ReadyItems] show "Table X, items ready"
    ↓
Waiter clicks "Serve table" → PATCH /api/orders/:id/status (SERVED)
    ↓
User clicks "Bill" → [BillGenerator]
    ↓
POST /api/orders/:id/bill {discountAmount?, discountNote?, splitType?}
    ↓
[BillPreview] shows items + tax + total
    ↓
User selects split → [SplitBillFlow] → POST /api/bills/:id/split
    ↓
Multiple [PaymentFlow] instances for each bill
    ↓
POST /api/payments {orderId, amount, method}
    ↓
Mark paid → PATCH /api/orders/:id/status (COMPLETED)
    ↓
[PrintFlow] → POST /api/bills/:id/reprint → Send to thermal printer
    ↓
Table marked AVAILABLE
```

### Flow 2: Kitchen Display System (KDS)

```
Order created → KOT auto-generated
    ↓
[KOTBoard] → Polling GET /api/orders?status=KITCHEN
    ↓
[KOTCard] shows items + order info + prep time estimate
    ↓
Chef drags card to "In Progress" → PATCH /api/orders/:id/status (KITCHEN→READY)
    ↓
Order moves to [CompletedOrders] column
    ↓
[ReadyItems] notification shown to waiters at POS
```

### Flow 3: Admin Analytics

```
[AnalyticsDashboard] loads
    ↓
GET /api/dashboard/summary + /api/dashboard/top-items + /api/dashboard/hourly
    ↓
Display KPIs: total revenue, order count, avg order value
    ↓
Chart: top 10 items by revenue
    ↓
Chart: hourly sales today
    ↓
[PromotionManager] → GET /api/promotions
    ↓
If slow item found → Suggest 20% discount → POST /api/promotions
```

---

## 💾 Offline-First Implementation

### Service Worker Flow
```typescript
// service-worker.ts
// 1. Cache all GET endpoints (menu, tables, etc.)
// 2. Store failed POST requests (orders, payments) in IndexedDB
// 3. Return cached responses when offline
// 4. Sync queue when online
// 5. Pre-load critical assets for next session

interface OfflineOrderQueue {
  id: string;
  endpoint: string; // /api/orders, /api/payments, etc.
  payload: object;
  timestamp: number;
  retryCount: number;
}
```

### Implementation Checklist
- [ ] Implement `useServiceWorker()` hook
- [ ] Cache static assets + API responses
- [ ] Queue failed requests in `localStorage` or `IndexedDB`
- [ ] Background sync when online `(SyncEvent)`
- [ ] Show "Offline Mode" badge + queue status
- [ ] Auto-retry failed requests with exponential backoff

---

## 🎤 Voice-Assisted Order Entry (Future Phase)

```typescript
// Pseudo-code for voice ordering
const [listening, setListening] = useState(false);

const handleVoiceOrder = async (transcript: string) => {
  // "Add 2 butter chicken and 1 coke"
  const parsed = parseNLPOrder(transcript); // ML model
  // parsed = { items: [{menuItemId, quantity}, ...] }
  
  const suggestions = await GET /api/ai/upsell?menuItemIds=X,Y;
  // User: "Do you have recommendations?"
  // Speech: "Butter chicken is popular. Would you like fries?"
  // User: "Yes"
  
  POST /api/orders { ...parsed };
};
```

---

## 🔐 State Management (Recommended: Zustand or Context API)

```typescript
// stores/authStore.ts
export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  login: async (username, password, pin?) => {
    const res = await POST /api/auth/login;
    set({ user: res.user, token: res.token });
  },
}));

// stores/orderStore.ts
export const useOrderStore = create((set) => ({
  currentOrder: null,
  cart: [],
  addToCart: (item) => set((state) => ({
    cart: [...state.cart, item]
  })),
  submitOrder: async () => {
    const res = await POST /api/orders { ...};
    set({ currentOrder: res });
  },
}));

// stores/tableStore.ts
export const useTableStore = create((set) => ({
  tables: [],
  selectedTableId: null,
  fetchTables: async () => {
    const res = await GET /api/tables;
    set({ tables: res });
  },
}));
```

---

## 📱 Responsive Design Guidelines

### Breakpoints
- **Mobile (< 640px)**: Portrait tablet + mobile phones
  - Single-column layout
  - Bottom nav for major sections (POS, KDS, Admin)
  - Swipe gestures for table nav
  
- **Tablet (640px - 1024px)**: iPad-sized
  - 2-column: Table layout + Order entry
  - Sidebar menu
  
- **Desktop (> 1024px)**: Full admin + POS on same screen
  - 3-column: Tables + Orders + Bill
  - Floating windows for KDS

### Touch-First Interactions
- **Swipe Left**: Delete item from cart
- **Swipe Right**: Merge bills
- **Long-Press**: Edit item quantity
- **Double-Tap**: Split bill
- **Pinch**: Zoom table layout
- **Tap + Hold**: Context menu

---

## 🎨 UI/UX Best Practices (Petpooja+ Features)

### 1. 3-Click Billing
- ✅ Click 1: Select table
- ✅ Click 2: Add items (auto-search on keyboard input)
- ✅ Click 3: Generate bill → Pay

**Implementation**: Hide unnecessary fields, auto-populate restaurant tax, show running total in real-time.

### 2. Drag-n-Drop Table Layout
- Drag table card to rearrange (for manager view)
- Context menu: Merge, Split, Rename
- Color-coded: Green (available), Red (occupied), Yellow (reserved)

### 3. Quick-Search Menu
- Ctrl+K or / : Focus search box
- Fuzzy match (typo tolerant)
- Show 5-10 results, click or arrow-key to select
- Press Enter to add (qty=1)

### 4. Gesture-Based Bill Split
- Swipe right on bill → Split dialog
- Select items from two columns (visual split)
- Swipe left to merge back (if unsplit)

### 5. Real-Time Notifications
- Toast: "Order ready at Table 5" (with sound)
- Badge: Pending payments count
- Timeline: Order created → KOT sent → Ready → Served → Billed

### 6. AI Upsell Nudges (Non-Intrusive)
- Toast bottom-left: "💡 Fries popular with combo [+Add]"
- Not modal/popup (avoids friction)
- Max 1 suggestion per 3 seconds

---

## 🔄 Local Storage & Caching Strategy

```typescript
// Local Storage Levels
localStorage
├── auth.token (JWT)
├── auth.user (JSON)
├── cache.menu (categories + items)
├── cache.tables (table list + status)
├── cache.restaurant (tax rate, service charge)
└── queue.offline (failed requests JSON array)

// IndexedDB (for larger data)
indexedDB
├── orders (completed today)
├── bills (all bills with items)
├── products (full menu with images)
└── audit_logs (local copy)
```

**Cache Expiry**:
- Menu/Tables: 30 mins (or manual refresh)
- User: 8 hrs (session)
- Order details: Session (until bill paid)

---

## 📋 Implementation Checklist for Frontend

### Phase 1: Core POS (Weeks 1-3)
- [ ] Login + PIN flow
- [ ] Table layout (static grid, no drag-drop yet)
- [ ] Quick menu search + item selector
- [ ] Cart + running total
- [ ] Bill generation + payment flow
- [ ] Print integration (thermal printer via receipt.js)

### Phase 2: Advanced POS (Weeks 4-5)
- [ ] Table drag-drop + status colors
- [ ] Bill split/merge UI
- [ ] KOT status polling (kitchen order tracking)
- [ ] Real-time notifications (WebSocket optional)
- [ ] AI upsell toasts

### Phase 3: Offline & KDS (Weeks 6-7)
- [ ] Service worker + offline detection
- [ ] Offline order queue + background sync
- [ ] Kitchen Display System (KOT board)
- [ ] Voice-assisted order entry (optional, Phase 4)

### Phase 4: Admin Dashboard (Week 8)
- [ ] Analytics + revenue charts
- [ ] Menu/Promotion editor
- [ ] Audit logs + order history
- [ ] Staff management + role permissions

---

## 🚀 Deployment Checklist

- [ ] Environment variables (.env.local, .env.production)
- [ ] API endpoint URL (dev vs prod)
- [ ] JWT secret matches backend
- [ ] Service worker registered in production
- [ ] Analytics tracking (optional: Mixpanel, Segment)
- [ ] Error reporting (Sentry)
- [ ] Build optimization: Code-splitting, lazy routes
- [ ] Database migration runs on server startup
- [ ] SSL/HTTPS enabled
- [ ] CORS configured correctly

---

## 📞 Backend API Contract Summary

**Base URL**: `http://localhost:3333/api`

**Headers Required**:
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

**Error Response Format**:
```json
{ "error": "Description message" }
```

**Success Response Format**:
```json
{
  "data": {...},
  "message": "Success"
}
```

---

## 🔗 Key Files Reference

**Backend**:
- Auth: `apps/api/src/modules/auth/auth.routes.ts`
- Orders & Billing: `apps/api/src/modules/pos/orders.routes.ts`
- Bills (Split/Merge): `apps/api/src/modules/pos/bills.routes.ts`
- Menu: `apps/api/src/modules/menu/menu.routes.ts`
- AI Suggestions: `apps/api/src/modules/ai/ai.routes.ts`
- Promotions: `apps/api/src/modules/pos/promotions.routes.ts`
- Dashboard: `apps/api/src/modules/dashboard/dashboard.routes.ts`
- Prisma Schema: `prisma/schema.prisma`

**Frontend (To Create)**:
- `apps/frontend/src/pages/pos/index.tsx` → Main POS flow
- `apps/frontend/src/pages/kds/index.tsx` → Kitchen display
- `apps/frontend/src/pages/admin/index.tsx` → Dashboard
- `apps/frontend/src/hooks/useOfflineQueue.ts` → Offline sync
- `apps/frontend/src/components/TableLayout.tsx` → Drag-drop tables
- `apps/frontend/src/components/OrderEntry.tsx` → Menu + cart

---

## ✅ Success Criteria

- All API endpoints return correct status codes (201 for creates, 200 for updates, 404 for not found, 400 for validation)
- Frontend can create orders, split bills, and process payments end-to-end
- Offline mode queues requests and syncs when online
- KOT appears in real-time (or polls every 2-3 seconds)
- AI suggestions show contextually
- Admin can manage menu, promotions, and view analytics
- Waiter 2FA works (PIN required after password for WAITER role)
- Multi-restaurant isolation enforced (user cannot access other restaurants' data)

---

**Ready to start building?** Pick one component from Phase 1 and follow the data flow above. Good luck! 🎉
