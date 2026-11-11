/**
 * Type definitions for the Essential Services & Local Authorities module.
 */

export type DepartmentSlug = 'water' | 'electricity' | 'municipal' | string;

export type AnnouncementCategory =
  | 'interruption'
  | 'maintenance'
  | 'emergency'
  | 'notice'
  | 'advisory';

export type AnnouncementPriority = 'low' | 'medium' | 'high' | 'critical';

export type AnnouncementStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'completed'
  | 'cancelled';

export interface AuthorityDepartment {
  id: string;
  slug: DepartmentSlug;
  name: string;
  name_mr: string;
  icon: string; // 'Droplets' | 'Zap' | 'Building2' | etc.
  color_theme: 'blue' | 'amber' | 'emerald' | string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface OfficerContact {
  id?: string;
  role: string;
  name: string;
  phone: string;
}

export interface AuthorityOrganization {
  id: string;
  department_ids: string[];
  city_id: string;
  district_id?: string | null;
  name: string;
  name_mr: string;
  office_address?: string | null;
  maps_url?: string | null;
  visiting_hours?: string | null;
  helpline_phone: string;
  emergency_phone?: string | null;
  whatsapp_number?: string | null;
  email?: string | null;
  key_contacts?: OfficerContact[];
  is_demo: boolean;
  is_verified: boolean;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AnnouncementLocation {
  id?: string;
  announcement_id?: string;
  city_id: string;
  village_id?: string | null;
  area_text?: string | null;
}

export interface AuthorityAnnouncement {
  id: string;
  org_id: string;
  department_id: string;
  city_id: string;
  title: string;
  title_mr: string;
  description: string;
  description_mr?: string | null;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  start_time?: string | null;
  end_time?: string | null;
  published_at: string;
  media_urls?: string[];
  is_demo: boolean;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;

  // Joined relations & client computed fields
  department?: AuthorityDepartment;
  organization?: AuthorityOrganization;
  locations?: AnnouncementLocation[];
  isExpiredOutage?: boolean;
}

export interface AuthorityAdminGrant {
  id: string;
  user_id: string;
  department_id?: string | null;
  city_id?: string | null;
  district_id?: string | null;
  can_publish: boolean;
  can_edit: boolean;
  is_active: boolean;
}
