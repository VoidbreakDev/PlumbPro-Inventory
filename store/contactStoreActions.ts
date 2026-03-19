import { contactsAPI } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import type { AppState, StoreSet } from './storeTypes';

export const createContactStoreActions = (
  set: StoreSet
): Pick<AppState, 'fetchContacts' | 'addContact' | 'updateContact' | 'deleteContact'> => ({
  fetchContacts: async () => {
    try {
      const contacts = await contactsAPI.getAll();
      set({ contacts });
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to load contacts');
      set({ error: message });
      throw error;
    }
  },

  addContact: async (contact) => {
    try {
      const newContact = await contactsAPI.create(contact);
      set((state) => ({
        contacts: [...state.contacts, newContact]
      }));
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to add contact');
      set({ error: message });
      throw error;
    }
  },

  updateContact: async (id, updates) => {
    try {
      const updated = await contactsAPI.update(id, updates);
      set((state) => ({
        contacts: state.contacts.map((contact) =>
          contact.id === id ? { ...contact, ...updated } : contact
        )
      }));
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to update contact');
      set({ error: message });
      throw error;
    }
  },

  deleteContact: async (id) => {
    try {
      await contactsAPI.delete(id);
      set((state) => ({
        contacts: state.contacts.filter((contact) => contact.id !== id)
      }));
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to delete contact');
      set({ error: message });
      throw error;
    }
  }
});
