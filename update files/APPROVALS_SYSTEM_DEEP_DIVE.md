# Approvals System - Deep Dive & Integration Guide

## Overview

The PlumbPro Inventory approvals system is a **multi-stage workflow approval engine** that can be integrated throughout the application to enforce business process controls. Currently, it's foundation-ready but needs deeper integration with existing features.

---

## Current Implementation

### What Exists Now

✅ **Complete Backend Infrastructure**
- Database tables: `approval_workflows` and `approval_stages`
- REST API endpoints for all CRUD operations
- Multi-stage approval logic
- User-based permissions

✅ **Frontend UI**
- Dedicated Approvals View page
- Statistics dashboard
- Approve/Reject interface
- Status tracking

✅ **Core Features**
- Multi-stage sequential approvals
- Comments and audit trail
- Status tracking (pending, approved, rejected, cancelled)
- User notifications (via stats)

### What Needs Integration

⚠️ **Missing Connections:**
- Not connected to inventory operations
- Not connected to job creation/updates
- Not connected to purchase orders
- No automatic workflow triggering
- No threshold-based rules

---

## System Architecture

### Database Schema

```
approval_workflows                    approval_stages
┌─────────────────────┐             ┌──────────────────────┐
│ id (UUID)           │◄───────────┤ id (UUID)            │
│ user_id (UUID)      │             │ approval_workflow_id │
│ entity_type         │             │ stage_number         │
│ entity_id           │             │ approver_id (UUID)   │
│ workflow_id         │             │ status               │
│ current_stage       │             │ comments             │
│ total_stages        │             │ responded_at         │
│ status              │             │ created_at           │
│ requested_by        │             └──────────────────────┘
│ requested_at        │
│ completed_at        │
└─────────────────────┘
```

**Entity Types Supported:**
- `job` - Job approvals
- `purchase_order` - PO approvals
- `stock_adjustment` - Inventory adjustments

**Workflow Status:**
- `pending` - Waiting for approval
- `approved` - All stages approved
- `rejected` - At least one stage rejected
- `cancelled` - Cancelled by requester

**Stage Status:**
- `pending` - Awaiting approver action
- `approved` - Approved by approver
- `rejected` - Rejected by approver

### API Endpoints

```
GET    /api/approvals              # Get user's approval workflows
GET    /api/approvals/pending      # Get approvals requiring user's action
GET    /api/approvals/:id          # Get specific workflow with stages
POST   /api/approvals              # Create new approval workflow
POST   /api/approvals/:id/approve  # Approve current stage
POST   /api/approvals/:id/reject   # Reject current stage
POST   /api/approvals/:id/cancel   # Cancel workflow
GET    /api/approvals/stats/summary # Get approval statistics
```

---

## Integration Opportunities

### 1. **Inventory Management Integration**

#### Use Cases

**A. Stock Adjustments Above Threshold**
```typescript
// When adjusting stock beyond a certain amount
if (Math.abs(adjustmentQuantity) >= 100) {
  // Create approval workflow
  await approvalsAPI.createApproval({
    entity_type: 'stock_adjustment',
    entity_id: inventoryItemId,
    approvers: [managerId, warehouseManagerId]
  });

  // Don't apply adjustment yet - wait for approval
  toast.info('Stock adjustment requires approval');
} else {
  // Small adjustments go through immediately
  await adjustStock(itemId, quantity, reason);
}
```

**B. Adding High-Value Items**
```typescript
// When adding expensive inventory
if (itemPrice > 1000) {
  await approvalsAPI.createApproval({
    entity_type: 'inventory_item',
    entity_id: newItemId,
    approvers: [purchasingManagerId, cfId]
  });
}
```

**C. Deleting Inventory Items**
```typescript
// Require approval before deletion
const approval = await approvalsAPI.createApproval({
  entity_type: 'inventory_deletion',
  entity_id: itemId,
  approvers: [managerId]
});

// Only delete after approval
```

#### Implementation Example

