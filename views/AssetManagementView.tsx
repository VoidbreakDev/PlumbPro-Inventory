/**
 * Asset Management View
 * Comprehensive management of vehicles, tools, equipment, and maintenance
 */

import React, { useState, useEffect } from 'react';
import {
  Truck,
  Wrench,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Plus,
  Search,
  Filter,
  MoreVertical,
  MapPin,
  Clock,
  FileText,
  Settings,
  TrendingUp,
  Users,
  Tag,
  Edit2,
  Trash2,
  X,
  Save,
  ChevronRight,
  Phone,
  Navigation,
  History,
  Gauge,
  Shield,
  ClipboardList,
} from 'lucide-react';
import { assetAPI } from '../lib/assetAPI';
import { useStore } from '../store/useStore';
import { getErrorMessage } from '../lib/errors';
import type { Asset, MaintenanceRecord, AssetType, AssetStatus, AssetCondition } from '../types';
import { Badge } from '../components/Shared';

type TabType = 'all' | 'vehicles' | 'tools' | 'equipment' | 'maintenance';

const ASSET_TYPE_CONFIG: Record<AssetType, { icon: any; color: string; label: string }> = {
  vehicle: { icon: Truck, color: 'bg-blue-500', label: 'Vehicle' },
  tool: { icon: Wrench, color: 'bg-amber-500', label: 'Tool' },
  equipment: { icon: Settings, color: 'bg-purple-500', label: 'Equipment' },
  machinery: { icon: Gauge, color: 'bg-red-500', label: 'Machinery' },
};

const STATUS_COLORS: Record<AssetStatus, string> = {
  active: 'bg-green-100 text-green-800',
  maintenance: 'bg-amber-100 text-amber-800',
  retired: 'bg-gray-100 text-gray-800',
  lost: 'bg-red-100 text-red-800',
  stolen: 'bg-red-100 text-red-800',
};

const CONDITION_COLORS: Record<AssetCondition, string> = {
  excellent: 'bg-green-100 text-green-800',
  good: 'bg-blue-100 text-blue-800',
  fair: 'bg-yellow-100 text-yellow-800',
  poor: 'bg-orange-100 text-orange-800',
  unusable: 'bg-red-100 text-red-800',
};

// Mock data for development
const MOCK_ASSETS: Asset[] = [
  {
    id: '1',
    name: 'Service Van 1',
    assetType: 'vehicle',
    assetCode: 'VAN-001',
    serialNumber: '1HGCM82633A123456',
    model: 'Toyota Hiace',
    manufacturer: 'Toyota',
    year: 2022,
    registrationNumber: 'ABC-123',
    vin: 'JT3HP10VXW7090123',
    fuelType: 'Diesel',
    currentOdometer: 45230,
    nextServiceOdometer: 50000,
    status: 'active',
    condition: 'good',
    assignedToName: 'John Smith',
    purchaseDate: '2022-03-15',
    purchasePrice: 45000,
    insuranceProvider: 'Allianz',
    insuranceExpiry: '2026-03-15',
    maintenanceSchedule: {
      frequencyMonths: 6,
      frequencyKilometers: 10000,
      lastMaintenanceDate: '2025-08-10',
      nextMaintenanceDate: '2026-02-10',
    },
    photos: [],
    tags: ['service', 'primary'],
    createdAt: '2022-03-15T00:00:00Z',
    updatedAt: '2025-08-10T00:00:00Z',
  },
  {
    id: '2',
    name: 'Drain Cleaning Machine',
    assetType: 'equipment',
    assetCode: 'EQUIP-015',
    model: 'RIDGID K-5208',
    manufacturer: 'RIDGID',
    year: 2023,
    status: 'active',
    condition: 'excellent',
    assignedToName: 'Mike Johnson',
    purchaseDate: '2023-06-20',
    purchasePrice: 8500,
    maintenanceSchedule: {
      frequencyMonths: 12,
      lastMaintenanceDate: '2025-06-20',
      nextMaintenanceDate: '2026-06-20',
    },
    photos: [],
    tags: ['drainage', 'specialized'],
    createdAt: '2023-06-20T00:00:00Z',
    updatedAt: '2025-06-20T00:00:00Z',
  },
  {
    id: '3',
    name: 'Core Drill Set',
    assetType: 'tool',
    assetCode: 'TOOL-042',
    model: 'Makita DBM131',
    manufacturer: 'Makita',
    status: 'maintenance',
    condition: 'fair',
    purchaseDate: '2024-01-10',
    purchasePrice: 1200,
    maintenanceSchedule: {
      lastTestTagDate: '2024-06-15',
      nextTestTagDate: '2024-12-15',
    },
    photos: [],
    tags: ['concrete', 'drilling'],
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: '2024-11-01T00:00:00Z',
  },
  {
    id: '4',
    name: 'Excavator 3T',
    assetType: 'machinery',
    assetCode: 'MACH-003',
    model: 'Kubota U35-4',
    manufacturer: 'Kubota',
    year: 2021,
    status: 'active',
    condition: 'good',
    purchaseDate: '2021-09-01',
    purchasePrice: 65000,
    insuranceProvider: 'CGU Insurance',
    insuranceExpiry: '2025-09-01',
    maintenanceSchedule: {
      frequencyMonths: 3,
      lastMaintenanceDate: '2025-11-01',
      nextMaintenanceDate: '2026-02-01',
    },
    photos: [],
    tags: ['excavation', 'earthworks'],
    createdAt: '2021-09-01T00:00:00Z',
    updatedAt: '2025-11-01T00:00:00Z',
  },
];

