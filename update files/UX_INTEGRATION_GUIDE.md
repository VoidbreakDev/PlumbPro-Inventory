# PlumbPro Inventory - UX Integration Guide

## Overview

This guide explains how the UX features have been integrated into PlumbPro Inventory and how to use them in your application.

---

## ✅ What's Been Integrated

### 1. Core UX System (App.tsx)

**Status**: ✅ Complete

The main App component now includes:

```typescript
// UX Components imported
import { ToastProvider, useToast } from './components/ToastNotification';
import CommandPalette from './components/CommandPalette';
import { onboardingService, tours } from './lib/onboardingService';
import { addSkipLink } from './lib/accessibility';
```

**Key Features Active:**
- ✅ Toast notification system (wrapped with ToastProvider)
- ✅ Command Palette (Cmd+K / Ctrl+K)
- ✅ Onboarding tours (auto-starts for new users)
- ✅ Accessibility skip links
- ✅ Custom event system for navigation

### 2. Toast Notifications

**Where Used:**
- `handleCreateJob()` - Success/warning toasts for job creation
- `handleConfirmPick()` - Success toast when items picked
- `handleImportCSV()` - Success toast for CSV imports
- `handleManualAdjustment()` - Success/warning toasts for stock adjustments

**Example Usage:**
```typescript
const toast = useToast();

// Success notification
toast.success('Item saved successfully!');

// Error with title
toast.error('Failed to save item', 'Error');

// Warning
toast.warning('Please fill in all required fields');

// Info with action
toast.info('New update available', {
  action: {
    label: 'Update Now',
    onClick: () => updateApp()
  }
});
```

### 3. Command Palette

**Status**: ✅ Fully integrated

**Default Commands Available:**
- **Navigation** (6 commands):
  - Go to Dashboard
  - Go to Inventory
  - Go to Jobs
  - Go to Contacts
  - Go to Smart Ordering
  - Go to Stock History

- **Actions** (3 commands):
  - Create New Item
  - Create New Job
  - Add New Contact

- **Quick Actions** (3 commands):
  - Create Backup
  - Start Tour
  - View Keyboard Shortcuts

**How It Works:**
1. Press `Cmd+K` (Mac) or `Ctrl+K` (Windows)
2. Type to search commands
3. Navigate with arrow keys
4. Press Enter to execute

**Custom Commands:**
You can add custom commands by passing them to CommandPalette:

```typescript
const customCommands = [
  {
    id: 'export',
    label: 'Export Inventory',
    description: 'Download as CSV',
    icon: '📄',
    category: 'Export',
    action: () => exportData()
  }
];

<CommandPalette commands={customCommands} />
```

### 4. Onboarding Tours

**Status**: ✅ Active

**Pre-built Tours:**
1. **Welcome Tour** - Auto-starts for first-time users
2. **Inventory Tour** - Inventory management features
3. **Workflows Tour** - Workflow automation features

**Tour Targets (data-tour attributes):**
- `data-tour="logo"` - App logo
- `data-tour="navigation"` - Main navigation
- `data-tour="inventory"` - Inventory nav item
- `data-tour="jobs"` - Jobs nav item
- `data-tour="contacts"` - Contacts nav item
- `data-tour="settings"` - Settings button

**Manually Start Tours:**
```typescript
import { onboardingService, tours } from './lib/onboardingService';

// Start welcome tour
onboardingService.startTour(tours.welcome);

// Start inventory tour
onboardingService.startTour(tours.inventory);

// Check if tour completed
const hasSeenWelcome = onboardingService.hasCompletedTour('welcome');
```

### 5. Enhanced Inventory View

**Status**: ✅ Example integration complete

**New Features:**
- ✅ Empty state when no inventory items
- ✅ "No results" state when search returns nothing
- ✅ Help icons with tooltips
- ✅ Keyboard hints footer
- ✅ Better UX feedback

**Components Used:**
```typescript
import { EmptyState } from '../components/LoadingStates';
import { HelpIcon, KeyboardHint } from '../components/ContextualHelp';
```

---

## 🎯 How to Use UX Features in Other Views

### Adding Toast Notifications

1. Import the hook:
```typescript
import { useToast } from '../components/ToastNotification';
```

2. Use in component:
```typescript
function MyView() {
  const toast = useToast();

  const handleSave = async () => {
    try {
      await api.save(data);
      toast.success('Saved successfully!');
    } catch (error) {
      toast.error('Failed to save');
    }
  };
}
```

