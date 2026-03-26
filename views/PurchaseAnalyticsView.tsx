// views/PurchaseAnalyticsView.tsx
import React from 'react';
import { AnalyticsDashboard } from '../components/analytics/AnalyticsDashboard';
import { ImportHistory } from '../components/import/ImportHistory';

export function PurchaseAnalyticsView() {
  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-screen bg-slate-50 p-4">
      <div className="flex-1 min-w-0">
        <AnalyticsDashboard />
      </div>
      <div className="w-full lg:w-72 flex-shrink-0">
        <ImportHistory />
      </div>
    </div>
  );
}

export default PurchaseAnalyticsView;
