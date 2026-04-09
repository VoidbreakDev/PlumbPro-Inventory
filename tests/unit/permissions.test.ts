import { describe, it, expect } from 'vitest';
import { canPerform } from '../../lib/permissions';

describe('canPerform', () => {
  describe('reschedule', () => {
    it('allows admin', () => expect(canPerform('admin', 'reschedule', false)).toBe(true));
    it('allows manager', () => expect(canPerform('manager', 'reschedule', false)).toBe(true));
    it('allows office', () => expect(canPerform('office', 'reschedule', false)).toBe(true));
    it('blocks technician', () => expect(canPerform('technician', 'reschedule', true)).toBe(false));
    it('blocks apprentice', () => expect(canPerform('apprentice', 'reschedule', true)).toBe(false));
  });

  describe('updateStatus', () => {
    it('allows manager always', () => expect(canPerform('manager', 'updateStatus', false)).toBe(true));
    it('allows technician on own job', () => expect(canPerform('technician', 'updateStatus', true)).toBe(true));
    it('blocks technician on unassigned job', () => expect(canPerform('technician', 'updateStatus', false)).toBe(false));
    it('blocks apprentice always', () => expect(canPerform('apprentice', 'updateStatus', true)).toBe(false));
  });

  describe('addNote', () => {
    it('allows technician on own job', () => expect(canPerform('technician', 'addNote', true)).toBe(true));
    it('blocks technician on unassigned job', () => expect(canPerform('technician', 'addNote', false)).toBe(false));
    it('allows apprentice on own job', () => expect(canPerform('apprentice', 'addNote', true)).toBe(true));
  });

  describe('clockInOut', () => {
    it('allows all roles', () => {
      for (const role of ['admin', 'manager', 'office', 'technician', 'apprentice']) {
        expect(canPerform(role, 'clockInOut', false)).toBe(true);
      }
    });
  });

  describe('vanStock', () => {
    it('allows technician on own job', () => expect(canPerform('technician', 'vanStock', true)).toBe(true));
    it('blocks apprentice always', () => expect(canPerform('apprentice', 'vanStock', true)).toBe(false));
  });
});
