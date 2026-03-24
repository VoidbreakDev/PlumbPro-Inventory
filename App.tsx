
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import './lib/i18n';
import { ArrowRightLeft, Package } from 'lucide-react';
import { InventoryItem } from './types';
import { useStore } from './store/useStore';

import { NavTab, getNavigationLabel, isTabVisible } from './components/Navigation';
import { DeferredContentFallback } from './components/DeferredContentFallback';
import { TitleBar } from './components/TitleBar';

// UX Components
import { ToastProvider, useToast } from './components/ToastNotification';
import CommandPalette from './components/CommandPalette';
import { MobileBottomNav } from './components/MobileBottomNav';
import { AppViewRouter } from './app/AppViewRouter';
import { LoginView } from './app/lazyViews';
import { API_ROOT_URL, DEFAULT_BACKEND_PORT, hasExplicitApiUrl, smartOrderingAPI } from './lib/api';
import { useAutoLogout } from './hooks/useAutoLogout';
import { useAppBootstrap } from './hooks/useAppBootstrap';
import { useBackendHealthCheck } from './hooks/useBackendHealthCheck';
import { useResponsiveShell } from './hooks/useResponsiveShell';
import { useThemeInitialization } from './hooks/useThemeInitialization';
import { logger } from './lib/logging';

import { AppShell } from './components/AppShell';
import { useAppModals } from './components/AppModals';

// ── AppContent ────────────────────────────────────────────────────────────────

