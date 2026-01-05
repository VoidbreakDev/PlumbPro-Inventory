
import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import {
  INITIAL_CONTACTS,
  INITIAL_INVENTORY,
  INITIAL_JOBS,
  INITIAL_MOVEMENTS,
  JOB_TEMPLATES
} from './constants';

import { NavItem, getStockStatus, StockMeter, Badge } from './components/Shared';
import { DashboardView } from './views/DashboardView';
import { InventoryView } from './views/InventoryView';
import { JobsView } from './views/JobsView';
import { OrderingView } from './views/OrderingView';
import { HistoryView } from './views/HistoryView';
import { ContactsView } from './views/ContactsView';
import { ApprovalsView } from './views/ApprovalsView';

// UX Components
import { ToastProvider, useToast } from './components/ToastNotification';
import CommandPalette from './components/CommandPalette';
import LanguageSwitcher from './components/LanguageSwitcher';
import { onboardingService, tours } from './lib/onboardingService';
import { addSkipLink } from './lib/accessibility';

function AppContent() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'jobs' | 'contacts' | 'ordering' | 'history' | 'approvals'>('dashboard');
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [contacts, setContacts] = useState<Contact[]>(INITIAL_CONTACTS);
  const [jobs, setJobs] = useState<Job[]>(INITIAL_JOBS);
  const [movements, setMovements] = useState<StockMovement[]>(INITIAL_MOVEMENTS);
  const [templates, setTemplates] = useState<JobTemplate[]>(JOB_TEMPLATES);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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
      const tab = customEvent.detail as 'dashboard' | 'inventory' | 'jobs' | 'contacts' | 'ordering' | 'history' | 'approvals';
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

  const handleCreateJob = () => {
    const { title, builder, date, workerIds, templateId } = newJobData;
    if (!title || !date || workerIds.length === 0) {
      toast.warning('Please fill in all required fields');
      return;
    }

    let allocatedItems: AllocatedItem[] = [];
    if (templateId) {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        allocatedItems = template.items.map(i => ({ ...i }));
      }
    }

    const newJob: Job = {
      id: `j-${Date.now()}`,
      title,
      builder,
      date,
      assignedWorkerIds: workerIds,
      jobType: 'Custom',
      status: 'Scheduled',
      allocatedItems,
      isPicked: false,
    };

    setJobs(prev => [...prev, newJob]);
    setIsNewJobModalOpen(false);
    setNewJobData({ title: '', builder: '', date: '', workerIds: [], templateId: '' });
    toast.success(`Job "${title}" created successfully!`);
  };

  const handleConfirmPick = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job || job.isPicked) return;

    setInventory(prevInv => {
      const newInv = [...prevInv];
      job.allocatedItems.forEach(allocated => {
        const itemIdx = newInv.findIndex(i => i.id === allocated.itemId);
        if (itemIdx >= 0) {
          const item = newInv[itemIdx];
          newInv[itemIdx] = { ...item, quantity: Math.max(0, item.quantity - allocated.quantity) };

          // Record movement
          const movement: StockMovement = {
            id: `m-pick-${Date.now()}-${allocated.itemId}`,
            itemId: allocated.itemId,
            type: 'Out',
            quantity: allocated.quantity,
            timestamp: Date.now(),
            reference: `Picked for Job: ${job.title}`,
          };
          setMovements(prevMove => [movement, ...prevMove]);
        }
      });
      return newInv;
    });

    setJobs(prevJobs => prevJobs.map(j => j.id === jobId ? { ...j, isPicked: true, status: 'In Progress' } : j));
    toast.success(`Job "${job.title}" picked successfully!`, 'Items Allocated');
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      const newItems: InventoryItem[] = [];
      lines.slice(1).forEach((line, idx) => {
        if (!line.trim()) return;
        const [name, category, price, quantity, reorder, supplierId, supplierCode] = line.split(',').map(s => s.trim());
        newItems.push({
          id: `csv-${Date.now()}-${idx}`,
          name,
          category,
          price: parseFloat(price) || 0,
          quantity: parseInt(quantity) || 0,
          reorderLevel: parseInt(reorder) || 5,
          supplierId,
          supplierCode,
        });
      });
      setInventory(prev => [...prev, ...newItems]);
      toast.success(`Imported ${newItems.length} items successfully!`, 'CSV Import Complete');
    };
    reader.readAsText(file);
  };

  const handleManualAdjustment = () => {
    if (!itemToAdjust || adjustmentValue === 0 || !adjustmentReason.trim()) {
      toast.warning('Please provide adjustment value and reason');
      return;
    }
    const newQuantity = Math.max(0, itemToAdjust.quantity + adjustmentValue);
    setInventory(prev => prev.map(i => i.id === itemToAdjust.id ? { ...i, quantity: newQuantity } : i));
    const movement: StockMovement = {
      id: `m-adj-${Date.now()}`,
      itemId: itemToAdjust.id,
      type: 'Adjustment',
      quantity: Math.abs(adjustmentValue),
      timestamp: Date.now(),
      reference: `${adjustmentValue > 0 ? 'Added' : 'Removed'}: ${adjustmentReason}`,
    };
    setMovements(prev => [movement, ...prev]);
    setIsAdjustModalOpen(false);
    toast.success(`Stock adjusted for ${itemToAdjust.name}`, 'Adjustment Complete');
  };

  const handleEditItem = (item: InventoryItem) => {
    setItemToEdit(item);
    setIsEditItemModalOpen(true);
  };

  const handleSaveEditItem = () => {
    if (!itemToEdit) return;
    if (!itemToEdit.name.trim() || !itemToEdit.category.trim()) {
      toast.warning('Please fill in all required fields');
      return;
    }
    setInventory(prev => prev.map(i => i.id === itemToEdit.id ? itemToEdit : i));
    setIsEditItemModalOpen(false);
    toast.success(`${itemToEdit.name} updated successfully!`);
    setItemToEdit(null);
  };

  const handleEditContact = (contact: Contact) => {
    setContactToEdit(contact);
    setIsEditContactModalOpen(true);
  };

  const handleSaveEditContact = () => {
    if (!contactToEdit) return;
    if (!contactToEdit.name.trim() || !contactToEdit.email.trim()) {
      toast.warning('Please fill in name and email');
      return;
    }
    setContacts(prev => prev.map(c => c.id === contactToEdit.id ? contactToEdit : c));
    setIsEditContactModalOpen(false);
    toast.success(`${contactToEdit.name} updated successfully!`);
    setContactToEdit(null);
  };

  const handleDeleteContact = (contact: Contact) => {
    if (!confirm(`Delete ${contact.name}? This cannot be undone.`)) return;
    setContacts(prev => prev.filter(c => c.id !== contact.id));
    toast.success(`${contact.name} deleted successfully`);
  };

  const applyTemplateAllocation = () => {
    if (!templateJob || !templateItems.length) return;
    setJobs(prev => prev.map(job => {
      if (job.id === templateJob.id) {
        return { ...job, allocatedItems: [...job.allocatedItems, ...templateItems] };
      }
      return job;
    }));
    if (templateJob.isPicked) {
        templateItems.forEach(item => {
          const movement: StockMovement = {
            id: `m-tmpl-${Date.now()}-${Math.random()}`,
            itemId: item.itemId,
            type: 'Allocation',
            quantity: item.quantity,
            timestamp: Date.now(),
            reference: templateJob.id,
          };
          setMovements(prev => [movement, ...prev]);
          setInventory(inv => inv.map(i => {
            if (i.id === item.itemId) {
              return { ...i, quantity: Math.max(0, i.quantity - item.quantity) };
            }
            return i;
          }));
        });
    }
    setIsTemplateModalOpen(false);
  };

  const handleManualAllocate = () => {
    if (!jobToAllocate || !allocItemId || allocQty <= 0) return;
    setJobs(prev => prev.map(job => {
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
    }));
    
    if (jobToAllocate.isPicked) {
        const movement: StockMovement = {
          id: `m-alloc-${Date.now()}`,
          itemId: allocItemId,
          type: 'Allocation',
          quantity: allocQty,
          timestamp: Date.now(),
          reference: jobToAllocate.id,
        };
        setMovements(prev => [movement, ...prev]);
        setInventory(prev => prev.map(i => {
          if (i.id === allocItemId) {
            return { ...i, quantity: Math.max(0, i.quantity - allocQty) };
          }
          return i;
        }));
    }
    setIsAllocateModalOpen(false);
  };

  // Template Management Handlers
  const handleAddTemplate = (name: string, items: AllocatedItem[]) => {
    const newTemplate: JobTemplate = {
      id: `t-${Date.now()}`,
      name,
      items
    };
    setTemplates(prev => [...prev, newTemplate]);
  };

  const handleUpdateTemplate = (id: string, name: string, items: AllocatedItem[]) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, name, items } : t));
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  return (
    <>
      <CommandPalette />

      <div className="min-h-screen flex bg-slate-50">
        <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-slate-400 transition-all duration-300 flex flex-col fixed h-full z-20`}>
          <div className="p-6 flex items-center space-x-3 text-white" data-tour="logo">
            <Package className="w-8 h-8 text-blue-400 shrink-0" />
            {isSidebarOpen && <span className="font-bold text-xl tracking-tight">PlumbStock</span>}
          </div>
          <nav className="flex-1 mt-4" data-tour="navigation">
            <NavItem icon={TrendingUp} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} collapsed={!isSidebarOpen} />
            <div data-tour="inventory">
              <NavItem icon={Package} label="Inventory" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} collapsed={!isSidebarOpen} />
            </div>
            <div data-tour="jobs">
              <NavItem icon={Calendar} label="Jobs & Planning" active={activeTab === 'jobs'} onClick={() => setActiveTab('jobs')} collapsed={!isSidebarOpen} />
            </div>
            <NavItem icon={ShoppingCart} label="Smart Ordering" active={activeTab === 'ordering'} onClick={() => setActiveTab('ordering')} collapsed={!isSidebarOpen} />
            <NavItem icon={ArrowRightLeft} label="Stock History" active={activeTab === 'history'} onClick={() => setActiveTab('history')} collapsed={!isSidebarOpen} />
            <div data-tour="contacts">
              <NavItem icon={Users} label="Contacts" active={activeTab === 'contacts'} onClick={() => setActiveTab('contacts')} collapsed={!isSidebarOpen} />
            </div>
            <NavItem icon={CheckCircle} label="Approvals" active={activeTab === 'approvals'} onClick={() => setActiveTab('approvals')} collapsed={!isSidebarOpen} />
          </nav>
          <div className="p-4 border-t border-slate-800">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="flex items-center w-full p-3 rounded-lg hover:bg-slate-800 transition-colors">
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5 mx-auto" />}
              {isSidebarOpen && <span className="ml-3">Collapse</span>}
            </button>
          </div>
        </aside>

        <main id="main-content" className={`flex-1 ${isSidebarOpen ? 'ml-64' : 'ml-20'} transition-all duration-300 p-8`}>
          <header className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-800 capitalize">{activeTab.replace('-', ' ')}</h1>
              <p className="text-slate-500 mt-1">Manage your plumbing warehouse efficiently.</p>
            </div>
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <button className="p-2 text-slate-400 hover:text-blue-500 transition-colors" data-tour="settings">
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
          />
        )}
        {activeTab === 'jobs' && (
          <JobsView 
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
            onEditContact={handleEditContact}
            onDeleteContact={handleDeleteContact}
          />
        )}
        {activeTab === 'approvals' && <ApprovalsView />}
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
