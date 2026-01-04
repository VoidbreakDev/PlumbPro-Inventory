/**
 * Loading States & Skeleton Screens
 * Beautiful loading indicators and skeleton screens
 */

import React from 'react';

// Spinner Component
export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <div className="animate-spin rounded-full border-b-2 border-blue-600 w-full h-full"></div>
    </div>
  );
};

// Full Page Loader
export const PageLoader: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => {
  return (
    <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
      <div className="text-center">
        <Spinner size="lg" className="mx-auto" />
        <p className="mt-4 text-gray-600 font-medium">{message}</p>
      </div>
    </div>
  );
};

// Inline Loader
export const InlineLoader: React.FC<{ message?: string }> = ({ message }) => {
  return (
    <div className="flex items-center justify-center py-8">
      <Spinner size="md" className="mr-3" />
      {message && <span className="text-gray-600">{message}</span>}
    </div>
  );
};

// Skeleton Components
export const SkeletonLine: React.FC<{ width?: string; height?: string; className?: string }> = ({
  width = '100%',
  height = '1rem',
  className = ''
}) => {
  return (
    <div
      className={`bg-gray-200 rounded animate-pulse ${className}`}
      style={{ width, height }}
    />
  );
};

export const SkeletonCircle: React.FC<{ size?: string; className?: string }> = ({
  size = '3rem',
  className = ''
}) => {
  return (
    <div
      className={`bg-gray-200 rounded-full animate-pulse ${className}`}
      style={{ width: size, height: size }}
    />
  );
};

export const SkeletonImage: React.FC<{ width?: string; height?: string; className?: string }> = ({
  width = '100%',
  height = '200px',
  className = ''
}) => {
  return (
    <div
      className={`bg-gray-200 rounded animate-pulse ${className}`}
      style={{ width, height }}
    />
  );
};

// Card Skeleton
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <div className="flex items-center space-x-4 mb-4">
        <SkeletonCircle size="48px" />
        <div className="flex-1">
          <SkeletonLine width="60%" height="20px" className="mb-2" />
          <SkeletonLine width="40%" height="14px" />
        </div>
      </div>
      <SkeletonLine width="100%" className="mb-2" />
      <SkeletonLine width="80%" className="mb-2" />
      <SkeletonLine width="90%" />
    </div>
  );
};

// Table Skeleton
export const SkeletonTable: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 4
}) => {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex space-x-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="flex-1">
            <SkeletonLine width="80%" height="16px" />
          </div>
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="px-6 py-4 border-b border-gray-200 flex space-x-4"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={colIndex} className="flex-1">
              <SkeletonLine width={`${60 + Math.random() * 30}%`} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

// List Skeleton
export const SkeletonList: React.FC<{ items?: number }> = ({ items = 5 }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center space-x-4">
            <SkeletonCircle size="40px" />
            <div className="flex-1">
              <SkeletonLine width="70%" height="18px" className="mb-2" />
              <SkeletonLine width="50%" height="14px" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Dashboard Skeleton
export const SkeletonDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6">
            <SkeletonLine width="50%" height="14px" className="mb-3" />
            <SkeletonLine width="80%" height="32px" className="mb-2" />
            <SkeletonLine width="60%" height="12px" />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <SkeletonLine width="40%" height="20px" className="mb-4" />
          <SkeletonImage height="300px" />
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <SkeletonLine width="40%" height="20px" className="mb-4" />
          <SkeletonImage height="300px" />
        </div>
      </div>

      {/* Table */}
      <SkeletonTable rows={8} columns={5} />
    </div>
  );
};

// Form Skeleton
export const SkeletonForm: React.FC<{ fields?: number }> = ({ fields = 6 }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i}>
          <SkeletonLine width="30%" height="14px" className="mb-2" />
          <SkeletonLine width="100%" height="40px" />
        </div>
      ))}
      <div className="flex justify-end space-x-3">
        <SkeletonLine width="100px" height="40px" />
        <SkeletonLine width="100px" height="40px" />
      </div>
    </div>
  );
};

// Progress Bar
export const ProgressBar: React.FC<{
  progress: number;
  label?: string;
  showPercentage?: boolean;
  className?: string;
}> = ({ progress, label, showPercentage = true, className = '' }) => {
  const percentage = Math.min(Math.max(progress, 0), 100);

  return (
    <div className={className}>
      {(label || showPercentage) && (
        <div className="flex justify-between mb-2 text-sm">
          {label && <span className="text-gray-700">{label}</span>}
          {showPercentage && <span className="text-gray-500">{percentage}%</span>}
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className="bg-blue-600 h-full rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// Empty State
export const EmptyState: React.FC<{
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}> = ({ icon = '📭', title, description, action }) => {
  return (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-gray-600 mb-6 max-w-md mx-auto">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

// Error State
export const ErrorState: React.FC<{
  title?: string;
  message: string;
  retry?: () => void;
}> = ({ title = 'Something went wrong', message, retry }) => {
  return (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">⚠️</div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">{message}</p>
      {retry && (
        <button
          onClick={retry}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Try Again
        </button>
      )}
    </div>
  );
};

// Pulse Loader (for buttons)
export const ButtonLoader: React.FC = () => {
  return (
    <div className="flex items-center space-x-2">
      <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
};

export default {
  Spinner,
  PageLoader,
  InlineLoader,
  SkeletonLine,
  SkeletonCircle,
  SkeletonImage,
  SkeletonCard,
  SkeletonTable,
  SkeletonList,
  SkeletonDashboard,
  SkeletonForm,
  ProgressBar,
  EmptyState,
  ErrorState,
  ButtonLoader
};
