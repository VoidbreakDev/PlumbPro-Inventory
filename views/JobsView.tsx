
import React, { useState } from 'react';
import { 
  Plus, 
  ClipboardList, 
  CheckCircle, 
  User, 
  HardHat, 
  Truck, 
  AlertTriangle, 
  Package, 
  Calendar, 
  MapPin,
  TrendingUp,
  Settings2,
  X,
  Trash2,
  Edit2,
  Search,
  Save
} from 'lucide-react';
import { Job, Contact, InventoryItem, JobTemplate, AllocatedItem, Kit } from '../types';
import { Badge } from '../components/Shared';

interface JobsViewProps {
  jobs: Job[];
  contacts: Contact[];
  inventory: InventoryItem[];
  templates: JobTemplate[];
  kits: Kit[];
  onOpenNewJobModal: () => void;
  onConfirmPick: (jobId: string) => void;
  onOpenAllocateModal: (job: Job) => void;
  onOpenTemplateModal: (jobId: string, templateId: string) => void;
  onNavigate: (tab: any) => void;
  onAddTemplate: (name: string, items: AllocatedItem[]) => void;
  onUpdateTemplate: (id: string, name: string, items: AllocatedItem[]) => void;
  onDeleteTemplate: (id: string) => void;
}

export const JobsView: React.FC<JobsViewProps> = ({ 
  jobs, 
  contacts, 
  inventory, 
  templates,
  kits,
  onOpenNewJobModal,
  onConfirmPick,
  onOpenAllocateModal, 
  onOpenTemplateModal,
  onNavigate,
  onAddTemplate,
  onUpdateTemplate,
  onDeleteTemplate
}) => {
  const [isManageTemplatesOpen, setIsManageTemplatesOpen] = useState(false);
  const [isTemplateEditOpen, setIsTemplateEditOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<JobTemplate | null>(null);
  const [tempName, setTempName] = useState('');
  const [tempItems, setTempItems] = useState<AllocatedItem[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const activeJobs = jobs.filter((job) => !['Completed', 'Cancelled'].includes(job.status));

  const openEditTemplate = (template?: JobTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTempName(template.name);
      setTempItems([...template.items]);
    } else {
      setEditingTemplate(null);
      setTempName('');
      setTempItems([]);
    }
    setIsTemplateEditOpen(true);
  };

  const saveTemplate = () => {
    if (!tempName || tempItems.length === 0) return;
    if (editingTemplate) {
      onUpdateTemplate(editingTemplate.id, tempName, tempItems);
    } else {
      onAddTemplate(tempName, tempItems);
    }
    setIsTemplateEditOpen(false);
  };

  const addItemToTemp = (itemId: string) => {
    if (tempItems.find(i => i.itemId === itemId)) return;
    setTempItems([...tempItems, { itemId, quantity: 1 }]);
  };

  const removeItemFromTemp = (itemId: string) => {
    setTempItems(tempItems.filter(i => i.itemId !== itemId));
  };

  const updateItemQtyInTemp = (itemId: string, qty: number) => {
    setTempItems(tempItems.map(i => i.itemId === itemId ? { ...i, quantity: Math.max(1, qty) } : i));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-bold text-slate-800">Active Job Pipeline</h3>
          <button 
            onClick={onOpenNewJobModal}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold shadow-md"
          >
            <Plus className="w-4 h-4 mr-2" /> New Job
          </button>
        </div>
        {activeJobs.map(job => (
          <div key={job.id} className={`bg-white p-6 rounded-2xl shadow-sm border transition-all ${job.isPicked ? 'border-slate-100' : 'border-blue-200 bg-blue-50/10'}`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <h4 className="text-xl font-black text-slate-800">{job.title}</h4>
                  {!job.isPicked && <Badge variant="blue">Stock Reserved</Badge>}
                  {job.developmentStageType && <Badge variant="slate">{job.developmentStageType}</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-slate-500 text-sm">
                  <span className="flex items-center"><User className="w-3 h-3 mr-1" /> {job.builder || 'No Builder'}</span>
                  <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" /> {job.date}</span>
                  {(job.jobAddress || job.builder) && (
                    <span className="flex items-center">
                      <MapPin className="w-3 h-3 mr-1" /> {job.jobAddress || job.builder}
                    </span>
                  )}
                  <div className="flex items-center -space-x-2">
                    {job.assignedWorkerIds.map(workerId => (
                      <div key={workerId} title={contacts.find(c => c.id === workerId)?.name} className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600">
                        {contacts.find(c => c.id === workerId)?.name.charAt(0)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <Badge variant={job.status === 'Scheduled' ? 'blue' : job.status === 'Completed' ? 'green' : 'yellow'}>{job.status}</Badge>
            </div>
            
            <div className={`p-5 rounded-2xl mb-6 border-2 border-dashed ${job.isPicked ? 'bg-slate-50 border-slate-100' : 'bg-white border-blue-100 shadow-sm'}`}>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-2">
                   <Package className={`w-4 h-4 ${job.isPicked ? 'text-slate-400' : 'text-blue-500'}`} />
                   <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inventory List</h5>
                </div>
                {!job.isPicked && (
                  <button 
                    onClick={() => onOpenAllocateModal(job)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center transition-colors"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Parts
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {job.allocatedItems.length > 0 ? job.allocatedItems.map((ai, idx) => {
                  const invItem = inventory.find(i => i.id === ai.itemId);
                  return (
                    <div key={idx} className="flex justify-between items-center text-sm p-3 bg-white/50 border border-slate-50 rounded-xl group transition-all">
                      <div className="flex flex-col">
                        <span className="text-slate-700 font-bold">{invItem?.name}</span>
                        {invItem && !job.isPicked && invItem.quantity < ai.quantity && (
                          <span className="text-[10px] text-red-500 font-bold flex items-center mt-0.5">
                            <AlertTriangle className="w-3 h-3 mr-1" /> Insufficient Stock to Pick
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-black text-slate-900 px-3 py-1 bg-slate-100 rounded-lg text-xs">x{ai.quantity}</span>
                    </div>
                  );
                }) : (
                  <p className="text-slate-400 text-sm italic text-center py-4">No materials allocated yet.</p>
                )}
              </div>
            </div>

            <div className="flex space-x-3">
              {!job.isPicked ? (
                <button 
                  onClick={() => onConfirmPick(job.id)}
                  disabled={job.allocatedItems.length === 0}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>Confirm & Pick Stock</span>
                </button>
              ) : (
                <div className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold text-center flex items-center justify-center space-x-2 cursor-default">
                  <Truck className="w-5 h-5" />
                  <span>Stock Dispatched</span>
                </div>
              )}
              
              {!job.isPicked && (
                <select 
                  value=""
                  onChange={(e) => onOpenTemplateModal(job.id, e.target.value)}
                  className="bg-white border-2 border-slate-100 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none hover:border-blue-100 transition-all"
                >
                  <option value="">Apply Stock Plan...</option>
                  {templates.length > 0 && (
                    <optgroup label="Stock Templates">
                      {templates.map((template) => (
                        <option key={template.id} value={`template:${template.id}`}>{template.name}</option>
                      ))}
                    </optgroup>
                  )}
                  {kits.length > 0 && (
                    <optgroup label="Kits & BOMs">
                      {kits.map((kit) => (
                        <option key={kit.id} value={`kit:${kit.id}`}>{kit.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              )}
              
              <button className="px-6 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-900 text-sm font-bold transition-all shadow-md">
                View Profile
              </button>
            </div>
          </div>
        ))}
        {activeJobs.length === 0 && (
          <div className="bg-slate-100 rounded-2xl p-12 text-center border-2 border-dashed border-slate-200">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-bold">No jobs in the pipeline. Start by scheduling a new one.</p>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h4 className="font-bold text-slate-800 mb-6 flex items-center text-sm uppercase tracking-wider">
            <ClipboardList className="w-5 h-5 mr-3 text-blue-500" />
            Picking Stats
          </h4>
          <div className="space-y-4">
             <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
               <p className="text-xs font-bold text-slate-400 uppercase mb-1">Unpicked Orders</p>
               <p className="text-3xl font-black text-slate-800">{activeJobs.filter((job) => !job.isPicked).length}</p>
             </div>
             <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
               <p className="text-xs font-bold text-blue-400 uppercase mb-1">Ready to Pack</p>
               <p className="text-3xl font-black text-blue-800">{activeJobs.filter((job) => !job.isPicked && job.allocatedItems.length > 0).length}</p>
             </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-slate-800 flex items-center text-sm uppercase tracking-wider">
              <CheckCircle className="w-5 h-5 mr-3 text-green-500" />
              Stock Plans
            </h4>
            <button 
              onClick={() => setIsManageTemplatesOpen(true)}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Manage Templates"
            >
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {templates.map((template) => (
              <div key={template.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50 hover:bg-blue-50 hover:border-blue-100 transition-all group">
                <p className="font-bold text-sm text-slate-700 group-hover:text-blue-700 mb-1">{template.name}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">{template.items.length} materials</p>
                  <Badge variant="slate" className="px-2 py-0.5 text-[10px]">Template</Badge>
                </div>
              </div>
            ))}
            {kits.map((kit) => (
              <div key={kit.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50 hover:bg-blue-50 hover:border-blue-100 transition-all group">
                <p className="font-bold text-sm text-slate-700 group-hover:text-blue-700 mb-1">{kit.name}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">{kit.items.length} BOM lines</p>
                  <Badge variant="blue" className="px-2 py-0.5 text-[10px]">Kit</Badge>
                </div>
              </div>
            ))}
            <button 
              onClick={() => openEditTemplate()}
              className="w-full mt-2 py-2 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-400 hover:border-blue-200 hover:text-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center"
            >
              <Plus className="w-3 h-3 mr-1" /> Create Template
            </button>
          </div>
        </div>

        <div className="bg-indigo-600 p-8 rounded-2xl text-white shadow-xl relative overflow-hidden group">
          <div className="relative z-10">
            <h4 className="font-black text-xl mb-2">Smart Stock Control</h4>
            <p className="text-sm opacity-80 mb-6 leading-relaxed">System is tracking {activeJobs.filter((job) => !job.isPicked).length} upcoming job stock reservations.</p>
            <button 
              onClick={() => onNavigate('ordering')}
              className="w-full py-3 bg-white text-indigo-700 rounded-xl text-sm font-black hover:bg-indigo-50 transition-all shadow-lg"
            >
              Run Stock Audit
            </button>
          </div>
          <TrendingUp className="absolute -right-8 -bottom-8 w-40 h-40 opacity-10 group-hover:scale-110 transition-transform duration-500" />
        </div>
      </div>

      {/* Template Management Modal */}
      {isManageTemplatesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center space-x-3">
                <Settings2 className="w-6 h-6 text-blue-600" />
                <h3 className="text-xl font-bold text-slate-800">Manage Stock Templates</h3>
              </div>
              <button onClick={() => setIsManageTemplatesOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
              {templates.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500 font-bold">No templates found.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {templates.map(template => (
                    <div key={template.id} className="p-4 border border-slate-100 rounded-2xl bg-slate-50 flex items-center justify-between group hover:bg-white hover:shadow-md transition-all">
                      <div>
                        <h4 className="font-bold text-slate-800">{template.name}</h4>
                        <p className="text-xs text-slate-500">{template.items.length} items included</p>
                      </div>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => openEditTemplate(template)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            if (confirm(`Delete template "${template.name}"?`)) {
                              onDeleteTemplate(template.id);
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => openEditTemplate()}
                className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" /> New Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Create Template Modal */}
      {isTemplateEditOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800">{editingTemplate ? 'Edit' : 'Create'} Template</h3>
              <button onClick={() => setIsTemplateEditOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[75vh] overflow-y-auto">
              {/* Template Info & Selected Items */}
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Template Name</label>
                  <input 
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    placeholder="e.g., Standard Service Kit"
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold text-slate-800"
                  />
                </div>
                
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Included Items ({tempItems.length})</label>
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                    {tempItems.length === 0 ? (
                      <div className="p-8 border-2 border-dashed border-slate-100 rounded-2xl text-center">
                        <Package className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                        <p className="text-xs text-slate-400 font-bold">No items added yet. Search on the right.</p>
                      </div>
                    ) : tempItems.map(ti => {
                      const item = inventory.find(i => i.id === ti.itemId);
                      return (
                        <div key={ti.itemId} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                          <div className="flex-1 min-w-0 pr-3">
                            <p className="text-sm font-bold text-slate-800 truncate">{item?.name || 'Unknown'}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{item?.supplierCode}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input 
                              type="number"
                              min="1"
                              value={ti.quantity}
                              onChange={(e) => updateItemQtyInTemp(ti.itemId, parseInt(e.target.value) || 1)}
                              className="w-12 px-1 py-1 border border-slate-200 rounded text-center text-xs font-bold"
                            />
                            <button 
                              onClick={() => removeItemFromTemp(ti.itemId)}
                              className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Item Selection Sidebar */}
              <div className="space-y-4">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Add Materials</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Search materials..."
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  />
                </div>
                <div className="space-y-1 overflow-y-auto max-h-[50vh] pr-2">
                  {inventory
                    .filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase()) || i.category.toLowerCase().includes(itemSearch.toLowerCase()))
                    .map(item => {
                      const isAdded = tempItems.find(ti => ti.itemId === item.id);
                      return (
                        <button
                          key={item.id}
                          disabled={!!isAdded}
                          onClick={() => addItemToTemp(item.id)}
                          className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between border ${isAdded ? 'bg-emerald-50 border-emerald-100 opacity-60' : 'hover:bg-slate-50 border-transparent hover:border-slate-100'}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                            <p className="text-[10px] text-slate-400">{item.category}</p>
                          </div>
                          {isAdded ? (
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 ml-2" />
                          ) : (
                            <Plus className="w-4 h-4 text-slate-300 shrink-0 ml-2" />
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={() => setIsTemplateEditOpen(false)} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100">Cancel</button>
              <button 
                disabled={!tempName || tempItems.length === 0}
                onClick={saveTemplate}
                className="flex-[2] px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg disabled:opacity-50 flex items-center justify-center"
              >
                <Save className="w-5 h-5 mr-2" /> Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
