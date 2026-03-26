import React, { Suspense, type ChangeEvent } from 'react';
import type {
  AllocatedItem,
  Contact,
  InventoryItem,
  Job,
  JobTemplate,
  Kit,
  StockMovement
} from '../types';
import type { NavTab } from '../components/Navigation';
import { DeferredContentFallback } from '../components/DeferredContentFallback';
import { DashboardView } from '../views/DashboardView';
import {
  AIForecastView,
  AnalyticsView,
  ApprovalsView,
  AssetManagementView,
  CalendarView,
  ContactsView,
  DeveloperView,
  HistoryView,
  InventoryView,
  InvoicesView,
  JobPlanningView,
  KitManagementView,
  LeadPipelineView,
  ProjectStagesView,
  FranchiseView,
  MobileSyncDashboard,
  OrderingView,
  PurchaseOrdersView,
  QuotesView,
  ReportingView,
  SettingsView,
  StockReturnsView,
  SubcontractorManagementView,
  SupplierDashboardView,
  TeamManagementView,
  TechnicianPerformanceView,
  VanStockView,
  WorkflowAutomationView,
  PurchaseAnalyticsView
} from './lazyViews';

type InventorySortConfig = { key: keyof InventoryItem; direction: 'asc' | 'desc' } | null;

interface AppViewRouterProps {
  activeTab: NavTab;
  inventory: InventoryItem[];
  filteredInventory: InventoryItem[];
  contacts: Contact[];
  jobs: Job[];
  movements: StockMovement[];
  templates: JobTemplate[];
  kits: Kit[];
  inventorySearch: string;
  inventorySortConfig: InventorySortConfig;
  onNavigate: (tab: NavTab) => void;
  onInventorySearchChange: (value: string) => void;
  onInventorySort: (key: keyof InventoryItem) => void;
  onImportCSV: (event: ChangeEvent<HTMLInputElement>) => void;
  onViewItemDetails: (item: InventoryItem) => void;
  onOpenAdjustItem: (item: InventoryItem) => void;
  onEditItem: (item: InventoryItem) => void;
  onAddItem: () => void;
  onDeleteItem: (item: InventoryItem) => void;
  onDeleteAllItems: () => void;
  onOpenStockTransfer: () => void;
  onOpenNewJobModal: () => void;
  onConfirmPick: (jobId: string) => void;
  onOpenAllocateModal: (job: Job) => void;
  onOpenTemplateModal: (jobId: string, templateId: string) => void;
  onAddTemplate: (name: string, items: AllocatedItem[]) => Promise<void>;
  onUpdateTemplate: (id: string, name: string, items: AllocatedItem[]) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
  onAddContact: () => void;
  onEditContact: (contact: Contact) => void;
  onDeleteContact: (contact: Contact) => Promise<void>;
  onSettingsSaved: () => void;
}

export function AppViewRouter({
  activeTab,
  inventory,
  filteredInventory,
  contacts,
  jobs,
  movements,
  templates,
  kits,
  inventorySearch,
  inventorySortConfig,
  onNavigate,
  onInventorySearchChange,
  onInventorySort,
  onImportCSV,
  onViewItemDetails,
  onOpenAdjustItem,
  onEditItem,
  onAddItem,
  onDeleteItem,
  onDeleteAllItems,
  onOpenStockTransfer,
  onOpenNewJobModal,
  onConfirmPick,
  onOpenAllocateModal,
  onOpenTemplateModal,
  onAddTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onAddContact,
  onEditContact,
  onDeleteContact,
  onSettingsSaved
}: AppViewRouterProps) {
  return (
    <Suspense fallback={<DeferredContentFallback label={`Loading ${activeTab.replace('-', ' ')}...`} />}>
      {activeTab === 'dashboard' && <DashboardView inventory={inventory} jobs={jobs} contacts={contacts} onNavigate={onNavigate} />}
      {activeTab === 'inventory' && (
        <InventoryView
          inventory={filteredInventory}
          contacts={contacts}
          search={inventorySearch}
          onSearchChange={onInventorySearchChange}
          sortConfig={inventorySortConfig}
          onSort={onInventorySort}
          onImportCSV={onImportCSV}
          onViewDetails={onViewItemDetails}
          onAdjustStock={onOpenAdjustItem}
          onEditItem={onEditItem}
          onAddItem={onAddItem}
          onDeleteItem={onDeleteItem}
          onDeleteAll={onDeleteAllItems}
          onTransferStock={onOpenStockTransfer}
        />
      )}
      {activeTab === 'calendar' && (
        <CalendarView
          jobs={jobs}
          contacts={contacts}
          onJobClick={() => {
            onNavigate('job-planning');
          }}
        />
      )}
      {activeTab === 'job-planning' && (
        <JobPlanningView
          jobs={jobs}
          contacts={contacts}
          inventory={inventory}
          templates={templates}
          kits={kits}
          onOpenNewJobModal={onOpenNewJobModal}
          onConfirmPick={onConfirmPick}
          onOpenAllocateModal={onOpenAllocateModal}
          onOpenTemplateModal={onOpenTemplateModal}
          onNavigate={onNavigate}
          onAddTemplate={onAddTemplate}
          onUpdateTemplate={onUpdateTemplate}
          onDeleteTemplate={onDeleteTemplate}
        />
      )}
      {activeTab === 'project-stages' && <ProjectStagesView />}
      {activeTab === 'kits' && <KitManagementView />}
      {activeTab === 'ordering' && <OrderingView inventory={inventory} jobs={jobs} />}
      {activeTab === 'history' && <HistoryView movements={movements} inventory={inventory} />}
      {activeTab === 'contacts' && (
        <ContactsView
          contacts={contacts}
          onAddContact={onAddContact}
          onEditContact={onEditContact}
          onDeleteContact={onDeleteContact}
        />
      )}
      {activeTab === 'subcontractors' && <SubcontractorManagementView />}
      {activeTab === 'approvals' && <ApprovalsView />}
      {activeTab === 'purchase-orders' && <PurchaseOrdersView />}
      {activeTab === 'leads' && <LeadPipelineView />}
      {activeTab === 'quotes' && <QuotesView />}
      {activeTab === 'invoices' && <InvoicesView />}
      {activeTab === 'stock-returns' && <StockReturnsView />}
      {activeTab === 'supplier-dashboard' && <SupplierDashboardView contacts={contacts} />}
      {activeTab === 'reports' && <ReportingView />}
      {activeTab === 'team' && <TeamManagementView />}
      {activeTab === 'assets' && <AssetManagementView />}
      {activeTab === 'van-stock' && <VanStockView />}
      {activeTab === 'sync-dashboard' && <MobileSyncDashboard />}
      {activeTab === 'franchise' && <FranchiseView />}
      {activeTab === 'developer' && <DeveloperView />}
      {activeTab === 'settings' && <SettingsView onSave={onSettingsSaved} />}
      {activeTab === 'analytics' && <AnalyticsView />}
      {activeTab === 'performance' && <TechnicianPerformanceView />}
      {activeTab === 'ai-forecast' && <AIForecastView />}
      {activeTab === 'workflows' && <WorkflowAutomationView />}
      {activeTab === 'purchase-analytics' && <PurchaseAnalyticsView />}
    </Suspense>
  );
}
