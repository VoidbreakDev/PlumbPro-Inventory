# Purchase Orders System - Implementation Guide

## Overview

A streamlined Purchase Order (PO) system tailored for your warehouse management needs. No unnecessary approval workflows - just practical PO tracking with job integration and Smart Ordering connection.

---

## What's Been Built

### ✅ Database Schema (6 Tables)

**Core Tables:**
1. **`purchase_orders`** - Main PO records
   - Auto-generated PO numbers (PO-2024-001)
   - Status tracking (draft → sent → received)
   - Financial totals with tax and shipping
   - Supplier linking

2. **`purchase_order_items`** - Line items
   - Product details
   - Quantities ordered vs. received
   - Unit pricing and line totals
   - Optional job assignment per item

3. **`purchase_order_jobs`** - Job linking
   - Many-to-many relationship
   - Track which POs support which jobs

4. **`purchase_order_history`** - Audit trail
   - Status changes
   - Who made changes
   - When changes occurred

5. **`purchase_order_receipts`** - Receipt tracking
   - Support partial deliveries
   - Who received items
   - When items arrived

6. **`purchase_order_receipt_items`** - Receipt line items
   - Quantity received per item
   - Notes on condition/issues

### ✅ Backend API (Complete)

**Endpoints:**
```
GET    /api/purchase-orders              # List all POs
GET    /api/purchase-orders/:id          # Get specific PO with items & jobs
POST   /api/purchase-orders              # Create new PO
PUT    /api/purchase-orders/:id          # Update draft PO
POST   /api/purchase-orders/:id/send     # Mark as sent to supplier
POST   /api/purchase-orders/:id/receive  # Record receipt (partial/full)
POST   /api/purchase-orders/:id/cancel   # Cancel PO
DELETE /api/purchase-orders/:id          # Delete draft PO
GET    /api/purchase-orders/stats/summary # Get statistics
```

