
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
  Languages
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

// UX Components
import { ToastProvider, useToast } from './components/ToastNotification';
import CommandPalette from './components/CommandPalette';
import LanguageSwitcher from './components/LanguageSwitcher';
import { MobileBottomNav } from './components/MobileBottomNav';
import { onboardingService, tours } from './lib/onboardingService';
import { addSkipLink } from './lib/accessibility';
import { API_ROOT_URL, DEFAULT_BACKEND_PORT, hasExplicitApiUrl } from './lib/api';

function AppContent() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'calendar' | 'job-planning' | 'contacts' | 'ordering' | 'history' | 'approvals' | 'settings'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('light');
  const [isMobileStockCountOpen, setIsMobileStockCountOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const inventory = useStore((state) => state.inventory);
  const contacts = useStore((state) => state.contacts);
  const jobs = useStore((state) => state.jobs);
  const movements = useStore((state) => state.movements);
  const templates = useStore((state) => state.templates);
  const error = useStore((state) => state.error);
  const clearError = useStore((state) => state.clearError);
  const addJob = useStore((state) => state.addJob);
  const pickJob = useStore((state) => state.pickJob);
  const addInventoryItem = useStore((state) => state.addInventoryItem);
  const updateInventoryItem = useStore((state) => state.updateInventoryItem);
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

  // Initialize theme from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('plumbpro-settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings.appearance?.theme) {
          setTheme(settings.appearance.theme);
        }
      } catch (e) {
        console.error('Failed to load theme settings:', e);
      }
    }
  }, []);

  // Load all data on mount
  useEffect(() => {
    void useStore.getState().syncWithServer();
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

    window.addEventListener('navigate', handleNavigate);
    window.addEventListener('create-new-item', handleCreateNewItem);
    window.addEventListener('create-new-job', handleCreateNewJob);
    window.addEventListener('create-new-contact', handleCreateNewContact);

    return () => {
      window.removeEventListener('navigate', handleNavigate);
      window.removeEventListener('create-new-item', handleCreateNewItem);
      window.removeEventListener('create-new-job', handleCreateNewJob);
      window.removeEventListener('create-new-contact', handleCreateNewContact);
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
      console.log('✅ Job created in database');
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
      console.log('✅ Job picked in database:', jobId);
    } catch (error: any) {
      // Errors are handled via the global store error state.
    }
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      const newItems: Omit<InventoryItem, 'id'>[] = [];
      lines.slice(1).forEach((line) => {
        if (!line.trim()) return;
        const [name, category, price, quantity, reorder, supplierId, supplierCode] = line.split(',').map(s => s.trim());
        newItems.push({
          name,
          category,
          price: parseFloat(price) || 0,
          quantity: parseInt(quantity) || 0,
          reorderLevel: parseInt(reorder) || 5,
          supplierId,
          supplierCode,
          location: '',
          lastUpdated: new Date().toISOString().split('T')[0]
        });
      });
      void Promise.all(newItems.map((item) => addInventoryItem(item)))
        .then(() => {
          toast.success(`Imported ${newItems.length} items successfully!`, 'CSV Import Complete');
        })
        .catch(() => {
          // Errors are handled via the global store error state.
        });
    };
    reader.readAsText(file);
  };

  const handleManualAdjustment = async () => {
    if (!itemToAdjust || adjustmentValue === 0 || !adjustmentReason.trim()) {
      toast.warning('Please provide adjustment value and reason');
      return;
    }

    try {
      await adjustStock(itemToAdjust.id, adjustmentValue, adjustmentReason);
      setIsAdjustModalOpen(false);
      toast.success(`Stock adjusted for ${itemToAdjust.name}`, 'Adjustment Complete');
      console.log('✅ Stock adjusted in database:', itemToAdjust.id);
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
      console.log('✅ Inventory item updated in database:', itemToEdit.id);
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
      location: '',
      lastUpdated: new Date().toISOString().split('T')[0]
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
      console.log('✅ Inventory item created in database');
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
      console.log('✅ Mobile stock updated in database:', itemId);
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
        console.log('✅ Contact created in database');
      } else {
        // Update existing contact in database
        await updateContact(contactToEdit.id, contactToEdit);
        toast.success(`${contactToEdit.name} updated successfully!`);
        console.log('✅ Contact updated in database:', contactToEdit.id);
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
      console.log('✅ Contact deleted from database:', contact.id);
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
      console.log('✅ Template created in database');
    } catch (error: any) {
      // Errors are handled via the global store error state.
    }
  };

  const handleUpdateTemplate = async (id: string, name: string, items: AllocatedItem[]) => {
    try {
      await updateTemplate(id, { name, items });
      toast.success(`Template "${name}" updated successfully!`);
      console.log('✅ Template updated in database:', id);
    } catch (error: any) {
      // Errors are handled via the global store error state.
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await deleteTemplate(id);
      toast.success('Template deleted successfully!');
      console.log('✅ Template deleted from database:', id);
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
            <NavItem icon={ShoppingCart} label="Smart Ordering" active={activeTab === 'ordering'} onClick={() => setActiveTab('ordering')} collapsed={!isSidebarOpen} />
            <NavItem icon={ArrowRightLeft} label="Stock History" active={activeTab === 'history'} onClick={() => setActiveTab('history')} collapsed={!isSidebarOpen} />
            <div data-tour="contacts">
              <NavItem icon={Users} label="Contacts" active={activeTab === 'contacts'} onClick={() => setActiveTab('contacts')} collapsed={!isSidebarOpen} />
            </div>
            <NavItem icon={CheckCircle} label="Approvals" active={activeTab === 'approvals'} onClick={() => setActiveTab('approvals')} collapsed={!isSidebarOpen} />
            <NavItem icon={Settings} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} collapsed={!isSidebarOpen} />
          </nav>
          <div className="p-4 border-t border-slate-800">
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
        {activeTab === 'settings' && <SettingsView onSave={(settings) => toast.success('Settings saved successfully!')} />}
      </main>

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
                    <p className="text-sm text-slate-400">Current Stock: <span className="font-bold text-slate-700">{itemToAdjust.quantity}</span></p>
                  </div>
                  <Badge variant={getStockStatus(itemToAdjust.quantity, itemToAdjust.reorderLevel).variant}>{getStockStatus(itemToAdjust.quantity, itemToAdjust.reorderLevel).label}</Badge>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Adjustment Quantity</label>
                <input
                  type="number" value={adjustmentValue}
                  onChange={(e) => setAdjustmentValue(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-lg font-bold"
                  placeholder="Use - for removal"
                />
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
              <button disabled={adjustmentValue === 0 || !adjustmentReason} onClick={handleManualAdjustment} className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg">Apply</button>
            </div>
          </div>
        </div>
      )}

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

      {/* Mobile FAB for Stock Count */}
      {isMobile && activeTab === 'inventory' && !isMobileStockCountOpen && (
        <button
          onClick={() => setIsMobileStockCountOpen(true)}
          className="md:hidden fixed bottom-20 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center z-20 active:scale-95 transition-transform"
        >
          <Package className="w-6 h-6" />
        </button>
      )}
      </div>
    </>
  );
}

// Main App component with providers
export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
