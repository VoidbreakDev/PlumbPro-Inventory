import { describe, it, expect } from 'vitest';

describe('Example Tests', () => {
  it('should pass a basic math test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle string operations', () => {
    expect('PlumbPro'.toLowerCase()).toBe('plumbpro');
  });

  it('should handle arrays', () => {
    const arr = [1, 2, 3];
    expect(arr).toHaveLength(3);
    expect(arr).toContain(2);
  });
});

describe('Inventory Calculations', () => {
  it('should calculate total value correctly', () => {
    const items = [
      { price: 10, quantity: 5 },
      { price: 20, quantity: 3 },
    ];
    
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    expect(total).toBe(110); // (10*5) + (20*3) = 50 + 60 = 110
  });

  it('should identify low stock items', () => {
    const items = [
      { name: 'Pipe', quantity: 10, reorderLevel: 5 },
      { name: 'Fitting', quantity: 3, reorderLevel: 10 },
      { name: 'Valve', quantity: 20, reorderLevel: 15 },
    ];
    
    const lowStock = items.filter(item => item.quantity < item.reorderLevel);
    
    expect(lowStock).toHaveLength(1);
    expect(lowStock[0].name).toBe('Fitting');
  });
});
