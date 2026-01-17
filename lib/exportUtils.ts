import { ItemSupplier, SupplierPerformance, PriceAlert } from '../types';

/**
 * Export utility functions for supplier data
 */

// CSV Export
export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Handle values that might contain commas
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value ?? '';
      }).join(',')
    )
  ].join('\n');

  downloadFile(csvContent, filename, 'text/csv');
};

// Export supplier comparison data
export const exportSupplierComparison = (suppliers: ItemSupplier[], itemName: string) => {
  const data = suppliers.map(s => ({
    'Item Name': itemName,
    'Supplier Name': s.supplierName,
    'Supplier Company': s.supplierCompany || '',
    'Supplier Code': s.supplierCode,
    'Price (Excl GST)': s.unitPriceExclGst.toFixed(2),
    'Price (Incl GST)': s.unitPriceInclGst.toFixed(2),
    'Lead Time (Days)': s.leadTimeDays,
    'Is Preferred': s.isPreferred ? 'Yes' : 'No',
    'Is Lowest Price': s.isLowestPrice ? 'Yes' : 'No',
    'Average Rating': s.averageRating?.toFixed(1) || 'N/A',
    'Total Ratings': s.totalRatings || 0,
    'Times Ordered': s.timesOrdered,
    'Last Ordered': s.lastOrderedDate ? new Date(s.lastOrderedDate).toLocaleDateString() : 'Never',
    'Has Contract': s.hasContract ? 'Yes' : 'No',
    'Contract Status': s.contractStatus || 'N/A'
  }));

  exportToCSV(data, `supplier-comparison-${itemName.replace(/[^a-zA-Z0-9]/g, '-')}.csv`);
};

// Export supplier performance data
export const exportSupplierPerformance = (performance: SupplierPerformance) => {
  const data = [{
    'Supplier Name': performance.supplier.name,
    'Supplier Company': performance.supplier.company || '',
    'Email': performance.supplier.email,
    'Phone': performance.supplier.phone,
    'Average Rating': performance.supplier.averageRating.toFixed(2),
    'Total Ratings': performance.supplier.totalRatings,
    'Total Orders': performance.performance.orders.totalOrders,
    'Completed Orders': performance.performance.orders.completedOrders,
    'Pending Orders': performance.performance.orders.pendingOrders,
    'Total Spent': performance.performance.orders.totalSpent.toFixed(2),
    'Average Order Value': performance.performance.orders.avgOrderValue.toFixed(2),
    'Total Deliveries': performance.performance.delivery.totalDeliveries,
    'On-Time Deliveries': performance.performance.delivery.onTimeDeliveries,
    'Late Deliveries': performance.performance.delivery.lateDeliveries,
    'Delivery Reliability (%)': performance.performance.delivery.reliabilityPercentage || 'N/A',
    'Items Supplied': performance.performance.items.totalItems,
    'Preferred Items': performance.performance.items.preferredItems,
    'Average Price': performance.performance.items.avgPrice.toFixed(2),
    'Average Lead Time (Days)': performance.performance.items.avgLeadTime.toFixed(1),
    'Price Changes': performance.performance.pricing.totalPriceChanges,
    'Price Increases': performance.performance.pricing.priceIncreases,
    'Price Decreases': performance.performance.pricing.priceDecreases
  }];

  exportToCSV(data, `supplier-performance-${performance.supplier.name.replace(/[^a-zA-Z0-9]/g, '-')}.csv`);
};

// Export price alerts
export const exportPriceAlerts = (alerts: PriceAlert[]) => {
  const data = alerts.map(alert => ({
    'Item Name': alert.itemName,
    'Item Category': alert.itemCategory,
    'Supplier Name': alert.supplierName,
    'Supplier Company': alert.supplierCompany || '',
    'Old Price (Excl GST)': parseFloat(alert.oldPriceExclGst.toString()).toFixed(2),
    'New Price (Excl GST)': parseFloat(alert.newPriceExclGst.toString()).toFixed(2),
    'Price Difference': parseFloat(alert.priceDifference.toString()).toFixed(2),
    'Percentage Change': alert.percentageChange.toFixed(2) + '%',
    'Alert Type': alert.alertType,
    'Urgency': alert.urgency.toUpperCase(),
    'Is Viewed': alert.isViewed ? 'Yes' : 'No',
    'Is Acknowledged': alert.isAcknowledged ? 'Yes' : 'No',
    'Created At': new Date(alert.createdAt).toLocaleString()
  }));

  exportToCSV(data, `price-alerts-${new Date().toISOString().split('T')[0]}.csv`);
};

