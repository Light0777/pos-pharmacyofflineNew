import type {
  User
} from '../types';

// =========================
// PHARMACIST AUTH
// =========================

export function canDispenseRestrictedMedicine(
  user: User | undefined
): boolean {

  if (!user) {
    return false;
  }

  return (
    user.role === 'admin' || user.role === 'manager'
  );
}