function AppContent() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [reorderAlertCount, setReorderAlertCount] = useState(0);
  const { isMobile, isSidebarOpen, setIsSidebarOpen } = useResponsiveShell();
  useThemeInitialization();

  const user = useStore((state) => state.user);
  const logout = useStore((state) => state.logout);
  const inventory = useStore((state) => state.inventory);
  const contacts = useStore((state) => state.contacts);
  const jobs = useStore((state) => state.jobs);
  const movements = useStore((state) => state.movements);
  const templates = useStore((state) => state.templates);
  const kits = useStore((state) => state.kits);
  const locations = useStore((state) => state.locations);
  const syncWithServer = useStore((state) => state.syncWithServer);

  const resolvedActiveTab = useMemo(
    () => (isTabVisible(activeTab, user?.role) ? activeTab : 'dashboard'),
    [activeTab, user?.role]
  );
  const activeTabLabel = useMemo(() => getNavigationLabel(resolvedActiveTab), [resolvedActiveTab]);

  // Auto-logout after 30 minutes of inactivity
  useAutoLogout({
    timeout: 30 * 60 * 1000,
    onLogout: () => {
      logout();
      toast.error('You have been logged out due to inactivity');
    }
  });

  useBackendHealthCheck({
    apiRootUrl: API_ROOT_URL,
    defaultBackendPort: DEFAULT_BACKEND_PORT,
    hasExplicitApiUrl,
    toast
  });

  // Listen for auto-logout warning
  useEffect(() => {
    const handleWarning = () => {
      toast.warning('You will be logged out in 2 minutes due to inactivity', { duration: 5000 });
    };
    const handleWarningClear = () => {};

    window.addEventListener('auto-logout-warning', handleWarning);
    window.addEventListener('auto-logout-warning-clear', handleWarningClear);
    return () => {
      window.removeEventListener('auto-logout-warning', handleWarning);
      window.removeEventListener('auto-logout-warning-clear', handleWarningClear);
    };
  }, [toast]);

  // Fetch reorder alert count periodically
  useEffect(() => {
    const fetchAlertCount = async () => {
      try {
        const alerts = await smartOrderingAPI.getAlerts({ status: 'pending' });
        setReorderAlertCount(alerts.length);
      } catch (error) {
        logger.debug('Failed to fetch reorder alerts:', error);
      }
    };
    fetchAlertCount();
    const interval = setInterval(fetchAlertCount, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (resolvedActiveTab !== activeTab) {
      setActiveTab(resolvedActiveTab);
    }
  }, [activeTab, resolvedActiveTab]);

  // Inventory Filtering & Sorting
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventorySortConfig, setInventorySortConfig] = useState<{ key: keyof InventoryItem; direction: 'asc' | 'desc' } | null>(null);

  const handleInventorySort = (key: keyof InventoryItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (inventorySortConfig && inventorySortConfig.key === key && inventorySortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setInventorySortConfig({ key, direction });
  };

  // Memoized Reserved Stock Calculation
  const reservedStock = useMemo(() => {
    const reserved: Record<string, number> = {};
    jobs
      .filter((job) => !job.isPicked && ['Scheduled', 'In Progress'].includes(job.status))
      .forEach((job) => {
        job.allocatedItems.forEach((item) => {
          reserved[item.itemId] = (reserved[item.itemId] || 0) + item.quantity;
        });
      });
    return reserved;
  }, [jobs]);

  // Memoized Filtered Data
  const filteredInventory = useMemo(() => {
    let items = [...inventory];
    if (inventorySearch.trim()) {
      const lowerQuery = inventorySearch.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(lowerQuery) ||
          item.category.toLowerCase().includes(lowerQuery)
      );
    }
    if (inventorySortConfig) {
      items.sort((a, b) => {
        const aVal = a[inventorySortConfig.key];
        const bVal = b[inventorySortConfig.key];
        if (aVal === undefined || bVal === undefined) return 0;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return inventorySortConfig.direction === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return inventorySortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        return 0;
      });
    }
    return items;
  }, [inventory, inventorySearch, inventorySortConfig]);

  // All modal state + handlers live in useAppModals
  const { state: modalState, handlers, modalsJSX } = useAppModals(
    inventory,
    contacts,
    jobs,
    movements,
    templates,
    kits,
    locations,
    reservedStock
  );

  useAppBootstrap({
    syncWithServer,
    enableDataSyncOnMount: true,
    enableUiBootstrap: true,
    onNavigate: setActiveTab,
    onOpenNewJobModal: modalState.setIsNewJobModalOpen,
    onOpenStockTransferModal: modalState.setIsStockTransferModalOpen
  });

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden">
      <CommandPalette />
      <TitleBar />

      <AppShell
        activeTab={resolvedActiveTab}
        isSidebarOpen={isSidebarOpen}
        isMobile={isMobile}
        reorderAlertCount={reorderAlertCount}
        userFullName={user?.fullName}
        userEmail={user?.email}
        userRole={user?.role}
        activeTabLabel={activeTabLabel}
        onNavigate={setActiveTab}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onLogout={logout}
        onOpenAIAssistant={() => modalState.setShowAIAssistant(true)}
        onOpenSettings={() => setActiveTab('settings')}
      >
        <AppViewRouter
          activeTab={resolvedActiveTab}
          inventory={inventory}
          filteredInventory={filteredInventory}
          contacts={contacts}
          jobs={jobs}
          movements={movements}
          templates={templates}
          kits={kits}
          inventorySearch={inventorySearch}
          inventorySortConfig={inventorySortConfig}
          onNavigate={setActiveTab}
          onInventorySearchChange={setInventorySearch}
          onInventorySort={handleInventorySort}
          onImportCSV={handlers.handleImportCSV}
          onViewItemDetails={(item) => {
            modalState.setItemToShow(item);
            modalState.setIsDetailModalOpen(true);
          }}
          onOpenAdjustItem={(item) => {
            modalState.setItemToAdjust(item);
            modalState.setAdjustmentValue(0);
            modalState.setIsAdjustModalOpen(true);
          }}
          onEditItem={handlers.handleEditItem}
          onAddItem={handlers.handleAddItem}
          onDeleteItem={handlers.handleDeleteItem}
          onDeleteAllItems={handlers.handleDeleteAllItems}
          onOpenStockTransfer={() => modalState.setIsStockTransferModalOpen(true)}
          onOpenNewJobModal={() => modalState.setIsNewJobModalOpen(true)}
          onConfirmPick={handlers.handleConfirmPick}
          onOpenAllocateModal={(job) => {
            modalState.setJobToAllocate(job);
            modalState.setAllocSearch('');
            modalState.setAllocItemId('');
            modalState.setIsAllocateModalOpen(true);
          }}
          onOpenTemplateModal={(jobId, templateId) => {
            const job = jobs.find((j) => j.id === jobId);
            const allocatedItems = handlers.getAllocatedItemsFromSelection(templateId);
            if (job && allocatedItems.length > 0) {
              modalState.setTemplateJob(job);
              modalState.setSelectedStockSourceName(handlers.getStockSourceName(templateId));
              modalState.setTemplateItems(allocatedItems);
              modalState.setIsTemplateModalOpen(true);
            } else if (job) {
              toast.warning(`${handlers.getStockSourceName(templateId)} does not contain any stock-linked inventory items yet.`);
            }
          }}
          onAddTemplate={handlers.handleAddTemplate}
          onUpdateTemplate={handlers.handleUpdateTemplate}
          onDeleteTemplate={handlers.handleDeleteTemplate}
          onAddContact={handlers.handleAddContact}
          onEditContact={handlers.handleEditContact}
          onDeleteContact={handlers.handleDeleteContact}
          onSettingsSaved={() => toast.success('Settings saved successfully!')}
        />
      </AppShell>

      {/* Global modals rendered via useAppModals hook */}
      {modalsJSX}

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <MobileBottomNav
          activeTab={resolvedActiveTab}
          onNavigate={(tab) => {
            if (tab === 'menu') {
              setActiveTab('settings');
            } else {
              setActiveTab(tab as any);
            }
          }}
        />
      )}

      {/* Mobile FAB for Stock Count and Transfer */}
      {isMobile && resolvedActiveTab === 'inventory' && !modalState.isMobileStockCountOpen && (
        <>
          <button
            onClick={() => modalState.setIsStockTransferModalOpen(true)}
            className="md:hidden fixed bottom-36 right-6 w-12 h-12 bg-green-600 text-white rounded-full shadow-lg flex items-center justify-center z-20 active:scale-95 transition-transform"
            title="Transfer Stock"
          >
            <ArrowRightLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => modalState.setIsMobileStockCountOpen(true)}
            className="md:hidden fixed bottom-20 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center z-20 active:scale-95 transition-transform"
          >
            <Package className="w-6 h-6" />
          </button>
        </>
      )}
    </div>
  );
}

// ── App (root with providers + auth gate) ─────────────────────────────────────

export default function App() {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const syncWithServer = useStore((state) => state.syncWithServer);

  useAppBootstrap({
    syncWithServer,
    enableAuthBootstrap: true
  });

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<DeferredContentFallback label="Loading login..." />}>
        <LoginView />
      </Suspense>
    );
  }

  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
