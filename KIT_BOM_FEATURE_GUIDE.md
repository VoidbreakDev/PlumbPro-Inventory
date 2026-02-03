# Kit/BOM Management System - Feature Guide

## Overview

The Kit/BOM (Bill of Materials) Management System is a comprehensive feature that allows plumbing businesses to create, manage, and apply pre-defined sets of materials and labor for common jobs. This dramatically speeds up job creation, quoting, and stock allocation.

---

## 🎯 Key Benefits

| Benefit | Description |
|---------|-------------|
| **Time Savings** | Create jobs in seconds instead of minutes |
| **Consistency** | Standardize pricing and materials across all jobs |
| **Accuracy** | Reduce forgotten items and calculation errors |
| **Profitability** | Track which kits are most profitable |
| **Stock Control** | Automatic stock reservation and picking lists |
| **Training** | New staff know exactly what to use for each job type |

---

## 📦 Core Concepts

### Kit Types

| Type | Description | Example |
|------|-------------|---------|
| **Service** | Routine maintenance jobs | Annual hot water service |
| **Installation** | New installations | Hot water system install |
| **Repair** | Fix-it jobs | Tap replacement, leak repair |
| **Maintenance** | Scheduled maintenance | Backflow testing |
| **Emergency** | After-hours callouts | Burst pipe emergency |
| **Inspection** | Assessment jobs | Pre-purchase inspection |

### Kit Structure

```
Kit: "Standard Tap Replacement"
├── Type: Repair
├── Category: Kitchen/Bathroom
├── Items:
│   ├── Flexi Hose 500mm x 2
│   ├── Thread Seal Tape x 1
│   └── Labor - Licensed Plumber x 1 hour
├── Variations:
│   ├── Standard (1.0x)
│   ├── Premium (1.2x) - includes better quality tap
│   └── Basic (0.8x) - economy parts
└── Pricing:
    ├── Cost: $72.50
    ├── Sell: $150.00
    └── Margin: 52%
```

---

## 🚀 Features Implemented

### 1. Kit Management View (`views/KitManagementView.tsx`)

**Location**: Inventory → Kits & BOMs

**Features**:
- Grid/List view toggle
- Category filtering
- Type filtering
- Status filtering (Active/Draft/Archived)
- Search by name, description, tags
- Quick stats dashboard
- Import/Export functionality

**Screenshot Preview**:
```
┌─────────────────────────────────────────────┐
│ Kits & BOMs                    [+ Create]   │
├─────────────────────────────────────────────┤
│ [Total: 24] [Active: 20] [Uses: 156]       │
├─────────────────────────────────────────────┤
│ Search: [________________] [Grid/List]      │
│ [All] [Active] [Draft] [Archived]          │
│ Category: [All ▼]  Type: [All ▼]           │
├─────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │ 🚰       │ │ 🔥       │ │ 🚿       │    │
│ │ Standard │ │ Hot Water│ │ Bathroom │    │
│ │ Tap      │ │ System   │ │ Reno     │    │
│ │ $150     │ │ $1,790   │ │ $2,585   │    │
│ │ 52% marg │ │ 35% marg │ │ 45% marg │    │
│ └──────────┘ └──────────┘ └──────────┘    │
└─────────────────────────────────────────────┘
```

### 2. Kit Types & API (`types.ts`, `lib/kitAPI.ts`)

**Core Types**:
- `Kit` - Main kit definition
- `KitItem` - Individual items within a kit
- `KitVariation` - Size/quality variations
- `KitCategory` - Organization categories
- `KitApplication` - When a kit is applied to a job
- `KitAvailability` - Stock availability checking
- `KitAnalytics` - Usage and profitability stats

**API Methods**:
```typescript
// CRUD Operations
kitAPI.getKits(filters)           // List kits with filtering
kitAPI.getKit(id)                 // Get single kit
kitAPI.createKit(data)            // Create new kit
kitAPI.updateKit(id, data)        // Update kit
kitAPI.deleteKit(id)              // Delete kit
kitAPI.duplicateKit(id)           // Copy existing kit

// Application
kitAPI.applyKitToJob(input)       // Apply kit to a job
kitAPI.getKitApplications()       // List applications
kitAPI.pickKitItems()             // Mark items as picked

// Stock Management
kitAPI.checkAvailability()        // Check stock levels
kitAPI.reserveStock()             // Reserve kit items
kitAPI.releaseReservation()       // Cancel reservation

// Analytics
kitAPI.getKitAnalytics()          // Get usage stats
kitAPI.getPopularKits()           // Most used kits
kitAPI.getMostProfitableKits()    // Best margin kits
kitAPI.compareKits()              // Side-by-side comparison

// AI Features
kitAPI.getRecommendations()       // AI kit suggestions
kitAPI.getSmartSuggestions()      // Related kits

// Import/Export
kitAPI.exportKit(format)          // Export to file
kitAPI.importKits(file)           // Bulk import
```

### 3. Kit Selector Component (`components/KitSelector.tsx`)

**Used in**: Job creation, Quote creation

