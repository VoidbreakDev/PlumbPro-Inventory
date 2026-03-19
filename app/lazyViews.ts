import { lazy } from 'react';

export const InventoryView = lazy(async () => {
  const module = await import('../views/InventoryView');
  return { default: module.InventoryView };
});

export const CalendarView = lazy(async () => {
  const module = await import('../views/CalendarView');
  return { default: module.CalendarView };
});

export const JobPlanningView = lazy(async () => {
  const module = await import('../views/JobPlanningView');
  return { default: module.JobPlanningView };
});

export const ProjectStagesView = lazy(async () => {
  const module = await import('../views/ProjectStagesView');
  return { default: module.ProjectStagesView };
});

export const OrderingView = lazy(async () => {
  const module = await import('../views/OrderingView');
  return { default: module.OrderingView };
});

export const HistoryView = lazy(async () => {
  const module = await import('../views/HistoryView');
  return { default: module.HistoryView };
});

export const ContactsView = lazy(async () => {
  const module = await import('../views/ContactsView');
  return { default: module.ContactsView };
});

export const ApprovalsView = lazy(async () => {
  const module = await import('../views/ApprovalsView');
  return { default: module.ApprovalsView };
});

export const SettingsView = lazy(async () => {
  const module = await import('../views/SettingsView');
  return { default: module.SettingsView };
});

export const MobileStockCountView = lazy(async () => {
  const module = await import('../views/MobileStockCountView');
  return { default: module.MobileStockCountView };
});

export const LoginView = lazy(async () => {
  const module = await import('../components/LoginView');
  return { default: module.LoginView };
});

export const PurchaseOrdersView = lazy(async () => {
  const module = await import('../views/PurchaseOrdersView');
  return { default: module.PurchaseOrdersView };
});

export const StockReturnsView = lazy(async () => {
  const module = await import('../views/StockReturnsView');
  return { default: module.StockReturnsView };
});

export const SupplierDashboardView = lazy(async () => {
  const module = await import('../views/SupplierDashboardView');
  return { default: module.SupplierDashboardView };
});

export const QuotesView = lazy(async () => {
  const module = await import('../views/QuotesView');
  return { default: module.QuotesView };
});

export const InvoicesView = lazy(() => import('../views/InvoicesView'));

export const ReportingView = lazy(async () => {
  const module = await import('../views/ReportingView');
  return { default: module.ReportingView };
});

export const TeamManagementView = lazy(async () => {
  const module = await import('../views/TeamManagementView');
  return { default: module.TeamManagementView };
});

export const AnalyticsView = lazy(async () => {
  const module = await import('../views/AnalyticsView');
  return { default: module.AnalyticsView };
});

export const AIForecastView = lazy(async () => {
  const module = await import('../views/AIForecastView');
  return { default: module.AIForecastView };
});

export const KitManagementView = lazy(() => import('../views/KitManagementView'));
export const AssetManagementView = lazy(() => import('../views/AssetManagementView'));
export const TechnicianPerformanceView = lazy(() => import('../views/TechnicianPerformanceView'));
export const SubcontractorManagementView = lazy(() => import('../views/SubcontractorManagementView'));
export const LeadPipelineView = lazy(() => import('../views/LeadPipelineView'));
export const VanStockView = lazy(async () => {
  const module = await import('../views/VanStockView');
  return { default: module.VanStockView };
});
export const MobileSyncDashboard = lazy(async () => {
  const module = await import('../views/MobileSyncDashboard');
  return { default: module.MobileSyncDashboard };
});
export const DeveloperView = lazy(async () => {
  const module = await import('../views/DeveloperView');
  return { default: module.DeveloperView };
});

export const AIAssistant = lazy(async () => {
  const module = await import('../components/AIAssistant');
  return { default: module.AIAssistant };
});

export const WorkflowAutomationView = lazy(() => import('../views/WorkflowAutomationView'));

export const StockTransferModal = lazy(async () => {
  const module = await import('../components/StockTransferModal');
  return { default: module.StockTransferModal };
});
