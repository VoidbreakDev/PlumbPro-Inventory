import { jobsAPI } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import type { AppState, StoreGet, StoreSet } from './storeTypes';
import type { JobNote, JobPhoto, JobStatus, RecurrenceFrequency } from '../types';

let pollTimer: ReturnType<typeof setInterval> | null = null;

export const createJobStoreActions = (
  set: StoreSet,
  get: StoreGet
): Pick<AppState,
  | 'fetchJobs' | 'addJob' | 'updateJob' | 'pickJob' | 'deleteJob'
  | 'fetchJobsForRange' | 'fetchUnscheduled'
  | 'addJobNote' | 'addJobPhoto'
  | 'updateJobStatus' | 'assignJob' | 'setJobRecurring'
  | 'startCalendarPolling' | 'stopCalendarPolling'
> => ({
  fetchJobs: async () => {
    try {
      const jobs = await jobsAPI.getAll();
      set({ jobs });
    } catch (error) {
      set({ error: getErrorMessage(error, 'Failed to load jobs') });
      throw error;
    }
  },

  addJob: async (job) => {
    try {
      const newJob = await jobsAPI.create(job);
      set((state) => ({ jobs: [...state.jobs, newJob] }));
    } catch (error) {
      set({ error: getErrorMessage(error, 'Failed to add job') });
      throw error;
    }
  },

  updateJob: async (id, updates) => {
    try {
      const updated = await jobsAPI.update(id, updates);
      set((state) => ({
        jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...updated } : j)),
        calendarJobs: state.calendarJobs.map((j) => (j.id === id ? { ...j, ...updated } : j))
      }));
    } catch (error) {
      set({ error: getErrorMessage(error, 'Failed to update job') });
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
      set({ error: getErrorMessage(error, 'Failed to pick job') });
      throw error;
    }
  },

  deleteJob: async (id) => {
    try {
      await jobsAPI.delete(id);
      set((state) => ({
        jobs: state.jobs.filter((j) => j.id !== id),
        calendarJobs: state.calendarJobs.filter((j) => j.id !== id)
      }));
    } catch (error) {
      set({ error: getErrorMessage(error, 'Failed to delete job') });
      throw error;
    }
  },

  fetchJobsForRange: async (start, end) => {
    try {
      const calendarJobs = await jobsAPI.getCalendar(start, end);
      set({ calendarJobs, calendarPollFailures: 0 });
    } catch (error) {
      set((state) => {
        const failures = (state.calendarPollFailures ?? 0) + 1;
        return { calendarPollFailures: failures };
      });
    }
  },

  fetchUnscheduled: async () => {
    try {
      const unscheduledJobs = await jobsAPI.getUnscheduled();
      set({ unscheduledJobs });
    } catch (error) {
      set({ error: getErrorMessage(error, 'Failed to load unscheduled jobs') });
      throw error;
    }
  },

  addJobNote: async (jobId, note) => {
    try {
      return await jobsAPI.addNote(jobId, note);
    } catch (error) {
      set({ error: getErrorMessage(error, 'Failed to add note') });
      throw error;
    }
  },

  addJobPhoto: async (jobId, file, caption) => {
    try {
      return await jobsAPI.addPhoto(jobId, file, caption);
    } catch (error) {
      set({ error: getErrorMessage(error, 'Failed to upload photo') });
      throw error;
    }
  },

  updateJobStatus: async (jobId, status) => {
    try {
      await jobsAPI.updateStatus(jobId, status);
      set((state) => ({
        jobs: state.jobs.map((j) => (j.id === jobId ? { ...j, status } : j)),
        calendarJobs: state.calendarJobs.map((j) => (j.id === jobId ? { ...j, status } : j))
      }));
    } catch (error) {
      set({ error: getErrorMessage(error, 'Failed to update status') });
      throw error;
    }
  },

  assignJob: async (jobId, workerIds, scheduledStart, scheduledEnd) => {
    try {
      await jobsAPI.assign(jobId, workerIds, scheduledStart, scheduledEnd);
      await get().fetchJobsForRange(
        scheduledStart?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        scheduledEnd?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
      );
    } catch (error) {
      set({ error: getErrorMessage(error, 'Failed to assign job') });
      throw error;
    }
  },

  setJobRecurring: async (jobId, frequency, startDate) => {
    try {
      await jobsAPI.setRecurring(jobId, frequency, startDate);
    } catch (error) {
      set({ error: getErrorMessage(error, 'Failed to set recurring rule') });
      throw error;
    }
  },

  startCalendarPolling: (start, end) => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      get().fetchJobsForRange(start, end);
    }, 30_000);
  },

  stopCalendarPolling: () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }
});