**Features**:
- AI-powered recommendations based on job description
- Category filtering
- Real-time stock availability checking
- Quantity customization
- Variation selection
- Profit preview

**Usage Example**:
```tsx
<KitSelector
  jobType="Hot Water Installation"
  jobDescription="Replace 250L electric hot water system"
  onSelectKit={(kit, variation, customization) => {
    // Apply kit to job
  }}
  onCancel={() => setShowKitSelector(false)}
/>
```

---

## 🔧 Integration Points

### 1. Job Creation Integration

When creating a new job, users can:
1. Click "Apply Kit" button
2. See AI recommendations based on job description
3. Browse/filter available kits
4. Select variation (Small/Medium/Large)
5. Customize quantities if needed
6. Auto-populate job with:
   - Materials list
   - Estimated labor hours
   - Pre-calculated pricing
   - Stock reservation

**Code Example**:
```typescript
// In job creation modal
const handleApplyKit = async (kit: Kit, variationId?: string) => {
  // Apply kit to job
  const application = await kitAPI.applyKitToJob({
    kitId: kit.id,
    jobId: currentJob.id,
    variationId,
  });
  
  // Auto-allocate items from kit
  kit.items.forEach(item => {
    if (item.inventoryItemId) {
      allocateItemToJob(currentJob.id, item.inventoryItemId, item.quantity);
    }
  });
  
  // Set estimated labor
  updateJobLaborEstimate(currentJob.id, kit.totalLaborHours);
};
```

### 2. Quote Creation Integration

Kits can be converted directly to quote line items:

```typescript
// Convert kit to quote
const convertKitToQuote = (kit: Kit): QuoteLineItem[] => {
  return kit.items.map(item => ({
    itemType: item.itemType,
    itemName: item.itemName,
    quantity: item.quantity,
    unitPrice: item.unitSellPrice,
    lineTotal: item.lineSellTotal,
    // ...
  }));
};
```

### 3. Stock Management Integration

**Automatic Stock Reservation**:
- When kit is applied to job, items are reserved
- Shows availability status (Available/Partial/Unavailable)
- Suggests alternatives for out-of-stock items
- Generates picking list for warehouse/van

**Stock Picking Workflow**:
```
Job Created with Kit
    ↓
Check Stock Availability
    ↓
Reserve Stock (if available)
    ↓
Generate Picking List
    ↓
Technician Picks Items
    ↓
Mark as Picked in System
    ↓
Deduct from Inventory on Job Complete
```

### 4. Purchase Order Integration

When kit items are out of stock:
```typescript
// Check what's missing
const availability = await kitAPI.checkAvailability(kit.id);

// Auto-create PO for shortages
if (availability.shortageItems > 0) {
  const poItems = availability.items
    .filter(item => item.shortageQty > 0)
    .map(item => ({
      itemId: item.kitItemId,
      quantity: item.shortageQty,
    }));
  
  await purchaseOrderAPI.create({
    supplierId: preferredSupplier,
    items: poItems,
    reference: `For Job: ${jobId}`,
  });
}
```

---

## 📊 Analytics & Reporting

### Kit Performance Metrics

| Metric | Description |
|--------|-------------|
| Usage Count | How many times kit applied |
| Total Revenue | Sum of all kit sales |
| Total Profit | Revenue minus costs |
| Avg Margin | Average profit percentage |
| Avg Job Value | Typical total job value |
| Stockout Frequency | How often items unavailable |
| Modification Rate | How often kits customized |
| Completion Time | Avg time from apply to finish |

### Popular Kits Report

```
Top 10 Most Used Kits (Last 30 Days)
┌─────────────────────────────┬────────┬──────────┬──────────┐
│ Kit Name                    │ Uses   │ Revenue  │ Margin   │
├─────────────────────────────┼────────┼──────────┼──────────┤
│ Blocked Drain - Standard    │ 23     │ $7,762   │ 47%      │
│ Tap Replacement             │ 18     │ $2,700   │ 52%      │
│ HWC Install - Electric 250L │ 8      │ $14,320  │ 35%      │
│ Gas Cooktop Install         │ 7      │ $2,940   │ 48%      │
│ Bathroom Reno - Standard    │ 4      │ $10,340  │ 45%      │
└─────────────────────────────┴────────┴──────────┴──────────┘
```

---

## 🤖 AI Features

### Smart Kit Recommendations

**How it works**:
1. User enters job description: "Kitchen sink leaking from tap"
2. AI analyzes description using Gemini API
3. Suggests matching kits with confidence scores:
   - "Standard Tap Replacement" - 95% match
   - "Kitchen Sink Repair" - 82% match
   - "Full Tap Set Install" - 67% match

**Code**:
```typescript
const recommendations = await kitAPI.getRecommendations(
  "Kitchen sink leaking from tap",
  "Repair"
);

// Returns ranked suggestions with reasoning
[
  {
    kit: tapReplacementKit,
    matchScore: 95,
    matchReason: "Keywords: 'tap', 'leaking', 'kitchen' match this kit",
    estimatedProfit: 77.50,
    stockAvailability: { ... }
  }
]
```

