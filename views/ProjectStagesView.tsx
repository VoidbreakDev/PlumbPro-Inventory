import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Home,
  Layers,
  Package,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Users,
  Wrench,
  XCircle
} from 'lucide-react';
import type {
  AllocatedItem,
  CreateDevelopmentProjectInput,
  DevelopmentHouseProfile,
  DevelopmentProject,
  DevelopmentStage,
  DevelopmentStageStatus,
  DevelopmentStageType
} from '../types';
import {
  buildManualItemAdjustments,
  buildStageStockPlan,
  DEFAULT_DEVELOPMENT_HOUSE_PROFILE,
  DEVELOPMENT_STAGE_LIBRARY,
  DEVELOPMENT_STAGE_STATUS_LABELS
} from '../lib/projectStages';
import { useStore } from '../store/useStore';
import { Badge } from '../components/Shared';
import { useToast } from '../components/ToastNotification';
import { ConfirmationModal } from '../components/ConfirmationModal';

type ProjectFormState = Omit<CreateDevelopmentProjectInput, 'skippedStageTypes'> & {
  skippedStageTypes: DevelopmentStageType[];
};

type StageDraft = {
  status: DevelopmentStageStatus;
  plannedDate: string;
  assignedWorkerIds: string[];
  baseKitId: string;
  variationId: string;
  notes: string;
  resolvedAllocatedItems: AllocatedItem[];
  manualItemAdjustments: DevelopmentStage['manualItemAdjustments'];
  hasManualResolvedItems: boolean;
};

const STATUS_BADGES: Record<DevelopmentStageStatus, 'blue' | 'yellow' | 'green' | 'red' | 'slate'> = {
  pending: 'slate',
  scheduled: 'blue',
  in_progress: 'yellow',
  completed: 'green',
  skipped: 'slate',
  blocked: 'red'
};

const createProjectForm = (): ProjectFormState => ({
  title: '',
  builder: '',
  customerId: '',
  siteAddress: '',
  targetStartDate: '',
  targetCompletionDate: '',
  notes: '',
  houseProfile: { ...DEFAULT_DEVELOPMENT_HOUSE_PROFILE },
  skippedStageTypes: []
});

const createStageDraft = (stage: DevelopmentStage): StageDraft => ({
  status: stage.status,
  plannedDate: stage.plannedDate || '',
  assignedWorkerIds: [...stage.assignedWorkerIds],
  baseKitId: stage.baseKitId || '',
  variationId: stage.variationId || '',
  notes: stage.notes || '',
  resolvedAllocatedItems: stage.resolvedAllocatedItems.map((item) => ({ ...item })),
  manualItemAdjustments: stage.manualItemAdjustments || [],
  hasManualResolvedItems: false
});

const getProjectSummary = (project: DevelopmentProject) => {
  const completedStages = project.stages.filter((stage) => stage.status === 'completed').length;
  const activeStages = project.stages.filter((stage) =>
    ['scheduled', 'in_progress'].includes(stage.status)
  ).length;

  return { completedStages, activeStages };
};

