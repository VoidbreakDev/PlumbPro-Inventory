import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Gauge,
  History,
  MapPin,
  Navigation,
  Plus,
  RotateCcw,
  Save,
  Settings,
  Shield,
  Trash2,
  Truck,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { assetAPI } from '../lib/assetAPI';
import { getErrorMessage } from '../lib/errors';
import { useStore } from '../store/useStore';
import type { Asset, AssetAllocation, AssetCondition, AssetStatus, AssetType, MaintenanceRecord } from '../types';
import { Badge } from '../components/Shared';

type TabType = 'all' | 'vehicles' | 'tools' | 'equipment' | 'maintenance';

const ASSET_TYPE_OPTIONS: AssetType[] = ['vehicle', 'tool', 'equipment', 'machinery'];
const ASSET_STATUS_OPTIONS: AssetStatus[] = ['active', 'maintenance', 'retired', 'lost', 'stolen'];
const ASSET_CONDITION_OPTIONS: AssetCondition[] = ['excellent', 'good', 'fair', 'poor', 'unusable'];

const emptyAsset = (): Partial<Asset> => ({
  name: '',
  assetCode: '',
  assetType: 'tool',
  status: 'active',
  condition: 'good',
  tags: [],
  complianceDocuments: [],
});

const emptyMaintenance = (): Partial<MaintenanceRecord> => ({
  maintenanceType: 'routine',
  scheduledDate: new Date().toISOString().slice(0, 10),
  description: '',
  status: 'scheduled',
});

