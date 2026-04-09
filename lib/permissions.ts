export type SchedulingAction =
  | 'reschedule'
  | 'reassign'
  | 'createJob'
  | 'deleteJob'
  | 'updateStatus'
  | 'addNote'
  | 'addPhoto'
  | 'viewFinancials'
  | 'clockInOut'
  | 'vanStock'
  | 'compliance'
  | 'setRecurring';

const MANAGER_PLUS = ['admin', 'manager', 'office'];

/**
 * Returns true if a user with the given role may perform the action.
 * @param role      The user's role string (lowercase).
 * @param action    The scheduling action to check.
 * @param isAssigned Whether the user is in the job's assignedWorkerIds array.
 */
export function canPerform(role: string, action: SchedulingAction, isAssigned: boolean): boolean {
  const r = role.toLowerCase();

  switch (action) {
    case 'reschedule':
    case 'reassign':
    case 'createJob':
    case 'deleteJob':
    case 'viewFinancials':
    case 'setRecurring':
      return MANAGER_PLUS.includes(r);

    case 'updateStatus':
      return MANAGER_PLUS.includes(r) || (r === 'technician' && isAssigned);

    case 'addNote':
    case 'addPhoto':
      return MANAGER_PLUS.includes(r) || (
        (r === 'technician' || r === 'apprentice') && isAssigned
      );

    case 'clockInOut':
    case 'compliance':
      return true;

    case 'vanStock':
      return MANAGER_PLUS.includes(r) || (r === 'technician' && isAssigned);

    default:
      return false;
  }
}
