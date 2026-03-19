import { templatesAPI } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import type { AppState, StoreGet, StoreSet } from './storeTypes';

export const createTemplateStoreActions = (
  set: StoreSet,
  get: StoreGet
): Pick<AppState, 'fetchTemplates' | 'addTemplate' | 'updateTemplate' | 'deleteTemplate'> => ({
  fetchTemplates: async () => {
    try {
      const templates = await templatesAPI.getAll();
      set({ templates });
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to load templates');
      set({ error: message });
      throw error;
    }
  },

  addTemplate: async (template) => {
    try {
      const newTemplate = await templatesAPI.create(template);
      set((state) => ({
        templates: [...state.templates, newTemplate]
      }));
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to add template');
      set({ error: message });
      throw error;
    }
  },

  updateTemplate: async (id, updates) => {
    try {
      await templatesAPI.update(id, updates);
      await get().fetchTemplates();
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to update template');
      set({ error: message });
      throw error;
    }
  },

  deleteTemplate: async (id) => {
    try {
      await templatesAPI.delete(id);
      set((state) => ({
        templates: state.templates.filter((template) => template.id !== id)
      }));
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to delete template');
      set({ error: message });
      throw error;
    }
  }
});