export function AssetManagementView() {
  const setError = useStore((state) => state.setError);
  const user = useStore((state) => state.user);

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [allocations, setAllocations] = useState<AssetAllocation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetDraft, setAssetDraft] = useState<Partial<Asset>>(emptyAsset());
  const [maintenanceDraft, setMaintenanceDraft] = useState<Partial<MaintenanceRecord>>(emptyMaintenance());
  const [docDraft, setDocDraft] = useState({ title: '', type: 'other', expiryDate: '' });
  const [notice, setNotice] = useState<{ tone: 'success' | 'info'; text: string } | null>(null);

  const loadData = async (background = false) => {
    try {
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [assetsResponse, maintenanceResponse, allocationsResponse] = await Promise.all([
        assetAPI.getAssets({ pageSize: 200 }),
        assetAPI.getMaintenanceRecords(),
        assetAPI.getCurrentAllocations(),
      ]);

      setAssets(assetsResponse.assets);
      setMaintenanceRecords(maintenanceResponse);
      setAllocations(allocationsResponse);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load assets'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const allocationByAssetId = useMemo(() => {
    return new Map(
      allocations
        .filter((allocation) => allocation.status === 'allocated' || allocation.status === 'checked_out')
        .map((allocation) => [allocation.assetId, allocation])
    );
  }, [allocations]);

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (activeTab === 'vehicles' && asset.assetType !== 'vehicle') return false;
      if (activeTab === 'tools' && asset.assetType !== 'tool') return false;
      if (activeTab === 'equipment' && !['equipment', 'machinery'].includes(asset.assetType)) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const haystack = `${asset.name} ${asset.assetCode} ${asset.manufacturer || ''} ${asset.model || ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [activeTab, assets, searchQuery]);

  const stats = useMemo(() => ({
    vehicles: assets.filter((asset) => asset.assetType === 'vehicle').length,
    tools: assets.filter((asset) => asset.assetType === 'tool').length,
    inMaintenance: assets.filter((asset) => asset.status === 'maintenance').length,
    overdueMaintenance: maintenanceRecords.filter((record) => (
      record.status !== 'completed' && new Date(record.scheduledDate).getTime() < Date.now()
    )).length,
  }), [assets, maintenanceRecords]);

  const openCreateAsset = () => {
    setSelectedAsset(null);
    setAssetDraft(emptyAsset());
    setDocDraft({ title: '', type: 'other', expiryDate: '' });
    setShowAssetModal(true);
  };

  const openEditAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setAssetDraft({
      ...asset,
      tags: [...(asset.tags || [])],
      complianceDocuments: [...(asset.complianceDocuments || [])],
    });
    setDocDraft({ title: '', type: 'other', expiryDate: '' });
    setShowAssetModal(true);
  };

  const saveAsset = async () => {
    try {
      const payload = {
        ...assetDraft,
        tags: String(assetDraft.tags || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      };

      if (selectedAsset) {
        await assetAPI.updateAsset(selectedAsset.id, payload);

        if (docDraft.title.trim()) {
          await assetAPI.addComplianceDocument(selectedAsset.id, {
            title: docDraft.title.trim(),
            type: docDraft.type as any,
            expiryDate: docDraft.expiryDate || undefined,
            status: docDraft.expiryDate ? 'expiring' : 'valid',
          });
        }
      } else {
        await assetAPI.createAsset(payload as Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>);
      }

      setNotice({ tone: 'success', text: selectedAsset ? 'Asset updated' : 'Asset created' });
      setShowAssetModal(false);
      await loadData(true);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to save asset'));
    }
  };

  const deleteAsset = async (asset: Asset) => {
    if (!confirm(`Delete ${asset.name}?`)) return;

    try {
      await assetAPI.deleteAsset(asset.id);
      setNotice({ tone: 'info', text: `${asset.name} deleted` });
      await loadData(true);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to delete asset'));
    }
  };

  const saveMaintenance = async () => {
    if (!selectedAsset) return;

    try {
      await assetAPI.createMaintenanceRecord({
        assetId: selectedAsset.id,
        maintenanceType: maintenanceDraft.maintenanceType || 'routine',
        scheduledDate: maintenanceDraft.scheduledDate!,
        description: maintenanceDraft.description!,
        status: maintenanceDraft.status || 'scheduled',
      } as Omit<MaintenanceRecord, 'id' | 'createdAt' | 'updatedAt'>);

      setShowMaintenanceModal(false);
      setMaintenanceDraft(emptyMaintenance());
      setNotice({ tone: 'success', text: 'Maintenance scheduled' });
      await loadData(true);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to schedule maintenance'));
    }
  };

  const handleCheckInOut = async (asset: Asset) => {
    try {
      const position = await assetAPI.getCurrentPosition();
      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date().toISOString(),
      };
      const activeAllocation = allocationByAssetId.get(asset.id);

      if (activeAllocation?.status === 'checked_out') {
        await assetAPI.checkInAsset(activeAllocation.id, location, {
          condition: asset.condition,
          odometerReading: asset.currentOdometer,
        });
        setNotice({ tone: 'success', text: `${asset.name} checked in` });
      } else {
        const allocation = activeAllocation || await assetAPI.allocateAsset({
          assetId: asset.id,
          userId: user?.id,
          notes: 'Auto-allocated from Asset Management',
        });

        await assetAPI.checkOutAsset(allocation.id, location, asset.currentOdometer);
        setNotice({ tone: 'success', text: `${asset.name} checked out` });
      }

      await loadData(true);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to update asset allocation'));
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 flex items-center justify-center">
        <RotateCcw className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          notice.tone === 'success'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          {notice.text}
        </div>
      )}

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

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-4 border-b border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 rounded-lg p-1">
                {(['all', 'vehicles', 'tools', 'equipment', 'maintenance'] as TabType[]).map((tab) => (
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
              <input
                type="text"
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
              <button
                onClick={() => void loadData(true)}
                className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50"
                title="Refresh"
              >
                <RotateCcw className={`w-4 h-4 text-slate-600 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={openCreateAsset}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Asset
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {filteredAssets.length === 0 ? (
            <div className="py-12 text-center">
              <Truck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No assets found</p>
            </div>
          ) : (
            filteredAssets.map((asset) => {
              const activeAllocation = allocationByAssetId.get(asset.id);

              return (
                <div key={asset.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-slate-800">{asset.name}</h3>
                        <Badge variant="blue">{asset.assetType}</Badge>
                        <Badge variant={asset.status === 'maintenance' ? 'yellow' : asset.status === 'active' ? 'green' : 'gray'}>
                          {asset.status.replace('_', ' ')}
                        </Badge>
                        {activeAllocation && (
                          <Badge variant="purple">
                            {activeAllocation.status === 'checked_out' ? 'Checked Out' : 'Allocated'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">{asset.assetCode}</p>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                        {asset.model && <span>{asset.manufacturer ? `${asset.manufacturer} ${asset.model}` : asset.model}</span>}
                        {asset.currentOdometer !== undefined && (
                          <span className="flex items-center gap-1">
                            <Gauge className="w-4 h-4" />
                            {asset.currentOdometer.toLocaleString()} km
                          </span>
                        )}
                        {asset.assignedToName && (
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {asset.assignedToName}
                          </span>
                        )}
                        {asset.complianceDocuments?.length ? (
                          <span className="flex items-center gap-1">
                            <Shield className="w-4 h-4" />
                            {asset.complianceDocuments.length} docs
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => void handleCheckInOut(asset)}
                        className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
                      >
                        <Navigation className="w-4 h-4 text-slate-500" />
                        {activeAllocation?.status === 'checked_out' ? 'Check In' : 'Check Out'}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedAsset(asset);
                          setMaintenanceDraft(emptyMaintenance());
                          setShowMaintenanceModal(true);
                        }}
                        className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
                      >
                        <History className="w-4 h-4 text-slate-500" />
                        Maintenance
                      </button>
                      <button
                        onClick={() => openEditAsset(asset)}
                        className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void deleteAsset(asset)}
                        className="p-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showAssetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {selectedAsset ? 'Edit Asset' : 'Create Asset'}
                </h2>
                <p className="text-sm text-slate-500">Persisted to the live asset management API</p>
              </div>
              <button onClick={() => setShowAssetModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm text-slate-600">
                  Name
                  <input
                    value={assetDraft.name || ''}
                    onChange={(event) => setAssetDraft((current) => ({ ...current, name: event.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="text-sm text-slate-600">
                  Asset Code
                  <input
                    value={assetDraft.assetCode || ''}
                    onChange={(event) => setAssetDraft((current) => ({ ...current, assetCode: event.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="text-sm text-slate-600">
                  Asset Type
                  <select
                    value={assetDraft.assetType || 'tool'}
                    onChange={(event) => setAssetDraft((current) => ({ ...current, assetType: event.target.value as AssetType }))}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    {ASSET_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-600">
                  Status
                  <select
                    value={assetDraft.status || 'active'}
                    onChange={(event) => setAssetDraft((current) => ({ ...current, status: event.target.value as AssetStatus }))}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    {ASSET_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-600">
                  Condition
                  <select
                    value={assetDraft.condition || 'good'}
                    onChange={(event) => setAssetDraft((current) => ({ ...current, condition: event.target.value as AssetCondition }))}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    {ASSET_CONDITION_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-600">
                  Manufacturer
                  <input
                    value={assetDraft.manufacturer || ''}
                    onChange={(event) => setAssetDraft((current) => ({ ...current, manufacturer: event.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="text-sm text-slate-600">
                  Model
                  <input
                    value={assetDraft.model || ''}
                    onChange={(event) => setAssetDraft((current) => ({ ...current, model: event.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="text-sm text-slate-600">
                  Odometer
                  <input
                    type="number"
                    value={assetDraft.currentOdometer || ''}
                    onChange={(event) => setAssetDraft((current) => ({ ...current, currentOdometer: Number(event.target.value) || undefined }))}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="text-sm text-slate-600 md:col-span-2">
                  Tags
                  <input
                    value={Array.isArray(assetDraft.tags) ? assetDraft.tags.join(', ') : String(assetDraft.tags || '')}
                    onChange={(event) => setAssetDraft((current) => ({ ...current, tags: event.target.value as any }))}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg"
                    placeholder="vehicle, drainage, primary"
                  />
                </label>
              </div>

              {selectedAsset && (
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <h3 className="font-semibold text-slate-800">Add Compliance Document</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      value={docDraft.title}
                      onChange={(event) => setDocDraft((current) => ({ ...current, title: event.target.value }))}
                      className="px-3 py-2 border border-slate-200 rounded-lg"
                      placeholder="Document title"
                    />
                    <select
                      value={docDraft.type}
                      onChange={(event) => setDocDraft((current) => ({ ...current, type: event.target.value }))}
                      className="px-3 py-2 border border-slate-200 rounded-lg"
                    >
                      <option value="insurance">Insurance</option>
                      <option value="registration">Registration</option>
                      <option value="license">License</option>
                      <option value="certification">Certification</option>
                      <option value="warranty">Warranty</option>
                      <option value="other">Other</option>
                    </select>
                    <input
                      type="date"
                      value={docDraft.expiryDate}
                      onChange={(event) => setDocDraft((current) => ({ ...current, expiryDate: event.target.value }))}
                      className="px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowAssetModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              <button onClick={() => void saveAsset()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                <Save className="w-4 h-4" />
                Save Asset
              </button>
            </div>
          </div>
        </div>
      )}

      {showMaintenanceModal && selectedAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Schedule Maintenance</h2>
                <p className="text-sm text-slate-500">{selectedAsset.name}</p>
              </div>
              <button onClick={() => setShowMaintenanceModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <label className="text-sm text-slate-600">
                Maintenance Type
                <select
                  value={maintenanceDraft.maintenanceType || 'routine'}
                  onChange={(event) => setMaintenanceDraft((current) => ({ ...current, maintenanceType: event.target.value as any }))}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg"
                >
                  <option value="routine">Routine</option>
                  <option value="repair">Repair</option>
                  <option value="inspection">Inspection</option>
                  <option value="test_tag">Test & Tag</option>
                  <option value="compliance">Compliance</option>
                </select>
              </label>
              <label className="text-sm text-slate-600">
                Scheduled Date
                <input
                  type="date"
                  value={maintenanceDraft.scheduledDate || ''}
                  onChange={(event) => setMaintenanceDraft((current) => ({ ...current, scheduledDate: event.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </label>
              <label className="text-sm text-slate-600">
                Description
                <textarea
                  value={maintenanceDraft.description || ''}
                  onChange={(event) => setMaintenanceDraft((current) => ({ ...current, description: event.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg min-h-[120px]"
                />
              </label>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowMaintenanceModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              <button onClick={() => void saveMaintenance()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                <Save className="w-4 h-4" />
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-blue-900">GPS check-in/out is live</p>
          <p className="text-blue-700 mt-1">
            Asset check-out now records live location data and persists the allocation instead of using a browser alert.
          </p>
        </div>
      </div>
    </div>
  );
}

export default AssetManagementView;
