# PlumbPro Inventory - User Experience Features

## Overview

PlumbPro Inventory includes a comprehensive suite of UX enhancements designed to make the application intuitive, efficient, and accessible to all users. These features follow modern UX best practices and WCAG 2.1 AA accessibility standards.

---

## Table of Contents

1. [Onboarding & Tours](#onboarding--tours)
2. [Keyboard Shortcuts](#keyboard-shortcuts)
3. [Command Palette](#command-palette)
4. [Advanced Search](#advanced-search)
5. [Toast Notifications](#toast-notifications)
6. [Loading States](#loading-states)
7. [Contextual Help](#contextual-help)
8. [Bulk Operations](#bulk-operations)
9. [Accessibility Features](#accessibility-features)
10. [Best Practices](#best-practices)

---

## Onboarding & Tours

### Interactive Welcome Tour

New users are greeted with an interactive tour that highlights key features:

**Features:**
- Step-by-step walkthrough
- Highlighted UI elements
- Skip and navigation controls
- Progress indicators
- Auto-completion tracking

**Usage:**
```typescript
import { onboardingService, tours } from '../lib/onboardingService';

// Start the welcome tour
onboardingService.startTour(tours.welcome);

// Check if user has completed a tour
if (!onboardingService.hasCompletedTour('welcome')) {
  onboardingService.startTour(tours.welcome);
}

// Create custom tour
const customTour = {
  id: 'custom-feature',
  name: 'New Feature Tour',
  steps: [
    {
      target: '[data-tour="feature"]',
      title: 'New Feature!',
      content: 'Check out this amazing new capability',
      placement: 'bottom'
    }
  ]
};

onboardingService.startTour(customTour);
```

**Pre-built Tours:**
1. **Welcome Tour** - Introduction to main features
2. **Inventory Tour** - Inventory management walkthrough
3. **Workflows Tour** - Workflow automation guide

**Adding Tour Targets:**
```jsx
// Add data-tour attribute to elements you want to highlight
<button data-tour="add-item">Add Item</button>
<div data-tour="inventory">Inventory Section</div>
```

---

## Keyboard Shortcuts

### Global Shortcuts

Boost productivity with keyboard shortcuts for common actions:

| Action | Shortcut (Mac) | Shortcut (Windows) |
|--------|---------------|-------------------|
| Command Palette | ⌘K | Ctrl+K |
| Go to Inventory | ⌘I | Ctrl+I |
| Go to Jobs | ⌘J | Ctrl+J |
| Go to Contacts | ⌘C | Ctrl+C |
| Go to Workflows | ⌘W | Ctrl+W |
| Go to Analytics | ⌘A | Ctrl+A |
| Create New | ⌘N | Ctrl+N |
| Save Form | ⌘S | Ctrl+S |
| Focus Search | ⌘F | Ctrl+F |
| Show Shortcuts | ? | ? |
| Open Help | ⌘H | Ctrl+H |
| Close Modal | Esc | Esc |

**Usage:**
```typescript
import { keyboardShortcuts, useKeyboardShortcut } from '../lib/keyboardShortcuts';

// Register custom shortcut
keyboardShortcuts.register({
  key: 'e',
  meta: true,
  description: 'Export data',
  category: 'Actions',
  action: () => exportData()
});

// React Hook
useKeyboardShortcut('p', printReport, {
  meta: true,
  description: 'Print report',
  category: 'Actions'
});

// Get all shortcuts
const shortcuts = keyboardShortcuts.getAllShortcuts();

// Format for display
const formatted = keyboardShortcuts.formatShortcut(shortcut);
// Returns: "⌘K" on Mac, "Ctrl+K" on Windows
```

**Viewing Shortcuts:**
Press `?` (Shift + /) to see all available keyboard shortcuts in a modal.

---

## Command Palette

### Quick Action Access (⌘K / Ctrl+K)

Access any action instantly with the command palette:

**Features:**
- Fuzzy search across all commands
- Categorized commands
- Keyboard navigation
- Recent actions
- Custom commands

**Default Commands:**
- **Navigation**: Jump to any page instantly
- **Actions**: Create items, jobs, contacts, workflows
- **Quick Actions**: Backup, tours, settings
- **Settings**: Profile, AI config, notifications

**Usage:**
```typescript
import CommandPalette from '../components/CommandPalette';

// Add to your App component
<CommandPalette
  commands={customCommands}
/>

// Custom command example
const customCommands = [
  {
    id: 'export-csv',
    label: 'Export to CSV',
    description: 'Export inventory as CSV',
    icon: '📄',
    category: 'Export',
    action: () => exportToCSV(),
    keywords: ['download', 'data']
  }
];
```

**Opening the Palette:**
- Keyboard: `Cmd+K` (Mac) or `Ctrl+K` (Windows)
- Programmatically: Dispatch `open-command-palette` event

---

## Advanced Search

### Global Search with Autocomplete

Powerful search across all data types:

**Features:**
- Real-time autocomplete
- Multi-type search (inventory, jobs, contacts, workflows)
- Filter by type
- Recent searches
- Keyboard navigation
- Debounced queries

**Usage:**
```tsx
import AdvancedSearch from '../components/AdvancedSearch';

<AdvancedSearch
  placeholder="Search everything..."
  onSelect={(result) => {
    console.log('Selected:', result);
    // Navigate or perform action
  }}
  autoFocus={true}
/>
```

**Search Result Structure:**
```typescript
{
  id: string;
  type: 'inventory' | 'job' | 'contact' | 'workflow';
  title: string;
  subtitle?: string;
  description?: string;
  metadata?: Record<string, any>;
  icon?: string;
}
```

**Keyboard Controls:**
- `↑↓`: Navigate results
- `Enter`: Select result
- `Esc`: Close search
- Type filters: Click category badges

**Focus Search:**
- Keyboard: `Cmd+F` (Mac) or `Ctrl+F` (Windows)
- Add `data-search-input` attribute to make searchable

---

## Toast Notifications

### Beautiful, Accessible Notifications

Non-intrusive notifications for user feedback:

**Types:**
- ✅ Success
- ❌ Error
- ⚠️ Warning
- ℹ️ Info

**Features:**
- Auto-dismiss with timer
- Manual dismiss
- Action buttons
- Progress indicator
- Accessible (ARIA live regions)

**Usage:**
```tsx
import { ToastProvider, useToast } from '../components/ToastNotification';

// Wrap your app
<ToastProvider>
  <App />
</ToastProvider>

// In components
function MyComponent() {
  const toast = useToast();

  const saveData = async () => {
    try {
      await api.save(data);
      toast.success('Data saved successfully!');
    } catch (error) {
      toast.error('Failed to save data', 'Error');
    }
  };

  // With action button
  toast.info('New update available', 'Update', {
    action: {
      label: 'Update Now',
      onClick: () => updateApp()
    },
    duration: 10000 // 10 seconds
  });

  // Warning
  toast.warning('Low stock detected');

  return <button onClick={saveData}>Save</button>;
}
```

**Duration:**
- Default: 5000ms (5 seconds)
- Set to 0 for persistent toast
- Custom: Pass `duration` in options

---

## Loading States

### Skeleton Screens & Spinners

Beautiful loading indicators for better perceived performance:

**Components:**
- `Spinner` - Animated spinner (sm/md/lg)
- `PageLoader` - Full-page loading overlay
- `InlineLoader` - Inline loading indicator
- `SkeletonLine` - Placeholder line
- `SkeletonCircle` - Placeholder circle
- `SkeletonCard` - Card skeleton
- `SkeletonTable` - Table skeleton
- `SkeletonList` - List skeleton
- `SkeletonDashboard` - Dashboard skeleton
- `SkeletonForm` - Form skeleton
- `ProgressBar` - Progress indicator
- `EmptyState` - No data state
- `ErrorState` - Error display
- `ButtonLoader` - Button loading animation

**Usage:**
```tsx
import {
  Spinner,
  PageLoader,
  SkeletonCard,
  SkeletonTable,
  ProgressBar,
  EmptyState,
  ErrorState
} from '../components/LoadingStates';

// Spinner
<Spinner size="md" />

// Page loader
{isLoading && <PageLoader message="Loading data..." />}

// Skeleton screens
{isLoading ? (
  <SkeletonTable rows={10} columns={5} />
) : (
  <DataTable data={data} />
)}

// Progress bar
<ProgressBar
  progress={uploadProgress}
  label="Uploading files"
  showPercentage={true}
/>

// Empty state
<EmptyState
  icon="📭"
  title="No items found"
  description="Create your first inventory item to get started"
  action={{
    label: 'Add Item',
    onClick: () => createItem()
  }}
/>

// Error state
<ErrorState
  title="Failed to load data"
  message="Please check your connection and try again"
  retry={() => refetch()}
/>

// Button loading
<button disabled={isLoading}>
  {isLoading ? <ButtonLoader /> : 'Save'}
</button>
```

**Best Practices:**
- Use skeleton screens for initial loads
- Use spinners for inline/quick operations
- Show progress bars for long operations
- Use empty states instead of blank pages
- Provide retry options for errors

---

## Contextual Help

### Inline Help & Tooltips

Context-sensitive help throughout the application:

**Components:**
- `Tooltip` - Hover/focus tooltip
- `HelpIcon` - Question mark icon with tooltip
- `InfoCallout` - Colored callout boxes
- `InlineHelp` - Help text below fields
- `HelpPanel` - Expandable help sections
- `FieldLabel` - Label with optional help
- `QuickTips` - Tips panel
- `KeyboardHint` - Keyboard shortcut display
- `FeatureHighlight` - New feature banners

**Usage:**
```tsx
import {
  Tooltip,
  HelpIcon,
  InfoCallout,
  InlineHelp,
  HelpPanel,
  FieldLabel,
  QuickTips,
  KeyboardHint,
  FeatureHighlight
} from '../components/ContextualHelp';

// Simple tooltip
<Tooltip content="Click to add new item" placement="top">
  <button>Add Item</button>
</Tooltip>

// Help icon
<HelpIcon
  content="Stock below this level triggers reorder alerts"
  placement="right"
/>

// Field label with help
<FieldLabel
  label="Reorder Level"
  helpText="Minimum stock before reordering"
  required={true}
  htmlFor="reorder-level"
/>

// Info callout
<InfoCallout type="tip" title="Pro Tip">
  Use workflows to automate reordering when stock is low
</InfoCallout>

// Types: info, tip, warning, error

// Help panel (expandable)
<HelpPanel title="How to use this feature" defaultExpanded={false}>
  <p>Detailed explanation of the feature...</p>
</HelpPanel>

// Quick tips
<QuickTips
  title="Getting Started"
  tips={[
    "Set reorder levels for automatic alerts",
    "Use barcode scanning for quick lookups",
    "Create workflows to automate tasks"
  ]}
/>

// Keyboard hint
<KeyboardHint
  keys={['cmd', 'k']}
  description="Open command palette"
/>

// Feature highlight
<FeatureHighlight
  title="New: Workflow Automation"
  description="Automate repetitive tasks with custom workflows"
  icon="✨"
  badge="NEW"
  onDismiss={() => dismissFeature()}
/>
```

---

## Bulk Operations

### Multi-Select & Batch Actions

Perform actions on multiple items simultaneously:

**Features:**
- Multi-select with checkboxes
- Select all / clear all
- Bulk action bar
- Confirmation dialogs
- Keyboard shortcuts (Cmd+A)
- Visual selection feedback

**Usage:**
```tsx
import BulkOperations, { useBulkSelection } from '../components/BulkOperations';

function InventoryList() {
  const items = useInventory();
  const selection = useBulkSelection(items, item => item.id);

  const bulkActions = [
    {
      id: 'delete',
      label: 'Delete Selected',
      icon: '🗑️',
      variant: 'danger',
      action: async (ids) => {
        await api.deleteItems(ids);
      },
      confirm: {
        title: 'Delete Items?',
        message: `Delete ${selection.selectionCount} items? This cannot be undone.`
      }
    },
    {
      id: 'export',
      label: 'Export',
      icon: '📄',
      action: async (ids) => {
        const data = items.filter(item => ids.includes(item.id));
        exportToCSV(data);
      }
    }
  ];

  return (
    <BulkOperations
      items={items}
      selectedIds={selection.selectedIds}
      onSelectionChange={selection.setSelectedIds}
      actions={bulkActions}
      getItemId={item => item.id}
      renderItem={(item, isSelected, onToggle) => (
        <InventoryRow
          item={item}
          isSelected={isSelected}
          onToggle={onToggle}
        />
      )}
    />
  );
}

// In row component
import { BulkSelectCheckbox } from '../components/BulkOperations';

function InventoryRow({ item, isSelected, onToggle }) {
  return (
    <div>
      <BulkSelectCheckbox isSelected={isSelected} onToggle={onToggle} />
      <span>{item.name}</span>
    </div>
  );
}
```

**Available Actions:**
- Delete multiple items
- Export selected items
- Update fields in bulk
- Move to category
- Apply tags
- Change status

---

## Accessibility Features

### WCAG 2.1 AA Compliance

Full keyboard navigation and screen reader support:

**Features:**
- ✅ Keyboard navigation everywhere
- ✅ ARIA labels and roles
- ✅ Focus management
- ✅ Screen reader announcements
- ✅ High contrast support
- ✅ Reduced motion support
- ✅ Color contrast (AA/AAA)
- ✅ Skip links
- ✅ Form validation

**Utilities:**
```typescript
import {
  announce,
  FocusTrap,
  getContrastRatio,
  meetsContrastStandard,
  KeyboardNav,
  prefersReducedMotion,
  addSkipLink,
  ARIA,
  FormA11y
} from '../lib/accessibility';

// Announce to screen readers
announce('Item added successfully', 'polite');
announce('Error occurred', 'assertive');

// Focus trap (for modals)
const trap = new FocusTrap(modalElement);
trap.activate(); // Trap focus
// ...
trap.deactivate(); // Release focus

// Check contrast
const ratio = getContrastRatio('#0066CC', '#FFFFFF');
const meetsAA = meetsContrastStandard('#0066CC', '#FFFFFF', 'AA');

// Keyboard navigation
KeyboardNav.handleArrowKeys(
  event,
  currentIndex,
  totalItems,
  (newIndex) => setSelectedIndex(newIndex),
  { vertical: true, wrap: true }
);

// Reduced motion
if (prefersReducedMotion()) {
  // Disable animations
}

// Add skip link
addSkipLink('main-content', 'Skip to main content');

// ARIA helpers
ARIA.setExpanded(button, isExpanded);
ARIA.setSelected(tab, isSelected);
ARIA.describeElement(input, 'help-text-id');

// Form accessibility
FormA11y.associateLabel(input, label);
FormA11y.addError(input, 'Invalid email format', 'email-error');
FormA11y.removeError(input, 'email-error');
```

**Keyboard Navigation:**
- `Tab` / `Shift+Tab`: Navigate between focusable elements
- `Enter` / `Space`: Activate buttons and links
- `Esc`: Close modals and dropdowns
- `↑↓`: Navigate lists and options
- `Home` / `End`: Jump to first/last item

**Screen Reader Support:**
- All interactive elements have labels
- Form inputs have associated labels
- Buttons describe their action
- Errors announced automatically
- Live regions for dynamic content

---

## Best Practices

### UX Guidelines

**1. Progressive Disclosure**
- Show only essential information initially
- Use "Show More" for additional details
- Expandable sections for advanced options

**2. Immediate Feedback**
- Toast notifications for actions
- Loading states for operations
- Validation feedback in real-time

**3. Error Prevention**
- Confirmation for destructive actions
- Input validation before submission
- Clear error messages with solutions

**4. Consistency**
- Use same patterns throughout
- Consistent terminology
- Predictable interactions

**5. Efficiency**
- Keyboard shortcuts for power users
- Bulk operations for repetitive tasks
- Autocomplete and suggestions

**6. Help & Documentation**
- Contextual help where needed
- Tooltips for unclear items
- Onboarding for new users

**7. Accessibility**
- Keyboard navigation everywhere
- Screen reader friendly
- High contrast mode
- Reduced motion option

**8. Performance**
- Skeleton screens for loading
- Optimistic UI updates
- Debounced search
- Virtualized long lists

**9. Mobile Support**
- Touch-friendly targets (48px min)
- Responsive layouts
- Swipe gestures
- Mobile-optimized inputs

**10. User Control**
- Undo actions when possible
- Customizable preferences
- Save state between sessions
- Export data

---

## Implementation Checklist

### Adding UX Features to New Pages

- [ ] Add to onboarding tour (if major feature)
- [ ] Implement keyboard shortcuts for main actions
- [ ] Add to command palette
- [ ] Make searchable via advanced search
- [ ] Add toast notifications for actions
- [ ] Implement loading states
- [ ] Add contextual help and tooltips
- [ ] Support bulk operations (if list-based)
- [ ] Ensure full keyboard navigation
- [ ] Test with screen reader
- [ ] Add skip link if primary content
- [ ] Implement error states
- [ ] Add empty states
- [ ] Test on mobile devices

---

## Examples

### Complete Example: Inventory Page with All UX Features

```tsx
import React, { useState, useEffect } from 'react';
import { useToast } from '../components/ToastNotification';
import BulkOperations, { useBulkSelection } from '../components/BulkOperations';
import { SkeletonTable, EmptyState, ErrorState } from '../components/LoadingStates';
import { InfoCallout, QuickTips, HelpIcon } from '../components/ContextualHelp';
import { useKeyboardShortcut } from '../lib/keyboardShortcuts';
import { announce } from '../lib/accessibility';

function InventoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const toast = useToast();
  const selection = useBulkSelection(items, item => item.id);

  // Keyboard shortcut for new item
  useKeyboardShortcut('n', createNewItem, {
    meta: true,
    description: 'Create new item',
    category: 'Inventory'
  });

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const data = await api.getInventory();
      setItems(data);
      announce(`${data.length} items loaded`);
    } catch (err) {
      setError(err.message);
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const createNewItem = () => {
    // Navigate to create form
    announce('Opening create item form');
  };

  const bulkActions = [
    {
      id: 'delete',
      label: 'Delete',
      icon: '🗑️',
      variant: 'danger',
      action: async (ids) => {
        await api.deleteItems(ids);
        toast.success(`${ids.length} items deleted`);
        loadInventory();
      },
      confirm: {
        title: 'Delete Items?',
        message: `Delete ${selection.selectionCount} items?`
      }
    }
  ];

  if (loading) return <SkeletonTable rows={10} columns={5} />;
  if (error) return <ErrorState message={error} retry={loadInventory} />;
  if (items.length === 0) {
    return (
      <EmptyState
        icon="📦"
        title="No inventory items"
        description="Add your first item to get started"
        action={{ label: 'Add Item', onClick: createNewItem }}
      />
    );
  }

  return (
    <div>
      <InfoCallout type="tip" title="Pro Tip">
        Press <HelpIcon content="Command on Mac, Ctrl on Windows" /> + N to quickly add items
      </InfoCallout>

      <QuickTips
        tips={[
          "Set reorder levels to get automatic alerts",
          "Use workflows to automate reordering",
          "Scan barcodes for quick lookups"
        ]}
      />

      <BulkOperations
        items={items}
        selectedIds={selection.selectedIds}
        onSelectionChange={selection.setSelectedIds}
        actions={bulkActions}
        getItemId={item => item.id}
        renderItem={(item, isSelected, onToggle) => (
          <InventoryRow
            item={item}
            isSelected={isSelected}
            onToggle={onToggle}
          />
        )}
      />
    </div>
  );
}
```

---

## Summary

PlumbPro Inventory's UX features provide:

✅ **Efficient** - Keyboard shortcuts, command palette, bulk operations
✅ **Intuitive** - Onboarding tours, contextual help, clear feedback
✅ **Accessible** - WCAG 2.1 AA compliant, keyboard navigation, screen reader support
✅ **Responsive** - Loading states, error handling, progress indicators
✅ **Modern** - Toast notifications, skeleton screens, smooth animations
✅ **User-Friendly** - Advanced search, tooltips, feature highlights

These features work together to create a professional, polished user experience that helps users work faster and more effectively.