```typescript
// InventoryView.tsx - Stock Adjustment Modal
const handleAdjustStock = async (item: InventoryItem, quantity: number, reason: string) => {
  try {
    // Check if adjustment requires approval
    const requiresApproval = Math.abs(quantity) >= getApprovalThreshold('stock_adjustment');

    if (requiresApproval) {
      // Create approval workflow
      const workflow = await approvalsAPI.createApproval({
        entity_type: 'stock_adjustment',
        entity_id: item.id,
        approvers: getApproversFor('stock_adjustment'), // From settings
        metadata: {
          item_name: item.name,
          current_quantity: item.quantity,
          adjustment_quantity: quantity,
          reason: reason
        }
      });

      toast.info('Stock adjustment submitted for approval');

      // Create pending adjustment record
      await createPendingAdjustment({
        approval_workflow_id: workflow.id,
        item_id: item.id,
        quantity: quantity,
        reason: reason
      });
    } else {
      // Process immediately
      await adjustStock(item.id, quantity, reason);
      toast.success('Stock adjusted successfully');
    }
  } catch (error) {
    toast.error('Failed to process stock adjustment');
  }
};
```

---

### 2. **Job Planning Integration**

#### Use Cases

**A. High-Value Jobs**
```typescript
// Jobs over certain value require approval
if (estimatedJobValue > 5000) {
  await approvalsAPI.createApproval({
    entity_type: 'job',
    entity_id: jobId,
    approvers: [projectManagerId, operationsManagerId]
  });
}
```

**B. Rush Jobs**
```typescript
// Rush jobs (less than 24 hours notice)
const jobDate = new Date(job.date);
const now = new Date();
const hoursUntilJob = (jobDate.getTime() - now.getTime()) / (1000 * 60 * 60);

if (hoursUntilJob < 24) {
  await approvalsAPI.createApproval({
    entity_type: 'rush_job',
    entity_id: jobId,
    approvers: [dispatcherId]
  });
}
```

**C. Overtime Jobs**
```typescript
// Jobs scheduled outside normal hours
if (isWeekend(job.date) || isAfterHours(job.time)) {
  await approvalsAPI.createApproval({
    entity_type: 'overtime_job',
    entity_id: jobId,
    approvers: [hrManagerId, operationsManagerId]
  });
}
```

#### Implementation Example

```typescript
// JobPlanningView.tsx - Job Creation
const handleCreateJob = async (jobData: Partial<Job>) => {
  try {
    // Create job (in pending state if approval required)
    const newJob = await addJob({
      ...jobData,
      status: requiresApproval(jobData) ? 'pending_approval' : 'Scheduled'
    });

    // Check if job requires approval
    if (requiresApproval(jobData)) {
      const approvers = determineApprovers(jobData);

      await approvalsAPI.createApproval({
        entity_type: 'job',
        entity_id: newJob.id,
        approvers: approvers.map(a => a.id),
        metadata: {
          job_title: jobData.title,
          estimated_value: calculateJobValue(jobData),
          scheduled_date: jobData.date,
          assigned_workers: jobData.assignedWorkerIds
        }
      });

      toast.info('Job created and sent for approval');
    } else {
      toast.success('Job created successfully');
    }
  } catch (error) {
    toast.error('Failed to create job');
  }
};

// Helper: Determine if job requires approval
const requiresApproval = (job: Partial<Job>): boolean => {
  const value = calculateJobValue(job);
  const isRush = isRushJob(job.date);
  const isOvertime = isOvertimeJob(job.date);

  return value > 5000 || isRush || isOvertime;
};
```

---

### 3. **Purchase Order Integration**

#### Use Cases

**A. Creating Purchase Orders**
```typescript
// All POs require approval
await approvalsAPI.createApproval({
  entity_type: 'purchase_order',
  entity_id: purchaseOrderId,
  approvers: getPOApprovers(totalAmount)
});
```

**B. Tiered Approval Based on Amount**
```typescript
// Different approval chains based on amount
const getApprovers = (amount: number) => {
  if (amount > 10000) {
    return [managerId, cfId, ceoId]; // 3-stage
  } else if (amount > 5000) {
    return [managerId, cfId]; // 2-stage
  } else {
    return [managerId]; // 1-stage
  }
};
```

#### Implementation Example

