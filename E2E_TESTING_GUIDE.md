# BhojAI Phase 2 - End-to-End Testing Guide

## Overview
This document provides a comprehensive testing checklist for all Phase 2 features implemented in the BhojAI frontend. Each feature has been implemented following the architecture guide and includes validation steps.

---

## ✅ Feature 1: Upsell Suggestions (Cart-Triggered)
**Location:** OrderEntry `/pos/order` - After 2+ items in cart

### What it does:
- When user adds 2+ items to cart, an 800ms debounced API call fetches upsell suggestions
- Toast notification appears showing "💡 **Popular with this combo**: [Item]?" with [+Add] button
- Max 3-5 suggestions shown
- One per session per item (duplicate suppression)

### Test Steps:
1. Open OrderEntry page
2. Select Paneer Tikka (item-1)
3. Add second item (e.g., Chicken Wings)
   - Expected: Toast notification appears after ~800ms with suggestion
   - Verify: `/api/upsell?menuItemIds=item-1,item-2` was called
4. Click [+Add] on toast
   - Expected: Item added to cart silently, toast dismisses
5. Add another item to verify fresh suggestion appears
   - Expected: New toast with different item (no duplicate)

### Test Failure Cases:
- If backend unavailable: Cart still works, no toast appears
- If no suggestions: No toast appears (expected behavior)

