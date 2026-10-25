export const USER = 'user';
export const ADMIN = 'admin';
export const SUPER_ADMIN = 'super_admin';
export const STAFF_ROLES = [ADMIN, SUPER_ADMIN];
// Post statuses that only the owner and staff may see.
export const PRIVATE_POST_STATUSES = ['hidden', 'removed'];

export function isStaff(role: string | null | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role);
}
