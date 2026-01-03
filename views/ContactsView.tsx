
import React from 'react';
import { Plus } from 'lucide-react';
import { Contact } from '../types';
import { Badge } from '../components/Shared';

interface ContactsViewProps {
  contacts: Contact[];
}

export const ContactsView: React.FC<ContactsViewProps> = ({ contacts }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {contacts.map(contact => (
        <div key={contact.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative">
          <div className="absolute top-4 right-4"><Badge variant={contact.type === 'Supplier' ? 'yellow' : 'green'}>{contact.type}</Badge></div>
          <div className="flex items-center space-x-4 mb-6">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl ${contact.type === 'Supplier' ? 'bg-amber-500' : 'bg-green-500'}`}>{contact.name.charAt(0)}</div>
            <div>
              <h4 className="font-bold text-slate-800 text-lg">{contact.name}</h4>
              {contact.company && <p className="text-slate-500 text-sm font-medium">{contact.company}</p>}
            </div>
          </div>
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex items-center"><span className="font-semibold w-16">Email:</span><a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">{contact.email}</a></div>
            <div className="flex items-center"><span className="font-semibold w-16">Phone:</span><span>{contact.phone}</span></div>
          </div>
        </div>
      ))}
      <button className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center p-8 hover:border-blue-400 hover:bg-blue-50 group transition-all">
        <Plus className="w-10 h-10 text-slate-300 group-hover:text-blue-500 mb-2 transition-colors" />
        <span className="text-slate-500 font-bold group-hover:text-blue-700">Add New Contact</span>
      </button>
    </div>
  );
};
