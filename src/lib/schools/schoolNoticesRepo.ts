/**
 * Repository for `school_notices` (Institute circulars, exam schedules,
 * admission announcements, merit lists & scholarship alerts).
 *
 * Gracefully returns empty lists if the 20261112000000 migration has not yet
 * been applied to a remote Supabase project.
 */
import { supabase } from '@/integrations/supabase/client';
import type { NoticeCategory } from '@/lib/schools/schoolHelpers';

export interface SchoolNotice {
  id: string;
  school_id: string;
  title: string;
  title_mr: string | null;
  body: string | null;
  body_mr: string | null;
  category: NoticeCategory;
  is_pinned: boolean;
  is_active: boolean;
  attachment_url: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSchoolNoticeInput {
  school_id: string;
  title: string;
  title_mr?: string | null;
  body?: string | null;
  body_mr?: string | null;
  category?: NoticeCategory;
  is_pinned?: boolean;
  is_active?: boolean;
  attachment_url?: string | null;
  expires_at?: string | null;
  created_by?: string | null;
}

const table = () => (supabase as any).from('school_notices');

function isTableMissing(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  return code === '42P01' || code === 'PGRST205' || msg.includes('does not exist');
}

export const schoolNoticesRepo = {
  /** Public active, non-expired notices ordered with pinned first, then newest. */
  async listPublic(schoolId: string): Promise<SchoolNotice[]> {
    if (!schoolId) return [];
    try {
      const { data, error } = await table()
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        if (isTableMissing(error)) return [];
        throw error;
      }

      const now = Date.now();
      return ((data ?? []) as SchoolNotice[]).filter(
        (n) => !n.expires_at || +new Date(n.expires_at) >= now
      );
    } catch (err) {
      if (isTableMissing(err)) return [];
      return [];
    }
  },

  /** Owner/Admin listing: includes archived/expired/inactive notices. */
  async listForOwner(schoolId: string): Promise<SchoolNotice[]> {
    if (!schoolId) return [];
    try {
      const { data, error } = await table()
        .select('*')
        .eq('school_id', schoolId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        if (isTableMissing(error)) return [];
        throw error;
      }
      return (data ?? []) as SchoolNotice[];
    } catch (err) {
      if (isTableMissing(err)) return [];
      return [];
    }
  },

  async create(input: CreateSchoolNoticeInput): Promise<SchoolNotice> {
    const payload = {
      school_id: input.school_id,
      title: input.title.trim(),
      title_mr: input.title_mr?.trim() || null,
      body: input.body?.trim() ?? '',
      body_mr: input.body_mr?.trim() || null,
      category: input.category || 'general',
      is_pinned: Boolean(input.is_pinned),
      is_active: input.is_active ?? true,
      attachment_url: input.attachment_url?.trim() || null,
      expires_at: input.expires_at || null,
      created_by: input.created_by || null,
    };

    const { data, error } = await table().insert(payload).select().single();
    if (error) throw error;
    return data as SchoolNotice;
  },

  async update(
    id: string,
    patch: Partial<Omit<SchoolNotice, 'id' | 'school_id' | 'created_at' | 'updated_at'>>
  ): Promise<SchoolNotice> {
    const { data, error } = await table().update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data as SchoolNotice;
  },

  async remove(id: string): Promise<void> {
    const { error } = await table().delete().eq('id', id);
    if (error) throw error;
  },
};