### Smart Suggestions

When viewing an inventory item, suggest kits that use it:
```typescript
// Viewing "Flexi Hose 500mm"
const relatedKits = await kitAPI.getSmartSuggestions(itemId);
// Returns: ["Standard Tap Replacement", "Bathroom Reno Kit", ...]
```

---

## 🎨 Customization Options

### Kit Variations

Create size/quality variations without duplicating kits:

```typescript
{
  name: "Bathroom Renovation",
  variations: [
    {
      name: "Basic",
      costMultiplier: 0.8,
      // Uses base kit items with 0.8x quantities/pricing
    },
    {
      name: "Standard", 
      costMultiplier: 1.0,
      // Base configuration
    },
    {
      name: "Luxury",
      costMultiplier: 1.4,
      additionalItems: [
        { itemName: "Premium Mixer", quantity: 1, ... },
      ],
      excludedItemIds: ["standard-mixer-id"]
    }
  ]
}
```

### Optional Items

Mark items as optional within a kit:
- Camera inspection (for drain jobs)
- Electrical connection (for hot water)
- Premium fittings upgrade

### Alternative Items

Define substitutes for out-of-stock items:
```typescript
{
  itemName: "15mm Copper Tube",
  alternativeItemIds: ["15mm-pex-tube", "15mm-pvc-tube"],
}
```

---

## 📱 Mobile Field Usage

Technicians in the field can:
1. View kit details on mobile app
2. See picking checklist
3. Mark items as picked/used
4. Request alternatives for unavailable items
5. Add notes about substitutions

**Mobile Kit View**:
```
┌─────────────────────────────┐
│ ← Standard Tap Replacement  │
├─────────────────────────────┤
│ Items Required:             │
│                             │
│ ☐ Flexi Hose 500mm (x2)     │
│    Location: Shelf A3       │
│                             │
│ ☐ Thread Seal Tape (x1)     │
│    Location: Van Stock      │
│                             │
│ ☐ Labor - 1 hour            │
│                             │
│ [Mark All Picked]           │
└─────────────────────────────┘
```

---

## 🔐 Permissions

Role-based access control:

| Permission | Admin | Manager | Plumber |
|------------|-------|---------|---------|
| Create Kits | ✅ | ✅ | ❌ |
| Edit Kits | ✅ | ✅ | ❌ |
| Delete Kits | ✅ | ❌ | ❌ |
| Apply Kits to Jobs | ✅ | ✅ | ✅ |
| View Kit Analytics | ✅ | ✅ | ❌ |
| Import/Export Kits | ✅ | ✅ | ❌ |
| Customize Kit Quantities | ✅ | ✅ | ✅ |

---

## 📥 Import/Export

### CSV Import Format

```csv
kit_name,kit_type,category,item_name,item_type,quantity,unit,unit_cost,unit_price,is_optional
Standard Tap Replacement,repair,Kitchen,Flexi Hose 500mm,inventory,2,EA,12.50,25.00,FALSE
Standard Tap Replacement,repair,Kitchen,Thread Seal Tape,inventory,1,ROLL,2.50,5.00,FALSE
Standard Tap Replacement,repair,Kitchen,Labor - Tap Replace,labor,1,HR,45.00,95.00,FALSE
```

### Export Options

- **JSON**: Full data with relationships
- **CSV**: Spreadsheet format for editing
- **PDF**: Printable kit reference cards

---

## 🚀 Getting Started

### Step 1: Create Your First Kit

1. Go to **Inventory → Kits & BOMs**
2. Click **Create Kit**
3. Fill in details:
   - Name: "Standard Tap Replacement"
   - Type: Repair
   - Category: Kitchen
4. Add items:
   - Flexi hoses (2x)
   - Thread seal tape (1x)
   - Labor (1 hour)
5. Set pricing
6. Save

### Step 2: Apply Kit to Job

1. Create new job
2. Enter job description
3. Click **Apply Kit**
4. Select your kit from recommendations
5. Review items and quantities
6. Click **Apply**

### Step 3: Track Performance

1. Go to Kit Management
2. View usage stats on kit cards
3. Click kit for detailed analytics
4. Adjust pricing based on profitability

---

## 🔮 Future Enhancements

Planned features for future releases:

1. **Nested Kits** - Kits within kits (e.g., "Bathroom Reno" contains "Shower Kit" + "Vanity Kit")
2. **Dynamic Pricing** - Auto-update kit prices when component prices change
3. **Kit Templates Library** - Pre-built industry standard kits
4. **Seasonal Kits** - Summer/winter maintenance packages
5. **Customer-Specific Kits** - Custom pricing per customer
6. **Kit Versioning** - Track changes over time
7. **Multi-Location Kits** - Different contents per warehouse/van

---

## 📞 Support

For questions or issues with Kit/BOM Management:
1. Check contextual help (?) icons in the UI
2. Review this documentation
3. Contact support with specific kit IDs and error messages

---

**Last Updated**: February 2026  
**Version**: 1.0  
**Feature Owner**: PlumbPro Development Team