const MOCK_MAINTENANCE: MaintenanceRecord[] = [
  {
    id: '1',
    assetId: '1',
    assetName: 'Service Van 1',
    maintenanceType: 'routine',
    status: 'completed',
    scheduledDate: '2025-08-10',
    completedDate: '2025-08-10',
    description: 'Regular 50,000km service',
    workPerformed: 'Oil change, filter replacement, brake inspection, tire rotation',
    cost: 450,
    performedByName: 'Toyota Service Center',
    odometerReading: 45230,
    createdAt: '2025-08-01T00:00:00Z',
    updatedAt: '2025-08-10T00:00:00Z',
  },
  {
    id: '2',
    assetId: '3',
    assetName: 'Core Drill Set',
    maintenanceType: 'test_tag',
    status: 'scheduled',
    scheduledDate: '2024-12-15',
    description: 'Annual electrical test and tag',
    createdAt: '2024-11-01T00:00:00Z',
    updatedAt: '2024-11-01T00:00:00Z',
  },
  {
    id: '3',
    assetId: '4',
    assetName: 'Excavator 3T',
    maintenanceType: 'repair',
    status: 'in_progress',
    scheduledDate: '2025-12-20',
    description: 'Hydraulic leak repair',
    workPerformed: 'Replacing hydraulic hose and checking system pressure',
    createdAt: '2025-12-15T00:00:00Z',
    updatedAt: '2025-12-18T00:00:00Z',
  },
];

