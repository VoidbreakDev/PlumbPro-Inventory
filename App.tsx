
import React, { useState, useMemo, useEffect } from 'react';
import './lib/i18n';
import {
  Package,
  Users,
  Calendar,
  TrendingUp,
  ShoppingCart,
  ArrowRightLeft,
  Settings,
  Menu,
  X,
  ClipboardList,
  AlertTriangle,
  CheckCircle,
  Plus,
  AlertCircle,
  Info,
  Tag,
  Truck,
  Mail,
  Phone,
  Search,
  UserPlus,
  Clock,
  Languages,
  LogOut,
  FileText,
  RotateCcw,
  FileUp,
  SlidersHorizontal,
  ArrowRight,
  BarChart3,
  Sparkles,
  Zap
} from 'lucide-react';
import {
  Contact,
  InventoryItem,
  Job,
  StockMovement,
  JobTemplate,
  AllocatedItem
} from './types';
import { useStore } from './store/useStore';

import { NavItem, getStockStatus, StockMeter, Badge } from './components/Shared';
import { DashboardView } from './views/DashboardView';
import { InventoryView } from './views/InventoryView';
import { JobsView } from './views/JobsView';
import { CalendarView } from './views/CalendarView';
import { JobPlanningView } from './views/JobPlanningView';
import { OrderingView } from './views/OrderingView';
import { HistoryView } from './views/HistoryView';
import { ContactsView } from './views/ContactsView';
import { ApprovalsView } from './views/ApprovalsView';
import { SettingsView } from './views/SettingsView';
import { MobileStockCountView } from './views/MobileStockCountView';
import { LoginView } from './components/LoginView';
import { PurchaseOrdersView } from './views/PurchaseOrdersView';
import { StockReturnsView } from './views/StockReturnsView';
import { SupplierDashboardView } from './views/SupplierDashboardView';
import { QuotesView } from './views/QuotesView';
import InvoicesView from './views/InvoicesView';
import { ReportingView } from './views/ReportingView';
import { TeamManagementView } from './views/TeamManagementView';
import { AnalyticsView } from './views/AnalyticsView';
import { AIForecastView } from './views/AIForecastView';
import { AIAssistant } from './components/AIAssistant';
import WorkflowAutomationView from './views/WorkflowAutomationView';
import CustomerPortalView from './views/CustomerPortalView';

// UX Components
import { ToastProvider, useToast } from './components/ToastNotification';
import CommandPalette from './components/CommandPalette';
import LanguageSwitcher from './components/LanguageSwitcher';
import { MobileBottomNav } from './components/MobileBottomNav';
import { StockTransferModal } from './components/StockTransferModal';
import { onboardingService, tours } from './lib/onboardingService';
import { addSkipLink } from './lib/accessibility';
import { API_ROOT_URL, DEFAULT_BACKEND_PORT, hasExplicitApiUrl, smartOrderingAPI } from './lib/api';
import { useAutoLogout } from './hooks/useAutoLogout';
import { logger } from './lib/logging';
import { loadSettings } from './lib/settings';