export function ProjectStagesView() {
  const toast = useToast();
  const developmentProjects = useStore((state) => state.developmentProjects);
  const contacts = useStore((state) => state.contacts);
  const kits = useStore((state) => state.kits);
  const fetchDevelopmentProjects = useStore((state) => state.fetchDevelopmentProjects);
  const createDevelopmentProject = useStore((state) => state.createDevelopmentProject);
  const updateDevelopmentProject = useStore((state) => state.updateDevelopmentProject);
  const updateDevelopmentStage = useStore((state) => state.updateDevelopmentStage);
  const deleteDevelopmentProject = useStore((state) => state.deleteDevelopmentProject);

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(createProjectForm);
  const [stageDrafts, setStageDrafts] = useState<Record<string, StageDraft>>({});
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const plumbers = useMemo(
    () => contacts.filter((contact) => contact.type === 'Plumber'),
    [contacts]
  );

  const customers = useMemo(
    () => contacts.filter((contact) => contact.type === 'Customer'),
    [contacts]
  );

  const filteredProjects = useMemo(() => {
    const lowerSearch = searchTerm.trim().toLowerCase();
    if (!lowerSearch) {
      return developmentProjects;
    }

    return developmentProjects.filter((project) =>
      [project.title, project.builder, project.siteAddress]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(lowerSearch))
    );
  }, [developmentProjects, searchTerm]);

  const selectedProject = useMemo(
    () => developmentProjects.find((project) => project.id === selectedProjectId) || null,
    [developmentProjects, selectedProjectId]
  );

  useEffect(() => {
    const loadProjects = async () => {
      setIsLoading(true);
      try {
        await fetchDevelopmentProjects();
      } catch {
        // Store handles global error state.
      } finally {
        setIsLoading(false);
      }
    };

    void loadProjects();
  }, [fetchDevelopmentProjects]);

  useEffect(() => {
    if (!selectedProjectId && developmentProjects.length > 0) {
      setSelectedProjectId(developmentProjects[0].id);
    }
  }, [developmentProjects, selectedProjectId]);

  useEffect(() => {
    if (!selectedProject) {
      return;
    }

    setProjectForm({
      title: selectedProject.title,
      builder: selectedProject.builder || '',
      customerId: selectedProject.customerId || '',
      siteAddress: selectedProject.siteAddress || '',
      targetStartDate: selectedProject.targetStartDate || '',
      targetCompletionDate: selectedProject.targetCompletionDate || '',
      notes: selectedProject.notes || '',
      houseProfile: { ...selectedProject.houseProfile },
      skippedStageTypes: selectedProject.stages
        .filter((stage) => stage.status === 'skipped')
        .map((stage) => stage.stageType)
    });

    setStageDrafts(
      selectedProject.stages.reduce<Record<string, StageDraft>>((drafts, stage) => {
        drafts[stage.id] = createStageDraft(stage);
        return drafts;
      }, {})
    );
  }, [selectedProject]);

  useEffect(() => {
    const handleOpenProject = (event: Event) => {
      const customEvent = event as CustomEvent<{ projectId?: string }>;
      if (customEvent.detail?.projectId) {
        setSelectedProjectId(customEvent.detail.projectId);
      }
    };

    window.addEventListener('open-development-project', handleOpenProject);
    return () => window.removeEventListener('open-development-project', handleOpenProject);
  }, []);

  const setHouseProfile = (updates: Partial<DevelopmentHouseProfile>) => {
    setProjectForm((current) => ({
      ...current,
      houseProfile: {
        ...current.houseProfile,
        ...updates
      }
    }));
  };

  const toggleSkippedStageType = (stageType: DevelopmentStageType) => {
    setProjectForm((current) => ({
      ...current,
      skippedStageTypes: current.skippedStageTypes.includes(stageType)
        ? current.skippedStageTypes.filter((entry) => entry !== stageType)
        : [...current.skippedStageTypes, stageType]
    }));
  };

  const updateStageDraft = (stageId: string, updates: Partial<StageDraft>) => {
    setStageDrafts((current) => ({
      ...current,
      [stageId]: {
        ...current[stageId],
        ...updates
      }
    }));
  };

  const rebuildStageDraftStock = (project: DevelopmentProject, stage: DevelopmentStage, nextDraft: StageDraft) => {
    const stockPlan = buildStageStockPlan(
      project,
      {
        ...stage,
        baseKitId: nextDraft.baseKitId || undefined,
        variationId: nextDraft.variationId || undefined,
        manualItemAdjustments: nextDraft.manualItemAdjustments || []
      },
      kits
    );

    return {
      ...nextDraft,
      resolvedAllocatedItems: stockPlan.resolvedAllocatedItems
    };
  };

  const handleKitSelection = (project: DevelopmentProject, stage: DevelopmentStage, baseKitId: string) => {
    const nextDraft = rebuildStageDraftStock(project, stage, {
      ...stageDrafts[stage.id],
      baseKitId,
      variationId: '',
      manualItemAdjustments: [],
      hasManualResolvedItems: false
    });

    updateStageDraft(stage.id, nextDraft);
  };

  const handleVariationSelection = (
    project: DevelopmentProject,
    stage: DevelopmentStage,
    variationId: string
  ) => {
    const nextDraft = rebuildStageDraftStock(project, stage, {
      ...stageDrafts[stage.id],
      variationId,
      manualItemAdjustments: [],
      hasManualResolvedItems: false
    });

    updateStageDraft(stage.id, nextDraft);
  };

  const handleResolvedItemQuantityChange = (
    stageId: string,
    itemId: string,
    quantity: number
  ) => {
    updateStageDraft(stageId, {
      resolvedAllocatedItems: (stageDrafts[stageId]?.resolvedAllocatedItems || []).map((item) =>
        item.itemId === itemId ? { ...item, quantity: Math.max(0, quantity) } : item
      ),
      hasManualResolvedItems: true
    });
  };

  const openCreateProject = () => {
    setProjectForm(createProjectForm());
    setIsCreateProjectOpen(true);
  };

  const handleCreateProject = async () => {
    if (!projectForm.title.trim()) {
      toast.warning('Project title is required');
      return;
    }

    try {
      await createDevelopmentProject({
        ...projectForm,
        title: projectForm.title.trim(),
        builder: projectForm.builder || undefined,
        customerId: projectForm.customerId || undefined,
        siteAddress: projectForm.siteAddress || undefined,
        targetStartDate: projectForm.targetStartDate || undefined,
        targetCompletionDate: projectForm.targetCompletionDate || undefined,
        notes: projectForm.notes || undefined,
        skippedStageTypes: projectForm.skippedStageTypes
      });

      const createdProject = useStore.getState().developmentProjects.at(-1);
      if (createdProject) {
        setSelectedProjectId(createdProject.id);
      }

      setIsCreateProjectOpen(false);
      setProjectForm(createProjectForm());
      toast.success('Development project created');
    } catch {
      // Store handles global error state.
    }
  };

  const recalculateProjectStagePlans = async (project: DevelopmentProject) => {
    const latestProject = useStore
      .getState()
      .developmentProjects.find((entry) => entry.id === project.id) || project;

    for (const stage of latestProject.stages) {
      if (!stage.baseKitId) {
        continue;
      }

      const stockPlan = buildStageStockPlan(latestProject, stage, kits);
      await updateDevelopmentStage(latestProject.id, stage.id, {
        status: stage.status,
        plannedDate: stage.plannedDate,
        assignedWorkerIds: stage.assignedWorkerIds,
        baseKitId: stage.baseKitId,
        baseKitName: stockPlan.baseKitName,
        variationId: stage.variationId,
        variationName: stockPlan.variationName,
        modifierSnapshot: stockPlan.modifierSnapshot,
        resolvedAllocatedItems: stockPlan.resolvedAllocatedItems,
        manualItemAdjustments: stage.manualItemAdjustments || [],
        isApplicable: stage.status !== 'skipped',
        notes: stage.notes
      });
    }
  };

  const handleSaveProject = async () => {
    if (!selectedProject) {
      return;
    }

    if (!projectForm.title.trim()) {
      toast.warning('Project title is required');
      return;
    }

    const houseProfileChanged =
      JSON.stringify(projectForm.houseProfile) !== JSON.stringify(selectedProject.houseProfile);

    try {
      await updateDevelopmentProject(selectedProject.id, {
        title: projectForm.title.trim(),
        builder: projectForm.builder || undefined,
        customerId: projectForm.customerId || undefined,
        siteAddress: projectForm.siteAddress || undefined,
        targetStartDate: projectForm.targetStartDate || undefined,
        targetCompletionDate: projectForm.targetCompletionDate || undefined,
        notes: projectForm.notes || undefined,
        houseProfile: projectForm.houseProfile
      });

      if (houseProfileChanged) {
        const updatedProject = useStore
          .getState()
          .developmentProjects.find((project) => project.id === selectedProject.id);

        if (updatedProject) {
          await recalculateProjectStagePlans(updatedProject);
        }
      }

      toast.success('Project details saved');
    } catch {
      // Store handles global error state.
    }
  };

  const handleDeleteProject = () => {
    if (!selectedProject) return;
    setConfirmModal({
      title: 'Delete Project',
      description: `Delete "${selectedProject.title}"?`,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await deleteDevelopmentProject(selectedProject.id);
          const nextProject = useStore.getState().developmentProjects[0];
          setSelectedProjectId(nextProject?.id || null);
          toast.success('Development project deleted');
        } catch {
          // Store handles global error state.
        }
      }
    });
  };

  const handleSaveStage = async (
    project: DevelopmentProject,
    stage: DevelopmentStage,
    overrides: Partial<StageDraft> = {}
  ) => {
    const currentDraft = {
      ...stageDrafts[stage.id],
      ...overrides
    };

    let manualItemAdjustments = currentDraft.manualItemAdjustments || [];
    let stockPlan = {
      baseKitName: stage.baseKitName,
      variationName: stage.variationName,
      modifierSnapshot: stage.modifierSnapshot,
      resolvedAllocatedItems: currentDraft.resolvedAllocatedItems
    };

    if (currentDraft.baseKitId) {
      const basePlan = buildStageStockPlan(
        project,
        {
          ...stage,
          baseKitId: currentDraft.baseKitId,
          variationId: currentDraft.variationId || undefined,
          manualItemAdjustments: []
        },
        kits
      );

      if (currentDraft.hasManualResolvedItems) {
        manualItemAdjustments = buildManualItemAdjustments(
          basePlan.resolvedAllocatedItems,
          currentDraft.resolvedAllocatedItems
        );
      }

      stockPlan = buildStageStockPlan(
        project,
        {
          ...stage,
          baseKitId: currentDraft.baseKitId,
          variationId: currentDraft.variationId || undefined,
          manualItemAdjustments
        },
        kits
      );
    } else {
      manualItemAdjustments = [];
      stockPlan = {
        baseKitName: undefined,
        variationName: undefined,
        modifierSnapshot: undefined,
        resolvedAllocatedItems: []
      };
    }

    try {
      await updateDevelopmentStage(project.id, stage.id, {
        status: currentDraft.status,
        plannedDate: currentDraft.plannedDate || undefined,
        assignedWorkerIds: currentDraft.assignedWorkerIds,
        baseKitId: currentDraft.baseKitId || undefined,
        baseKitName: stockPlan.baseKitName,
        variationId: currentDraft.variationId || undefined,
        variationName: stockPlan.variationName,
        modifierSnapshot: stockPlan.modifierSnapshot,
        resolvedAllocatedItems: stockPlan.resolvedAllocatedItems,
        manualItemAdjustments,
        isApplicable: currentDraft.status !== 'skipped',
        notes: currentDraft.notes || undefined
      });

      toast.success(`${stage.stageType} saved`);
    } catch {
      // Store handles global error state.
    }
  };

  const handleStageStatusAction = async (
    project: DevelopmentProject,
    stage: DevelopmentStage,
    status: DevelopmentStageStatus
  ) => {
    await handleSaveStage(project, stage, {
      ...stageDrafts[stage.id],
      status
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="space-y-5">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-800">Project Stages</h2>
              <p className="mt-1 text-sm text-slate-500">
                Track house builds and sync scheduled plumbing stages into jobs.
              </p>
            </div>
            <button
              onClick={openCreateProject}
              className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-md transition-colors hover:bg-blue-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              New
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search projects..."
                className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              Loading development projects...
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              Create your first house-development project to start tracking plumbing stages.
            </div>
          ) : (
            filteredProjects.map((project) => {
              const summary = getProjectSummary(project);
              const isSelected = project.id === selectedProjectId;

              return (
                <button
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                  className={`w-full rounded-3xl border p-5 text-left shadow-sm transition-all ${
                    isSelected
                      ? 'border-blue-200 bg-blue-50/60'
                      : 'border-slate-100 bg-white hover:border-blue-100 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-800">{project.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {project.builder || 'Builder not set'}
                      </p>
                    </div>
                    <Badge variant={project.overallStatus === 'Completed' ? 'green' : project.overallStatus === 'Active' ? 'blue' : 'slate'}>
                      {project.overallStatus}
                    </Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-600">
                    <div className="rounded-2xl bg-white/80 px-3 py-2">
                      <div className="font-bold text-slate-800">{summary.activeStages}</div>
                      <div>Active Stages</div>
                    </div>
                    <div className="rounded-2xl bg-white/80 px-3 py-2">
                      <div className="font-bold text-slate-800">{summary.completedStages}</div>
                      <div>Completed</div>
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-slate-500">
                    {project.siteAddress || 'Site address not set'}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="space-y-6">
        {!selectedProject ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
            <Home className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-xl font-black text-slate-800">Select a project</h3>
            <p className="mt-2 text-sm text-slate-500">
              Choose a development project to manage its plumbing stages, stock planning, and linked jobs.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-black text-slate-800">{selectedProject.title}</h1>
                    <Badge variant={selectedProject.overallStatus === 'Completed' ? 'green' : selectedProject.overallStatus === 'Active' ? 'blue' : 'slate'}>
                      {selectedProject.overallStatus}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {selectedProject.siteAddress || 'No site address yet'}{selectedProject.builder ? ` • ${selectedProject.builder}` : ''}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleSaveProject}
                    className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save Project
                  </button>
                  <button
                    onClick={async () => {
                      await recalculateProjectStagePlans(selectedProject);
                      toast.success('Stage stock recalculated');
                    }}
                    className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:border-blue-200 hover:text-blue-700"
                  >
                    <Layers className="mr-2 h-4 w-4" />
                    Recalculate Stock
                  </button>
                  <button
                    onClick={handleDeleteProject}
                    className="inline-flex items-center rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition-colors hover:bg-red-100"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Project Title</span>
                  <input
                    value={projectForm.title}
                    onChange={(event) => setProjectForm((current) => ({ ...current, title: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-blue-300 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Builder / Client</span>
                  <input
                    value={projectForm.builder}
                    onChange={(event) => setProjectForm((current) => ({ ...current, builder: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-blue-300 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Linked Customer</span>
                  <select
                    value={projectForm.customerId}
                    onChange={(event) => setProjectForm((current) => ({ ...current, customerId: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-blue-300 focus:outline-none"
                  >
                    <option value="">No linked customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block md:col-span-2 xl:col-span-3">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Site Address</span>
                  <input
                    value={projectForm.siteAddress}
                    onChange={(event) => setProjectForm((current) => ({ ...current, siteAddress: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-blue-300 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Target Start</span>
                  <input
                    type="date"
                    value={projectForm.targetStartDate}
                    onChange={(event) => setProjectForm((current) => ({ ...current, targetStartDate: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-blue-300 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Target Completion</span>
                  <input
                    type="date"
                    value={projectForm.targetCompletionDate}
                    onChange={(event) => setProjectForm((current) => ({ ...current, targetCompletionDate: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-blue-300 focus:outline-none"
                  />
                </label>

                <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5 md:col-span-2 xl:col-span-3">
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4 text-blue-600" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-600">House Profile</h3>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <label className="block">
                      <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Storeys</span>
                      <input
                        type="number"
                        min={1}
                        value={projectForm.houseProfile.storeys}
                        onChange={(event) => setHouseProfile({ storeys: Math.max(1, Number(event.target.value) || 1) })}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 focus:border-blue-300 focus:outline-none"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Bathrooms</span>
                      <input
                        type="number"
                        min={1}
                        value={projectForm.houseProfile.bathroomCount}
                        onChange={(event) => setHouseProfile({ bathroomCount: Math.max(1, Number(event.target.value) || 1) })}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 focus:border-blue-300 focus:outline-none"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Kitchen Config</span>
                      <select
                        value={projectForm.houseProfile.kitchenConfig}
                        onChange={(event) => setHouseProfile({ kitchenConfig: event.target.value as DevelopmentHouseProfile['kitchenConfig'] })}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 focus:border-blue-300 focus:outline-none"
                      >
                        <option value="standard">Standard</option>
                        <option value="galley">Galley</option>
                        <option value="large">Large</option>
                        <option value="custom">Custom</option>
                      </select>
                    </label>

                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={projectForm.houseProfile.hasButlersPantry}
                        onChange={(event) => setHouseProfile({ hasButlersPantry: event.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                      Butler's Pantry
                    </label>

                    <label className="block md:col-span-2 xl:col-span-1">
                      <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Custom Options</span>
                      <input
                        value={projectForm.houseProfile.customOptions.join(', ')}
                        onChange={(event) =>
                          setHouseProfile({
                            customOptions: event.target.value
                              .split(',')
                              .map((option) => option.trim())
                              .filter(Boolean)
                          })
                        }
                        placeholder="Laundry chute, outdoor kitchen"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 focus:border-blue-300 focus:outline-none"
                      />
                    </label>
                  </div>
                </div>

                <label className="block md:col-span-2 xl:col-span-3">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Project Notes</span>
                  <textarea
                    value={projectForm.notes}
                    onChange={(event) => setProjectForm((current) => ({ ...current, notes: event.target.value }))}
                    rows={3}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-blue-300 focus:outline-none"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-4">
              {selectedProject.stages.map((stage) => {
                const draft = stageDrafts[stage.id] || createStageDraft(stage);
                const selectedKit = kits.find((kit) => kit.id === draft.baseKitId);
                const summaryItems = draft.resolvedAllocatedItems.length > 0
                  ? draft.resolvedAllocatedItems
                  : stage.resolvedAllocatedItems;

                return (
                  <article
                    key={stage.id}
                    className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-black text-slate-800">{stage.stageType}</h3>
                          <Badge variant={STATUS_BADGES[stage.status]}>
                            {DEVELOPMENT_STAGE_STATUS_LABELS[stage.status]}
                          </Badge>
                          {stage.linkedJobId && (
                            <Badge variant="blue">Linked Job</Badge>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-slate-500">
                          {summaryItems.length} reserved material lines{stage.linkedJobStatus ? ` • Job ${stage.linkedJobStatus}` : ''}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleStageStatusAction(selectedProject, stage, 'scheduled')}
                          className="inline-flex items-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100"
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          Schedule
                        </button>
                        <button
                          onClick={() => handleStageStatusAction(selectedProject, stage, 'completed')}
                          className="inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Complete
                        </button>
                        <button
                          onClick={() => handleStageStatusAction(selectedProject, stage, 'skipped')}
                          className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Skip
                        </button>
                        {stage.linkedJobId && (
                          <button
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent('navigate', { detail: 'calendar' }));
                              toast.success('Opened Calendar for linked job review');
                            }}
                            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:border-blue-200 hover:text-blue-700"
                          >
                            <ClipboardList className="mr-2 h-4 w-4" />
                            Open Job Planning
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <label className="block">
                        <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Stage Status</span>
                        <select
                          value={draft.status}
                          onChange={(event) => updateStageDraft(stage.id, { status: event.target.value as DevelopmentStageStatus })}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-blue-300 focus:outline-none"
                        >
                          {Object.entries(DEVELOPMENT_STAGE_STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Planned Date</span>
                        <input
                          type="date"
                          value={draft.plannedDate}
                          onChange={(event) => updateStageDraft(stage.id, { plannedDate: event.target.value })}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-blue-300 focus:outline-none"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Base Kit / BOM</span>
                        <select
                          value={draft.baseKitId}
                          onChange={(event) => handleKitSelection(selectedProject, stage, event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-blue-300 focus:outline-none"
                        >
                          <option value="">No kit selected</option>
                          {kits.map((kit) => (
                            <option key={kit.id} value={kit.id}>
                              {kit.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Variation</span>
                        <select
                          value={draft.variationId}
                          onChange={(event) => handleVariationSelection(selectedProject, stage, event.target.value)}
                          disabled={!selectedKit || !selectedKit.variations?.length}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-blue-300 focus:outline-none disabled:opacity-60"
                        >
                          <option value="">Default</option>
                          {selectedKit?.variations?.map((variation) => (
                            <option key={variation.id} value={variation.id}>
                              {variation.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="mt-4 rounded-3xl border border-slate-100 bg-slate-50 p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-blue-600" />
                          <h4 className="text-sm font-black uppercase tracking-wider text-slate-600">Resolved Stock</h4>
                        </div>
                        {stage.modifierSnapshot?.finalMultiplier != null && (
                          <div className="text-xs font-bold text-slate-500">
                            Multiplier {stage.modifierSnapshot.finalMultiplier.toFixed(2)}x
                          </div>
                        )}
                      </div>

                      <div className="mt-4 space-y-3">
                        {summaryItems.length === 0 ? (
                          <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                            Select a kit to generate stage stock, then fine-tune quantities if needed.
                          </p>
                        ) : (
                          summaryItems.map((item) => (
                            <div
                              key={item.itemId}
                              className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between"
                            >
                              <div>
                                <p className="text-sm font-bold text-slate-800">{item.itemName || item.itemId}</p>
                                <p className="text-xs text-slate-500">{item.itemId}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Qty</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={item.quantity}
                                  onChange={(event) =>
                                    handleResolvedItemQuantityChange(
                                      stage.id,
                                      item.itemId,
                                      Number(event.target.value) || 0
                                    )
                                  }
                                  className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 focus:border-blue-300 focus:outline-none"
                                />
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="mt-4 rounded-3xl border border-slate-100 bg-slate-50 p-5">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-600" />
                        <h4 className="text-sm font-black uppercase tracking-wider text-slate-600">Assigned Crew</h4>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {plumbers.map((worker) => {
                          const isSelected = draft.assignedWorkerIds.includes(worker.id);
                          return (
                            <button
                              key={worker.id}
                              onClick={() => {
                                const nextWorkerIds = isSelected
                                  ? draft.assignedWorkerIds.filter((entry) => entry !== worker.id)
                                  : [...draft.assignedWorkerIds, worker.id];
                                updateStageDraft(stage.id, { assignedWorkerIds: nextWorkerIds });
                              }}
                              className={`rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${
                                isSelected
                                  ? 'border-blue-600 bg-blue-600 text-white'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                              }`}
                            >
                              {worker.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <label className="mt-4 block">
                      <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Stage Notes</span>
                      <textarea
                        value={draft.notes}
                        onChange={(event) => updateStageDraft(stage.id, { notes: event.target.value })}
                        rows={2}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-blue-300 focus:outline-none"
                      />
                    </label>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        onClick={() => handleSaveStage(selectedProject, stage)}
                        className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-blue-700"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save Stage
                      </button>
                      <button
                        onClick={() => updateStageDraft(stage.id, createStageDraft(stage))}
                        className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:border-slate-300"
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Reset Changes
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      {isCreateProjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-5">
              <div>
                <h2 className="text-xl font-black text-slate-800">Create Development Project</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Set the house profile, choose any stages to skip, and start planning.
                </p>
              </div>
              <button
                onClick={() => setIsCreateProjectOpen(false)}
                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 px-6 py-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Project Title</span>
                  <input
                    value={projectForm.title}
                    onChange={(event) => setProjectForm((current) => ({ ...current, title: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-blue-300 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Builder / Client</span>
                  <input
                    value={projectForm.builder}
                    onChange={(event) => setProjectForm((current) => ({ ...current, builder: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-blue-300 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Customer</span>
                  <select
                    value={projectForm.customerId}
                    onChange={(event) => setProjectForm((current) => ({ ...current, customerId: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-blue-300 focus:outline-none"
                  >
                    <option value="">No linked customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Site Address</span>
                  <input
                    value={projectForm.siteAddress}
                    onChange={(event) => setProjectForm((current) => ({ ...current, siteAddress: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-blue-300 focus:outline-none"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Storeys</span>
                  <input
                    type="number"
                    min={1}
                    value={projectForm.houseProfile.storeys}
                    onChange={(event) => setHouseProfile({ storeys: Math.max(1, Number(event.target.value) || 1) })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-blue-300 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Bathrooms</span>
                  <input
                    type="number"
                    min={1}
                    value={projectForm.houseProfile.bathroomCount}
                    onChange={(event) => setHouseProfile({ bathroomCount: Math.max(1, Number(event.target.value) || 1) })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-blue-300 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Kitchen</span>
                  <select
                    value={projectForm.houseProfile.kitchenConfig}
                    onChange={(event) => setHouseProfile({ kitchenConfig: event.target.value as DevelopmentHouseProfile['kitchenConfig'] })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-blue-300 focus:outline-none"
                  >
                    <option value="standard">Standard</option>
                    <option value="galley">Galley</option>
                    <option value="large">Large</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={projectForm.houseProfile.hasButlersPantry}
                    onChange={(event) => setHouseProfile({ hasButlersPantry: event.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  Butler's Pantry
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Custom Options</span>
                <input
                  value={projectForm.houseProfile.customOptions.join(', ')}
                  onChange={(event) =>
                    setHouseProfile({
                      customOptions: event.target.value
                        .split(',')
                        .map((option) => option.trim())
                        .filter(Boolean)
                    })
                  }
                  placeholder="Outdoor kitchen, mud room"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-blue-300 focus:outline-none"
                />
              </label>

              <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-600">Skip Non-Applicable Stages</h3>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {DEVELOPMENT_STAGE_LIBRARY.map((stageType) => {
                    const isSkipped = projectForm.skippedStageTypes.includes(stageType);

                    return (
                      <label
                        key={stageType}
                        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={isSkipped}
                          onChange={() => toggleSkippedStageType(stageType)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600"
                        />
                        {stageType}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3 border-t border-slate-100 bg-slate-50 px-6 py-5">
              <button
                onClick={() => setIsCreateProjectOpen(false)}
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                className="flex-[2] rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-blue-700"
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmationModal
        isOpen={confirmModal !== null}
        title={confirmModal?.title ?? ''}
        description={confirmModal?.description ?? ''}
        confirmLabel="Confirm"
        variant="danger"
        onConfirm={() => confirmModal?.onConfirm()}
        onClose={() => setConfirmModal(null)}
      />
    </div>
  );
}

export default ProjectStagesView;