### Code Reference:
- [OrderEntry lines 408-455](apps/frontend/src/app/pos/order/page.tsx#L408-L455): Upsell debounce logic

---

## ✅ Feature 2: Combo Suggestions (Modal-Based)
**Location:** OrderEntry `/pos/order` - Modal triggered when selecting menu item

### What it does:
- User clicks menu item to add to cart
- Modal opens showing "Also Popular" items that frequently co-purchase with this item
- Each combo item shows frequency count (e.g., "Ordered 23 times with this")
- Modal has Skip/Done buttons to close gracefully

### Test Steps:
1. Open OrderEntry page
2. Click menu item (e.g., Butter Chicken)
   - Expected: Combo modal opens immediately
   - Modal title: "Also Popular"
   - Verify: `/api/ai/combo-suggest` was called with `{menuItemId: "item-4"}`
3. Review suggested items with count metadata
4. Click [+] on a suggested item
   - Expected: Item added to cart, stays in modal
5. Click Done button
   - Expected: Modal closes, original item already in cart
6. Verify cart shows both items

### Test Failure Cases:
- If backend unavailable: Modal still opens with fallback suggestions
- If no combos found: Modal opens with message "No suggestions available"

### Code Reference:
- [OrderEntry combo state: lines 250-253](apps/frontend/src/app/pos/order/page.tsx#L250-L253): Combo state management
- [OrderEntry fetchComboSuggestions: lines 700-715](apps/frontend/src/app/pos/order/page.tsx#L700-L715): API fetch logic

---

## ✅ Feature 3: AI-Driven Insights (Analytics Dashboard)
**Location:** Analytics `/analytics` - New "💡 AI-Driven Insights" section

### What it does:
- Shows machine learning analysis of sales patterns
- HOT_ITEM cards: 🔥 "Butter Chicken is a bestseller! Consider featuring it..."
- SLOW_ITEM cards: 📉 "Veg Biryani has low sales. Consider a 15% discount..."
- Each insight shows: Item name, order count, revenue
- SLOW_ITEM cards have "→ Create Promotion" button

### Test Steps:
1. Navigate to Analytics page
2. Scroll to "💡 AI-Driven Insights" section
   - Expected: Section visible with gradient background
   - Verify: `/api/ai/insights` was called on page load
3. Review HOT_ITEM and SLOW_ITEM insights
   - Expected: Clear messaging with emojis and recommendations
4. Click "→ Create Promotion" on SLOW_ITEM
   - Expected: Toast notification directing to Promotions page
5. Verify insights update when data changes
   - Expected: Fallback insights show if backend unavailable

### Test Failure Cases:
- If no insights available: Message "No insights available yet. Check back after more orders."
- If backend unavailable: Shows fallback demo insights

### Code Reference:
- [Analytics AI Insights interface: lines 11-17](apps/frontend/src/app/analytics/page.tsx#L11-L17): AIInsight type definition
- [Analytics fetch logic: lines 42-70](apps/frontend/src/app/analytics/page.tsx#L42-L70): Insights API integration
- [Analytics render: lines 180-240](apps/frontend/src/app/analytics/page.tsx#L180-L240): UI rendering

---

## ✅ Feature 4: Promotions Manager
**Location:** Sidebar "Promos" → `/promotions` - Role-restricted to ADMIN/MANAGER

### What it does:
- CRUD interface for creating discount rules
- Types: PERCENTAGE_DISCOUNT, FLAT_DISCOUNT, BUY_X_GET_Y
- Parameters: name, value, minOrderAmount, maxDiscountAmount, priority, dates, active status
- Backend API: GET/POST/PATCH/DELETE `/api/promotions`

### Test Steps:
1. Login as ADMIN or MANAGER
2. Click sidebar "Promos" button
   - Expected: Promotions page loads
   - Verify: Full-width admin layout with title "Promotions Manager"
3. Click "+ New Promotion" button
   - Expected: Form modal opens
4. Fill form:
   - Name: "Happy Hour 20% Off"
   - Type: PERCENTAGE_DISCOUNT
   - Value: 20
   - Min Order: 200
   - Click "Create"
   - Expected: Toast "✅ Created: Promotion 'Happy Hour 20% Off' created."
5. Verify promotion appears in list with:
   - Green border (Active)
   - Priority badge
   - Edit/Delete buttons
6. Click edit button on existing promotion
   - Expected: Form pre-fills with promotion data
7. Update and save
   - Expected: Toast "✅ Updated: Promotion updated."
8. Click delete button with confirmation
   - Expected: Toast "✅ Deleted: Promotion deleted."

### Test Access Control:
- Login as WAITER
- Navigate to `/promotions`
- Expected: "Access Restricted" message showing ADMIN/MANAGER only

### Test Failure Cases:
- If backend unavailable: Shows fallback demo promotions, local fallback operations

### Code Reference:
- [Promotions page: apps/frontend/src/app/promotions/page.tsx](apps/frontend/src/app/promotions/page.tsx): Full implementation

---

## ✅ Feature 5: Menu Editor with AI Tags
**Location:** Sidebar "Menu" → `/menu` - CRUD for categories and items with AI tags

### What it does:
- Create/edit menu items with AI tag support
- Tags are comma-separated (e.g., "bestseller,combo,upsell")
- Tags displayed as badges on each item card
- Search includes tag matching
- Tags used by upsell/combo AI features

### Test Steps:
1. Click sidebar "Menu" button
2. Click "+ New Item" button
3. Fill form:
   - Item Name: "Paneer Tikka Masala"
   - Category: Choose one
   - Price: 320
   - Dietary: VEG
   - AI Tags: "bestseller,combo,signature"
   - Click "Create Item"
   - Expected: Toast "✅ Menu item created"
4. Verify item appears in catalog with tags as badges
5. Search for tag: "bestseller"
   - Expected: Item appears in search results
6. Click item to edit and update tags
7. Verify tags reflect in new searches

### Test Fallback:
- If backend unavailable: Item created locally, shows fallback toast

### Code Reference:
- [Menu page AI tags field: lines 570-576](apps/frontend/src/app/menu/page.tsx#L570-L576): Form input
- [Menu display: lines 370-385](apps/frontend/src/app/menu/page.tsx#L370-L385): Tag rendering

---

## ✅ Feature 6: KDS and OrderEntry Integration
**Location:** KDS `/kds` ↔ OrderEntry `/pos/order` - End-to-end order workflow

### What it does:
- OrderEntry creates order → POST `/api/orders`
- KOT auto-generated and sent to KDS
- KDS polls `/api/kots` every 5 seconds
- Chef updates status: PENDING → IN_PROGRESS → READY
- OrderEntry polls `/api/orders/{id}` every 5 seconds
- When KDS marks READY, OrderEntry shows "🔔 Kitchen update: Order is READY"

### Test Steps (Multi-Tab):
1. **Tab 1 (OrderEntry):**
   - Add items to cart
   - Click "Finalize" to create order
   - Expected: Order created, shows order ID, status = PENDING
   - Note the order number

2. **Tab 2 (KDS):**
   - Refresh page
   - Expected: New order appears in PENDING column
   - Verify ticket shows correct table/order number and items
   - Verify timestamp shows elapsed time

3. **Tab 2 (KDS):**
   - Click "▶ Start Preparing" on the ticket
   - Expected: Ticket moves to IN_PROGRESS column, button changes to "Mark Ready"

4. **Tab 1 (OrderEntry):**
   - Wait ~5 seconds for polling
   - Expected: Order status updates to KITCHEN

5. **Tab 2 (KDS):**
   - Click "✅ Mark Ready" on the ticket
   - Expected: Ticket moves to READY column

6. **Tab 1 (OrderEntry):**
   - Wait ~5 seconds for polling
   - Expected: Toast notification "🔔 Kitchen update: Order [number] is READY"
   - Order status changes to READY

### Test Failure Cases:
- Backend unavailable: Both pages fall back to demo data
- Network delay: Polling continues, updates appear within 5 seconds

### Code Reference:
- [KDS fetch logic: lines 74-130](apps/frontend/src/app/kds/page.tsx#L74-L130): KOT polling
- [OrderEntry polling: lines 499-515](apps/frontend/src/app/pos/order/page.tsx#L499-L515): Order status polling
- [OrderEntry status change handler: lines 483-497](apps/frontend/src/app/pos/order/page.tsx#L483-L497): READY alert

---

## ✅ Feature 7: Bill Generation and Payment Flow
**Location:** OrderEntry `/pos/order` - After order items finalized

### What it does:
- Automatic bill generation with itemization and taxes
- Payment method selection: CASH, CARD, DIGITAL_WALLET, CHEQUE
- Support for partial payments and split bills
- Promotion rules applied at checkout
- Audit trail for all payment operations

### Test Steps:
1. In OrderEntry, add items and click "Finalize"
2. Verify bill shows:
   - Itemization with prices
   - Subtotal
   - Taxes (if configured)
   - Total amount
3. Select payment method (e.g., CARD)
4. Enter amount equal to total
5. Click "Process Payment"
   - Expected: Order marked COMPLETED, toast confirmation
6. Verify audit logs show payment entry

### Test Failure Cases:
- If backend unavailable: Bill still generates locally, fallback payment processing

---

## 📊 Test Matrix Summary

| Feature | Page | Type | Status | Notes |
|---------|------|------|--------|-------|
| Upsell Suggestions | OrderEntry | Toast | ✅ Implemented | 800ms debounce, one-per-session |
| Combo Suggestions | OrderEntry | Modal | ✅ Implemented | Historical co-purchase pattern |
| AI Insights | Analytics | Dashboard section | ✅ Implemented | HOT_ITEM & SLOW_ITEM cards |
| Promotions CRUD | `/promotions` | Admin page | ✅ Implemented | ADMIN/MANAGER access only |
| Menu Editor + Tags | `/menu` | Admin page | ✅ Implemented | Existing, enhanced with tags |
| KDS Integration | `/kds` ↔ `/pos/order` | Live workflow | ✅ Implemented | 5s polling + WebSocket fallback |
| Bill Generation | OrderEntry | Checkout | ✅ Implemented | Itemization + promotions |
| Payment Flow | OrderEntry | Checkout | ✅ Implemented | Multiple methods + split/merge |

---

## 🔍 Verification Checklist

### Backend APIs Required (Verify Working):
- [ ] GET `/api/upsell?menuItemIds=...` - Returns tag-based suggestions
- [ ] POST `/api/ai/combo-suggest` - Returns historical co-purchases
- [ ] GET `/api/ai/insights` - Returns HOT_ITEM & SLOW_ITEM analysis
- [ ] GET/POST/PATCH/DELETE `/api/promotions` - Promotion CRUD
- [ ] GET `/api/kots` - KOT listing with polling
- [ ] PATCH `/api/kots/{id}/status` - Status updates from KDS
- [ ] GET `/api/orders/{id}` - Order detail with status polling
- [ ] POST `/api/orders` - Order creation with auto-KOT generation

### Frontend Features Verified:
- [ ] All 6 pages load without TypeScript errors
- [ ] Sidebar navigation includes Promotions link
- [ ] Toasts auto-dismiss after 4-5 seconds
- [ ] Modals close gracefully with Skip/Done buttons
- [ ] Fallback data appears when backend unavailable
- [ ] Role-based access control enforced (WAITER vs ADMIN/MANAGER)
- [ ] Live polling updates every 5 seconds
- [ ] Status changes trigger notifications appropriately

---

## 🚀 Deployment Checklist

Before going to production:

1. **Environment Variables:**
   - [ ] NEXT_PUBLIC_API_URL set to backend server
   - [ ] NEXT_PUBLIC_API_URL uses HTTPS (if applicable)

2. **Backend Dependencies:**
   - [ ] All `/api/*` endpoints deployed and working
   - [ ] Database migrations applied (Prisma)
   - [ ] JWT authentication active
   - [ ] CORS configured for frontend domain

3. **Performance:**
   - [ ] Upsell debounce doesn't cause lag (verify 800ms delay)
   - [ ] KDS polling doesn't overload backend (5s interval reasonable)
   - [ ] Analytics page loads within 2 seconds

4. **Error Handling:**
   - [ ] Toast notifications appear for all error cases
   - [ ] Fallback data prevents white-screen crashes
   - [ ] Network disconnections gracefully degrade

5. **Testing:**
   - [ ] Run full test matrix in staging environment
   - [ ] Verify all browser compatibility (Chrome, Safari, Firefox)
   - [ ] Load test with 10+ concurrent users

---

## 📝 Notes

- All state management uses React hooks (useState, useCallback, useRef)
- API calls use the centralized `apiRequest()` helper with Bearer token injection
- CSS uses design tokens (--primary, --success, --danger, etc.)
- Toast notifications tracked by unique IDs to prevent duplicates
- All forms validate input before submission
- Fallback DEMO/FALLBACK data ensures app works offline

**Last Updated:** Phase 2 completion  
**Maintained By:** BhojAI Development Team
