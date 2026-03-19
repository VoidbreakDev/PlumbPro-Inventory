import { developmentProjectsAPI } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import type { AppState, StoreGet, StoreSet } from './storeTypes';

export const createDevelopmentStoreActions = (
  set: StoreSet,
  get: StoreGet
): Pick<
  AppState,
  | 'fetchDevelopmentProjects'
  | 'createDevelopmentProject'
  | 'updateDevelopmentProject'
  | 'updateDevelopmentStage'
  | 'deleteDevelopmentProject'
> => ({
  fetchDevelopmentProjects: async () => {
    try {
      const developmentProjects = await developmentProjectsAPI.getAll();
      set({ developmentProjects });
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to load development projects');
      set({ error: message });
      throw error;
    }
  },

  createDevelopmentProject: async (project) => {
    try {
      const createdProject = await developmentProjectsAPI.create(project);
      set((state) => ({
        developmentProjects: [...state.developmentProjects, createdProject]
      }));
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to create development project');
      set({ error: message });
      throw error;
    }
  },

  updateDevelopmentProject: async (id, updates) => {
    try {
      const updatedProject = await developmentProjectsAPI.update(id, updates);
      set((state) => ({
        developmentProjects: state.developmentProjects.map((project) =>
          project.id === id ? updatedProject : project
        )
      }));
      await get().fetchJobs();
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to update development project');
      set({ error: message });
      throw error;
    }
  },

  updateDevelopmentStage: async (projectId, stageId, updates) => {
    try {
      const updatedProject = await developmentProjectsAPI.updateStage(projectId, stageId, updates);
      set((state) => ({
        developmentProjects: state.developmentProjects.map((project) =>
          project.id === projectId ? updatedProject : project
        )
      }));
      await get().fetchJobs();
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to update development stage');
      set({ error: message });
      throw error;
    }
  },

  deleteDevelopmentProject: async (id) => {
    try {
      await developmentProjectsAPI.delete(id);
      set((state) => ({
        developmentProjects: state.developmentProjects.filter((project) => project.id !== id)
      }));
      await get().fetchJobs();
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to delete development project');
      set({ error: message });
      throw error;
    }
  }
});
