/**
 * Van Stock Management View
 * Mobile-optimized service van inventory tracking
 */

import React, { useState, useEffect } from 'react';
import {
  Truck,
  Package,
  Plus,
  AlertTriangle,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  X,
  MapPin,
  TrendingDown,
  History,
  Search,
  Trash2,
  Eye
} from 'lucide-react';
import { getErrorMessage } from '../lib/errors';
import { ConfirmationModal } from '../components/ConfirmationModal';
import {
  vanStockAPI,
  ServiceVan,
  VanStockItem,
  LowStockItem,
  RestockRequest,
  VanStockMovement
} from '../lib/vanStockAPI';

type ActiveTab = 'vans' | 'low-stock' | 'restock' | 'movements';
type ConfirmationState = {
  title: string;
  description: string;
  confirmLabel: string;
  processingLabel?: string;
  variant?: 'default' | 'danger';
  errorMessage: string;
  action: () => Promise<void>;
};

export function VanStockView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('vans');

  // Data state
  const [vans, setVans] = useState<ServiceVan[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [restockRequests, setRestockRequests] = useState<RestockRequest[]>([]);
  const [movements, setMovements] = useState<VanStockMovement[]>([]);

  // Selected van state
  const [selectedVan, setSelectedVan] = useState<ServiceVan | null>(null);
  const [vanStock, setVanStock] = useState<VanStockItem[]>([]);

  // Modal state
  const [showCreateVanModal, setShowCreateVanModal] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);

  // Search/filter
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      if (activeTab === 'vans') {
        const { vans: v } = await vanStockAPI.getVans();
        setVans(v);
      } else if (activeTab === 'low-stock') {
        const { items } = await vanStockAPI.getLowStock();
        setLowStockItems(items);
      } else if (activeTab === 'restock') {
        const { requests } = await vanStockAPI.getRestockRequests();
        setRestockRequests(requests);
      } else if (activeTab === 'movements') {
        const { movements: m } = await vanStockAPI.getMovements({ limit: 100 });
        setMovements(m);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  const loadVanDetails = async (van: ServiceVan) => {
    try {
      const { van: v, stock } = await vanStockAPI.getVan(van.id);
      setSelectedVan(v);
      setVanStock(stock);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load van details'));
    }
  };

  const closeConfirmation = () => {
    if (!isConfirmingAction) {
      setConfirmation(null);
    }
  };

  const handleConfirmedAction = async () => {
    if (!confirmation) {
      return;
    }

    setIsConfirmingAction(true);
    try {
      await confirmation.action();
      setConfirmation(null);
    } catch (err) {
      setError(getErrorMessage(err, confirmation.errorMessage));
    } finally {
      setIsConfirmingAction(false);
    }
  };

  const requestDeleteVan = (van: ServiceVan) => {
    setConfirmation({
      title: `Delete ${van.name}?`,
      description: `This removes ${van.name} and its tracked stock records. Use this only when the vehicle has been decommissioned or migrated.`,
      confirmLabel: 'Delete Van',
      processingLabel: 'Deleting...',
      variant: 'danger',
      errorMessage: 'Failed to delete van',
      action: async () => {
        await vanStockAPI.deleteVan(van.id);
        setSuccess('Van deleted successfully');
        await loadData();
        if (selectedVan?.id === van.id) {
          setSelectedVan(null);
          setVanStock([]);
        }
      }
    });
  };

  const handleUpdateStatus = async (vanId: string, status: ServiceVan['status']) => {
    try {
      await vanStockAPI.updateVan(vanId, { status });
      setSuccess('Van status updated');
      loadData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update status'));
    }
  };

  const getStatusColor = (status: ServiceVan['status']) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-700';
      case 'in_use': return 'bg-blue-100 text-blue-700';
      case 'maintenance': return 'bg-yellow-100 text-yellow-700';
      case 'out_of_service': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority: RestockRequest['priority']) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700';
      case 'high': return 'bg-orange-100 text-orange-700';
      case 'normal': return 'bg-blue-100 text-blue-700';
      case 'low': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getRequestStatusColor = (status: RestockRequest['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'approved': return 'bg-blue-100 text-blue-700';
      case 'processing': return 'bg-purple-100 text-purple-700';
      case 'ready': return 'bg-green-100 text-green-700';
      case 'completed': return 'bg-gray-100 text-gray-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getMovementTypeColor = (type: VanStockMovement['movementType']) => {
    switch (type) {
      case 'restock': return 'bg-green-100 text-green-700';
      case 'return': return 'bg-blue-100 text-blue-700';
      case 'job_usage': return 'bg-purple-100 text-purple-700';
      case 'transfer_in': return 'bg-cyan-100 text-cyan-700';
      case 'transfer_out': return 'bg-orange-100 text-orange-700';
      case 'adjustment': return 'bg-yellow-100 text-yellow-700';
      case 'damaged': return 'bg-red-100 text-red-700';
      case 'lost': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const updateRestockRequestStatus = async (
    request: RestockRequest,
    status: RestockRequest['status']
  ) => {
    await vanStockAPI.updateRestockRequestStatus(request.id, status);
    setSuccess(
      status === 'approved'
        ? `Restock request for ${request.vanName} approved`
        : `Restock request for ${request.vanName} rejected`
    );
    await loadData();
  };

  const handleApproveRestockRequest = async (request: RestockRequest) => {
    try {
      await updateRestockRequestStatus(request, 'approved');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to approve restock request'));
    }
  };

  const requestRejectRestockRequest = (request: RestockRequest) => {
    setConfirmation({
      title: `Reject request for ${request.vanName}?`,
      description: `This will cancel the pending restock request from ${request.requestedByName}. The technician will need to submit a new request if stock is still required.`,
      confirmLabel: 'Reject Request',
      processingLabel: 'Rejecting...',
      variant: 'danger',
      errorMessage: 'Failed to reject restock request',
      action: () => updateRestockRequestStatus(request, 'cancelled')
    });
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  // Filter vans by search term
  const filteredVans = vans.filter(van =>
    van.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    van.registration?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    van.assignedToName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-700 flex-1">{success}</p>
          <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Van Stock Management</h1>
          <p className="text-slate-600 mt-1">Track and manage inventory across service vehicles</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {activeTab === 'vans' && (
            <button
              onClick={() => setShowCreateVanModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Van
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { id: 'vans', label: 'Vans', icon: Truck, count: vans.length },
          { id: 'low-stock', label: 'Low Stock', icon: AlertTriangle, count: lowStockItems.length },
          { id: 'restock', label: 'Restock Requests', icon: Package, count: restockRequests.filter(r => r.status === 'pending').length },
          { id: 'movements', label: 'History', icon: History },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ActiveTab)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
                tab.id === 'low-stock' ? 'bg-yellow-100 text-yellow-700' :
                tab.id === 'restock' ? 'bg-red-100 text-red-700' :
                'bg-gray-200 text-gray-700'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-3 text-gray-600">Loading...</span>
        </div>
      )}

      {/* Vans Tab */}
      {!loading && activeTab === 'vans' && (
        <div className="flex gap-6">
          {/* Vans List */}
          <div className={`${selectedVan ? 'w-1/2' : 'w-full'} space-y-4`}>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search vans..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Van Cards */}
            <div className="grid grid-cols-1 gap-4">
              {filteredVans.map((van) => (
                <div
                  key={van.id}
                  onClick={() => loadVanDetails(van)}
                  className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedVan?.id === van.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Truck className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{van.name}</h3>
                        {van.registration && (
                          <p className="text-sm text-gray-500">{van.registration}</p>
                        )}
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(van.status)}`}>
                      {van.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Assigned To</p>
                      <p className="font-medium text-gray-900">
                        {van.assignedToName || 'Unassigned'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Items</p>
                      <p className="font-medium text-gray-900">{van.totalItems || 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Low Stock</p>
                      <p className={`font-medium ${(van.lowStockItems || 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {van.lowStockItems || 0}
                      </p>
                    </div>
                  </div>

                  {van.lastLocationUpdate && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                      <MapPin className="w-3 h-3" />
                      Last seen {new Date(van.lastLocationUpdate).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}

              {filteredVans.length === 0 && (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <Truck className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">No vans found</p>
                  <button
                    onClick={() => setShowCreateVanModal(true)}
                    className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Add your first van
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Van Details Panel */}
          {selectedVan && (
            <div className="w-1/2 bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">{selectedVan.name}</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => requestDeleteVan(selectedVan)}
                      className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50"
                      title="Delete van"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedVan(null);
                        setVanStock([]);
                      }}
                      className="text-gray-400 hover:text-gray-600 p-2"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Van Info */}
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  {selectedVan.registration && (
                    <div>
                      <p className="text-gray-500">Registration</p>
                      <p className="font-medium">{selectedVan.registration}</p>
                    </div>
                  )}
                  {selectedVan.make && (
                    <div>
                      <p className="text-gray-500">Make/Model</p>
                      <p className="font-medium">{selectedVan.make} {selectedVan.model}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-500">Status</p>
                    <select
                      value={selectedVan.status}
                      onChange={(e) => handleUpdateStatus(selectedVan.id, e.target.value as ServiceVan['status'])}
                      className={`mt-1 px-2 py-1 rounded text-xs font-medium border-0 ${getStatusColor(selectedVan.status)}`}
                    >
                      <option value="available">Available</option>
                      <option value="in_use">In Use</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="out_of_service">Out of Service</option>
                    </select>
                  </div>
                  <div>
                    <p className="text-gray-500">Assigned To</p>
                    <p className="font-medium">{selectedVan.assignedToName || 'Unassigned'}</p>
                  </div>
                </div>
              </div>

              {/* Stock List */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Current Stock ({vanStock.length} items)</h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {vanStock.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg border ${
                        item.quantity <= item.minQuantity
                          ? 'border-red-200 bg-red-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{item.itemName}</p>
                          <p className="text-xs text-gray-500">{item.sku} • {item.category}</p>
                          {item.binLocation && (
                            <p className="text-xs text-gray-400">📍 {item.binLocation}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${
                            item.quantity <= item.minQuantity ? 'text-red-600' : 'text-gray-900'
                          }`}>
                            {item.quantity}
                          </p>
                          <p className="text-xs text-gray-500">
                            Min: {item.minQuantity}
                            {item.maxQuantity && ` • Max: ${item.maxQuantity}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {vanStock.length === 0 && (
                    <div className="text-center py-8">
                      <Package className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                      <p className="text-gray-500 text-sm">No stock in this van</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Low Stock Tab */}
      {!loading && activeTab === 'low-stock' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Low Stock Alerts</h2>
            <p className="text-sm text-gray-500 mt-1">Items below minimum quantity across all vans</p>
          </div>
          {lowStockItems.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {lowStockItems.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{item.itemName}</p>
                      <p className="text-sm text-gray-500">{item.sku} • {item.category}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        <Truck className="w-3 h-3 inline mr-1" />
                        {item.vanName}
                        {item.assignedToName && ` • ${item.assignedToName}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-red-600">{item.quantity}</p>
                    <p className="text-xs text-gray-500">Min: {item.minQuantity}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <CheckCircle className="w-12 h-12 mx-auto text-green-300 mb-3" />
              <p className="text-gray-500">All vans are fully stocked</p>
            </div>
          )}
        </div>
      )}

      {/* Restock Requests Tab */}
      {!loading && activeTab === 'restock' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Restock Requests</h2>
            <p className="text-sm text-gray-500 mt-1">Pending and recent restock requests from technicians</p>
          </div>
          {restockRequests.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {restockRequests.map((request) => (
                <div key={request.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{request.vanName}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRequestStatusColor(request.status)}`}>
                          {request.status}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(request.priority)}`}>
                          {request.priority}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Requested by {request.requestedByName} • {new Date(request.requestedAt).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600 mt-2">
                        {request.itemCount} items • {request.totalItems} units total
                      </p>
                      {request.pickupLocation && (
                        <p className="text-xs text-gray-400 mt-1">
                          <MapPin className="w-3 h-3 inline mr-1" />
                          Pickup: {request.pickupLocation}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50">
                        <Eye className="w-4 h-4" />
                      </button>
                      {request.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApproveRestockRequest(request)}
                            className="px-3 py-1 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => requestRejectRestockRequest(request)}
                            className="px-3 py-1 text-sm font-medium text-red-600 bg-red-50 rounded hover:bg-red-100"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No restock requests</p>
            </div>
          )}
        </div>
      )}

      {/* Movements Tab */}
      {!loading && activeTab === 'movements' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Stock Movement History</h2>
            <p className="text-sm text-gray-500 mt-1">Recent stock movements across all vans</p>
          </div>
          {movements.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {movements.map((movement) => (
                <div key={movement.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${getMovementTypeColor(movement.movementType)}`}>
                      {movement.movementType.replace('_', ' ')}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">{movement.itemName}</p>
                      <p className="text-sm text-gray-500">{movement.vanName}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {movement.performedByName} • {new Date(movement.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${
                      movement.quantityAfter > movement.quantityBefore ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {movement.quantityAfter > movement.quantityBefore ? '+' : ''}{movement.quantity}
                    </p>
                    <p className="text-xs text-gray-500">
                      {movement.quantityBefore} → {movement.quantityAfter}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <History className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No movement history</p>
            </div>
          )}
        </div>
      )}

      {/* Create Van Modal */}
      {showCreateVanModal && (
        <CreateVanModal
          onClose={() => setShowCreateVanModal(false)}
          onSuccess={() => {
            setShowCreateVanModal(false);
            setSuccess('Van created successfully');
            loadData();
          }}
          onError={(msg) => setError(msg)}
        />
      )}

      <ConfirmationModal
        isOpen={confirmation !== null}
        title={confirmation?.title || ''}
        description={confirmation?.description || ''}
        confirmLabel={confirmation?.confirmLabel || 'Confirm'}
        processingLabel={confirmation?.processingLabel}
        variant={confirmation?.variant}
        isProcessing={isConfirmingAction}
        onConfirm={handleConfirmedAction}
        onClose={closeConfirmation}
      />
    </div>
  );
}

// Create Van Modal
function CreateVanModal({
  onClose,
  onSuccess,
  onError
}: {
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [registration, setRegistration] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await vanStockAPI.createVan({
        name,
        registration: registration || undefined,
        make: make || undefined,
        model: model || undefined,
        year: year ? parseInt(year) : undefined,
        color: color || undefined,
        notes: notes || undefined
      });
      onSuccess();
    } catch (err) {
      onError(getErrorMessage(err, 'Failed to create van'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Add Service Van</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Van Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Van 1, Service Truck A, etc."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Registration</label>
              <input
                type="text"
                value={registration}
                onChange={(e) => setRegistration(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="ABC 123"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="White"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
              <input
                type="text"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Ford"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Transit"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="2023"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Any additional notes..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Add Van'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
