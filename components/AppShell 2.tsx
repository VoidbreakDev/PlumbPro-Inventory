import React from 'react';
import {
  Package,
  Menu,
  X,
  Settings,
  LogOut,
  Sparkles
} from 'lucide-react';
import { Navigation, NavTab } from './Navigation';
import LanguageSwitcher from './LanguageSwitcher';

interface AppShellProps {
  activeTab: NavTab;
  isSidebarOpen: boolean;
  isMobile: boolean;
  reorderAlertCount: number;
  userFullName?: string;
  userEmail?: string;
  userRole?: string;
  activeTabLabel: string;
  onNavigate: (tab: NavTab) => void;
  onToggleSidebar: () => void;
  onLogout: () => void;
  onOpenAIAssistant: () => void;
  onOpenSettings: () => void;
  children: React.ReactNode;
}

export function AppShell({
  activeTab,
  isSidebarOpen,
  isMobile,
  reorderAlertCount,
  userFullName,
  userEmail,
  userRole,
  activeTabLabel,
  onNavigate,
  onToggleSidebar,
  onLogout,
  onOpenAIAssistant,
  onOpenSettings,
  children
}: AppShellProps) {
  return (
    <div className="flex-1 min-h-0 flex">
      <aside
        className={`hidden md:flex ${isSidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 dark:bg-slate-950 text-slate-400 dark:text-slate-500 transition-all duration-300 flex-col fixed z-20`}
        style={{ top: '2.25rem', height: 'calc(100vh - 2.25rem)' }}
      >
        <div className="p-6 flex items-center space-x-3 text-white" data-tour="logo">
          <Package className="w-8 h-8 text-blue-400 shrink-0" />
          {isSidebarOpen && <span className="font-bold text-xl tracking-tight">PlumbStock</span>}
        </div>
        <nav className="flex-1 mt-4 overflow-y-auto" data-tour="navigation">
          <Navigation
            activeTab={activeTab}
            onNavigate={onNavigate}
            collapsed={!isSidebarOpen}
            getBadgeForTab={(tab) => (tab === 'ordering' ? reorderAlertCount : 0)}
            userRole={userRole}
          />
        </nav>
        <div className="p-4 border-t border-slate-800 space-y-2">
          {isSidebarOpen && userFullName && (
            <div className="px-3 py-2 mb-2">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Logged in as</p>
              <p className="text-sm text-slate-300 font-medium truncate">{userFullName}</p>
              <p className="text-xs text-slate-500 truncate">{userEmail}</p>
            </div>
          )}

          <button
            onClick={onLogout}
            className="flex items-center w-full p-3 rounded-lg hover:bg-red-900/20 hover:text-red-400 transition-colors text-slate-400"
            title="Logout"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {isSidebarOpen && <span className="ml-3">Logout</span>}
          </button>

          <button
            onClick={onToggleSidebar}
            className="flex items-center w-full p-3 rounded-lg hover:bg-slate-800 transition-colors"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5 mx-auto" />}
            {isSidebarOpen && <span className="ml-3">Collapse</span>}
          </button>
        </div>
      </aside>

      <main
        id="main-content"
        className={`flex-1 overflow-auto ${isSidebarOpen ? 'md:ml-64' : 'md:ml-20'} transition-all duration-300 p-4 md:p-8 pb-20 md:pb-8`}
        style={{ marginTop: '2.25rem' }}
      >
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{activeTabLabel}</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your plumbing warehouse efficiently.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenAIAssistant}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden md:inline">AI Assistant</span>
            </button>
            <LanguageSwitcher />
            <button
              onClick={onOpenSettings}
              className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
              data-tour="settings"
            >
              <Settings className="w-6 h-6" />
            </button>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