```typescript
// OrderingView.tsx - Smart Ordering
const handleGeneratePurchaseOrder = async (suggestions: SmartOrderSuggestion[]) => {
  try {
    // Calculate total PO amount
    const totalAmount = suggestions.reduce((sum, item) =>
      sum + (item.suggested_order_quantity * item.item_price), 0
    );

    // Create PO record (in draft state)
    const po = await createPurchaseOrder({
      items: suggestions,
      total_amount: totalAmount,
      status: 'draft'
    });

    // Determine approval chain based on amount
    const approvers = getPOApprovers(totalAmount);

    // Create approval workflow
    await approvalsAPI.createApproval({
      entity_type: 'purchase_order',
      entity_id: po.id,
      approvers: approvers.map(a => a.id),
      metadata: {
        supplier_count: new Set(suggestions.map(s => s.supplier_id)).size,
        item_count: suggestions.length,
        total_amount: totalAmount
      }
    });

    toast.success(`Purchase order created (${approvers.length} approval${approvers.length > 1 ? 's' : ''} required)`);
  } catch (error) {
    toast.error('Failed to create purchase order');
  }
};

// Approval chain configuration
const getPOApprovers = (amount: number): Approver[] => {
  const settings = getApprovalSettings();

  if (amount > settings.po_threshold_level3) {
    // High-value: Manager → CFO → CEO
    return [
      { id: settings.manager_id, role: 'Manager' },
      { id: settings.cfo_id, role: 'CFO' },
      { id: settings.ceo_id, role: 'CEO' }
    ];
  } else if (amount > settings.po_threshold_level2) {
    // Medium-value: Manager → CFO
    return [
      { id: settings.manager_id, role: 'Manager' },
      { id: settings.cfo_id, role: 'CFO' }
    ];
  } else {
    // Low-value: Manager only
    return [
      { id: settings.manager_id, role: 'Manager' }
    ];
  }
};
```

---

### 4. **Contact Management Integration**

#### Use Cases

**A. Adding Suppliers**
```typescript
// New suppliers require approval
if (contact.type === 'Supplier') {
  await approvalsAPI.createApproval({
    entity_type: 'supplier_addition',
    entity_id: contactId,
    approvers: [purchasingManagerId]
  });
}
```

**B. Deleting Active Suppliers**
```typescript
// Prevent accidental deletion of active suppliers
if (hasActiveOrders(supplierId)) {
  await approvalsAPI.createApproval({
    entity_type: 'supplier_deletion',
    entity_id: supplierId,
    approvers: [managerId, purchasingManagerId]
  });
}
```

---

### 5. **Settings Integration**

Create a new **"Approval Settings"** section in SettingsView:

```typescript
interface ApprovalSettings {
  // Stock adjustment thresholds
  stock_adjustment_threshold: number;
  stock_adjustment_approvers: string[];

  // Job approval thresholds
  job_value_threshold: number;
  job_approvers: string[];
  rush_job_approvers: string[];
  overtime_job_approvers: string[];

  // Purchase order thresholds
  po_threshold_level1: number; // 1 approval
  po_threshold_level2: number; // 2 approvals
  po_threshold_level3: number; // 3 approvals
  po_approvers_level1: string[];
  po_approvers_level2: string[];
  po_approvers_level3: string[];

  // General settings
  require_comments_on_reject: boolean;
  auto_cancel_after_days: number;
  notification_reminders: boolean;
}
```

**UI Mockup:**

```
╔══════════════════════════════════════════╗
║ Approval Settings                        ║
╠══════════════════════════════════════════╣
║                                          ║
║ Stock Adjustments                        ║
║ ┌──────────────────────────────────────┐ ║
║ │ Require approval for adjustments     │ ║
║ │ above: [100] units                   │ ║
║ │                                      │ ║
║ │ Approvers:                           │ ║
║ │ [x] John Smith (Manager)             │ ║
║ │ [x] Jane Doe (Warehouse Manager)     │ ║
║ └──────────────────────────────────────┘ ║
║                                          ║
║ Purchase Orders                          ║
║ ┌──────────────────────────────────────┐ ║
║ │ Tier 1 (Manager): $[0] - $[5000]    │ ║
║ │ Tier 2 (+ CFO): $[5000] - $[10000]  │ ║
║ │ Tier 3 (+ CEO): $[10000]+           │ ║
║ └──────────────────────────────────────┘ ║
║                                          ║
║ [Save Settings]                          ║
╚══════════════════════════════════════════╝
```

---

## Workflow Processing

### How Approvals Flow