### Adding Loading States

1. Import components:
```typescript
import {
  SkeletonTable,
  PageLoader,
  EmptyState,
  ErrorState
} from '../components/LoadingStates';
```

2. Use in component:
```typescript
function MyView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);

  if (loading) return <SkeletonTable rows={10} columns={5} />;

  if (error) return (
    <ErrorState
      message="Failed to load data"
      retry={() => loadData()}
    />
  );

  if (data.length === 0) return (
    <EmptyState
      icon="📭"
      title="No data"
      description="Get started by adding items"
      action={{ label: 'Add Item', onClick: () => {} }}
    />
  );

  return <div>{/* Your content */}</div>;
}
```

### Adding Contextual Help

1. Import components:
```typescript
import {
  HelpIcon,
  Tooltip,
  QuickTips,
  KeyboardHint,
  InfoCallout
} from '../components/ContextualHelp';
```

2. Use in component:
```typescript
<div className="flex items-center">
  <h2>Inventory Items</h2>
  <HelpIcon content="Search, sort, and manage items here" />
</div>

<QuickTips
  tips={[
    "Press Cmd+K to open command palette",
    "Click column headers to sort"
  ]}
/>

<InfoCallout type="tip" title="Pro Tip">
  Use keyboard shortcuts to work faster!
</InfoCallout>

<KeyboardHint keys={['⌘', 'K']} description="Open command palette" />
```

### Adding Bulk Operations

1. Import components:
```typescript
import BulkOperations, { useBulkSelection } from '../components/BulkOperations';
```

2. Use in component:
```typescript
function ItemsList() {
  const [items, setItems] = useState([]);
  const selection = useBulkSelection(items, item => item.id);

  const bulkActions = [
    {
      id: 'delete',
      label: 'Delete',
      icon: '🗑️',
      variant: 'danger' as const,
      action: async (ids: string[]) => {
        await api.deleteItems(ids);
      },
      confirm: {
        title: 'Delete Items?',
        message: `Delete ${selection.selectionCount} items?`
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
        <ItemRow item={item} isSelected={isSelected} onToggle={onToggle} />
      )}
    />
  );
}
```

---

## 🚀 Quick Start Checklist

### For New Views

When creating a new view, consider adding:

- [ ] Loading states (SkeletonTable, PageLoader)
- [ ] Empty states (EmptyState)
- [ ] Error states (ErrorState)
- [ ] Toast notifications for user actions
- [ ] Help icons for complex features
- [ ] Keyboard hints for power users
- [ ] Quick tips for onboarding
- [ ] Bulk operations for list views

### Example Template

```typescript
import React, { useState } from 'react';
import { useToast } from '../components/ToastNotification';
import { SkeletonTable, EmptyState, ErrorState } from '../components/LoadingStates';
import { HelpIcon, QuickTips } from '../components/ContextualHelp';

export const MyView: React.FC = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);

  const handleSave = async () => {
    try {
      setLoading(true);
      await api.save(data);
      toast.success('Saved successfully!');
    } catch (err) {
      toast.error('Failed to save');
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <SkeletonTable />;
  if (error) return <ErrorState message={error.message} retry={loadData} />;
  if (data.length === 0) return <EmptyState title="No data" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <h2>My View</h2>
          <HelpIcon content="Help text here" />
        </div>
      </div>

      <QuickTips tips={["Tip 1", "Tip 2"]} />

      {/* Your content here */}
    </div>
  );
};
```

---

## ⌨️ Keyboard Shortcuts

The following keyboard shortcuts are automatically available:

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open command palette |
| `Cmd/Ctrl + F` | Focus search |
| `Cmd/Ctrl + I` | Go to Inventory |
| `Cmd/Ctrl + J` | Go to Jobs |
| `Cmd/Ctrl + N` | Create new item |
| `Cmd/Ctrl + S` | Save (if applicable) |
| `?` | View all shortcuts |
| `Esc` | Close modals/palette |

**Adding Custom Shortcuts:**

```typescript
import { useKeyboardShortcut } from '../lib/keyboardShortcuts';

function MyComponent() {
  useKeyboardShortcut('e', exportData, {
    meta: true, // Cmd/Ctrl + E
    description: 'Export data',
    category: 'Actions'
  });
}
```

---