function AppContent() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'calendar' | 'job-planning' | 'contacts' | 'ordering' | 'history' | 'approvals' | 'purchase-orders' | 'stock-returns' | 'supplier-dashboard' | 'quotes' | 'invoices' | 'reports' | 'team' | 'settings' | 'analytics' | 'ai-forecast' | 'workflows'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('light');
  const [isMobileStockCountOpen, setIsMobileStockCountOpen] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [reorderAlertCount, setReorderAlertCount] = useState(0);
  const user = useStore((state) => state.user);
  const logout = useStore((state) => state.logout);
  const inventory = useStore((state) => state.inventory);
  const contacts = useStore((state) => state.contacts);
  const jobs = useStore((state) => state.jobs);
  const movements = useStore((state) => state.movements);
  const templates = useStore((state) => state.templates);
  const locations = useStore((state) => state.locations);
  const createStockTransfer = useStore((state) => state.createStockTransfer);
  const error = useStore((state) => state.error);
  const clearError = useStore((state) => state.clearError);
  const addJob = useStore((state) => state.addJob);
  const pickJob = useStore((state) => state.pickJob);
  const addInventoryItem = useStore((state) => state.addInventoryItem);
  const updateInventoryItem = useStore((state) => state.updateInventoryItem);
  const deleteInventoryItem = useStore((state) => state.deleteInventoryItem);
  const deleteAllInventoryItems = useStore((state) => state.deleteAllInventoryItems);
  const adjustStock = useStore((state) => state.adjustStock);
  const addContact = useStore((state) => state.addContact);
  const updateContact = useStore((state) => state.updateContact);
  const deleteContact = useStore((state) => state.deleteContact);
  const addTemplate = useStore((state) => state.addTemplate);
  const updateTemplate = useStore((state) => state.updateTemplate);
  const deleteTemplate = useStore((state) => state.deleteTemplate);
  const setInventoryState = useStore((state) => state.setInventoryState);
  const setJobsState = useStore((state) => state.setJobsState);
  const setMovementsState = useStore((state) => state.setMovementsState);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-logout after 30 minutes of inactivity
  useAutoLogout({
    timeout: 30 * 60 * 1000, // 30 minutes
    onLogout: () => {
      logout();
      toast.error('You have been logged out due to inactivity');
    }
  });

  // Listen for auto-logout warning
  useEffect(() => {
    const handleWarning = () => {
      toast.warning('You will be logged out in 2 minutes due to inactivity', { duration: 5000 });
    };

    const handleWarningClear = () => {
      // Clear any existing warnings (handled by toast system)
    };

    window.addEventListener('auto-logout-warning', handleWarning);
    window.addEventListener('auto-logout-warning-clear', handleWarningClear);

    return () => {
      window.removeEventListener('auto-logout-warning', handleWarning);
      window.removeEventListener('auto-logout-warning-clear', handleWarningClear);
    };
  }, [toast]);

  // Initialize theme from persisted settings
  useEffect(() => {
    let isMounted = true;
    const fetchSettings = async () => {
      try {
        const settings = await loadSettings();
        if (isMounted && settings.appearance?.theme) {
          setTheme(settings.appearance.theme);
        }
      } catch (error) {
        console.error('Failed to load theme settings:', error);
      }
    };

    void fetchSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  // Load all data on mount with error handling
  useEffect(() => {
    const loadData = async () => {
      try {
        await useStore.getState().syncWithServer();
      } catch (error) {
        logger.error('Failed to sync data on mount:', error);
        // Error is already handled by the store, but we ensure it's logged
      }
    };
    loadData();
  }, []);

  // Fetch reorder alert count periodically
  useEffect(() => {
    const fetchAlertCount = async () => {
      try {
        const alerts = await smartOrderingAPI.getAlerts({ status: 'pending' });
        setReorderAlertCount(alerts.length);
      } catch (error) {
        // Silently fail - alerts are not critical
        logger.debug('Failed to fetch reorder alerts:', error);
      }
    };

    // Initial fetch
    fetchAlertCount();

    // Refresh every 5 minutes
    const interval = setInterval(fetchAlertCount, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!hasExplicitApiUrl && window.location.port !== `${DEFAULT_BACKEND_PORT}`) {
      toast.warning(
        `VITE_API_URL is not set. The app is using the default API at ${API_ROOT_URL}. Set VITE_API_URL in your .env file if your backend runs elsewhere.`,
        'API configuration'
      );
    }
  }, [toast]);

  useEffect(() => {
    const controller = new AbortController();
    const checkHealth = async () => {
      try {
        const response = await fetch(`${API_ROOT_URL}/health`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Health check failed with status ${response.status}`);
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return;
        }
        toast.warning(
          `Backend health check failed for ${API_ROOT_URL}. Confirm the server is running and VITE_API_URL is correct.`,
          'Backend connection'
        );
      }
    };

    void checkHealth();
    return () => {
      controller.abort();
    };
  }, [toast]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else if (theme === 'auto') {
      // Auto mode: use system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [theme]);

  // Listen for settings changes
  useEffect(() => {
    const handleSettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.appearance?.theme) {
        setTheme(customEvent.detail.appearance.theme);
      }
    };

    window.addEventListener('settings-changed', handleSettingsChange);
    return () => {
      window.removeEventListener('settings-changed', handleSettingsChange);
    };
  }, []);

  // Initialize UX features on mount
  useEffect(() => {
    // Add skip link for accessibility
    addSkipLink('main-content', 'Skip to main content');

    // Show welcome tour for new users (after 1 second delay)
    if (!onboardingService.hasCompletedTour('welcome')) {
      setTimeout(() => {
        onboardingService.startTour(tours.welcome);
      }, 1000);
    }

    // Custom event listeners for command palette actions
    const handleNavigate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const tab = customEvent.detail as 'dashboard' | 'inventory' | 'calendar' | 'job-planning' | 'contacts' | 'ordering' | 'history' | 'approvals' | 'settings';
      setActiveTab(tab);
    };

    const handleCreateNewItem = () => {
      setActiveTab('inventory');
    };
    const handleCreateNewJob = () => {
      setIsNewJobModalOpen(true);
    };
    const handleCreateNewContact = () => {
      setActiveTab('contacts');
    };
    const handleTransferStock = () => {
      setIsStockTransferModalOpen(true);
    };

    window.addEventListener('navigate', handleNavigate);
    window.addEventListener('create-new-item', handleCreateNewItem);
    window.addEventListener('create-new-job', handleCreateNewJob);
    window.addEventListener('create-new-contact', handleCreateNewContact);
    window.addEventListener('transfer-stock', handleTransferStock);

    return () => {
      window.removeEventListener('navigate', handleNavigate);
      window.removeEventListener('create-new-item', handleCreateNewItem);
      window.removeEventListener('create-new-job', handleCreateNewJob);
      window.removeEventListener('create-new-contact', handleCreateNewContact);
      window.removeEventListener('transfer-stock', handleTransferStock);
    };
  }, []);
  
  // Inventory Filtering & Sorting
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventorySortConfig, setInventorySortConfig] = useState<{ key: keyof InventoryItem; direction: 'asc' | 'desc' } | null>(null);

  // Modals States
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [itemToAdjust, setItemToAdjust] = useState<InventoryItem | null>(null);
  const [adjustmentValue, setAdjustmentValue] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  const [adjustmentLocationId, setAdjustmentLocationId] = useState<string>('');
  const [isStockTransferModalOpen, setIsStockTransferModalOpen] = useState(false);
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isEditContactModalOpen, setIsEditContactModalOpen] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [itemToShow, setItemToShow] = useState<InventoryItem | null>(null);

  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
  const [jobToAllocate, setJobToAllocate] = useState<Job | null>(null);
  const [allocItemId, setAllocItemId] = useState<string>('');
  const [allocQty, setAllocQty] = useState<number>(1);
  const [allocSearch, setAllocSearch] = useState('');

  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateJob, setTemplateJob] = useState<Job | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<JobTemplate | null>(null);
  const [templateItems, setTemplateItems] = useState<AllocatedItem[]>([]);

  // New Job Modal State
  const [isNewJobModalOpen, setIsNewJobModalOpen] = useState(false);
  const [newJobData, setNewJobData] = useState({
    title: '',
    builder: '',
    date: '',
    workerIds: [] as string[],
    templateId: '',
  });

  // Memoized Reserved Stock Calculation
  const reservedStock = useMemo(() => {
    const reserved: Record<string, number> = {};
    jobs.filter(j => !j.isPicked).forEach(job => {
      job.allocatedItems.forEach(item => {
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
      items = items.filter(item => 
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
          return inventorySortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return inventorySortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        return 0;
      });
    }
    return items;
  }, [inventory, inventorySearch, inventorySortConfig]);

  // Handlers
  const handleInventorySort = (key: keyof InventoryItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (inventorySortConfig && inventorySortConfig.key === key && inventorySortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setInventorySortConfig({ key, direction });
  };

  const handleCreateJob = async () => {
    const { title, builder, date, workerIds, templateId } = newJobData;
    if (!title || !date || workerIds.length === 0) {
      toast.warning('Please fill in all required fields');
      return;
    }

    try {
      let allocatedItems: AllocatedItem[] = [];
      if (templateId) {
        const template = templates.find(t => t.id === templateId);
        if (template) {
          allocatedItems = template.items.map(i => ({ ...i }));
        }
      }

      const newJob = {
        title,
        builder,
        date,
        assignedWorkerIds: workerIds,
        jobType: 'Custom' as const,
        status: 'Scheduled' as const,
        allocatedItems,
        isPicked: false,
      };

      await addJob(newJob);
      setIsNewJobModalOpen(false);
      setNewJobData({ title: '', builder: '', date: '', workerIds: [], templateId: '' });
      toast.success(`Job "${title}" created successfully!`);
      logger.info('Job created successfully');
    } catch (error: any) {
      // Errors are handled via the global store error state.
    }
  };

  const handleConfirmPick = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job || job.isPicked) return;

    try {
      await pickJob(jobId);
      toast.success(`Job "${job.title}" picked successfully!`, 'Items Allocated');
      logger.info('Job picked successfully:', jobId);
    } catch (error: any) {
      // Errors are handled via the global store error state.
    }
  };

  const [csvPreviewItems, setCsvPreviewItems] = useState<Omit<InventoryItem, 'id'>[]>([]);
  const [csvSelectedRows, setCsvSelectedRows] = useState<Set<number>>(new Set());
  const [showCSVPreviewModal, setShowCSVPreviewModal] = useState(false);
  const [showCSVMappingModal, setShowCSVMappingModal] = useState(false);
  const [csvRawData, setCsvRawData] = useState<{ headers: string[], rows: string[][] }>({ headers: [], rows: [] });
  const [csvColumnMapping, setCsvColumnMapping] = useState<Record<string, number>>({
    name: 0,
    category: 1,
    price: 2,
    quantity: 3,
    reorderLevel: 4,
    supplierId: 5,
    supplierCode: 6,
    buyPriceExclGST: -1,
    buyPriceInclGST: -1,
    sellPriceExclGST: -1,
    sellPriceInclGST: -1
  });

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length === 0) {
        toast.error('CSV file is empty', 'Import Error');
        return;
      }

      // Parse CSV with proper handling of quoted fields
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = parseCSVLine(lines[0]);
      const rows = lines.slice(1).map(line => parseCSVLine(line));

      // Store raw data and show mapping modal
      setCsvRawData({ headers, rows });
      setShowCSVMappingModal(true);
    };
    reader.readAsText(file);
    // Reset the input value so the same file can be selected again
    event.target.value = '';
  };

  const applyCSVMapping = () => {
    const newItems: Omit<InventoryItem, 'id'>[] = [];

    csvRawData.rows.forEach((row) => {
      if (row.length === 0 || !row[csvColumnMapping.name]) return;

      const parsePriceField = (value: string): number | undefined => {
        if (!value || value.trim() === '') return undefined;
        const parsed = parseFloat(value);
        return isNaN(parsed) ? undefined : parsed;
      };

      const supplierIdValue = row[csvColumnMapping.supplierId] || '';
      const supplierCodeValue = row[csvColumnMapping.supplierCode] || '';

      // Parse legacy price field - use 0 if skipped or empty
      const legacyPrice = csvColumnMapping.price >= 0
        ? (parsePriceField(row[csvColumnMapping.price]) ?? 0)
        : 0;

      newItems.push({
        name: row[csvColumnMapping.name] || '',
        category: row[csvColumnMapping.category] || '',
        price: legacyPrice,
        quantity: parseInt(row[csvColumnMapping.quantity]) || 0,
        reorderLevel: parseInt(row[csvColumnMapping.reorderLevel]) || 5,
        supplierId: supplierIdValue,
        supplierCode: supplierCodeValue,
        locationStock: [],
        buyPriceExclGST: csvColumnMapping.buyPriceExclGST >= 0 ? parsePriceField(row[csvColumnMapping.buyPriceExclGST]) : undefined,
        buyPriceInclGST: csvColumnMapping.buyPriceInclGST >= 0 ? parsePriceField(row[csvColumnMapping.buyPriceInclGST]) : undefined,
        sellPriceExclGST: csvColumnMapping.sellPriceExclGST >= 0 ? parsePriceField(row[csvColumnMapping.sellPriceExclGST]) : undefined,
        sellPriceInclGST: csvColumnMapping.sellPriceInclGST >= 0 ? parsePriceField(row[csvColumnMapping.sellPriceInclGST]) : undefined
      });
    });

    // Log first item to verify pricing was parsed
    if (newItems.length > 0) {
      logger.debug('First parsed CSV item:', newItems[0]);
      logger.debug('CSV column mappings:', csvColumnMapping);
    }

    setCsvPreviewItems(newItems);
    // Select all rows by default
    setCsvSelectedRows(new Set(newItems.map((_, index) => index)));
    setShowCSVMappingModal(false);
    setShowCSVPreviewModal(true);
  };

  const confirmCSVImport = async () => {
    try {
      const selectedItems = csvPreviewItems.filter((_, index) => csvSelectedRows.has(index));

      // Sanitize items before sending to API
      const sanitizedItems = selectedItems.map(item => {
        const sanitized = {
          ...item,
          supplierId: item.supplierId && item.supplierId.trim() !== '' ? item.supplierId : undefined,
          supplierCode: item.supplierCode || undefined,
          description: item.description || undefined
        };

        // Log the first item to verify pricing data
        if (selectedItems.indexOf(item) === 0) {
          logger.debug('First CSV item being imported:', sanitized);
        }

        return sanitized;
      });

      // Use Promise.allSettled to allow partial success
      const results = await Promise.allSettled(
        sanitizedItems.map((item) => addInventoryItem(item))
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (succeeded > 0) {
        toast.success(
          `Imported ${succeeded} item${succeeded !== 1 ? 's' : ''} successfully!${failed > 0 ? ` (${failed} failed)` : ''}`,
          'CSV Import Complete'
        );
      }

      if (failed > 0 && succeeded === 0) {
        toast.error(`Failed to import all ${failed} item${failed !== 1 ? 's' : ''}. Check console for details.`, 'Import Failed');
        console.error('Import failures:', results.filter(r => r.status === 'rejected').map(r => r.reason));
      }

      setShowCSVPreviewModal(false);
      setCsvPreviewItems([]);
      setCsvSelectedRows(new Set());
    } catch (error) {
      toast.error('An unexpected error occurred during import', 'Import Error');
      console.error('CSV Import error:', error);
    }
  };

  const toggleAllCSVRows = () => {
    if (csvSelectedRows.size === csvPreviewItems.length) {
      // Deselect all
      setCsvSelectedRows(new Set());
    } else {
      // Select all
      setCsvSelectedRows(new Set(csvPreviewItems.map((_, index) => index)));
    }
  };

  const toggleCSVRow = (index: number) => {
    const newSelected = new Set(csvSelectedRows);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setCsvSelectedRows(newSelected);
  };

  const handleDeleteItem = async (item: InventoryItem) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      await deleteInventoryItem(item.id);
      toast.success(`"${item.name}" has been deleted`, 'Item Deleted');
    } catch (error: any) {
      // Errors are handled via the global store error state.
    }
  };

  const handleDeleteAllItems = async () => {
    const itemCount = inventory.length;
    if (!confirm(`Are you sure you want to delete ALL ${itemCount} inventory items?\n\nThis will permanently remove all items from your inventory.\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      await deleteAllInventoryItems();
      toast.success(`All ${itemCount} inventory items have been deleted`, 'Inventory Cleared');
    } catch (error: any) {
      // Errors are handled via the global store error state.
    }
  };

  const handleManualAdjustment = async () => {
    if (!itemToAdjust || adjustmentValue === 0 || !adjustmentReason.trim()) {
      toast.warning('Please provide adjustment value and reason');
      return;
    }

    try {
      await adjustStock(itemToAdjust.id, adjustmentValue, adjustmentReason);
      setIsAdjustModalOpen(false);
      setAdjustmentLocationId('');
      toast.success(`Stock adjusted for ${itemToAdjust.name}`, 'Adjustment Complete');
      logger.info('Stock adjusted successfully');
    } catch (error: any) {
      // Errors are handled via the global store error state.
    }
  };

  const handleEditItem = (item: InventoryItem) => {
    setItemToEdit(item);
    setIsEditItemModalOpen(true);
  };

  const handleSaveEditItem = async () => {
    if (!itemToEdit) return;
    if (!itemToEdit.name.trim() || !itemToEdit.category.trim()) {
      toast.warning('Please fill in all required fields');
      return;
    }

    try {
      await updateInventoryItem(itemToEdit.id, itemToEdit);
      setIsEditItemModalOpen(false);
      toast.success(`${itemToEdit.name} updated successfully!`);
      logger.info('Inventory item updated successfully');
      setItemToEdit(null);
    } catch (error: any) {
      // Errors are handled via the global store error state.
    }
  };

  const handleAddItem = () => {
    const newItem: InventoryItem = {
      id: `inv-${Date.now()}`,
      name: '',
      category: '',
      quantity: 0,
      price: 0,
      reorderLevel: 5,
      supplierId: contacts.find(c => c.type === 'Supplier')?.id || '',
      supplierCode: '',
      locationStock: []
    };
    setItemToEdit(newItem);
    setIsAddItemModalOpen(true);
  };

  const handleSaveNewItem = async () => {
    if (!itemToEdit) return;
    if (!itemToEdit.name.trim() || !itemToEdit.category.trim()) {
      toast.warning('Please fill in all required fields');
      return;
    }

    try {
      const { id, ...payload } = itemToEdit;
      await addInventoryItem(payload);
      setIsAddItemModalOpen(false);
      toast.success(`${itemToEdit.name} added successfully!`);
      logger.info('Inventory item created successfully');
      setItemToEdit(null);
    } catch (error: any) {
      // Errors are handled via the global store error state.
    }
  };

  const handleMobileStockUpdate = async (itemId: string, newQuantity: number) => {
    try {
      const item = inventory.find(i => i.id === itemId);
      if (!item) return;

      const delta = newQuantity - item.quantity;

      await adjustStock(itemId, delta, 'Mobile stock count adjustment');

      toast.success('Stock count updated');
      logger.info('Mobile stock updated successfully');
    } catch (error: any) {
      // Errors are handled via the global store error state.
    }
  };

  const handleAddContact = () => {
    setContactToEdit({
      id: `c-${Date.now()}`,
      name: '',
      company: '',
      email: '',
      phone: '',
      type: 'Supplier'
    });
    setIsEditContactModalOpen(true);
  };

  const handleEditContact = (contact: Contact) => {
    setContactToEdit(contact);
    setIsEditContactModalOpen(true);
  };

  const handleSaveEditContact = async () => {
    if (!contactToEdit) return;
    if (!contactToEdit.name.trim() || !contactToEdit.email.trim()) {
      toast.warning('Please fill in name and email');
      return;
    }

    try {
      // Check if this is a new contact or editing existing
      const isNewContact = !contacts.find(c => c.id === contactToEdit.id);

      if (isNewContact) {
        // Create new contact in database
        const { id, ...payload } = contactToEdit;
        await addContact(payload);
        toast.success(`${contactToEdit.name} added successfully!`);
        logger.info('Contact created successfully');
      } else {
        // Update existing contact in database
        await updateContact(contactToEdit.id, contactToEdit);
        toast.success(`${contactToEdit.name} updated successfully!`);
        logger.info('Contact updated successfully');
      }

      setIsEditContactModalOpen(false);
      setContactToEdit(null);
    } catch (error: any) {
      // Errors are handled via the global store error state.
    }
  };

  const handleDeleteContact = async (contact: Contact) => {
    if (!confirm(`Delete ${contact.name}? This cannot be undone.`)) return;

    try {
      await deleteContact(contact.id);
      toast.success(`${contact.name} deleted successfully`);
      logger.info('Contact deleted successfully');
    } catch (error: any) {
      // Errors are handled via the global store error state.
    }
  };

  const applyTemplateAllocation = () => {
    if (!templateJob || !templateItems.length) return;
    const nextJobs = jobs.map(job => {
      if (job.id === templateJob.id) {
        return { ...job, allocatedItems: [...job.allocatedItems, ...templateItems] };
      }
      return job;
    });
    setJobsState(nextJobs);
    if (templateJob.isPicked) {
      const newMovements = templateItems.map(item => ({
        id: `m-tmpl-${Date.now()}-${Math.random()}`,
        itemId: item.itemId,
        type: 'Allocation' as const,
        quantity: item.quantity,
        timestamp: Date.now(),
        reference: templateJob.id,
      }));
      setMovementsState([...newMovements, ...movements]);
      const updatedInventory = inventory.map(i => {
        const movement = templateItems.find(item => item.itemId === i.id);
        if (!movement) return i;
        return { ...i, quantity: Math.max(0, i.quantity - movement.quantity) };
      });
      setInventoryState(updatedInventory);
    }
    setIsTemplateModalOpen(false);
  };

  const handleManualAllocate = () => {
    if (!jobToAllocate || !allocItemId || allocQty <= 0) return;
    const nextJobs = jobs.map(job => {
      if (job.id === jobToAllocate.id) {
        const existingIndex = job.allocatedItems.findIndex(ai => ai.itemId === allocItemId);
        let newAllocatedItems = [...job.allocatedItems];
        if (existingIndex >= 0) {
          newAllocatedItems[existingIndex] = {
            ...newAllocatedItems[existingIndex],
            quantity: newAllocatedItems[existingIndex].quantity + allocQty
          };
        } else {
          newAllocatedItems.push({ itemId: allocItemId, quantity: allocQty });
        }
        return { ...job, allocatedItems: newAllocatedItems };
      }
      return job;
    });
    setJobsState(nextJobs);
    
    if (jobToAllocate.isPicked) {
      const movement: StockMovement = {
        id: `m-alloc-${Date.now()}`,
        itemId: allocItemId,
        type: 'Allocation',
        quantity: allocQty,
        timestamp: Date.now(),
        reference: jobToAllocate.id,
      };
      setMovementsState([movement, ...movements]);
      const updatedInventory = inventory.map(i => {
        if (i.id === allocItemId) {
          return { ...i, quantity: Math.max(0, i.quantity - allocQty) };
        }
        return i;
      });
      setInventoryState(updatedInventory);
    }
    setIsAllocateModalOpen(false);
  };

  // Template Management Handlers
  const handleAddTemplate = async (name: string, items: AllocatedItem[]) => {
    try {
      const newTemplate = {
        name,
        items
      };
      await addTemplate(newTemplate);
      toast.success(`Template "${name}" created successfully!`);
      logger.info('Template created successfully');
    } catch (error: any) {
      // Errors are handled via the global store error state.
    }
  };

  const handleUpdateTemplate = async (id: string, name: string, items: AllocatedItem[]) => {
    try {
      await updateTemplate(id, { name, items });
      toast.success(`Template "${name}" updated successfully!`);
      logger.info('Template updated successfully');
    } catch (error: any) {
      // Errors are handled via the global store error state.
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await deleteTemplate(id);
      toast.success('Template deleted successfully!');
      logger.info('Template deleted successfully');
    } catch (error: any) {
      // Errors are handled via the global store error state.
    }
  };

  return (
    <>
      <CommandPalette />

      <div className="min-h-screen flex bg-slate-50 dark:bg-slate-900">
        <aside className={`hidden md:flex ${isSidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 dark:bg-slate-950 text-slate-400 dark:text-slate-500 transition-all duration-300 flex-col fixed h-full z-20`}>
          <div className="p-6 flex items-center space-x-3 text-white" data-tour="logo">
            <Package className="w-8 h-8 text-blue-400 shrink-0" />
            {isSidebarOpen && <span className="font-bold text-xl tracking-tight">PlumbStock</span>}
          </div>
          <nav className="flex-1 mt-4" data-tour="navigation">
            <NavItem icon={TrendingUp} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} collapsed={!isSidebarOpen} />
            <div data-tour="inventory">
              <NavItem icon={Package} label="Inventory" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} collapsed={!isSidebarOpen} />
            </div>
            <div data-tour="calendar">
              <NavItem icon={Calendar} label="Calendar" active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} collapsed={!isSidebarOpen} />
            </div>
            <div data-tour="job-planning">
              <NavItem icon={ClipboardList} label="Job Planning" active={activeTab === 'job-planning'} onClick={() => setActiveTab('job-planning')} collapsed={!isSidebarOpen} />
            </div>
            <NavItem icon={ShoppingCart} label="Smart Ordering" active={activeTab === 'ordering'} onClick={() => setActiveTab('ordering')} collapsed={!isSidebarOpen} badge={reorderAlertCount} />
            <NavItem icon={FileText} label="Purchase Orders" active={activeTab === 'purchase-orders'} onClick={() => setActiveTab('purchase-orders')} collapsed={!isSidebarOpen} />
            <NavItem icon={FileText} label="Quotes" active={activeTab === 'quotes'} onClick={() => setActiveTab('quotes')} collapsed={!isSidebarOpen} />
            <NavItem icon={FileText} label="Invoices" active={activeTab === 'invoices'} onClick={() => setActiveTab('invoices')} collapsed={!isSidebarOpen} />
            <NavItem icon={RotateCcw} label="Stock Returns" active={activeTab === 'stock-returns'} onClick={() => setActiveTab('stock-returns')} collapsed={!isSidebarOpen} />
            <NavItem icon={ArrowRightLeft} label="Stock History" active={activeTab === 'history'} onClick={() => setActiveTab('history')} collapsed={!isSidebarOpen} />
            <div data-tour="contacts">
              <NavItem icon={Users} label="Contacts" active={activeTab === 'contacts'} onClick={() => setActiveTab('contacts')} collapsed={!isSidebarOpen} />
            </div>
            <NavItem icon={TrendingUp} label="Supplier Dashboard" active={activeTab === 'supplier-dashboard'} onClick={() => setActiveTab('supplier-dashboard')} collapsed={!isSidebarOpen} />
            <NavItem icon={TrendingUp} label="Reports" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} collapsed={!isSidebarOpen} />
            <NavItem icon={BarChart3} label="Analytics" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} collapsed={!isSidebarOpen} />
            <NavItem icon={Sparkles} label="AI Forecast" active={activeTab === 'ai-forecast'} onClick={() => setActiveTab('ai-forecast')} collapsed={!isSidebarOpen} />
            <NavItem icon={Zap} label="Workflows" active={activeTab === 'workflows'} onClick={() => setActiveTab('workflows')} collapsed={!isSidebarOpen} />
            <NavItem icon={Users} label="Team" active={activeTab === 'team'} onClick={() => setActiveTab('team')} collapsed={!isSidebarOpen} />
            <NavItem icon={CheckCircle} label="Approvals" active={activeTab === 'approvals'} onClick={() => setActiveTab('approvals')} collapsed={!isSidebarOpen} />
            <NavItem icon={Settings} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} collapsed={!isSidebarOpen} />
          </nav>
          <div className="p-4 border-t border-slate-800 space-y-2">
            {/* User Info */}
            {isSidebarOpen && user && (
              <div className="px-3 py-2 mb-2">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Logged in as</p>
                <p className="text-sm text-slate-300 font-medium truncate">{user.fullName}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            )}

            {/* Logout Button */}
            <button
              onClick={logout}
              className="flex items-center w-full p-3 rounded-lg hover:bg-red-900/20 hover:text-red-400 transition-colors text-slate-400"
              title="Logout"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              {isSidebarOpen && <span className="ml-3">Logout</span>}
            </button>

            {/* Collapse Button */}
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="flex items-center w-full p-3 rounded-lg hover:bg-slate-800 transition-colors">
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5 mx-auto" />}
              {isSidebarOpen && <span className="ml-3">Collapse</span>}
            </button>
          </div>
        </aside>

        <main id="main-content" className={`flex-1 md:${isSidebarOpen ? 'ml-64' : 'ml-20'} transition-all duration-300 p-4 md:p-8 pb-20 md:pb-8`}>
          <header className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 capitalize">{activeTab.replace('-', ' ')}</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your plumbing warehouse efficiently.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAIAssistant(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl"
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden md:inline">AI Assistant</span>
              </button>
              <LanguageSwitcher />
              <button onClick={() => setActiveTab('settings')} className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors" data-tour="settings">
                <Settings className="w-6 h-6" />
              </button>
            </div>
          </header>

        {activeTab === 'dashboard' && <DashboardView inventory={inventory} jobs={jobs} contacts={contacts} onNavigate={setActiveTab} />}
        {activeTab === 'inventory' && (
          <InventoryView
            inventory={filteredInventory}
            contacts={contacts}
            search={inventorySearch}
            onSearchChange={setInventorySearch}
            sortConfig={inventorySortConfig}
            onSort={handleInventorySort}
            onImportCSV={handleImportCSV}
            onViewDetails={(item) => { setItemToShow(item); setIsDetailModalOpen(true); }}
            onAdjustStock={(item) => { setItemToAdjust(item); setAdjustmentValue(0); setIsAdjustModalOpen(true); }}
            onEditItem={handleEditItem}
            onAddItem={handleAddItem}
            onDeleteItem={handleDeleteItem}
            onDeleteAll={handleDeleteAllItems}
            onTransferStock={() => setIsStockTransferModalOpen(true)}
          />
        )}
        {activeTab === 'calendar' && (
          <CalendarView
            jobs={jobs}
            contacts={contacts}
            onJobClick={(job) => {
              // Switch to job planning view when clicking a job
              setActiveTab('job-planning');
            }}
          />
        )}
        {activeTab === 'job-planning' && (
          <JobPlanningView
            jobs={jobs}
            contacts={contacts}
            inventory={inventory}
            templates={templates}
            onOpenNewJobModal={() => setIsNewJobModalOpen(true)}
            onConfirmPick={handleConfirmPick}
            onOpenAllocateModal={(job) => { setJobToAllocate(job); setAllocSearch(''); setAllocItemId(''); setIsAllocateModalOpen(true); }}
            onOpenTemplateModal={(jobId, templateId) => {
              const job = jobs.find(j => j.id === jobId);
              const template = templates.find(t => t.id === templateId);
              if (job && template) {
                setTemplateJob(job);
                setSelectedTemplate(template);
                setTemplateItems(template.items.map(item => ({ ...item })));
                setIsTemplateModalOpen(true);
              }
            }}
            onNavigate={setActiveTab}
            onAddTemplate={handleAddTemplate}
            onUpdateTemplate={handleUpdateTemplate}
            onDeleteTemplate={handleDeleteTemplate}
          />
        )}
        {activeTab === 'ordering' && <OrderingView inventory={inventory} jobs={jobs} />}
        {activeTab === 'history' && <HistoryView movements={movements} inventory={inventory} />}
        {activeTab === 'contacts' && (
          <ContactsView
            contacts={contacts}
            onAddContact={handleAddContact}
            onEditContact={handleEditContact}
            onDeleteContact={handleDeleteContact}
          />
        )}
        {activeTab === 'approvals' && <ApprovalsView />}
        {activeTab === 'purchase-orders' && <PurchaseOrdersView />}
        {activeTab === 'quotes' && <QuotesView />}
        {activeTab === 'invoices' && <InvoicesView />}
        {activeTab === 'stock-returns' && <StockReturnsView />}
        {activeTab === 'supplier-dashboard' && <SupplierDashboardView contacts={contacts} />}
        {activeTab === 'reports' && <ReportingView />}
        {activeTab === 'team' && <TeamManagementView />}
        {activeTab === 'settings' && <SettingsView onSave={(settings) => toast.success('Settings saved successfully!')} />}
        {activeTab === 'analytics' && <AnalyticsView />}
        {activeTab === 'ai-forecast' && <AIForecastView />}
        {activeTab === 'workflows' && <WorkflowAutomationView />}
      </main>

      {/* AI Assistant Panel */}
      {showAIAssistant && (
        <AIAssistant onClose={() => setShowAIAssistant(false)} />
      )}

      {/* New Job Modal */}
      {isNewJobModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center space-x-3">
                <Calendar className="w-6 h-6 text-blue-600" />
                <h3 className="text-xl font-bold text-slate-800">Schedule New Job</h3>
              </div>
              <button onClick={() => setIsNewJobModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Job Title</label>
                  <input 
                    type="text"
                    placeholder="e.g., Blocked Drain at North St"
                    value={newJobData.title}
                    onChange={(e) => setNewJobData({...newJobData, title: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Builder / Client</label>
                  <input 
                    type="text"
                    placeholder="e.g., Skyline Developments"
                    value={newJobData.builder}
                    onChange={(e) => setNewJobData({...newJobData, builder: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Job Date</label>
                  <input 
                    type="date"
                    value={newJobData.date}
                    onChange={(e) => setNewJobData({...newJobData, date: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Stock Template (Auto-Reserve)</label>
                  <select 
                    value={newJobData.templateId}
                    onChange={(e) => setNewJobData({...newJobData, templateId: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 font-bold"
                  >
                    <option value="">No Template</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Assign Workers</label>
                <div className="flex flex-wrap gap-2">
                  {contacts.filter(c => c.type === 'Plumber').map(worker => {
                    const isSelected = newJobData.workerIds.includes(worker.id);
                    return (
                      <button
                        key={worker.id}
                        onClick={() => {
                          const ids = isSelected 
                            ? newJobData.workerIds.filter(id => id !== worker.id)
                            : [...newJobData.workerIds, worker.id];
                          setNewJobData({...newJobData, workerIds: ids});
                        }}
                        className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center space-x-2 transition-all border-2 ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-200'}`}
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>{worker.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {newJobData.templateId && (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
                  <div className="flex items-center space-x-2 mb-4 text-blue-800">
                    <Package className="w-5 h-5" />
                    <h4 className="font-bold">Estimated Stock Impact</h4>
                  </div>
                  <div className="space-y-3">
                    {(() => {
                      const template = templates.find(t => t.id === newJobData.templateId);
                      if (!template) return null;
                      return template.items.map(ti => {
                        const item = inventory.find(i => i.id === ti.itemId);
                        if (!item) return null;
                        const projectedQty = item.quantity - (reservedStock[item.id] || 0) - ti.quantity;
                        const isWarning = projectedQty <= item.reorderLevel;
                        return (
                          <div key={ti.itemId} className={`flex items-center justify-between p-3 rounded-xl border ${isWarning ? 'bg-amber-50 border-amber-200' : 'bg-white border-blue-50'}`}>
                            <div>
                              <p className="text-sm font-bold text-slate-800">{item.name}</p>
                              <p className="text-xs text-slate-500">Need: {ti.quantity} | Available: {item.quantity - (reservedStock[item.id] || 0)}</p>
                            </div>
                            {isWarning && (
                              <div className="flex items-center text-amber-600">
                                <AlertTriangle className="w-4 h-4 mr-1" />
                                <span className="text-[10px] font-bold uppercase">Low Stock Warning</span>
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={() => setIsNewJobModalOpen(false)} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors">Cancel</button>
              <button 
                disabled={!newJobData.title || !newJobData.date || newJobData.workerIds.length === 0}
                onClick={handleCreateJob}
                className="flex-[2] px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg disabled:opacity-50"
              >
                Schedule Job & Reserve Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Detail Modal */}
      {isDetailModalOpen && itemToShow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center space-x-3"><Info className="w-6 h-6 text-blue-600" /><h3 className="text-xl font-bold text-slate-800">Inventory Item Details</h3></div>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-8 space-y-8 max-h-[80vh] overflow-y-auto">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                <div>
                  <div className="flex items-center space-x-3 mb-2"><h2 className="text-2xl font-extrabold text-slate-900">{itemToShow.name}</h2><Badge variant="slate">{itemToShow.category}</Badge></div>
                  <p className="text-slate-500 text-sm leading-relaxed max-w-md">{itemToShow.description || "No description provided."}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center min-w-[140px]">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Stock Level</p>
                  <p className={`text-4xl font-black ${getStockStatus(itemToShow.quantity, itemToShow.reorderLevel).variant === 'green' ? 'text-emerald-600' : 'text-amber-600'}`}>{itemToShow.quantity}</p>
                  <Badge variant={getStockStatus(itemToShow.quantity, itemToShow.reorderLevel).variant}>{getStockStatus(itemToShow.quantity, itemToShow.reorderLevel).label}</Badge>
                  <div className="mt-2"><StockMeter quantity={itemToShow.quantity} reorderLevel={itemToShow.reorderLevel} /></div>
                  {reservedStock[itemToShow.id] > 0 && (
                    <p className="text-[10px] font-bold text-blue-500 mt-2 uppercase">Reserved: {reservedStock[itemToShow.id]}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center"><Tag className="w-4 h-4 mr-2" />Inventory Info</h4>
                  <div className="bg-slate-50 rounded-xl p-5 space-y-4 border border-slate-100">
                    <div className="flex justify-between items-center text-sm"><span className="text-slate-500 font-medium">Retail Price</span><span className="text-slate-900 font-bold text-lg">${itemToShow.price.toFixed(2)}</span></div>
                    <div className="flex justify-between items-center text-sm"><span className="text-slate-500 font-medium">Reorder Level</span><span className="text-slate-900 font-bold">{itemToShow.reorderLevel} units</span></div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center"><Truck className="w-4 h-4 mr-2" />Supplier Information</h4>
                  {(() => {
                    const supplier = contacts.find(c => c.id === itemToShow.supplierId);
                    if (!supplier) return <div className="p-5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium">Supplier information not found.</div>;
                    return (
                      <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100 space-y-4">
                        <div><p className="text-xs font-bold text-blue-400 uppercase tracking-tighter mb-1">Company / Name</p><p className="text-slate-900 font-extrabold text-lg">{supplier.company || supplier.name}</p></div>
                        <div className="space-y-3 pt-2 border-t border-blue-100 text-sm">
                          <a href={`mailto:${supplier.email}`} className="flex items-center text-blue-600 font-semibold group"><Mail className="w-4 h-4 mr-2" />{supplier.email}</a>
                          <a href={`tel:${supplier.phone}`} className="flex items-center text-slate-700 font-semibold group"><Phone className="w-4 h-4 mr-2" />{supplier.phone}</a>
                          <div className="flex items-center text-sm mt-4 pt-2 border-t border-blue-50">
                            <p className="text-xs font-bold text-blue-400 uppercase mr-2">Part Code:</p>
                            <span className="font-mono bg-white px-2 py-1 rounded border border-blue-100 text-blue-700 font-bold text-xs">{itemToShow.supplierCode}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3"><button onClick={() => setIsDetailModalOpen(false)} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors">Close</button></div>
          </div>
        </div>
      )}

      {/* CSV Import Preview Modal */}
      {/* CSV Column Mapping Modal */}
      {showCSVMappingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-purple-600 to-indigo-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <SlidersHorizontal className="w-6 h-6 text-white" />
                  <div>
                    <h3 className="text-xl font-bold text-white">Map CSV Columns</h3>
                    <p className="text-sm text-purple-100">Match your CSV columns to inventory fields</p>
                  </div>
                </div>
                <button onClick={() => { setShowCSVMappingModal(false); setCsvRawData({ headers: [], rows: [] }); }} className="text-white hover:text-purple-100 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-blue-900 font-semibold mb-1">Your CSV has {csvRawData.headers.length} columns</p>
                    <p className="text-xs text-blue-700">Map each field below to the corresponding column in your CSV file</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { key: 'name', label: 'Item Name', required: true, description: 'The product or item name' },
                  { key: 'category', label: 'Category', required: false, description: 'Product category (e.g., Pipes, Fittings)' },
                  { key: 'price', label: 'Price', required: false, description: 'Unit price (numbers only)' },
                  { key: 'quantity', label: 'Quantity', required: false, description: 'Current stock quantity' },
                  { key: 'reorderLevel', label: 'Reorder Level', required: false, description: 'Minimum stock before reordering' },
                  { key: 'supplierId', label: 'Supplier ID', required: false, description: 'Internal supplier identifier' },
                  { key: 'supplierCode', label: 'Supplier Code', required: false, description: 'Supplier\'s product code' },
                  { key: 'buyPriceExclGST', label: 'Buy Price (Excl GST)', required: false, description: 'Cost price excluding 10% GST' },
                  { key: 'buyPriceInclGST', label: 'Buy Price (Incl GST)', required: false, description: 'Cost price including 10% GST' },
                  { key: 'sellPriceExclGST', label: 'Sell Price (Excl GST)', required: false, description: 'Invoice/CMP price excluding 10% GST' },
                  { key: 'sellPriceInclGST', label: 'Sell Price (Incl GST)', required: false, description: 'Invoice/CMP price including 10% GST' }
                ].map((field) => (
                  <div key={field.key} className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-semibold text-slate-800">{field.label}</label>
                        {field.required && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">Required</span>}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">{field.description}</p>
                    <select
                      value={csvColumnMapping[field.key]}
                      onChange={(e) => setCsvColumnMapping({ ...csvColumnMapping, [field.key]: parseInt(e.target.value) })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value={-1}>-- Skip this field --</option>
                      {csvRawData.headers.map((header, index) => (
                        <option key={index} value={index}>
                          Column {index + 1}: {header || '(unnamed)'}
                        </option>
                      ))}
                    </select>
                    {csvRawData.rows.length > 0 && csvColumnMapping[field.key] >= 0 && (
                      <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-600">
                        <span className="font-medium">Preview: </span>
                        <span className="font-mono">{csvRawData.rows[0][csvColumnMapping[field.key]] || '(empty)'}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => { setShowCSVMappingModal(false); setCsvRawData({ headers: [], rows: [] }); }}
                className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applyCSVMapping}
                className="flex-[2] px-4 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors shadow-lg flex items-center justify-center gap-2"
              >
                <ArrowRight className="w-5 h-5" />
                Continue to Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {showCSVPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-blue-600 to-indigo-700">
              <div className="flex items-center space-x-3">
                <FileUp className="w-6 h-6 text-white" />
                <div>
                  <h3 className="text-xl font-bold text-white">CSV Import Preview</h3>
                  <p className="text-sm text-blue-100">{csvSelectedRows.size} of {csvPreviewItems.length} items selected</p>
                </div>
              </div>
              <button onClick={() => { setShowCSVPreviewModal(false); setCsvPreviewItems([]); setCsvSelectedRows(new Set()); }} className="text-white hover:text-blue-100 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-180px)]">
              {csvPreviewItems.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <FileUp className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <p className="text-lg font-semibold">No items to preview</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={csvSelectedRows.size === csvPreviewItems.length && csvPreviewItems.length > 0}
                          onChange={toggleAllCSVRows}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          title="Select/Deselect All"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Item Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Price</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Quantity</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Reorder Level</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Supplier Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {csvPreviewItems.map((item, index) => (
                      <tr
                        key={index}
                        className={`hover:bg-slate-50 transition-colors ${csvSelectedRows.has(index) ? 'bg-blue-50' : ''}`}
                      >
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={csvSelectedRows.has(index)}
                            onChange={() => toggleCSVRow(index)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500 font-medium">{index + 1}</td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-800">{item.name || <span className="text-red-500 italic">Missing</span>}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{item.category || <span className="text-amber-500 italic">Unknown</span>}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-700">${item.price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm font-bold text-slate-800">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{item.reorderLevel}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 font-mono">{item.supplierCode || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2 text-sm text-slate-600">
                  <Info className="w-4 h-4" />
                  <span>Expected CSV format: <code className="px-2 py-1 bg-slate-200 rounded text-xs font-mono">name,category,price,quantity,reorder,supplierId,supplierCode</code></span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowCSVPreviewModal(false); setCsvPreviewItems([]); setCsvSelectedRows(new Set()); }}
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmCSVImport}
                  disabled={csvSelectedRows.size === 0}
                  className="flex-[2] px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <FileUp className="w-5 h-5" />
                  Import {csvSelectedRows.size} Selected Item{csvSelectedRows.size !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Allocation Modal */}
      {isAllocateModalOpen && jobToAllocate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800">Allocate Item to Job</h3>
              <button onClick={() => setIsAllocateModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Target Job</p>
                <div className="flex items-center justify-between">
                  <p className="text-lg font-extrabold text-slate-800">{jobToAllocate.title}</p>
                  <p className="text-xs text-slate-500 font-medium">{jobToAllocate.date}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-3">1. Select Stock Item</label>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Search inventory..."
                    value={allocSearch}
                    onChange={(e) => setAllocSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 text-sm"
                  />
                </div>
                
                <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100 bg-white shadow-inner">
                  {inventory.filter(i => i.name.toLowerCase().includes(allocSearch.toLowerCase())).map(item => {
                    const status = getStockStatus(item.quantity, item.reorderLevel);
                    const isSelected = allocItemId === item.id;
                    const isOutOfStock = item.quantity <= 0;
                    return (
                      <button
                        key={item.id}
                        onClick={() => !isOutOfStock && setAllocItemId(item.id)}
                        disabled={isOutOfStock}
                        className={`w-full text-left p-4 transition-all flex items-center justify-between group border-l-4 ${
                          isSelected 
                            ? 'bg-blue-50 border-blue-500' 
                            : isOutOfStock 
                              ? 'opacity-50 cursor-not-allowed bg-red-50 border-red-500' 
                              : 'hover:bg-slate-50 border-transparent'
                        }`}
                      >
                        <div className="flex-1 pr-4">
                          <p className={`font-bold text-sm ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>{item.name}</p>
                          <div className="mt-1.5 w-full max-w-[200px] flex items-center gap-4">
                            <div className="flex flex-col min-w-[70px]">
                               <p className="text-[9px] font-bold text-slate-400 uppercase leading-none">In Stock</p>
                               <p className={`text-sm font-black leading-tight ${isOutOfStock ? 'text-red-600' : 'text-slate-800'}`}>{item.quantity}</p>
                            </div>
                            <div className="flex-1"><StockMeter quantity={item.quantity} reorderLevel={item.reorderLevel} /></div>
                          </div>
                        </div>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </button>
                    );
                  })}
                </div>
              </div>

              {allocItemId && (
                <div className="bg-slate-50 p-5 rounded-xl border-2 border-blue-100 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <label className="block text-xs font-black text-blue-600 uppercase tracking-widest mb-2">2. Quantity to Allocate</label>
                      <div className="flex items-center space-x-4">
                        <input 
                          type="number" min="1"
                          value={allocQty}
                          onChange={(e) => setAllocQty(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-20 px-3 py-2 border border-slate-200 rounded-lg text-center font-black"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex space-x-3">
              <button onClick={() => setIsAllocateModalOpen(false)} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors">Cancel</button>
              <button disabled={!allocItemId} onClick={handleManualAllocate} className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg">Allocate Item</button>
            </div>
          </div>
        </div>
      )}

      {/* Template Allocation Review Modal */}
      {isTemplateModalOpen && templateJob && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800">Review Template Allocation</h3>
              <button onClick={() => setIsTemplateModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {templateItems.map((ti, index) => {
                const invItem = inventory.find(i => i.id === ti.itemId);
                return (
                  <div key={ti.itemId} className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-800">{invItem?.name}</p>
                      <p className="text-xs text-slate-500">In Stock: {invItem?.quantity}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <input 
                        type="number" min="0" value={ti.quantity}
                        onChange={(e) => {
                          const newItems = [...templateItems];
                          newItems[index].quantity = parseInt(e.target.value) || 0;
                          setTemplateItems(newItems);
                        }}
                        className="w-16 px-2 py-1 border border-slate-200 rounded text-center"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex space-x-3">
              <button onClick={() => setIsTemplateModalOpen(false)} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100">Cancel</button>
              <button onClick={applyTemplateAllocation} className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700">Finalize</button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {isAdjustModalOpen && itemToAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800">Manual Stock Adjustment</h3>
              <button onClick={() => setIsAdjustModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Item</p>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-lg font-bold text-slate-800">{itemToAdjust.name}</p>
                    <p className="text-sm text-slate-400">Total Stock: <span className="font-bold text-slate-700">{itemToAdjust.quantity}</span></p>
                  </div>
                  <Badge variant={getStockStatus(itemToAdjust.quantity, itemToAdjust.reorderLevel).variant}>{getStockStatus(itemToAdjust.quantity, itemToAdjust.reorderLevel).label}</Badge>
                </div>
                {itemToAdjust.locationStock && itemToAdjust.locationStock.length > 0 && (
                  <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-blue-800 mb-2">Stock by Location</p>
                    <div className="grid grid-cols-2 gap-2">
                      {itemToAdjust.locationStock.map((loc, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white rounded px-2 py-1">
                          <span className="text-xs text-slate-600">{loc.locationName}</span>
                          <span className="text-xs font-bold text-slate-800">{loc.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Location to Adjust</label>
                <select
                  value={adjustmentLocationId}
                  onChange={(e) => setAdjustmentLocationId(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white shadow-sm"
                >
                  <option value="">Select location...</option>
                  {locations.map((loc) => {
                    const stockAtLocation = itemToAdjust.locationStock?.find(ls => ls.locationId === loc.id);
                    return (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} (Current: {stockAtLocation?.quantity || 0})
                      </option>
                    );
                  })}
                </select>
                {adjustmentLocationId && (
                  <p className="mt-2 text-xs text-slate-500">
                    Current stock at {locations.find(l => l.id === adjustmentLocationId)?.name}: <span className="font-bold">{itemToAdjust.locationStock?.find(ls => ls.locationId === adjustmentLocationId)?.quantity || 0}</span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Adjustment Quantity</label>
                <input
                  type="number" value={adjustmentValue}
                  onChange={(e) => setAdjustmentValue(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-lg font-bold"
                  placeholder="Use - for removal"
                />
                <p className="mt-1 text-xs text-slate-500">Use positive numbers to add stock, negative to remove</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Reason</label>
                <select
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white shadow-sm"
                >
                  <option value="">Select reason...</option>
                  <option value="Damaged Stock">Damaged Stock</option>
                  <option value="Lost / Missing">Lost / Missing</option>
                  <option value="Correction Found">Correction</option>
                </select>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex space-x-3">
              <button onClick={() => setIsAdjustModalOpen(false)} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100">Cancel</button>
              <button disabled={adjustmentValue === 0 || !adjustmentReason || !adjustmentLocationId} onClick={handleManualAdjustment} className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Transfer Modal */}
      <StockTransferModal
        isOpen={isStockTransferModalOpen}
        onClose={() => setIsStockTransferModalOpen(false)}
        inventory={inventory}
        locations={locations}
        onTransfer={async (itemId, fromLocationId, toLocationId, quantity, reason) => {
          try {
            await createStockTransfer({
              itemId,
              fromLocationId,
              toLocationId,
              quantity,
              reason
            });
            toast.success('Stock transferred successfully');
          } catch (error) {
            toast.error('Failed to transfer stock');
            throw error;
          }
        }}
      />

      {/* Edit Item Modal */}
      {isEditItemModalOpen && itemToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800">Edit Inventory Item</h3>
              <button onClick={() => setIsEditItemModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Item Name *</label>
                  <input
                    type="text"
                    value={itemToEdit.name}
                    onChange={(e) => setItemToEdit({ ...itemToEdit, name: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Item name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Category *</label>
                  <input
                    type="text"
                    value={itemToEdit.category}
                    onChange={(e) => setItemToEdit({ ...itemToEdit, category: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Category"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemToEdit.price}
                    onChange={(e) => setItemToEdit({ ...itemToEdit, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Reorder Level</label>
                  <input
                    type="number"
                    value={itemToEdit.reorderLevel}
                    onChange={(e) => setItemToEdit({ ...itemToEdit, reorderLevel: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="5"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Supplier</label>
                  <select
                    value={itemToEdit.supplierId}
                    onChange={(e) => setItemToEdit({ ...itemToEdit, supplierId: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white shadow-sm"
                  >
                    <option value="">Select supplier...</option>
                    {contacts.filter(c => c.type === 'Supplier').map(supplier => (
                      <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Supplier Code</label>
                  <input
                    type="text"
                    value={itemToEdit.supplierCode}
                    onChange={(e) => setItemToEdit({ ...itemToEdit, supplierCode: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Product code"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex space-x-3">
              <button onClick={() => setIsEditItemModalOpen(false)} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100">Cancel</button>
              <button onClick={handleSaveEditItem} className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {isAddItemModalOpen && itemToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Add New Inventory Item</h3>
              <button onClick={() => setIsAddItemModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Item Name *</label>
                  <input
                    type="text"
                    value={itemToEdit.name}
                    onChange={(e) => setItemToEdit({ ...itemToEdit, name: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Item name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Category *</label>
                  <input
                    type="text"
                    value={itemToEdit.category}
                    onChange={(e) => setItemToEdit({ ...itemToEdit, category: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Category"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemToEdit.price}
                    onChange={(e) => setItemToEdit({ ...itemToEdit, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Initial Quantity</label>
                  <input
                    type="number"
                    value={itemToEdit.quantity}
                    onChange={(e) => setItemToEdit({ ...itemToEdit, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Reorder Level</label>
                  <input
                    type="number"
                    value={itemToEdit.reorderLevel}
                    onChange={(e) => setItemToEdit({ ...itemToEdit, reorderLevel: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="5"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Supplier</label>
                  <select
                    value={itemToEdit.supplierId}
                    onChange={(e) => setItemToEdit({ ...itemToEdit, supplierId: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl shadow-sm"
                  >
                    <option value="">Select supplier...</option>
                    {contacts.filter(c => c.type === 'Supplier').map(supplier => (
                      <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Supplier Code</label>
                  <input
                    type="text"
                    value={itemToEdit.supplierCode}
                    onChange={(e) => setItemToEdit({ ...itemToEdit, supplierCode: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Product code"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Location</label>
                <input
                  type="text"
                  value={itemToEdit.location}
                  onChange={(e) => setItemToEdit({ ...itemToEdit, location: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Warehouse location (e.g., Aisle 3, Shelf B)"
                />
              </div>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700 flex space-x-3">
              <button onClick={() => setIsAddItemModalOpen(false)} className="flex-1 px-4 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600">Cancel</button>
              <button onClick={handleSaveNewItem} className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg">Add Item</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Contact Modal */}
      {isEditContactModalOpen && contactToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800">Edit Contact</h3>
              <button onClick={() => setIsEditContactModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Name *</label>
                  <input
                    type="text"
                    value={contactToEdit.name}
                    onChange={(e) => setContactToEdit({ ...contactToEdit, name: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Contact name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Company</label>
                  <input
                    type="text"
                    value={contactToEdit.company || ''}
                    onChange={(e) => setContactToEdit({ ...contactToEdit, company: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Company name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Email *</label>
                  <input
                    type="email"
                    value={contactToEdit.email}
                    onChange={(e) => setContactToEdit({ ...contactToEdit, email: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Phone</label>
                  <input
                    type="tel"
                    value={contactToEdit.phone}
                    onChange={(e) => setContactToEdit({ ...contactToEdit, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Type</label>
                <select
                  value={contactToEdit.type}
                  onChange={(e) => setContactToEdit({ ...contactToEdit, type: e.target.value as 'Supplier' | 'Plumber' | 'Customer' })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white shadow-sm"
                >
                  <option value="Supplier">Supplier</option>
                  <option value="Plumber">Plumber</option>
                  <option value="Customer">Customer</option>
                </select>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex space-x-3">
              <button onClick={() => setIsEditContactModalOpen(false)} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100">Cancel</button>
              <button onClick={handleSaveEditContact} className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Stock Count View */}
      {isMobileStockCountOpen && (
        <MobileStockCountView
          inventory={inventory}
          onUpdateStock={handleMobileStockUpdate}
          onClose={() => setIsMobileStockCountOpen(false)}
        />
      )}

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <MobileBottomNav
          activeTab={activeTab === 'menu' ? 'menu' : activeTab}
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
      {isMobile && activeTab === 'inventory' && !isMobileStockCountOpen && (
        <>
          <button
            onClick={() => setIsStockTransferModalOpen(true)}
            className="md:hidden fixed bottom-36 right-6 w-12 h-12 bg-green-600 text-white rounded-full shadow-lg flex items-center justify-center z-20 active:scale-95 transition-transform"
            title="Transfer Stock"
          >
            <ArrowRightLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsMobileStockCountOpen(true)}
            className="md:hidden fixed bottom-20 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center z-20 active:scale-95 transition-transform"
          >
            <Package className="w-6 h-6" />
          </button>
        </>
      )}
      </div>
    </>
  );
}

// Main App component with providers and authentication
export default function App() {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const syncWithServer = useStore((state) => state.syncWithServer);

  // Check for existing auth token on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        useStore.getState().setUser(user, token);
        // Sync data from server after authentication
        syncWithServer();
      } catch (error) {
        console.error('Failed to restore auth session:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      }
    }
  }, [syncWithServer]);

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
