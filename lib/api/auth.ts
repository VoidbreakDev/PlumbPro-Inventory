import api from './client';

export const authAPI = {
  login: async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  },

  register: async (email: string, password: string, fullName: string, companyName?: string, inviteToken?: string) => {
    const { data } = await api.post('/auth/register', { email, password, fullName, companyName, inviteToken });
    return data;
  },

  getCurrentUser: async () => {
    const { data } = await api.get('/auth/me');
    return data;
  }
};
