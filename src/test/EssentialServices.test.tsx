import { describe, it, expect, beforeEach } from 'vitest';
import {
  canManageDepartment,
  getDevAuthorityRole,
  setDevAuthorityRole,
} from '@/lib/services/devRoleSwitcher';
import {
  processAnnouncementExpiry,
  formatAnnouncementWhatsAppShare,
  DEMO_DEPARTMENTS,
  DEMO_ANNOUNCEMENTS,
} from '@/lib/services/authorityService';
import { AuthorityAnnouncement } from '@/lib/services/authorityTypes';

describe('Essential Services & Local Authorities Module', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  describe('Multi-Tenant Scoped RBAC', () => {
    it('grants Super Admin full access across all departments', () => {
      expect(canManageDepartment('super_admin', 'water')).toBe(true);
      expect(canManageDepartment('super_admin', 'electricity')).toBe(true);
      expect(canManageDepartment('super_admin', 'municipal')).toBe(true);
      expect(canManageDepartment('super_admin', 'random_dept')).toBe(true);
    });

    it('strictly confines Water Admin to water department only', () => {
      expect(canManageDepartment('water_admin', 'water')).toBe(true);
      expect(canManageDepartment('water_admin', 'electricity')).toBe(false);
      expect(canManageDepartment('water_admin', 'municipal')).toBe(false);
    });

    it('strictly confines Electricity Admin to electricity department only', () => {
      expect(canManageDepartment('electricity_admin', 'electricity')).toBe(true);
      expect(canManageDepartment('electricity_admin', 'water')).toBe(false);
      expect(canManageDepartment('electricity_admin', 'municipal')).toBe(false);
    });

    it('strictly confines Municipal Admin to municipal department only', () => {
      expect(canManageDepartment('municipal_admin', 'municipal')).toBe(true);
      expect(canManageDepartment('municipal_admin', 'water')).toBe(false);
      expect(canManageDepartment('municipal_admin', 'electricity')).toBe(false);
    });

    it('denies edit access to regular Citizen persona', () => {
      expect(canManageDepartment('citizen', 'water')).toBe(false);
      expect(canManageDepartment('citizen', 'electricity')).toBe(false);
      expect(canManageDepartment('citizen', 'municipal')).toBe(false);
    });

    it('persists active mock role to sessionStorage', () => {
      setDevAuthorityRole('water_admin');
      expect(getDevAuthorityRole()).toBe('water_admin');
    });
  });

  describe('Automatic Outage Expiry Logic', () => {
    it('marks active outage as completed if end_time is in the past', () => {
      const pastEndTime = new Date(Date.now() - 2 * 3600 * 1000).toISOString(); // 2 hours ago
      const activeAnn: AuthorityAnnouncement = {
        id: 'test-ann-1',
        org_id: 'test-org',
        department_id: 'dept-water-001',
        city_id: 'city-1',
        title: 'Emergency Pipeline Repair',
        title_mr: 'जलवाहिनी दुरुस्ती',
        description: 'Under repair',
        category: 'interruption',
        priority: 'high',
        status: 'active',
        start_time: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
        end_time: pastEndTime,
        published_at: new Date().toISOString(),
        is_demo: true,
      };

      const result = processAnnouncementExpiry(activeAnn);
      expect(result.status).toBe('completed');
      expect(result.isExpiredOutage).toBe(true);
    });

    it('keeps active outage as active if end_time is still in the future', () => {
      const futureEndTime = new Date(Date.now() + 2 * 3600 * 1000).toISOString(); // 2 hours ahead
      const activeAnn: AuthorityAnnouncement = {
        id: 'test-ann-2',
        org_id: 'test-org',
        department_id: 'dept-power-002',
        city_id: 'city-1',
        title: 'Feeder Maintenance',
        title_mr: 'फिडर देखभाल',
        description: 'Power cut in progress',
        category: 'maintenance',
        priority: 'medium',
        status: 'active',
        start_time: new Date().toISOString(),
        end_time: futureEndTime,
        published_at: new Date().toISOString(),
        is_demo: true,
      };

      const result = processAnnouncementExpiry(activeAnn);
      expect(result.status).toBe('active');
      expect(result.isExpiredOutage).toBeUndefined();
    });
  });

  describe('WhatsApp Citizen Alert Sharing', () => {
    it('formats a rich alert message with emoji, timings, and helplines', () => {
      const sample = DEMO_ANNOUNCEMENTS[0];
      const enShare = formatAnnouncementWhatsAppShare(sample, 'Muktainagar', 'en');

      expect(enShare).toContain('Civic & Essential Services Alert | Muktainagar');
      expect(enShare).toContain('Emergency Pipeline Repair at Station Road [DEMO]');
      expect(enShare).toContain('Helpline:');
      expect(enShare).toContain('[DEMO SIMULATION — Illustrative Testing Update]');
      expect(enShare).toContain('/muktainagar/services');

      const mrShare = formatAnnouncementWhatsAppShare(sample, 'Muktainagar', 'mr');
      expect(mrShare).toContain('स्थानिक नागरी सूचना | Muktainagar');
      expect(mrShare).toContain('स्टेशन रोड येथे मुख्य जलवाहिनी तातडीची दुरुस्ती [डेमो]');
      expect(mrShare).toContain('बाधित परिसर:');
      expect(mrShare).toContain('[डेमो सिम्युलेशन — सराव सूचना]');
    });
  });

  describe('Demo Compliance', () => {
    it('verifies all seeded announcements and organizations have is_demo = true', () => {
      DEMO_ANNOUNCEMENTS.forEach((ann) => {
        expect(ann.is_demo).toBe(true);
        expect(ann.title).toContain('[DEMO]');
      });
    });
  });

  describe('UUID Resolution & Announcement Publishing', () => {
    it('generates valid RFC4122 UUID and resolves department and org UUIDs', async () => {
      const {
        saveAnnouncement,
        fetchAnnouncementsForCity,
        isValidUuid,
        DEPARTMENT_UUIDS,
        ORGANIZATION_UUIDS,
      } = await import('@/lib/services/authorityService');

      const saved = await saveAnnouncement({
        title: 'New Water Line Repair Notice',
        department_id: 'water', // slug
        category: 'interruption',
        priority: 'high',
        status: 'active',
      });

      expect(isValidUuid(saved.id)).toBe(true);
      expect(saved.department_id).toBe(DEPARTMENT_UUIDS.water);
      expect(saved.org_id).toBe(ORGANIZATION_UUIDS.water);
      expect(isValidUuid(saved.city_id)).toBe(true);

      // Verify fetch returns it
      const list = await fetchAnnouncementsForCity();
      const found = list.find((a) => a.id === saved.id);
      expect(found).toBeDefined();
      expect(found?.title).toBe('New Water Line Repair Notice');
    });
  });

  describe('Department Helplines & Contacts CRUD (v2)', () => {
    it('enforces RBAC permissions for editing department organization contacts', async () => {
      const { canManageOrganization } = await import('@/lib/services/devRoleSwitcher');
      const { DEMO_ORGANIZATIONS, DEMO_DEPARTMENTS } = await import('@/lib/services/authorityService');

      const waterOrg = DEMO_ORGANIZATIONS[0];
      const powerOrg = DEMO_ORGANIZATIONS[1];

      // Super admin can manage all organizations
      expect(canManageOrganization('super_admin', waterOrg, DEMO_DEPARTMENTS)).toBe(true);
      expect(canManageOrganization('super_admin', powerOrg, DEMO_DEPARTMENTS)).toBe(true);

      // Water admin can only manage Water organization
      expect(canManageOrganization('water_admin', waterOrg, DEMO_DEPARTMENTS)).toBe(true);
      expect(canManageOrganization('water_admin', powerOrg, DEMO_DEPARTMENTS)).toBe(false);

      // Electricity admin can only manage Electricity organization
      expect(canManageOrganization('electricity_admin', powerOrg, DEMO_DEPARTMENTS)).toBe(true);
      expect(canManageOrganization('electricity_admin', waterOrg, DEMO_DEPARTMENTS)).toBe(false);

      // Regular citizen has zero edit access
      expect(canManageOrganization('citizen', waterOrg, DEMO_DEPARTMENTS)).toBe(false);
      expect(canManageOrganization('citizen', powerOrg, DEMO_DEPARTMENTS)).toBe(false);
    });

    it('updates emergency helplines, visiting hours, and dynamic officer roster', async () => {
      const {
        saveOrganizationContact,
        fetchOrganizationsForCity,
        ORGANIZATION_UUIDS,
      } = await import('@/lib/services/authorityService');

      const updated = await saveOrganizationContact({
        id: ORGANIZATION_UUIDS.water,
        helpline_phone: '02583-999000',
        emergency_phone: '9822999000',
        visiting_hours: '09:00 AM - 04:00 PM (Mon-Fri)',
        key_contacts: [
          { role: 'Executive Engineer', name: 'Er. Test Patil', phone: '9822999001' },
          { role: 'Duty Supervisor', name: 'Raju Shinde', phone: '9822999002' },
        ],
      });

      expect(updated.helpline_phone).toBe('02583-999000');
      expect(updated.emergency_phone).toBe('9822999000');
      expect(updated.visiting_hours).toBe('09:00 AM - 04:00 PM (Mon-Fri)');
      expect(updated.key_contacts).toHaveLength(2);
      expect(updated.key_contacts?.[0].name).toBe('Er. Test Patil');

      // Check fetch returns updated contact details
      const orgs = await fetchOrganizationsForCity();
      const waterOrg = orgs.find((o) => o.id === ORGANIZATION_UUIDS.water);
      expect(waterOrg?.helpline_phone).toBe('02583-999000');
      expect(waterOrg?.emergency_phone).toBe('9822999000');
      expect(waterOrg?.key_contacts).toHaveLength(2);
    });
  });
});
