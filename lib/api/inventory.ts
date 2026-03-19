import type { InventoryItem } from '../../types';
import api from './client';

export const inventoryAPI = {
  getAll: async (): Promise<InventoryItem[]> => {
    const { data } = await api.get('/inventory');
    return data;
  },

  getById: async (id: string): Promise<InventoryItem> => {
    const { data } = await api.get(`/inventory/${id}`);
    return data;
  },

  create: async (item: Omit<InventoryItem, 'id'>): Promise<InventoryItem> => {
    const { data } = await api.post('/inventory', item);
    return data;
  },

  update: async (id: string, updates: Partial<InventoryItem>): Promise<InventoryItem> => {
    const { data } = await api.put(`/inventory/${id}`, updates);
    return data;
  },

  adjust: async (id: string, quantity: number, reason: string, locationId?: string) => {
    const { data } = await api.post(`/inventory/${id}/adjust`, { quantity, reason, locationId });
    return data;
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/inventory/${id}`);
    return data;
  },

  deleteAll: async () => {
    const { data } = await api.post('/inventory/bulk-delete/all');
    return data;
  }
};
