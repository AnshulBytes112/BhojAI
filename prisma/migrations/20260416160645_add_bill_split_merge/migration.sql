-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "subTotal" REAL NOT NULL,
    "taxAmount" REAL NOT NULL,
    "discountAmount" REAL NOT NULL DEFAULT 0,
    "discountNote" TEXT,
    "serviceCharge" REAL NOT NULL DEFAULT 0,
    "totalAmount" REAL NOT NULL,
    "roundOff" REAL NOT NULL DEFAULT 0,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "billNumber" TEXT,
    "splitType" TEXT,
    "parentBillId" TEXT,
    "splitStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Bill_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bill_parentBillId_fkey" FOREIGN KEY ("parentBillId") REFERENCES "Bill" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Bill" ("billNumber", "createdAt", "discountAmount", "discountNote", "id", "isPaid", "orderId", "roundOff", "serviceCharge", "splitType", "subTotal", "taxAmount", "totalAmount", "updatedAt") SELECT "billNumber", "createdAt", "discountAmount", "discountNote", "id", "isPaid", "orderId", "roundOff", "serviceCharge", "splitType", "subTotal", "taxAmount", "totalAmount", "updatedAt" FROM "Bill";
DROP TABLE "Bill";
ALTER TABLE "new_Bill" RENAME TO "Bill";
CREATE UNIQUE INDEX "Bill_orderId_key" ON "Bill"("orderId");
CREATE TABLE "new_OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "priceAtOrder" REAL NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "selectedModifiers" TEXT,
    "modifierTotal" REAL NOT NULL DEFAULT 0,
    "assignedBillId" TEXT,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_assignedBillId_fkey" FOREIGN KEY ("assignedBillId") REFERENCES "Bill" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OrderItem" ("id", "menuItemId", "modifierTotal", "notes", "orderId", "priceAtOrder", "quantity", "selectedModifiers", "status") SELECT "id", "menuItemId", "modifierTotal", "notes", "orderId", "priceAtOrder", "quantity", "selectedModifiers", "status" FROM "OrderItem";
DROP TABLE "OrderItem";
ALTER TABLE "new_OrderItem" RENAME TO "OrderItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
