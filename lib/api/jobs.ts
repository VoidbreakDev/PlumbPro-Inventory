import type { Job, JobTemplate, JobNote, JobPhoto, JobStatus, RecurrenceFrequency } from '../../types';
import api from './client';

export const jobsAPI = {
  getAll: async (): Promise<Job[]> => {
    const { data } = await api.get('/jobs');
    return data;
  },

  getJobs: async (): Promise<Job[]> => {
    return jobsAPI.getAll();
  },

  getById: async (id: string): Promise<Job> => {
    const { data } = await api.get(`/jobs/${id}`);
    return data;
  },

  create: async (job: Omit<Job, 'id'>): Promise<Job> => {
    const { data } = await api.post('/jobs', job);
    return data;
  },

  update: async (id: string, updates: Partial<Job>): Promise<Job> => {
    const { data } = await api.put(`/jobs/${id}`, updates);
    return data;
  },

  pick: async (id: string) => {
    const { data } = await api.post(`/jobs/${id}/pick`);
    return data;
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/jobs/${id}`);
    return data;
  },

  getCalendar: async (start: string, end: string): Promise<Job[]> => {
    const { data } = await api.get('/jobs/calendar', { params: { start, end } });
    return data.data;
  },

  getUnscheduled: async (): Promise<Job[]> => {
    const { data } = await api.get('/jobs/unscheduled');
    return data.data;
  },

  getNotes: async (jobId: string): Promise<JobNote[]> => {
    const { data } = await api.get(`/jobs/${jobId}/notes`);
    return data.data;
  },

  addNote: async (jobId: string, note: string): Promise<JobNote> => {
    const { data } = await api.post(`/jobs/${jobId}/notes`, { note });
    return data.data;
  },

  getPhotos: async (jobId: string): Promise<JobPhoto[]> => {
    const { data } = await api.get(`/jobs/${jobId}/photos`);
    return data.data;
  },

  addPhoto: async (jobId: string, file: File, caption?: string): Promise<JobPhoto> => {
    const form = new FormData();
    form.append('photo', file);
    if (caption) form.append('caption', caption);
    const { data } = await api.post(`/jobs/${jobId}/photos`, form);
    return data.data;
  },

  updateStatus: async (jobId: string, status: JobStatus): Promise<void> => {
    await api.post(`/jobs/${jobId}/status`, { status });
  },

  assign: async (
    jobId: string,
    workerIds: string[],
    scheduledStart?: string,
    scheduledEnd?: string
  ): Promise<void> => {
    await api.post(`/jobs/${jobId}/assign`, { workerIds, scheduledStart, scheduledEnd });
  },

  setRecurring: async (jobId: string, frequency: RecurrenceFrequency, startDate: string): Promise<void> => {
    await api.post(`/jobs/${jobId}/recurring`, { frequency, startDate });
  }
};

export const templatesAPI = {
  getAll: async (): Promise<JobTemplate[]> => {
    const { data } = await api.get('/templates');
    return data;
  },

  create: async (template: Omit<JobTemplate, 'id'>): Promise<JobTemplate> => {
    const { data } = await api.post('/templates', template);
    return data;
  },

  update: async (id: string, updates: Partial<JobTemplate>): Promise<JobTemplate> => {
    const { data } = await api.put(`/templates/${id}`, updates);
    return data;
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/templates/${id}`);
    return data;
  }
};