// PDF Export (requires jsPDF)
export const exportToPDF = async (
  title: string,
  data: any[],
  filename: string
) => {
  try {
    // Dynamic import to avoid bundling jsPDF if not used
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();

    // Add title
    doc.setFontSize(16);
    doc.text(title, 14, 20);

    // Add date
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

    // Convert data to table format
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(h => row[h]));

    // Add table
    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    });

    doc.save(filename);
  } catch (error) {
    console.error('PDF export error:', error);
    alert('PDF export requires additional libraries. Falling back to CSV export.');
    exportToCSV(data, filename.replace('.pdf', '.csv'));
  }
};

// Excel Export (requires xlsx library)
export const exportToExcel = async (
  data: any[],
  filename: string,
  sheetName: string = 'Sheet1'
) => {
  try {
    // Dynamic import to avoid bundling xlsx if not used
    const XLSX = await import('xlsx');

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Auto-size columns
    const maxWidth = 50;
    const wscols = Object.keys(data[0]).map(key => ({
      wch: Math.min(
        Math.max(
          key.length,
          ...data.map(row => String(row[key] || '').length)
        ),
        maxWidth
      )
    }));
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, filename);
  } catch (error) {
    console.error('Excel export error:', error);
    alert('Excel export requires additional libraries. Falling back to CSV export.');
    exportToCSV(data, filename.replace('.xlsx', '.csv'));
  }
};

// Helper function to download file
const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Print-friendly format
export const printSupplierReport = (performance: SupplierPerformance) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print reports');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Supplier Performance Report - ${performance.supplier.name}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 40px;
          color: #333;
        }
        h1 {
          color: #1f2937;
          border-bottom: 3px solid #3b82f6;
          padding-bottom: 10px;
        }
        h2 {
          color: #374151;
          margin-top: 30px;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 5px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin: 20px 0;
        }
        .info-item {
          padding: 15px;
          background: #f9fafb;
          border-radius: 8px;
        }
        .info-label {
          font-weight: bold;
          color: #6b7280;
          font-size: 12px;
          text-transform: uppercase;
        }
        .info-value {
          font-size: 24px;
          font-weight: bold;
          color: #1f2937;
          margin-top: 5px;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 12px;
        }
        @media print {
          body { padding: 20px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <h1>Supplier Performance Report</h1>
      <div style="margin: 20px 0;">
        <h2>${performance.supplier.name}</h2>
        <p>${performance.supplier.company || ''}</p>
        <p>Email: ${performance.supplier.email} | Phone: ${performance.supplier.phone}</p>
        <p>Rating: ${performance.supplier.averageRating.toFixed(1)}/5.0 (${performance.supplier.totalRatings} reviews)</p>
      </div>

      <h2>Purchase Orders</h2>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Total Orders</div>
          <div class="info-value">${performance.performance.orders.totalOrders}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Total Spent</div>
          <div class="info-value">$${performance.performance.orders.totalSpent.toFixed(2)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Completed Orders</div>
          <div class="info-value">${performance.performance.orders.completedOrders}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Average Order Value</div>
          <div class="info-value">$${performance.performance.orders.avgOrderValue.toFixed(2)}</div>
        </div>
      </div>

      <h2>Delivery Performance</h2>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">On-Time Delivery Rate</div>
          <div class="info-value">${performance.performance.delivery.reliabilityPercentage || 'N/A'}${performance.performance.delivery.reliabilityPercentage ? '%' : ''}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Total Deliveries</div>
          <div class="info-value">${performance.performance.delivery.totalDeliveries}</div>
        </div>
        <div class="info-item">
          <div class="info-label">On-Time Deliveries</div>
          <div class="info-value">${performance.performance.delivery.onTimeDeliveries}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Late Deliveries</div>
          <div class="info-value">${performance.performance.delivery.lateDeliveries}</div>
        </div>
      </div>

      <h2>Items & Pricing</h2>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Items Supplied</div>
          <div class="info-value">${performance.performance.items.totalItems}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Preferred Items</div>
          <div class="info-value">${performance.performance.items.preferredItems}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Average Price</div>
          <div class="info-value">$${performance.performance.items.avgPrice.toFixed(2)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Average Lead Time</div>
          <div class="info-value">${performance.performance.items.avgLeadTime.toFixed(0)} days</div>
        </div>
      </div>

      <div class="footer">
        <p>Generated: ${new Date().toLocaleString()}</p>
        <p>PlumbPro Inventory Management System</p>
      </div>

      <div class="no-print" style="margin-top: 20px;">
        <button onclick="window.print()" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">Print Report</button>
        <button onclick="window.close()" style="padding: 10px 20px; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; margin-left: 10px;">Close</button>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};