## 🎨 Accessibility Features

All UX components include:

- ✅ **WCAG 2.1 AA compliance**
- ✅ **Keyboard navigation**
- ✅ **Screen reader support** (ARIA labels)
- ✅ **Focus management**
- ✅ **Color contrast** (4.5:1 minimum)
- ✅ **Reduced motion** support
- ✅ **Skip links** for keyboard users

**Testing Accessibility:**

```typescript
import { meetsContrastStandard, announce } from '../lib/accessibility';

// Check color contrast
const passesAA = meetsContrastStandard('#000000', '#FFFFFF', 'AA');

// Announce to screen readers
announce('Item saved successfully', 'polite');
```

---

## 📱 Mobile Support

All UX components are mobile-responsive:

- ✅ Touch-friendly (44px minimum tap targets)
- ✅ Responsive layouts
- ✅ Mobile keyboard support
- ✅ Gesture support (where applicable)

---

## 🧪 Testing Your Integration

### Manual Testing Checklist

- [ ] Command palette opens with Cmd+K
- [ ] Toast notifications appear and dismiss
- [ ] Onboarding tour works for new users
- [ ] Help icons show tooltips on hover
- [ ] Loading states display during operations
- [ ] Empty states show when no data
- [ ] Keyboard shortcuts work
- [ ] Tab navigation works correctly
- [ ] Screen reader announces changes
- [ ] Works on mobile devices

### Test with Screen Reader

**macOS:**
1. Enable VoiceOver: Cmd + F5
2. Navigate: Tab key
3. Interact: VO + Space
4. Stop reading: Ctrl

**Windows:**
1. Install NVDA (free)
2. Start: Ctrl + Alt + N
3. Navigate: Tab key
4. Stop reading: Ctrl

---

## 🎯 Next Steps

### Recommended Enhancements

1. **Add to remaining views:**
   - ContactsView
   - JobsView
   - OrderingView
   - HistoryView
   - DashboardView

2. **Implement bulk operations:**
   - Bulk delete inventory items
   - Bulk update job statuses
   - Bulk export contacts

3. **Create additional tours:**
   - Jobs tour
   - Ordering tour
   - Analytics tour

4. **Add advanced features:**
   - Dark mode toggle
   - Customizable keyboard shortcuts
   - Advanced search with filters
   - Drag & drop functionality

---

## 📚 Additional Resources

- **UX_FEATURES.md** - Complete documentation of all UX components
- **UX_IMPLEMENTATION_SUMMARY.md** - Technical implementation details
- **WCAG 2.1 Guidelines** - https://www.w3.org/WAI/WCAG21/quickref/

---

## 💡 Tips & Best Practices

### Toast Notifications
- Use success toasts for completed actions
- Use error toasts for failures
- Use warning toasts for validation issues
- Keep messages concise (< 60 characters)

### Loading States
- Always show loading states for async operations
- Use skeleton screens for better perceived performance
- Match skeleton layout to actual content

### Help Content
- Place help icons next to complex features
- Keep tooltip content under 200 characters
- Use info callouts for important warnings

### Accessibility
- Always provide alt text for images
- Use semantic HTML elements
- Test with keyboard only
- Verify color contrast
- Add ARIA labels where needed

---

## 🐛 Troubleshooting

### Command Palette Not Opening
- Check if event listeners are attached
- Verify CommandPalette is rendered
- Check browser console for errors

### Toasts Not Showing
- Ensure component is wrapped in ToastProvider
- Check if useToast hook is called inside provider
- Verify toast methods are called correctly

### Tours Not Starting
- Check if tour targets exist in DOM
- Verify data-tour attributes match tour steps
- Clear localStorage to reset tour completion status

### Keyboard Shortcuts Not Working
- Check for conflicting browser shortcuts
- Verify keyboard shortcuts are registered
- Test in different browsers

---

## ✨ Summary

PlumbPro Inventory now features a comprehensive UX system that includes:

- **Command Palette** - Quick access to all actions
- **Toast Notifications** - User feedback system
- **Onboarding Tours** - Guided experience for new users
- **Loading States** - Better perceived performance
- **Contextual Help** - In-app guidance
- **Keyboard Shortcuts** - Power user features
- **Accessibility** - WCAG 2.1 AA compliant
- **Mobile Support** - Responsive and touch-friendly

All features are production-ready and can be extended to other views following the patterns shown in this guide.