```
1. USER ACTION
   └─> Create Item/Job/PO
       └─> Check if approval required
           ├─> NO: Process immediately
           └─> YES: Create approval workflow
               └─> Set entity to "pending_approval" state

2. APPROVAL WORKFLOW CREATED
   └─> approval_workflows record created
       └─> Multiple approval_stages created
           └─> Notifications sent to approvers

3. STAGE 1 APPROVER
   ├─> APPROVE: Move to stage 2
   │   └─> If last stage: Mark workflow "approved"
   │       └─> Execute pending action
   └─> REJECT: Mark workflow "rejected"
       └─> Notify requester
       └─> Cancel pending action

4. EXECUTE AFTER APPROVAL
   └─> Apply stock adjustment
   └─> Activate job
   └─> Send purchase order
```

### Multi-Stage Example

```
Purchase Order: $15,000
├─> Stage 1: Manager
│   └─> [PENDING] → [APPROVED] ✓
├─> Stage 2: CFO
│   └─> [PENDING] → [APPROVED] ✓
└─> Stage 3: CEO
    └─> [PENDING] → [APPROVED] ✓
        └─> ALL APPROVED → Send PO to supplier
```

---

## Implementation Checklist

### Phase 1: Foundation Enhancements

- [ ] Add approval workflow metadata field (store entity details)
- [ ] Create `pending_adjustments` table for queued stock changes
- [ ] Create `pending_purchase_orders` table
- [ ] Add approval settings to database
- [ ] Create approval settings UI in SettingsView

### Phase 2: Stock Adjustment Integration

- [ ] Add approval check to `adjustStock()` function
- [ ] Create approval workflow for large adjustments
- [ ] Store adjustment details in pending table
- [ ] Execute adjustment after approval
- [ ] Add "Pending Approvals" badge to inventory items

### Phase 3: Job Approval Integration

- [ ] Add approval check to job creation
- [ ] Implement job value calculation
- [ ] Add rush/overtime detection
- [ ] Create approval workflow for flagged jobs
- [ ] Add "Pending Approval" status to jobs list

### Phase 4: Purchase Order Integration

- [ ] Create purchase order data structure
- [ ] Implement PO generation from smart ordering
- [ ] Add tiered approval based on amount
- [ ] Send approved POs to suppliers (email/API)
- [ ] Track PO status (sent, received, completed)

### Phase 5: Notifications & Reminders

- [ ] Email notifications for pending approvals
- [ ] In-app notification center
- [ ] Daily digest of pending approvals
- [ ] Reminder emails after X days
- [ ] Mobile push notifications

### Phase 6: Analytics & Reporting

- [ ] Approval time metrics
- [ ] Bottleneck identification
- [ ] Approver performance dashboard
- [ ] Approval trend charts
- [ ] Export approval history

---

## Code Examples

### Creating Approval Workflow with Metadata

```typescript
// Enhanced approval creation with context
const createInventoryApproval = async (
  item: InventoryItem,
  adjustment: number,
  reason: string
) => {
  const workflow = await approvalsAPI.createApproval({
    entity_type: 'stock_adjustment',
    entity_id: item.id,
    approvers: getApproversFor('stock_adjustment'),
    metadata: {
      // Store all context for approval decision
      item_name: item.name,
      item_category: item.category,
      current_quantity: item.quantity,
      adjustment_quantity: adjustment,
      new_quantity: item.quantity + adjustment,
      reason: reason,
      estimated_value: item.price * Math.abs(adjustment),
      requested_by_name: user.fullName,
      requested_at: new Date().toISOString()
    }
  });

  return workflow;
};
```

### Processing Approved Actions

```typescript
// Backend: Process approval after all stages approved
const processApproval = async (approvalId: string) => {
  const approval = await getApprovalWithStages(approvalId);

  if (approval.status !== 'approved') {
    throw new Error('Approval not yet approved');
  }

  // Execute based on entity type
  switch (approval.entity_type) {
    case 'stock_adjustment':
      await executePendingAdjustment(approval.entity_id);
      break;

    case 'job':
      await activatePendingJob(approval.entity_id);
      break;

    case 'purchase_order':
      await sendPurchaseOrder(approval.entity_id);
      break;

    default:
      console.warn(`Unknown entity type: ${approval.entity_type}`);
  }

  // Mark as processed
  await markApprovalProcessed(approvalId);
};
```

### Approval Settings UI Component

