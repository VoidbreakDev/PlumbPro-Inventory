import type { Job, JobTemplate } from '../../types';
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