**Features:**
- Automatic PO numbering (PO-YYYY-###)
- Auto-calculated totals
- Status change logging
- User authentication
- Data isolation per user

---

## Key Features

### 1. **Smart Ordering Integration**

Convert Smart Ordering suggestions directly into POs:

```typescript
// From OrderingView - Generate PO button
const suggestions = await generateSmartSuggestions();

// Create PO from suggestions
await createPurchaseOrder({
  supplier_id: supplier.id,
  items: suggestions.map(item => ({
    inventory_item_id: item.inventory_item_id,
    item_name: item.item_name,
    quantity_ordered: item.suggested_order_quantity,
    unit_price: item.item_price,
    supplier_code: item.supplier_code
  })),
  notes: 'Generated from Smart Ordering'
});
```

### 2. **Job Tracking**

Link POs to jobs for cost tracking:

```typescript
// When creating job-specific PO
await createPurchaseOrder({
  items: jobMaterials,
  job_ids: [jobId],
  notes: `Materials for Job: ${jobTitle}`
});

// Later: View all POs for a job
const jobPOs = await getPurchaseOrders({ job_id: jobId });
```

### 3. **Manual PO Creation**

Create POs independently of Smart Ordering:

```typescript
await createPurchaseOrder({
  supplier_id: supplierId,
  items: [
    {
      inventory_item_id: item1.id,
      item_name: '2" PVC Pipe',
      quantity_ordered: 50,
      unit_price: 3.50
    },
    {
      inventory_item_id: item2.id,
      item_name: 'Copper Fittings',
      quantity_ordered: 100,
      unit_price: 1.25
    }
  ],
  expected_delivery_date: '2024-02-15',
  notes: 'Rush delivery needed',
  tax: 15.50,
  shipping: 25.00
});
```

### 4. **Receiving Workflow**

Track when items arrive (supports partial delivery):

```typescript
// Full receipt
await receivePurchaseOrder(poId, {
  items: [
    { po_item_id: item1Id, quantity_received: 50 }, // All 50
    { po_item_id: item2Id, quantity_received: 100 } // All 100
  ],
  notes: 'Delivered by UPS - good condition'
});
// Status: received ✓

// Partial receipt
await receivePurchaseOrder(poId, {
  items: [
    { po_item_id: item1Id, quantity_received: 30 } // Only 30 of 50
  ],
  notes: 'Partial delivery - rest on backorder'
});
// Status: partially_received ⚠️
// Can receive remaining 20 later
```

---

## PO Workflow States

```
DRAFT
  ↓ (Send to supplier)
SENT
  ↓ (Supplier confirms)
CONFIRMED
  ↓ (Items arrive)
PARTIALLY_RECEIVED or RECEIVED
  ↓ (All complete)
RECEIVED ✓

Can cancel at any stage before received
```

**Status Meanings:**
- **draft** - Being created, not sent yet
- **sent** - Sent to supplier, awaiting confirmation
- **confirmed** - Supplier acknowledged order
- **partially_received** - Some items arrived
- **received** - All items arrived
- **cancelled** - Order cancelled

---

## Integration Points

### With Smart Ordering

**OrderingView.tsx** - Add "Create PO" button:

```typescript
const handleCreatePOFromSuggestions = async () => {
  const groupedBySupplier = groupBy(suggestions, 'supplier_id');

  for (const [supplierId, items] of Object.entries(groupedBySupplier)) {
    await createPurchaseOrder({
      supplier_id: supplierId,
      items: items.map(item => ({
        inventory_item_id: item.inventory_item_id,
        item_name: item.item_name,
        quantity_ordered: item.suggested_order_quantity,
        unit_price: item.item_price,
        supplier_code: item.supplier_code
      })),
      notes: `Smart Ordering - ${new Date().toLocaleDateString()}`
    });
  }

  toast.success(`Created ${Object.keys(groupedBySupplier).length} purchase orders`);
};
```

### With Job Planning

**JobPlanningView.tsx** - Material ordering:

```typescript
// When allocating items to job, create PO for missing stock
const handleAllocateToJob = async (job: Job, materials: Material[]) => {
  const outOfStockItems = materials.filter(m =>
    inventory.find(i => i.id === m.item_id)?.quantity < m.quantity
  );

  if (outOfStockItems.length > 0) {
    const shouldCreatePO = confirm(
      `${outOfStockItems.length} items are out of stock. Create purchase order?`
    );

    if (shouldCreatePO) {
      await createPurchaseOrder({
        items: outOfStockItems.map(item => ({
          inventory_item_id: item.item_id,
          item_name: item.item_name,
          quantity_ordered: item.quantity,
          unit_price: item.estimated_cost
        })),
        job_ids: [job.id],
        notes: `Materials for job: ${job.title}`
      });

      toast.success('Purchase order created for out-of-stock items');
    }
  }
};
```

### With Inventory Management

**When receiving PO, automatically update inventory:**

```typescript
const handleReceivePO = async (poId: string, items: ReceiptItem[]) => {
  // Record receipt
  await receivePurchaseOrder(poId, { items });

  // Update inventory quantities
  for (const item of items) {
    const poItem = await getPOItem(item.po_item_id);

    if (poItem.inventory_item_id) {
      await adjustStock(
        poItem.inventory_item_id,
        item.quantity_received,
        `Received from PO-${poNumber}`
      );
    }
  }

  toast.success('Items received and inventory updated');
};
```

---

## UI Components Needed

### 1. Purchase Orders List View

**Features:**
- Table of all POs with filters
- Status badges
- Supplier names
- Total amounts
- Quick actions (view, send, receive, cancel)

**Filters:**
- Status dropdown
- Supplier dropdown
- Date range
- Search by PO number

### 2. Create/Edit PO Modal

**Fields:**
- Supplier selector (from contacts)
- Item picker (from inventory)
- Quantities and pricing
- Expected delivery date
- Notes and internal notes
- Tax and shipping

**Features:**
- Add/remove line items
- Auto-calculate totals
- Save as draft or send immediately

### 3. PO Detail View

**Sections:**
- Header with PO number, status, supplier
- Line items table with quantities
- Linked jobs list
- Receipt history
- Status history
- Action buttons (send, receive, cancel, print)

### 4. Receive PO Modal

**Features:**
- Show ordered vs. already received quantities
- Input fields for quantities being received
- Notes field
- Option to mark items as damaged/short
- Auto-update inventory on submit

### 5. Smart Ordering Integration

**In OrderingView:**
- "Generate PO" button next to Smart Ordering results
- Groups suggestions by supplier automatically
- One-click PO creation

---

## Example Usage Scenarios

### Scenario 1: Weekly Stock Replenishment

```
1. Go to Smart Ordering view
2. Click "Generate Suggestions"
3. Review low-stock items
4. Click "Create Purchase Orders"
5. System creates one PO per supplier
6. Review and send POs to suppliers
```

### Scenario 2: Job-Specific Order

```
1. Planning a big job in Job Planning
2. Allocate materials to job
3. System detects missing stock
4. Click "Order Missing Materials"
5. PO created with job linked
6. When items arrive, mark as received
7. Items auto-allocated to job
```

### Scenario 3: Manual Emergency Order

```
1. Customer needs urgent part
2. Go to Purchase Orders view
3. Click "Create PO"
4. Select supplier
5. Add item manually
6. Mark as "Rush Delivery"
7. Send immediately
8. Track delivery status
```

---

## Benefits for Your Workflow

### Bookkeeping
- **Track every purchase** - PO numbers for all orders
- **Cost allocation** - Link purchases to specific jobs
- **Audit trail** - Full history of who ordered what and when
- **Tax records** - Separate tax and shipping tracking

### Stock Management
- **Prevent over-ordering** - See open POs before ordering
- **Track deliveries** - Know what's coming and when
- **Partial receipts** - Handle backorders gracefully
- **Auto-update inventory** - Receiving updates stock levels

### Job Costing
- **Material costs per job** - See all POs linked to a job
- **Invoice accuracy** - Include PO costs in job invoices
- **Profitability tracking** - Compare estimated vs. actual costs
- **Client billing** - Show itemized material costs

### Supplier Management
- **Order history** - See all orders from each supplier
- **Performance tracking** - On-time delivery metrics
- **Price comparisons** - Historical pricing data
- **Relationship management** - Communication log

---

## Next Steps to Complete

### Phase 1: TypeScript Types & API Client
- [ ] Create PurchaseOrder types
- [ ] Create purchaseOrdersAPI client
- [ ] Add to types.ts

### Phase 2: Basic UI
- [ ] Create PurchaseOrdersView.tsx
- [ ] PO list table with filters
- [ ] Create/Edit PO modal
- [ ] PO detail view

### Phase 3: Smart Ordering Integration
- [ ] Add "Create PO" button to OrderingView
- [ ] Group suggestions by supplier
- [ ] One-click PO generation

### Phase 4: Receiving Workflow
- [ ] Receive PO modal
- [ ] Partial delivery support
- [ ] Inventory auto-update

### Phase 5: Job Integration
- [ ] Link POs to jobs
- [ ] Show job POs in job detail
- [ ] Material cost tracking

### Phase 6: Reporting
- [ ] PO history reports
- [ ] Supplier spending analysis
- [ ] Job cost breakdown
- [ ] Export to CSV/PDF

---

## Technical Details

### Auto-Generated PO Numbers

```sql
-- Trigger function automatically generates: PO-2024-001
CREATE OR REPLACE FUNCTION generate_po_number()
-- Increments based on year
-- PO-2024-001, PO-2024-002, ...
-- Resets to 001 each January
```

### Automatic Total Calculation

```sql
-- Trigger recalculates PO totals when items change
UPDATE purchase_orders
SET subtotal = SUM(line_total),
    total = subtotal + tax + shipping
```

### Quantity Tracking

```
ordered: 100 units
received: 30 units (first delivery)
remaining: 70 units
received: 70 units (second delivery)
status: received ✓
```

### Job Cost Calculation

```sql
-- Get total PO cost for a job
SELECT SUM(po.total)
FROM purchase_orders po
JOIN purchase_order_jobs poj ON po.id = poj.purchase_order_id
WHERE poj.job_id = $1
```

---

## Summary

You now have a complete Purchase Order backend system that:

✅ **Tracks all purchases** with auto-generated PO numbers
✅ **Links to jobs** for cost tracking and invoicing
✅ **Integrates with Smart Ordering** for one-click PO creation
✅ **Supports manual orders** for flexibility
✅ **Handles partial deliveries** gracefully
✅ **Maintains audit trails** for compliance
✅ **Auto-calculates totals** including tax and shipping
✅ **Updates inventory** when items are received

**No approval workflows** - Just you managing your warehouse efficiently! 🎯

Ready to build the frontend UI?
