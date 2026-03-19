import type {
  CreateDevelopmentProjectInput,
  DevelopmentProject,
  UpdateDevelopmentProjectInput,
  UpdateDevelopmentStageInput
} from '../../types';
import api from './client';

export const developmentProjectsAPI = {
  getAll: async (params?: { search?: string; limit?: number }): Promise<DevelopmentProject[]> => {
    const { data } = await api.get('/development-projects', { params });
    return data;
  },

  getById: async (id: string): Promise<DevelopmentProject> => {
    const { data } = await api.get(`/development-projects/${id}`);
    return data;
  },

  create: async (input: CreateDevelopmentProjectInput): Promise<DevelopmentProject> => {
    const { data } = await api.post('/development-projects', input);
    return data;
  },

  update: async (id: string, input: UpdateDevelopmentProjectInput): Promise<DevelopmentProject> => {
    const { data } = await api.put(`/development-projects/${id}`, input);
    return data;
  },

  updateStage: async (
    projectId: string,
    stageId: string,
    input: UpdateDevelopmentStageInput
  ): Promise<DevelopmentProject> => {
    const { data } = await api.put(`/development-projects/${projectId}/stages/${stageId}`, input);
    return data;
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/development-projects/${id}`);
    return data;
  }
};
