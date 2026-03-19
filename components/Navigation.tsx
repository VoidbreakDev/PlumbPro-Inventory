import React, { useState, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  Package,
  Users,
  ClipboardList,
  FileText,
  BarChart3,
  Zap,
  Settings,
  ChevronDown,
  LucideIcon
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type NavTab = 
  | 'dashboard' | 'inventory' | 'calendar' | 'job-planning' | 'project-stages' | 'contacts' 
  | 'ordering' | 'history' | 'approvals' | 'purchase-orders' | 'stock-returns' 
  | 'supplier-dashboard' | 'quotes' | 'invoices' | 'reports' | 'team' 
  | 'settings' | 'analytics' | 'ai-forecast' | 'workflows' | 'kits' | 'assets' 
  | 'performance' | 'leads' | 'subcontractors' | 'van-stock' | 'sync-dashboard'
  | 'developer';

export interface NavChildItem {
  id: NavTab;
  label: string;
  badge?: number;
  tag?: string;
  roles?: string[];
}

export interface NavGroupItem {
  id: string;
  label: string;
  icon: LucideIcon;
  children: NavChildItem[];
  badge?: number;
}

export interface NavSingleItem {
  id: NavTab;
  label: string;
  icon: LucideIcon;
  badge?: number;
  tag?: string;
  roles?: string[];
  tourId?: string;
}

export type NavigationItem = NavSingleItem | NavGroupItem;

// ============================================================================
// Navigation Configuration
// ============================================================================

export const NAVIGATION_CONFIG: NavigationItem[] = [
  // Main
  { 
    id: 'dashboard', 
    label: 'Dashboard', 
    icon: TrendingUp 
  },
  
  // Inventory Group
  {
    id: 'inventory-group',
    label: 'Inventory',
    icon: Package,
    children: [
      { id: 'inventory', label: 'Inventory' },
      { id: 'kits', label: 'Kits & BOMs' },
      { id: 'ordering', label: 'Smart Ordering' },
      { id: 'purchase-orders', label: 'Purchase Orders' },
      { id: 'stock-returns', label: 'Stock Returns' },
      { id: 'history', label: 'Stock History' },
    ]
  },
  
  // Jobs Group
  {
    id: 'jobs-group',
    label: 'Jobs',
    icon: ClipboardList,
    children: [
      { id: 'calendar', label: 'Calendar' },
      { id: 'job-planning', label: 'Job Planning' },
      { id: 'project-stages', label: 'Project Stages' },
      { id: 'workflows', label: 'Workflows' },
    ]
  },
  
  // Sales Group
  {
    id: 'sales-group',
    label: 'Sales',
    icon: FileText,
    children: [
      { id: 'leads', label: 'Lead Pipeline' },
      { id: 'quotes', label: 'Quotes' },
      { id: 'invoices', label: 'Invoices' },
    ]
  },
  
  // Contacts Group
  {
    id: 'contacts-group',
    label: 'Contacts',
    icon: Users,
    children: [
      { id: 'contacts', label: 'Contacts' },
      { id: 'subcontractors', label: 'Subcontractors' },
      { id: 'supplier-dashboard', label: 'Supplier Dashboard' },
    ]
  },
  
  // Insights Group
  {
    id: 'insights-group',
    label: 'Insights',
    icon: BarChart3,
    children: [
      { id: 'reports', label: 'Reports' },
      { id: 'analytics', label: 'Analytics' },
      { id: 'performance', label: 'Team Performance' },
      { id: 'ai-forecast', label: 'AI Forecast' },
    ]
  },
  
  // Team Group
  {
    id: 'team-group',
    label: 'Team',
    icon: Users,
    children: [
      { id: 'team', label: 'Team' },
      { id: 'assets', label: 'Assets & Vehicles' },
      { id: 'approvals', label: 'Approvals' },
    ]
  },

  // Advanced modules that are production-usable but not core for every team
  {
    id: 'advanced-group',
    label: 'Advanced',
    icon: Zap,
    children: [
      { id: 'van-stock', label: 'Van Stock', tag: 'Beta' },
      { id: 'sync-dashboard', label: 'Sync Dashboard' },
      { id: 'developer', label: 'Developer', tag: 'Beta', roles: ['admin', 'owner'] },
    ]
  },
  
  // System
  { 
    id: 'settings', 
    label: 'Settings', 
    icon: Settings 
  },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get badge count for a parent item based on its children
 */
export const getParentBadge = (children: NavChildItem[], getBadgeForTab: (tab: NavTab) => number): number => {
  return children.reduce((total, child) => {
    const childBadge = getBadgeForTab(child.id);
    return total + (childBadge || 0);
  }, 0);
};

/**
 * Check if any child in a group is active
 */
export const isGroupActive = (children: NavChildItem[], activeTab: NavTab): boolean => {
  return children.some(child => child.id === activeTab);
};

const normalizeRole = (role?: string | null) => role?.trim().toLowerCase() ?? null;

const canAccessItem = (userRole: string | null | undefined, roles?: string[]) => {
  if (!roles || roles.length === 0) {
    return true;
  }

  const normalizedRole = normalizeRole(userRole);
  if (!normalizedRole) {
    return false;
  }

  return roles.some((role) => normalizeRole(role) === normalizedRole);
};

export const getVisibleNavigationConfig = (userRole?: string | null): NavigationItem[] => {
  return NAVIGATION_CONFIG.reduce<NavigationItem[]>((visibleItems, item) => {
    if ('children' in item) {
      const children = item.children.filter((child) => canAccessItem(userRole, child.roles));
      if (children.length === 0) {
        return visibleItems;
      }

      visibleItems.push({ ...item, children });
      return visibleItems;
    }

    if (canAccessItem(userRole, item.roles)) {
      visibleItems.push(item);
    }

    return visibleItems;
  }, []);
};

export const isTabVisible = (tab: NavTab, userRole?: string | null): boolean => {
  return getVisibleNavigationConfig(userRole).some((item) => {
    if ('children' in item) {
      return item.children.some((child) => child.id === tab);
    }

    return item.id === tab;
  });
};

export const getNavigationLabel = (tab: NavTab): string => {
  for (const item of NAVIGATION_CONFIG) {
    if ('children' in item) {
      const child = item.children.find((entry) => entry.id === tab);
      if (child) {
        return child.label;
      }
      continue;
    }

    if (item.id === tab) {
      return item.label;
    }
  }

  return tab
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

// ============================================================================
// Components
// ============================================================================

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  collapsed: boolean;
  badge?: number;
  tag?: string;
  tourId?: string;
}

/**
 * NavItem - Single navigation item component
 * Displays an icon, label, and optional badge with active/hover states
 */
export const NavItem: React.FC<NavItemProps> = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick, 
  collapsed, 
  badge,
  tag,
  tourId
}) => {
  const content = (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center px-6 py-3 transition-all duration-200 relative
        ${active 
          ? 'text-white bg-slate-800/50' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
        }
      `}
      aria-current={active ? 'page' : undefined}
    >
      {/* Active indicator - left border */}
      {active && (
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full"
          aria-hidden="true"
        />
      )}
      
      {/* Icon with optional badge */}
      <div className="relative shrink-0">
        <Icon 
          className={`w-5 h-5 ${active ? 'text-blue-400' : ''}`} 
          aria-hidden="true"
        />
        {/* Badge on icon (only when collapsed) */}
        {collapsed && badge !== undefined && badge > 0 && (
          <span 
            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[14px] h-3.5 flex items-center justify-center px-0.5"
            aria-label={`${badge} notifications`}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      
      {/* Label and badge (only when expanded) */}
      {!collapsed && (
        <span className="ml-3 text-sm font-medium flex items-center flex-1 min-w-0 gap-2">
          <span className="truncate">{label}</span>
          {tag && (
            <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300 shrink-0">
              {tag}
            </span>
          )}
          {badge !== undefined && badge > 0 && (
            <span 
              className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-4 flex items-center justify-center px-1.5 shrink-0"
              aria-label={`${badge} notifications`}
            >
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </span>
      )}
    </button>
  );

  if (tourId) {
    return <div data-tour={tourId}>{content}</div>;
  }

  return content;
};

interface NavItemGroupProps {
  icon: LucideIcon;
  label: string;
  children: NavChildItem[];
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  collapsed: boolean;
  getBadgeForTab: (tab: NavTab) => number;
  defaultExpanded?: boolean;
  tourId?: string;
}

/**
 * NavItemGroup - Collapsible navigation group component
 * Shows parent with icon, expandable children with indented sub-items
 */
export const NavItemGroup: React.FC<NavItemGroupProps> = ({ 
  icon: Icon, 
  label, 
  children, 
  activeTab, 
  onNavigate, 
  collapsed,
  getBadgeForTab,
  defaultExpanded = false,
  tourId
}) => {
  // Check if any child is active
  const hasActiveChild = useMemo(() => 
    isGroupActive(children, activeTab),
    [children, activeTab]
  );
  
  // Auto-expand if a child is active
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || hasActiveChild);
  
  // Keep expanded if child becomes active
  React.useEffect(() => {
    if (hasActiveChild) {
      setIsExpanded(true);
    }
  }, [hasActiveChild]);
  
  // Calculate parent badge from children
  const parentBadge = useMemo(() => 
    getParentBadge(children, getBadgeForTab),
    [children, getBadgeForTab]
  );
  
  const handleToggle = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);
  
  const handleChildClick = useCallback((childId: NavTab) => {
    onNavigate(childId);
  }, [onNavigate]);

  // When collapsed, render as a simple nav item that navigates to first child
  if (collapsed) {
    const firstChild = children[0];
    return (
      <NavItem
        icon={Icon}
        label={label}
        active={hasActiveChild}
        onClick={() => firstChild && onNavigate(firstChild.id)}
        collapsed={collapsed}
        badge={parentBadge > 0 ? parentBadge : undefined}
        tourId={tourId}
      />
    );
  }

  const content = (
    <div className="relative">
      {/* Parent Item */}
      <button
        onClick={handleToggle}
        className={`
          w-full flex items-center px-6 py-3 transition-all duration-200 relative
          ${hasActiveChild 
            ? 'text-white bg-slate-800/50' 
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }
        `}
        aria-expanded={isExpanded}
        aria-haspopup="true"
      >
        {/* Active indicator - left border (shown when any child is active) */}
        {hasActiveChild && (
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full"
            aria-hidden="true"
          />
        )}
        
        {/* Icon */}
        <Icon 
          className={`w-5 h-5 shrink-0 ${hasActiveChild ? 'text-blue-400' : ''}`}
          aria-hidden="true"
        />
        
        {/* Label */}
        <span className="ml-3 text-sm font-medium flex-1 text-left truncate">
          {label}
        </span>
        
        {/* Badge */}
        {parentBadge > 0 && (
          <span 
            className="mr-2 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-4 flex items-center justify-center px-1.5 shrink-0"
            aria-label={`${parentBadge} notifications in group`}
          >
            {parentBadge > 99 ? '99+' : parentBadge}
          </span>
        )}
        
        {/* Chevron - rotates when expanded */}
        <ChevronDown 
          className={`
            w-4 h-4 shrink-0 ml-2 transition-transform duration-200
            ${isExpanded ? 'rotate-180' : ''}
          `}
          aria-hidden="true"
        />
      </button>
      
      {/* Children - indented with animation */}
      <div 
        className={`
          overflow-hidden transition-all duration-200 ease-in-out
          ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}
        `}
        aria-hidden={!isExpanded}
      >
        <div className="pl-14 pr-4 py-1 space-y-0.5">
          {children.map((child) => {
            const isChildActive = activeTab === child.id;
            const childBadge = getBadgeForTab(child.id);
            
            return (
              <button
                key={child.id}
                onClick={() => handleChildClick(child.id)}
                className={`
                  w-full flex items-center px-3 py-2 rounded-md text-sm transition-colors relative
                  ${isChildActive 
                    ? 'text-white bg-blue-500/20' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }
                `}
                aria-current={isChildActive ? 'page' : undefined}
              >
                {/* Active dot indicator for child */}
                {isChildActive && (
                  <div 
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-blue-400 rounded-full"
                    aria-hidden="true"
                  />
                )}
                
                <span className="flex-1 text-left truncate">{child.label}</span>

                {child.tag && (
                  <span className="mr-2 rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-300 shrink-0">
                    {child.tag}
                  </span>
                )}
                
                {childBadge > 0 && (
                  <span 
                    className="ml-2 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-3.5 flex items-center justify-center px-1 shrink-0"
                    aria-label={`${childBadge} notifications`}
                  >
                    {childBadge > 99 ? '99+' : childBadge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (tourId) {
    return <div data-tour={tourId}>{content}</div>;
  }

  return content;
};

// ============================================================================
// Main Navigation Component
// ============================================================================

interface NavigationProps {
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  collapsed: boolean;
  getBadgeForTab: (tab: NavTab) => number;
  userRole?: string | null;
  className?: string;
}

/**
 * Navigation - Main sidebar navigation component
 * Renders all navigation items with groups and single items
 */
export const Navigation: React.FC<NavigationProps> = ({ 
  activeTab, 
  onNavigate, 
  collapsed, 
  getBadgeForTab,
  userRole,
  className = ''
}) => {
  const visibleItems = useMemo(() => getVisibleNavigationConfig(userRole), [userRole]);

  return (
    <nav 
      className={`flex-1 overflow-y-auto ${className}`}
      data-tour="navigation"
      aria-label="Main navigation"
    >
      {visibleItems.map((item) => {
        // Single item
        if ('children' in item) {
          // Group item
          return (
            <NavItemGroup
              key={item.id}
              icon={item.icon}
              label={item.label}
              children={item.children}
              activeTab={activeTab}
              onNavigate={onNavigate}
              collapsed={collapsed}
              getBadgeForTab={getBadgeForTab}
              tourId={item.id === 'inventory-group' ? 'inventory' : undefined}
            />
          );
        } else {
          // Single item
          return (
            <NavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeTab === item.id}
              onClick={() => onNavigate(item.id)}
              collapsed={collapsed}
              badge={getBadgeForTab(item.id) > 0 ? getBadgeForTab(item.id) : undefined}
              tag={item.tag}
            />
          );
        }
      })}
    </nav>
  );
};

export default Navigation;