export function AssetManagementView() {
  const setError = useStore((state) => state.setError);
  const user = useStore((state) => state.user);
  
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [assets, setAssets] = useState<Asset[]>(MOCK_ASSETS);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>(MOCK_MAINTENANCE);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Stats
  const stats = {
    total: assets.length,
    vehicles: assets.filter(a => a.assetType === 'vehicle').length,
    tools: assets.filter(a => a.assetType === 'tool').length,
    equipment: assets.filter(a => a.assetType === 'equipment').length,
    machinery: assets.filter(a => a.assetType === 'machinery').length,
    inMaintenance: assets.filter(a => a.status === 'maintenance').length,
    overdueMaintenance: maintenanceRecords.filter(m => 
      m.status === 'scheduled' && new Date(m.scheduledDate) < new Date()
    ).length,
  };

  // Filtered assets
  const filteredAssets = assets.filter(asset => {
    if (activeTab !== 'all' && activeTab !== 'maintenance') {
      const typeMap: Record<string, AssetType> = {
        vehicles: 'vehicle',
        tools: 'tool',
        equipment: 'equipment',
      };
      if (asset.assetType !== typeMap[activeTab]) return false;
    }
    
    if (searchQuery && !asset.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !asset.assetCode.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    return true;
  });

  const handleCheckInOut = async (asset: Asset) => {
    try {
      const position = await assetAPI.getCurrentPosition();
      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date().toISOString(),
      };
      
      // In real implementation, this would check if already checked out
      alert(`GPS Location captured:\nLat: ${location.latitude.toFixed(6)}\nLng: ${location.longitude.toFixed(6)}\n\nAsset ${asset.assetCode} checked in/out successfully!`);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to get GPS location'));
    }
  };

  const getMaintenanceStatus = (asset: Asset) => {
    if (!asset.maintenanceSchedule?.nextMaintenanceDate) return null;
    const nextDate = new Date(asset.maintenanceSchedule.nextMaintenanceDate);
    const today = new Date();
    const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) return { status: 'overdue', days: Math.abs(daysUntil) };
    if (daysUntil <= 14) return { status: 'due_soon', days: daysUntil };
    return { status: 'ok', days: daysUntil };
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Vehicles</p>
              <p className="text-2xl font-bold text-slate-800">{stats.vehicles}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Wrench className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Tools</p>
              <p className="text-2xl font-bold text-slate-800">{stats.tools}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">In Maintenance</p>
              <p className="text-2xl font-bold text-slate-800">{stats.inMaintenance}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Overdue</p>
              <p className="text-2xl font-bold text-slate-800">{stats.overdueMaintenance}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl border border-slate-200">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 rounded-lg p-1">
                {(['all', 'vehicles', 'tools', 'equipment', 'maintenance'] as TabType[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
                      activeTab === tab ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search assets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => setShowAssetModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Asset
              </button>
            </div>
          </div>
        </div>

        {/* Assets Grid/List */}
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map(asset => {
            const TypeIcon = ASSET_TYPE_CONFIG[asset.assetType].icon;
            const maintStatus = getMaintenanceStatus(asset);
            
            return (
              <div
                key={asset.id}
                className="bg-slate-50 rounded-xl p-4 border border-slate-200 hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${ASSET_TYPE_CONFIG[asset.assetType].color} rounded-lg flex items-center justify-center`}>
                      <TypeIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">{asset.name}</h3>
                      <p className="text-sm text-slate-500">{asset.assetCode}</p>
                    </div>
                  </div>
                  <Badge variant={asset.status === 'active' ? 'green' : asset.status === 'maintenance' ? 'yellow' : 'gray'}>
                    {asset.status}
                  </Badge>
                </div>

                {/* Details */}
                <div className="space-y-2 mb-4">
                  {asset.manufacturer && (
                    <p className="text-sm text-slate-600">
                      {asset.manufacturer} {asset.model} {asset.year && `(${asset.year})`}
                    </p>
                  )}
                  {asset.assignedToName && (
                    <div className="flex items-center gap-1 text-sm text-slate-500">
                      <Users className="w-3 h-3" />
                      Assigned: {asset.assignedToName}
                    </div>
                  )}
                  {asset.currentOdometer !== undefined && (
                    <div className="flex items-center gap-1 text-sm text-slate-500">
                      <Gauge className="w-3 h-3" />
                      {asset.currentOdometer.toLocaleString()} km
                    </div>
                  )}
                </div>

                {/* Maintenance Alert */}
                {maintStatus && maintStatus.status !== 'ok' && (
                  <div className={`rounded-lg p-2 mb-3 flex items-center gap-2 text-sm ${
                    maintStatus.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    <AlertTriangle className="w-4 h-4" />
                    {maintStatus.status === 'overdue' 
                      ? `Maintenance overdue by ${maintStatus.days} days`
                      : `Maintenance due in ${maintStatus.days} days`
                    }
                  </div>
                )}

                {/* Insurance Alert */}
                {asset.insuranceExpiry && new Date(asset.insuranceExpiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                  <div className="bg-amber-50 text-amber-700 rounded-lg p-2 mb-3 flex items-center gap-2 text-sm">
                    <Shield className="w-4 h-4" />
                    Insurance expires {new Date(asset.insuranceExpiry).toLocaleDateString()}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCheckInOut(asset)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                  >
                    <MapPin className="w-4 h-4" />
                    GPS Check In/Out
                  </button>
                  <button
                    onClick={() => {
                      setSelectedAsset(asset);
                      setShowMaintenanceModal(true);
                    }}
                    className="p-2 border border-slate-200 rounded-lg hover:bg-slate-100"
                    title="Maintenance History"
                  >
                    <History className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
              </div>
            );
          })}
          
          {filteredAssets.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400">
              <Truck className="w-12 h-12 mx-auto mb-3" />
              <p>No assets found</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Tips */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <Navigation className="w-5 h-5 text-blue-600 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-blue-900">GPS Check-in/out</p>
          <p className="text-blue-700 mt-1">
            Use the GPS Check In/Out button to record when vehicles or equipment leave/return. 
            This helps track asset location and usage automatically.
          </p>
        </div>
      </div>
    </div>
  );
}

export default AssetManagementView;