```typescript
// SettingsView.tsx - Approval Settings Section
const ApprovalSettingsSection = () => {
  const [settings, setSettings] = useState<ApprovalSettings>(loadApprovalSettings());
  const users = useStore(state => state.users); // Assume we have user list

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Approval Settings</h2>

      {/* Stock Adjustments */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Stock Adjustments</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Require approval for adjustments above:
            </label>
            <input
              type="number"
              value={settings.stock_adjustment_threshold}
              onChange={(e) => setSettings({
                ...settings,
                stock_adjustment_threshold: parseInt(e.target.value)
              })}
              className="w-32 px-3 py-2 border rounded"
            />
            <span className="ml-2 text-gray-600">units</span>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Approvers:
            </label>
            <div className="space-y-2">
              {users.map(user => (
                <label key={user.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.stock_adjustment_approvers.includes(user.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSettings({
                          ...settings,
                          stock_adjustment_approvers: [...settings.stock_adjustment_approvers, user.id]
                        });
                      } else {
                        setSettings({
                          ...settings,
                          stock_adjustment_approvers: settings.stock_adjustment_approvers.filter(id => id !== user.id)
                        });
                      }
                    }}
                    className="mr-2"
                  />
                  {user.fullName} ({user.role})
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Purchase Orders */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Purchase Orders</h3>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Tier 1 (Max)</label>
              <input
                type="number"
                value={settings.po_threshold_level1}
                onChange={(e) => setSettings({
                  ...settings,
                  po_threshold_level1: parseInt(e.target.value)
                })}
                className="w-full px-3 py-2 border rounded"
                placeholder="5000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Tier 2 (Max)</label>
              <input
                type="number"
                value={settings.po_threshold_level2}
                onChange={(e) => setSettings({
                  ...settings,
                  po_threshold_level2: parseInt(e.target.value)
                })}
                className="w-full px-3 py-2 border rounded"
                placeholder="10000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Tier 3 (Max)</label>
              <input
                type="number"
                value={settings.po_threshold_level3}
                onChange={(e) => setSettings({
                  ...settings,
                  po_threshold_level3: parseInt(e.target.value)
                })}
                className="w-full px-3 py-2 border rounded"
                placeholder="Unlimited"
              />
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => saveApprovalSettings(settings)}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Save Settings
      </button>
    </div>
  );
};
```

---

## Benefits of Integration

### Business Process Control

✅ **Prevent unauthorized actions**
- Large stock adjustments require manager approval
- High-value purchases require financial approval
- Critical operations have oversight

✅ **Audit trail**
- Who requested what
- Who approved/rejected
- When decisions were made
- Comments and reasoning

✅ **Separation of duties**
- Request vs. approve roles
- Multi-level approval chains
- No self-approval

### Operational Benefits

✅ **Reduced errors**
- Second set of eyes on major decisions
- Catch mistakes before execution
- Validate business logic

✅ **Better resource management**
- Control spending
- Prevent over-ordering
- Optimize inventory levels

✅ **Compliance**
- Meet regulatory requirements
- Document decision-making process
- Demonstrate internal controls

---

## Next Steps

### Recommended Implementation Order

1. **Start with Stock Adjustments** (Simplest integration)
   - Add approval threshold to settings
   - Create approval workflow for large adjustments
   - Test approval flow end-to-end

2. **Add Purchase Order Approvals** (High value)
   - Create PO data structure
   - Implement tiered approval
   - Connect to smart ordering

3. **Integrate Job Approvals** (Complex but valuable)
   - Add approval triggers (value, rush, overtime)
   - Update job status workflow
   - Test with real job scenarios

4. **Enhance with Notifications** (User experience)
   - Email notifications
   - In-app badges
   - Mobile push

5. **Add Analytics** (Management insight)
   - Approval time tracking
   - Bottleneck identification
   - Performance metrics

---

## Summary

The approvals system is **fully implemented** at the infrastructure level but needs **deeper integration** with your core business processes. The current setup provides:

✅ Multi-stage approval workflows
✅ User-based permissions
✅ Status tracking and history
✅ REST API for all operations
✅ Basic UI for managing approvals

**Missing:** Automatic triggering from inventory, jobs, and purchase order operations.

By following this integration guide, you can transform the approvals feature from a standalone system into a **core business process control mechanism** that adds value across your entire application.

**Ready to implement?** Start with stock adjustment approvals - it's the simplest integration point and provides immediate value! 🚀
