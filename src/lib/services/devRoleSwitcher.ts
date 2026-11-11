/**
 * Dev Role Switcher for local development and RBAC testing.
 * Enables 1-tap switching between Super Admin, Scoped Department Admins, and Citizens.
 */

import { DepartmentSlug } from './authorityTypes';

export type DevAuthorityRole =
  | 'super_admin'
  | 'water_admin'
  | 'electricity_admin'
  | 'municipal_admin'
  | 'citizen';

export interface DevRoleDefinition {
  id: DevAuthorityRole;
  label: string;
  label_mr: string;
  departmentSlug?: DepartmentSlug;
  description: string;
  badgeColor: string;
}

export const DEV_AUTHORITY_ROLES: DevRoleDefinition[] = [
  {
    id: 'super_admin',
    label: 'Super Admin',
    label_mr: 'मुख्य प्रशासक (Super Admin)',
    description: 'Full global access across all departments & cities',
    badgeColor: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
  },
  {
    id: 'water_admin',
    label: 'Water Dept Admin',
    label_mr: 'पाणी पुरवठा विभाग प्रशासक',
    departmentSlug: 'water',
    description: 'Scoped strictly to Water Supply announcements & outages',
    badgeColor: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  },
  {
    id: 'electricity_admin',
    label: 'Electricity Admin',
    label_mr: 'वीज वितरण विभाग प्रशासक',
    departmentSlug: 'electricity',
    description: 'Scoped strictly to Power supply & transformer maintenance',
    badgeColor: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
  {
    id: 'municipal_admin',
    label: 'Municipal Admin',
    label_mr: 'नगरपंचायत प्रशासन प्रशासक',
    departmentSlug: 'municipal',
    description: 'Scoped to Municipal Council advisories & civic drives',
    badgeColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  },
  {
    id: 'citizen',
    label: 'Regular Citizen',
    label_mr: 'सामान्य नागरिक (केवळ वाचन)',
    description: 'Read-only public access without edit rights',
    badgeColor: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
  },
];

const STORAGE_KEY = 'apnalocal.dev_authority_role';

export function getDevAuthorityRole(): DevAuthorityRole {
  // SEC-03: Never honor mock elevated roles in production builds
  if (!import.meta.env.DEV) {
    return 'citizen';
  }

  if (typeof window === 'undefined') return 'super_admin';
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY) as DevAuthorityRole | null;
    if (stored && DEV_AUTHORITY_ROLES.some((r) => r.id === stored)) {
      return stored;
    }
  } catch {
    /* ignore */
  }
  return 'super_admin';
}

export function setDevAuthorityRole(role: DevAuthorityRole): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, role);
    window.dispatchEvent(new CustomEvent('dev-authority-role-changed', { detail: { role } }));
  } catch {
    /* ignore */
  }
}

/**
 * Checks whether the current mock role has permission to manage a given department.
 */
export function canManageDepartment(role: DevAuthorityRole, departmentSlug?: string): boolean {
  if (role === 'super_admin') return true;
  if (role === 'citizen') return false;

  const roleDef = DEV_AUTHORITY_ROLES.find((r) => r.id === role);
  if (!roleDef || !roleDef.departmentSlug) return false;

  return roleDef.departmentSlug === departmentSlug;
}

/**
 * Checks whether the current mock role has permission to manage a given organization.
 */
export function canManageOrganization(
  role: DevAuthorityRole,
  org?: { department_ids?: string[] },
  departments: { id: string; slug: string }[] = []
): boolean {
  if (role === 'super_admin') return true;
  if (role === 'citizen' || !org) return false;

  const roleDef = DEV_AUTHORITY_ROLES.find((r) => r.id === role);
  if (!roleDef || !roleDef.departmentSlug) return false;

  return (org.department_ids || []).some((deptId) => {
    const d = departments.find((dept) => dept.id === deptId || dept.slug === deptId);
    return d && d.slug === roleDef.departmentSlug;
  });
}

export function isDevSuperAdmin(role: DevAuthorityRole): boolean {
  return role === 'super_admin';
}

export function isDevCitizen(role: DevAuthorityRole): boolean {
  return role === 'citizen';
}
