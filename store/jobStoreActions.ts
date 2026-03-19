import { jobsAPI } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import type { AppState, StoreGet, StoreSet } from './storeTypes';

export const createJobStoreActions = (
  set: StoreSet,
  get: StoreGet
): Pick<AppState, 'fetchJobs' | 'addJob' | 'updateJob' | 'pickJob' | 'deleteJob'> => ({
  fetchJobs: async () => {
    try {
      const jobs = await jobsAPI.getAll();
      set({ jobs });
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to load jobs');
      set({ error: message });
      throw error;
    }
  },

  addJob: async (job) => {
    try {
      const newJob = await jobsAPI.create(job);
      set((state) => ({
        jobs: [...state.jobs, newJob]
      }));
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to add job');
      set({ error: message });
      throw error;
    }
  },

  updateJob: async (id, updates) => {
    try {
      const updated = await jobsAPI.update(id, updates);
      set((state) => ({
        jobs: state.jobs.map((job) =>
          job.id === id ? { ...job, ...updated } : job
        )
      }));
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to update job');
      set({ error: message });
      throw error;
    }
  },

  pickJob: async (id) => {
    try {
      await jobsAPI.pick(id);
      await get().fetchJobs();
      await get().fetchInventory();
      await get().fetchMovements();
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to pick job');
      set({ error: message });
      throw error;
    }
  },

  deleteJob: async (id) => {
    try {
      await jobsAPI.delete(id);
      set((state) => ({
        jobs: state.jobs.filter((job) => job.id !== id)
      }));
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to delete job');
      set({ error: message });
      throw error;
    }
  }
});
