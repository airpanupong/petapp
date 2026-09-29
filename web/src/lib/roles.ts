export function isStaff(role?: string | null) {
  return role === 'admin' || role === 'super_admin';
}

export function isSuperAdmin(role?: string | null) {
  return role === 'super_admin';
}

export function roleLabel(role?: string | null) {
  if (role === 'super_admin') return 'Super Admin';
  if (role === 'admin') return 'Admin';
  return 'ผู้ใช้';
}
