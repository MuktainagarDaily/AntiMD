import { describe, it, expect, beforeEach } from 'vitest';
import { safeRelativePath } from '@/lib/utils';
import {
  getDevAuthorityRole,
  setDevAuthorityRole,
  canManageDepartment,
  DEV_AUTHORITY_ROLES,
} from '@/lib/services/devRoleSwitcher';
import {
  getRuntimeOrganizations,
  saveRuntimeOrganizations,
  resetRuntimeOrganizationsStore,
  DEMO_ORGANIZATIONS,
} from '@/lib/services/authorityService';

describe('Security Audit Remediation Suite', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    resetRuntimeOrganizationsStore();
  });

  describe('SEC-08: Open Redirect & Path Traversal Defense (safeRelativePath)', () => {
    it('allows clean same-origin relative paths', () => {
      expect(safeRelativePath('/')).toBe('/');
      expect(safeRelativePath('/shops')).toBe('/shops');
      expect(safeRelativePath('/muktainagar/bus-timetable')).toBe('/muktainagar/bus-timetable');
      expect(safeRelativePath('/auth?next=%2Fprofile')).toBe('/auth?next=/profile');
      expect(safeRelativePath('/settings#profile')).toBe('/settings#profile');
    });

    it('rejects null, undefined, empty, and whitespace strings', () => {
      expect(safeRelativePath(null)).toBeNull();
      expect(safeRelativePath(undefined)).toBeNull();
      expect(safeRelativePath('')).toBeNull();
      expect(safeRelativePath('   ')).toBeNull();
    });

    it('rejects external absolute URLs without leading slash', () => {
      expect(safeRelativePath('https://evil.com')).toBeNull();
      expect(safeRelativePath('http://malicious.org/phish')).toBeNull();
      expect(safeRelativePath('javascript:alert(1)')).toBeNull();
      expect(safeRelativePath('data:text/html,<script>alert(1)</script>')).toBeNull();
    });

    it('rejects protocol-relative bypass attempts (// and /\\)', () => {
      expect(safeRelativePath('//evil.com')).toBeNull();
      expect(safeRelativePath('//evil.com/phish')).toBeNull();
      expect(safeRelativePath('/\\evil.com')).toBeNull();
      expect(safeRelativePath('\\\\evil.com')).toBeNull();
    });

    it('rejects double-URL-encoded protocol-relative bypasses (%2F%2F)', () => {
      expect(safeRelativePath('%2F%2Fevil.com')).toBeNull();
      expect(safeRelativePath('%2F%2Fattacker.com%2Fpath')).toBeNull();
      expect(safeRelativePath('%252F%252Fnested-evil.com')).toBeNull();
      expect(safeRelativePath('%2F%5Cescaped-evil.com')).toBeNull();
    });

    it('rejects protocol schemes embedded inside leading pathname', () => {
      expect(safeRelativePath('/http://attacker.com')).toBeNull();
      expect(safeRelativePath('/https://malicious.net')).toBeNull();
      expect(safeRelativePath('/javascript:alert(document.cookie)')).toBeNull();
      expect(safeRelativePath('/data:text/html,evil')).toBeNull();
      expect(safeRelativePath('/vbscript:evil')).toBeNull();
    });
  });

  describe('SEC-03: Dev Role Switcher Scope & Production Safety', () => {
    it('defines valid roles with proper scopes', () => {
      const ids = DEV_AUTHORITY_ROLES.map((r) => r.id);
      expect(ids).toContain('super_admin');
      expect(ids).toContain('water_admin');
      expect(ids).toContain('electricity_admin');
      expect(ids).toContain('municipal_admin');
      expect(ids).toContain('citizen');
    });

    it('enforces RBAC boundaries across roles', () => {
      expect(canManageDepartment('super_admin', 'water')).toBe(true);
      expect(canManageDepartment('water_admin', 'water')).toBe(true);
      expect(canManageDepartment('water_admin', 'electricity')).toBe(false);
      expect(canManageDepartment('citizen', 'water')).toBe(false);
    });

    it('stores dev role in sessionStorage only, never leaking to localStorage', () => {
      setDevAuthorityRole('water_admin');
      expect(sessionStorage.getItem('apnalocal.dev_authority_role')).toBe('water_admin');
      expect(localStorage.getItem('apnalocal.dev_authority_role')).toBeNull();
      expect(getDevAuthorityRole()).toBe('water_admin');
    });
  });

  describe('SEC-09: Municipal Personnel PII Protection in Storage', () => {
    it('never writes officer roster PII to persistent localStorage', () => {
      const testOrgs = [...DEMO_ORGANIZATIONS];
      saveRuntimeOrganizations(testOrgs);

      // Verify localStorage does NOT contain the serialized organizations or phone numbers
      expect(localStorage.getItem('apnalocal.runtime_organizations')).toBeNull();
    });

    it('purges any legacy unencrypted PII from localStorage upon initialization', () => {
      // Simulate historical stale PII in localStorage
      localStorage.setItem('apnalocal.runtime_organizations', JSON.stringify([{ id: 'stale' }]));
      expect(localStorage.getItem('apnalocal.runtime_organizations')).not.toBeNull();

      // Calling getRuntimeOrganizations() cleans up localStorage
      const orgs = getRuntimeOrganizations();
      expect(orgs.length).toBeGreaterThan(0);
      expect(localStorage.getItem('apnalocal.runtime_organizations')).toBeNull();
    });
  });
});
