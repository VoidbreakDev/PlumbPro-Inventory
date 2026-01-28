import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  franchiseAPI,
  FranchiseNetwork,
  FranchiseLocation,
  FranchiseTerritory,
  FranchiseLead,
  FranchiseRoyalty,
  ComplianceItem,
  FranchiseAnnouncement,
  DashboardStats,
} from '../lib/franchiseAPI';

type TabType = 'dashboard' | 'locations' | 'territories' | 'leads' | 'royalties' | 'compliance' | 'announcements';

export default function FranchiseView() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [networks, setNetworks] = useState<FranchiseNetwork[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<FranchiseNetwork | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [locations, setLocations] = useState<FranchiseLocation[]>([]);
  const [territories, setTerritories] = useState<FranchiseTerritory[]>([]);
  const [leads, setLeads] = useState<FranchiseLead[]>([]);
  const [royalties, setRoyalties] = useState<FranchiseRoyalty[]>([]);
  const [announcements, setAnnouncements] = useState<FranchiseAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showTerritoryModal, setShowTerritoryModal] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<FranchiseLocation | null>(null);

  useEffect(() => {
    loadNetworks();
  }, []);

  useEffect(() => {
    if (selectedNetwork) {
      loadNetworkData();
    }
  }, [selectedNetwork, activeTab]);

  const loadNetworks = async () => {
    try {
      setLoading(true);
      const { networks: data } = await franchiseAPI.getNetworks();
      setNetworks(data);
      if (data.length > 0) {
        setSelectedNetwork(data[0]);
      }
    } catch (err) {
      setError('Failed to load franchise networks');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadNetworkData = async () => {
    if (!selectedNetwork) return;

    try {
      setLoading(true);
      switch (activeTab) {
        case 'dashboard':
          const stats = await franchiseAPI.getDashboardStats(selectedNetwork.id);
          setDashboardStats(stats);
          break;
        case 'locations':
          const { locations: locs } = await franchiseAPI.getLocations(selectedNetwork.id);
          setLocations(locs);
          break;
        case 'territories':
          const { territories: terrs } = await franchiseAPI.getTerritories(selectedNetwork.id);
          setTerritories(terrs);
          break;
        case 'leads':
          const { leads: lds } = await franchiseAPI.getLeads(selectedNetwork.id);
          setLeads(lds);
          break;
        case 'royalties':
          const { royalties: roys } = await franchiseAPI.getRoyalties(selectedNetwork.id);
          setRoyalties(roys);
          break;
        case 'announcements':
          const { announcements: anns } = await franchiseAPI.getAnnouncements(selectedNetwork.id);
          setAnnouncements(anns);
          break;
      }
    } catch (err) {
      console.error('Error loading network data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'paid':
      case 'won':
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending':
      case 'new':
      case 'assigned':
        return 'bg-yellow-100 text-yellow-800';
      case 'suspended':
      case 'overdue':
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'terminated':
      case 'lost':
      case 'expired':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
      case 'emergency':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'normal':
        return 'bg-blue-100 text-blue-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: selectedNetwork?.defaultCurrency || 'GBP',
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Tab content components
  const renderDashboard = () => {
    if (!dashboardStats) return <div className="text-center py-8">Loading dashboard...</div>;

    return (
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-500 mb-1">Active Locations</div>
            <div className="text-3xl font-bold text-blue-600">{dashboardStats.locations.activeLocations}</div>
            <div className="text-xs text-gray-400 mt-1">
              {dashboardStats.locations.pendingLocations} pending
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-500 mb-1">Monthly Revenue</div>
            <div className="text-3xl font-bold text-green-600">
              {formatCurrency(dashboardStats.locations.totalMonthlyRevenue)}
            </div>
            <div className="text-xs text-gray-400 mt-1">Network-wide</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-500 mb-1">Leads This Month</div>
            <div className="text-3xl font-bold text-purple-600">{dashboardStats.leads.totalLeads}</div>
            <div className="text-xs text-gray-400 mt-1">
              {dashboardStats.leads.wonLeads} won, {dashboardStats.leads.pendingLeads} pending
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-500 mb-1">Avg Compliance Score</div>
            <div className="text-3xl font-bold text-orange-600">
              {dashboardStats.locations.avgComplianceScore.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400 mt-1">Across all locations</div>
          </div>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Territories</h3>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-2xl font-bold">{dashboardStats.territories.totalTerritories}</div>
                <div className="text-sm text-gray-500">Total Territories</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">
                  {dashboardStats.territories.availableTerritories}
                </div>
                <div className="text-sm text-gray-500">Available</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Lead Response</h3>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-2xl font-bold">{dashboardStats.leads.avgResponseTime.toFixed(0)}</div>
                <div className="text-sm text-gray-500">Avg Minutes to Response</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">
                  {dashboardStats.leads.totalLeads > 0
                    ? ((dashboardStats.leads.wonLeads / dashboardStats.leads.totalLeads) * 100).toFixed(1)
                    : 0}%
                </div>
                <div className="text-sm text-gray-500">Conversion Rate</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Royalties</h3>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-2xl font-bold">{formatCurrency(dashboardStats.royalties.totalDue)}</div>
                <div className="text-sm text-gray-500">Total Due</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-red-600">{dashboardStats.royalties.overdueRoyalties}</div>
                <div className="text-sm text-gray-500">Overdue</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowLocationModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + Add Location
            </button>
            <button
              onClick={() => setShowTerritoryModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              + Add Territory
            </button>
            <button
              onClick={() => setShowAnnouncementModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              + New Announcement
            </button>
            <button
              onClick={() => setActiveTab('leads')}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              View Leads ({dashboardStats.leads.pendingLeads})
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderLocations = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Franchise Locations</h2>
        <button
          onClick={() => setShowLocationModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Add Location
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Territory
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Monthly Revenue
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Compliance
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {locations.map((location) => (
              <tr key={location.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{location.name}</div>
                      <div className="text-sm text-gray-500">{location.code}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {location.territoryName || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {formatCurrency(location.monthlyRevenue)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                      <div
                        className={`h-2 rounded-full ${
                          location.complianceScore >= 80
                            ? 'bg-green-500'
                            : location.complianceScore >= 60
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${location.complianceScore}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600">{location.complianceScore.toFixed(0)}%</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(location.status)}`}>
                    {location.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <button
                    onClick={() => setSelectedLocation(location)}
                    className="text-blue-600 hover:text-blue-800 mr-3"
                  >
                    View
                  </button>
                  <button className="text-gray-600 hover:text-gray-800">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {locations.length === 0 && (
          <div className="text-center py-8 text-gray-500">No locations found</div>
        )}
      </div>
    </div>
  );

  const renderTerritories = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Territories</h2>
        <button
          onClick={() => setShowTerritoryModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Add Territory
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {territories.map((territory) => (
          <div key={territory.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{territory.name}</h3>
                <div className="text-sm text-gray-500">{territory.code}</div>
              </div>
              <span
                className={`px-2 py-1 text-xs rounded-full ${
                  territory.isAvailable ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}
              >
                {territory.isAvailable ? 'Available' : 'Assigned'}
              </span>
            </div>

            {territory.description && (
              <p className="text-sm text-gray-600 mb-3">{territory.description}</p>
            )}

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Type:</span>
                <span className="font-medium capitalize">{territory.boundaryType.replace('_', ' ')}</span>
              </div>
              {territory.postalCodes && territory.postalCodes.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Postal Codes:</span>
                  <span className="font-medium">{territory.postalCodes.length}</span>
                </div>
              )}
              {territory.estimatedPopulation && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Population:</span>
                  <span className="font-medium">{territory.estimatedPopulation.toLocaleString()}</span>
                </div>
              )}
              {territory.estimatedHouseholds && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Households:</span>
                  <span className="font-medium">{territory.estimatedHouseholds.toLocaleString()}</span>
                </div>
              )}
              {territory.assignedLocationName && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Assigned To:</span>
                  <span className="font-medium text-blue-600">{territory.assignedLocationName}</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t flex justify-end space-x-2">
              <button className="text-sm text-gray-600 hover:text-gray-800">Edit</button>
              {territory.isAvailable && (
                <button className="text-sm text-blue-600 hover:text-blue-800">Assign</button>
              )}
            </div>
          </div>
        ))}
      </div>
      {territories.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No territories defined yet
        </div>
      )}
    </div>
  );

  const renderLeads = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Lead Distribution</h2>
        <button
          onClick={() => setShowLeadModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Add Lead
        </button>
      </div>

      {/* Lead Filters */}
      <div className="bg-white rounded-lg shadow p-4 flex gap-4">
        <select className="px-3 py-2 border border-gray-300 rounded-lg">
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="assigned">Assigned</option>
          <option value="contacted">Contacted</option>
          <option value="quoted">Quoted</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
        <select className="px-3 py-2 border border-gray-300 rounded-lg">
          <option value="">All Locations</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Service
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Assigned To
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Priority
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Received
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{lead.customerName}</div>
                  <div className="text-sm text-gray-500">{lead.customerPhone || lead.customerEmail}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {lead.serviceType || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {lead.city}, {lead.postalCode}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {lead.assignedLocationName || (
                    <span className="text-yellow-600">Unassigned</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(lead.urgency)}`}>
                    {lead.urgency}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(lead.status)}`}>
                    {lead.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(lead.receivedAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {!lead.assignedLocationId ? (
                    <button className="text-blue-600 hover:text-blue-800">Assign</button>
                  ) : (
                    <button className="text-gray-600 hover:text-gray-800">View</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {leads.length === 0 && (
          <div className="text-center py-8 text-gray-500">No leads found</div>
        )}
      </div>
    </div>
  );

  const renderRoyalties = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Royalty Management</h2>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            Export Report
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Calculate All
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total Due</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(royalties.reduce((sum, r) => sum + r.totalDue, 0))}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Collected</div>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(royalties.filter((r) => r.status === 'paid').reduce((sum, r) => sum + r.paidAmount!, 0))}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Pending</div>
          <div className="text-2xl font-bold text-yellow-600">
            {royalties.filter((r) => r.status === 'pending').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Overdue</div>
          <div className="text-2xl font-bold text-red-600">
            {royalties.filter((r) => r.status === 'overdue').length}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Period
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Revenue
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Royalty
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Due
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Due Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {royalties.map((royalty) => (
              <tr key={royalty.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{royalty.locationName}</div>
                  <div className="text-sm text-gray-500">{royalty.locationCode}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(royalty.periodStart)} - {formatDate(royalty.periodEnd)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatCurrency(royalty.grossRevenue)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatCurrency(royalty.royaltyAmount)}
                  <div className="text-xs text-gray-500">
                    {royalty.royaltyRate}% {royalty.royaltyType}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {formatCurrency(royalty.totalDue)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(royalty.status)}`}>
                    {royalty.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {royalty.dueDate ? formatDate(royalty.dueDate) : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {royalty.status === 'pending' && (
                    <button className="text-green-600 hover:text-green-800 mr-2">Mark Paid</button>
                  )}
                  <button className="text-gray-600 hover:text-gray-800">View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {royalties.length === 0 && (
          <div className="text-center py-8 text-gray-500">No royalty records found</div>
        )}
      </div>
    </div>
  );

  const renderCompliance = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Compliance Management</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          + Add Requirement
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500 text-center py-8">
          Select a location from the Locations tab to view and manage compliance requirements.
        </p>
      </div>
    </div>
  );

  const renderAnnouncements = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Announcements</h2>
        <button
          onClick={() => setShowAnnouncementModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + New Announcement
        </button>
      </div>

      <div className="space-y-4">
        {announcements.map((announcement) => (
          <div
            key={announcement.id}
            className={`bg-white rounded-lg shadow p-4 ${
              announcement.isPinned ? 'border-l-4 border-blue-500' : ''
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                {announcement.isPinned && (
                  <span className="text-blue-500" title="Pinned">
                    📌
                  </span>
                )}
                <h3 className="font-semibold text-gray-900">{announcement.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(announcement.priority)}`}>
                  {announcement.priority}
                </span>
                {announcement.category && (
                  <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
                    {announcement.category}
                  </span>
                )}
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-3">{announcement.content}</p>
            <div className="flex justify-between items-center text-xs text-gray-500">
              <div>
                Published: {formatDate(announcement.publishAt)}
                {announcement.expiresAt && ` • Expires: ${formatDate(announcement.expiresAt)}`}
              </div>
              <div>
                {announcement.requiresAcknowledgment && (
                  <span className="text-yellow-600">Requires acknowledgment</span>
                )}
              </div>
            </div>
          </div>
        ))}
        {announcements.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            No announcements yet
          </div>
        )}
      </div>
    </div>
  );

  // Create Network Modal
  const CreateNetworkModal = () => {
    const [formData, setFormData] = useState({
      name: '',
      code: '',
      email: '',
      phone: '',
      royaltyType: 'percentage' as const,
      royaltyPercentage: 5,
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const network = await franchiseAPI.createNetwork(formData);
        setNetworks([...networks, network]);
        setSelectedNetwork(network);
        setShowNetworkModal(false);
      } catch (err) {
        console.error('Error creating network:', err);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <h2 className="text-xl font-semibold mb-4">Create Franchise Network</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Network Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Network Code *</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="e.g., PLUMBPRO-UK"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Royalty Type</label>
                <select
                  value={formData.royaltyType}
                  onChange={(e) => setFormData({ ...formData, royaltyType: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed Amount</option>
                  <option value="tiered">Tiered</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Royalty %</label>
                <input
                  type="number"
                  value={formData.royaltyPercentage}
                  onChange={(e) => setFormData({ ...formData, royaltyPercentage: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowNetworkModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Network
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Create Location Modal
  const CreateLocationModal = () => {
    const [formData, setFormData] = useState({
      name: '',
      code: '',
      email: '',
      phone: '',
      city: '',
      postalCode: '',
      territoryId: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedNetwork) return;
      try {
        const location = await franchiseAPI.createLocation(selectedNetwork.id, {
          ...formData,
          userId: '', // Would need to select or create a user
        });
        setLocations([...locations, location]);
        setShowLocationModal(false);
      } catch (err) {
        console.error('Error creating location:', err);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <h2 className="text-xl font-semibold mb-4">Add Franchise Location</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location Code *</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="e.g., LON-001"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                <input
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign Territory</label>
              <select
                value={formData.territoryId}
                onChange={(e) => setFormData({ ...formData, territoryId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select territory...</option>
                {territories.filter((t) => t.isAvailable).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowLocationModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Location
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Create Territory Modal
  const CreateTerritoryModal = () => {
    const [formData, setFormData] = useState({
      name: '',
      code: '',
      description: '',
      boundaryType: 'postal_codes' as const,
      postalCodes: '',
      isExclusive: true,
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedNetwork) return;
      try {
        const territory = await franchiseAPI.createTerritory(selectedNetwork.id, {
          ...formData,
          postalCodes: formData.postalCodes.split(',').map((p) => p.trim()).filter(Boolean),
        });
        setTerritories([...territories, territory]);
        setShowTerritoryModal(false);
      } catch (err) {
        console.error('Error creating territory:', err);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <h2 className="text-xl font-semibold mb-4">Add Territory</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Territory Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Territory Code *</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="e.g., LONDON-NORTH"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Postal Codes</label>
              <textarea
                value={formData.postalCodes}
                onChange={(e) => setFormData({ ...formData, postalCodes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={2}
                placeholder="Enter postal codes separated by commas"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isExclusive"
                checked={formData.isExclusive}
                onChange={(e) => setFormData({ ...formData, isExclusive: e.target.checked })}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <label htmlFor="isExclusive" className="ml-2 text-sm text-gray-700">
                Exclusive territory (only one franchisee can operate)
              </label>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowTerritoryModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Territory
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Create Announcement Modal
  const CreateAnnouncementModal = () => {
    const [formData, setFormData] = useState({
      title: '',
      content: '',
      category: '',
      priority: 'normal' as const,
      isPinned: false,
      requiresAcknowledgment: false,
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedNetwork) return;
      try {
        const announcement = await franchiseAPI.createAnnouncement(selectedNetwork.id, formData);
        setAnnouncements([announcement, ...announcements]);
        setShowAnnouncementModal(false);
      } catch (err) {
        console.error('Error creating announcement:', err);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
          <h2 className="text-xl font-semibold mb-4">New Announcement</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={4}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select...</option>
                  <option value="news">News</option>
                  <option value="policy">Policy</option>
                  <option value="training">Training</option>
                  <option value="marketing">Marketing</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isPinned"
                  checked={formData.isPinned}
                  onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label htmlFor="isPinned" className="ml-2 text-sm text-gray-700">
                  Pin to top
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="requiresAck"
                  checked={formData.requiresAcknowledgment}
                  onChange={(e) => setFormData({ ...formData, requiresAcknowledgment: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label htmlFor="requiresAck" className="ml-2 text-sm text-gray-700">
                  Require acknowledgment
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowAnnouncementModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Publish
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  if (loading && networks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading franchise data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Franchise Management</h1>
          <p className="text-gray-500">Manage your franchise network, locations, and operations</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={selectedNetwork?.id || ''}
            onChange={(e) => {
              const network = networks.find((n) => n.id === e.target.value);
              setSelectedNetwork(network || null);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
          >
            {networks.map((network) => (
              <option key={network.id} value={network.id}>
                {network.name} ({network.code})
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowNetworkModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + New Network
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {[
            { key: 'dashboard', label: 'Dashboard' },
            { key: 'locations', label: 'Locations' },
            { key: 'territories', label: 'Territories' },
            { key: 'leads', label: 'Leads' },
            { key: 'royalties', label: 'Royalties' },
            { key: 'compliance', label: 'Compliance' },
            { key: 'announcements', label: 'Announcements' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'locations' && renderLocations()}
        {activeTab === 'territories' && renderTerritories()}
        {activeTab === 'leads' && renderLeads()}
        {activeTab === 'royalties' && renderRoyalties()}
        {activeTab === 'compliance' && renderCompliance()}
        {activeTab === 'announcements' && renderAnnouncements()}
      </div>

      {/* Modals */}
      {showNetworkModal && <CreateNetworkModal />}
      {showLocationModal && <CreateLocationModal />}
      {showTerritoryModal && <CreateTerritoryModal />}
      {showAnnouncementModal && <CreateAnnouncementModal />}
    </div>
  );
}
