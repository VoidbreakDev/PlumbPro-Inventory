
import { Contact, InventoryItem, Job, JobTemplate, StockMovement } from './types';

export const INITIAL_CONTACTS: Contact[] = [
  { id: 'c1', name: 'John Doe', type: 'Plumber', email: 'john@plumbpro.com', phone: '555-0101' },
  { id: 'c2', name: 'Jane Smith', type: 'Plumber', email: 'jane@plumbpro.com', phone: '555-0102' },
  { id: 's1', name: 'PlumbSupply Co', type: 'Supplier', email: 'sales@plumbsupply.com', phone: '555-0500', company: 'PlumbSupply' },
  { id: 's2', name: 'DrainTech Tools', type: 'Supplier', email: 'info@draintech.com', phone: '555-0600', company: 'DrainTech' },
];

export const INITIAL_INVENTORY: InventoryItem[] = [
  { id: 'i1', name: '15mm Copper Pipe (3m)', category: 'Piping', price: 24.50, quantity: 45, reorderLevel: 20, supplierId: 's1', supplierCode: 'CP-15-3M' },
  { id: 'i2', name: 'Standard S-Trap', category: 'Fittings', price: 8.95, quantity: 12, reorderLevel: 15, supplierId: 's1', supplierCode: 'STRAP-STD' },
  { id: 'i3', name: 'Plumber Putty 500g', category: 'Consumables', price: 5.20, quantity: 30, reorderLevel: 10, supplierId: 's2', supplierCode: 'PUT-500' },
  { id: 'i4', name: 'Drain Snake - Industrial', category: 'Tools', price: 450.00, quantity: 3, reorderLevel: 2, supplierId: 's2', supplierCode: 'DS-IND-X' },
  { id: 'i5', name: 'L-Shaped Elbow 15mm', category: 'Fittings', price: 1.25, quantity: 150, reorderLevel: 50, supplierId: 's1', supplierCode: 'ELB-15-L' },
];

export const INITIAL_JOBS: Job[] = [
  { 
    id: 'j1', 
    title: 'Main Street Leak Repair', 
    builder: 'Skyline Homes',
    jobType: 'Repair', 
    assignedWorkerIds: ['c1'], 
    status: 'Scheduled', 
    date: '2024-06-15', 
    allocatedItems: [],
    isPicked: false 
  },
  { 
    id: 'j2', 
    title: 'West Side Bathroom Install', 
    builder: 'Private Owner',
    jobType: 'Installation', 
    assignedWorkerIds: ['c2', 'c1'], 
    status: 'In Progress', 
    date: '2024-06-10', 
    allocatedItems: [{ itemId: 'i1', quantity: 5 }],
    isPicked: true 
  },
];

export const JOB_TEMPLATES: JobTemplate[] = [
  {
    id: 't1',
    name: 'Basic Leak Repair Kit',
    items: [
      { itemId: 'i1', quantity: 1 },
      { itemId: 'i3', quantity: 1 },
      { itemId: 'i5', quantity: 4 },
    ]
  },
  {
    id: 't2',
    name: 'Standard Basin Install',
    items: [
      { itemId: 'i1', quantity: 2 },
      { itemId: 'i2', quantity: 1 },
      { itemId: 'i3', quantity: 1 },
      { itemId: 'i5', quantity: 2 },
    ]
  }
];

export const INITIAL_MOVEMENTS: StockMovement[] = [
  { id: 'm1', itemId: 'i1', type: 'In', quantity: 50, timestamp: Date.now() - 86400000 * 5 },
  { id: 'm2', itemId: 'i1', type: 'Out', quantity: 5, timestamp: Date.now() - 86400000, reference: 'j2' },
];
