import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Loader2, Check, X, UserCog, Search, Plus, Trash2, Inbox as InboxIcon,
  Mail, Users, ArrowRightLeft, ChevronDown, ChevronRight, Phone, Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { downloadCsv, townCsvFilename } from '@/lib/csvUtils';
import { RequestsTab } from './RequestsTab';
import { EmptyState } from './_shared/EmptyState';
import { ConfirmTapButton } from './_shared/ConfirmTapButton';
import { ClaimReviewModal } from './ClaimReviewModal';
import { ModerationQueue } from './_shared/ModerationQueue';
import { ClaimEntity, isMissingRelationErr, type ClaimRow } from '@/lib/entities/claimEntity';
import { removeShopImageQuiet } from '@/lib/storageNaming';
import { GraduationCap, Store } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';


type Branch = 'requests' | 'claims' | 'owners' | 'assign';
const SS_KEY = 'admin-inbox-branch';

interface InboxTabProps {
  pendingRequests: number;
  pendingClaims: number;
  onShopCreated: () => void;
}

export function InboxTab({ pendingRequests, pendingClaims, onShopCreated }: InboxTabProps) {
  const [branch, setBranchState] = useState<Branch>(() => {
    const saved = sessionStorage.getItem(SS_KEY) as Branch | null;
    if (saved && ['requests','claims','owners','assign'].includes(saved)) return saved;
    if (pendingRequests > 0) return 'requests';
    if (pendingClaims > 0) return 'claims';
    return 'owners';
  });

  const setBranch = (b: Branch) => {
    setBranchState(b);
    sessionStorage.setItem(SS_KEY, b);
  };

  return (
    <div>
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none -mx-3 sm:-mx-4 px-3 sm:px-4">
        <SubBtn active={branch==='requests'} onClick={() => setBranch('requests')}
          icon={<Mail className="w-3.5 h-3.5" />} label="Requests" badge={pendingRequests} />
        <SubBtn active={branch==='claims'} onClick={() => setBranch('claims')}
          icon={<InboxIcon className="w-3.5 h-3.5" />} label="Claims" badge={pendingClaims} />
        <SubBtn active={branch==='owners'} onClick={() => setBranch('owners')}
          icon={<Users className="w-3.5 h-3.5" />} label="Owners" />
        <SubBtn active={branch==='assign'} onClick={() => setBranch('assign')}
          icon={<Plus className="w-3.5 h-3.5" />} label="Assign" />
      </div>

      {branch === 'requests' && <RequestsTab onShopCreated={onShopCreated} />}
      {branch === 'claims' && <PendingClaims />}
      {branch === 'owners' && <OwnersGrouped />}
      {branch === 'assign' && <DirectAssign />}
    </div>
  );
}

function SubBtn({
  active, onClick, icon, label, badge,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
        active ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      <span>{label}</span>
      {!!badge && badge > 0 && (
        <span className={`ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
          active ? 'bg-primary-foreground text-primary' : 'bg-destructive text-destructive-foreground'
        }`}>{badge}</span>
      )}
    </button>
  );
}

/* ─── Pending Claims (migrated to <ModerationQueue/>, Forge rec #12) ── */
function PendingClaims() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-claims-pending'],
    queryFn: async () => {
      const [shopRes, schoolRes] = await Promise.all([
        supabase
          .from('shop_claims')
          .select('id, shop_id, user_id, contact_phone, note, status, created_at, proof_image_path, proof_type, admin_notes')
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        (supabase.from('school_claims' as any) as any)
          .select('id, school_id, user_id, contact_phone, note, status, created_at, proof_image_path, proof_type, admin_notes, role_claimed, udise_or_id')
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
      ]);

      if (shopRes.error) throw shopRes.error;
      if (schoolRes.error && !isMissingRelationErr(schoolRes.error)) {
        throw schoolRes.error;
      }

      const shopRows = (shopRes.data || []).map((r: any) => ({ ...r, entity_kind: 'shop' as const }));
      const schoolRows = (schoolRes.error ? [] : (schoolRes.data || [])).map((r: any) => ({
        ...r,
        shop_id: null,
        entity_kind: 'school' as const,
      }));
      const combined = [...shopRows, ...schoolRows].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      if (!combined.length) return [] as ClaimRow[];

      const userIds = Array.from(new Set(combined.map((r: any) => r.user_id)));
      const shopIds = Array.from(new Set(shopRows.map((r: any) => r.shop_id).filter(Boolean)));
      const schoolIds = Array.from(new Set(schoolRows.map((r: any) => r.school_id).filter(Boolean)));

      const [{ data: profs }, { data: shops }, { data: schools }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, phone').in('id', userIds),
        shopIds.length > 0
          ? supabase.from('shops').select('id, name, phone, area, is_verified').in('id', shopIds)
          : Promise.resolve({ data: [] as any[] }),
        schoolIds.length > 0
          ? (supabase.from('schools') as any).select('id, name, phone, area, is_verified, udise_aishe_code').in('id', schoolIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const profilesById: Record<string, any> = {};
      (profs || []).forEach((p: any) => { profilesById[p.id] = p; });
      const shopsById: Record<string, any> = {};
      (shops || []).forEach((s: any) => { shopsById[s.id] = s; });
      const schoolsById: Record<string, any> = {};
      (schools || []).forEach((s: any) => { schoolsById[s.id] = s; });

      return combined.map((r: any) => ({
        ...r,
        profiles: profilesById[r.user_id] || null,
        shops: r.shop_id ? (shopsById[r.shop_id] || null) : null,
        schools: r.school_id ? (schoolsById[r.school_id] || null) : null,
      })) as ClaimRow[];
    },
  });
  const [reviewing, setReviewing] = useState<ClaimRow | null>(null);

  const handleReject = async (row: ClaimRow) => {
    setReviewing(row);
  };
  const handleApprove = async (row: ClaimRow) => {
    setReviewing(row);
  };

  const handleDelete = async (row: ClaimRow) => {
    const table = row.entity_kind === 'school' || !!row.school_id ? 'school_claims' : 'shop_claims';
    const { error } = await (supabase.from(table as any) as any).delete().eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    if (row.proof_image_path) await removeShopImageQuiet(row.proof_image_path);
    toast.success('Claim deleted.');
    qc.invalidateQueries({ queryKey: ['admin-claims-pending'] });
    qc.invalidateQueries({ queryKey: ['admin-inbox-counts'] });
    qc.invalidateQueries({ queryKey: ['admin-stats'] });
  };

  const handleExportClaimsCsv = () => {
    if (!data.length) {
      toast.info('No pending claims to export');
      return;
    }
    const headers = [
      'Claim Type',
      'Listing Name',
      'Area',
      'Claimant Name',
      'Claimant Phone',
      'Role Claimed',
      'UDISE / ID',
      'Proof Type',
      'Has Proof',
      'Note',
      'Status',
      'Submitted At',
    ];
    const csvRows = data.map((row) => {
      const isSchool = row.entity_kind === 'school' || !!row.school_id;
      const targetName = (isSchool ? row.schools?.name : row.shops?.name) || '';
      const targetArea = (isSchool ? row.schools?.area : row.shops?.area) || '';
      return [
        isSchool ? 'school' : 'shop',
        targetName,
        targetArea,
        row.profiles?.full_name || '',
        row.contact_phone || row.profiles?.phone || '',
        row.role_claimed || '',
        row.udise_or_id || row.schools?.udise_aishe_code || '',
        row.proof_type || '',
        row.proof_image_path ? 'Yes' : 'No',
        row.note || '',
        row.status,
        row.created_at,
      ];
    });
    downloadCsv(townCsvFilename(null, 'pending-claims'), headers, csvRows);
    toast.success(`Exported ${csvRows.length} claim${csvRows.length === 1 ? '' : 's'} to CSV`);
  };

  return (
    <>
      <ModerationQueue<ClaimRow>
        entity={ClaimEntity}
        dataOverride={{ rows: data, isLoading }}
        isPending={(r) => r.status === 'pending'}
        toolbarExtras={
          <button
            type="button"
            onClick={handleExportClaimsCsv}
            disabled={!data.length}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Export Claims CSV
          </button>
        }
        onView={(r) => setReviewing(r)}
        onApprove={handleApprove}
        onReject={handleReject}
        onDelete={handleDelete}
        copyFor={(action, row) => {
          const isSchool = row.entity_kind === 'school' || !!row.school_id;
          const targetName = (isSchool ? row.schools?.name : row.shops?.name) ?? (isSchool ? 'this institute' : 'this shop');
          if (action === 'approve') return {
            title: `Review claim for "${targetName}"`,
            cta: 'Open review',
            description: <p>Approval assigns ownership and requires a side-by-side check of the submitted proof. Continue in the review dialog.</p>,
          };
          if (action === 'reject') return {
            title: `Reject claim for "${targetName}"?`,
            cta: 'Open review',
            description: <p>Rejection requires a note explaining why. Continue in the review dialog to add one.</p>,
          };
          return {
            title: `Delete claim for "${targetName}"?`,
            cta: 'Delete claim',
            description: (
              <p>The claim and its uploaded proof image will be <strong className="text-foreground">permanently removed</strong>. Ownership is not affected. This cannot be undone.</p>
            ),
          };
        }}
        emptyState={
          <EmptyState
            icon={<InboxIcon className="w-6 h-6" />}
            title="No pending claims"
            hint="When shopkeepers or school principals request to claim a listing, they appear here."
          />
        }
        skeletonRows={3}
      />

      {reviewing && (
        <ClaimReviewModal
          claim={reviewing as any}
          onClose={() => setReviewing(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: ['admin-claims-pending'] })}
        />
      )}
    </>
  );
}


/* ─── Direct Assign ───────────────────────────────────────────────── */
function DirectAssign() {
  const qc = useQueryClient();
  const [targetKind, setTargetKind] = useState<'shop' | 'school'>('shop');
  const [targetQ, setTargetQ] = useState('');
  const [userQ, setUserQ] = useState('');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [pickedTargetLabel, setPickedTargetLabel] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);
  const [roleTitle, setRoleTitle] = useState('Principal / Owner');
  const [busy, setBusy] = useState(false);

  const { data: candidates } = useQuery({
    queryKey: ['admin-assign-search', targetKind, targetQ],
    enabled: targetQ.length >= 2,
    queryFn: async () => {
      if (targetKind === 'school') {
        const { data } = await (supabase.from('schools') as any)
          .select('id, name, area')
          .ilike('name', `%${targetQ}%`)
          .limit(8);
        return data || [];
      }
      const { data } = await supabase
        .from('shops')
        .select('id, name, area')
        .ilike('name', `%${targetQ}%`)
        .limit(8);
      return data || [];
    },
  });

  const { data: users } = useQuery({
    queryKey: ['admin-user-search', userQ],
    enabled: userQ.trim().length >= 2,
    queryFn: async () => {
      const esc = userQ.replace(/[%,()\\]/g, ' ').trim();
      if (esc.length < 2) return [];
      const { data } = await supabase.from('profiles').select('id, full_name, phone')
        .or(`full_name.ilike.%${esc}%,phone.ilike.%${esc}%`).limit(8);
      return data || [];
    },
  });

  async function assign() {
    if (!targetId || !userId) return;
    setBusy(true);
    const { error } =
      targetKind === 'school'
        ? await supabase.rpc('assign_school_owner' as any, {
            _school_id: targetId,
            _user_id: userId,
            _role_title: roleTitle.trim() || 'Principal / Owner',
          })
        : await supabase.rpc('assign_shop_owner' as any, {
            _shop_id: targetId,
            _user_id: userId,
          });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(targetKind === 'school' ? 'Institute assigned to user.' : 'Shop assigned to user.');
    setTargetId(null);
    setPickedTargetLabel('');
    setUserId(null);
    setTargetQ('');
    setUserQ('');
    qc.invalidateQueries({ queryKey: ['admin-owners-grouped'] });
    qc.invalidateQueries({ queryKey: ['admin-stats'] });
    if (targetKind === 'school') {
      qc.invalidateQueries({ queryKey: ['admin-schools'] });
      qc.invalidateQueries({ queryKey: ['schools'] });
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-3 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            1. Pick {targetKind === 'school' ? 'Institute / School' : 'Shop / Mess / PG'}
          </p>
          <div className="inline-flex flex-wrap rounded-lg border border-border bg-muted/40 p-0.5 text-xs font-semibold max-w-full">
            <button
              type="button"
              onClick={() => { setTargetKind('shop'); setTargetId(null); setTargetQ(''); }}
              className={`px-2.5 py-1 rounded-md inline-flex items-center gap-1 transition-colors ${
                targetKind === 'shop' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Store className="w-3 h-3" /> Shop / Mess / PG
            </button>
            <button
              type="button"
              onClick={() => { setTargetKind('school'); setTargetId(null); setTargetQ(''); }}
              className={`px-2.5 py-1 rounded-md inline-flex items-center gap-1 transition-colors ${
                targetKind === 'school' ? 'bg-purple-600 text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <GraduationCap className="w-3 h-3" /> Institute / School
            </button>
          </div>
        </div>

        {targetId ? (
          <div className="flex items-center justify-between bg-muted rounded-lg px-3 py-2">
            <span className="text-sm font-semibold text-foreground">
              {pickedTargetLabel || candidates?.find((s: any) => s.id === targetId)?.name || targetId}
            </span>
            <button onClick={() => { setTargetId(null); setPickedTargetLabel(''); }} className="text-xs text-muted-foreground">
              Change
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={targetQ}
                onChange={(e) => setTargetQ(e.target.value)}
                placeholder={targetKind === 'school' ? 'Search school / college / coaching name…' : 'Search shop / mess / PG name…'}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm"
              />
            </div>
            {candidates && candidates.length > 0 && (
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {candidates.map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => { setTargetId(s.id); setPickedTargetLabel(s.name); }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted text-sm"
                  >
                    <span className="font-semibold text-foreground">{s.name}</span>
                    <span className="text-muted-foreground"> · {s.area ?? '—'}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {targetKind === 'school' && (
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              Role Title (shown in Owners list)
            </label>
            <input
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="Principal / Owner / Admission Coordinator"
              className="w-full px-3 py-1.5 rounded-lg border border-input bg-background text-xs"
            />
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border p-3">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">2. Pick user</p>
        {userId ? (
          <div className="flex items-center justify-between bg-muted rounded-lg px-3 py-2">
            <span className="text-sm font-semibold text-foreground">
              {users?.find((u: any) => u.id === userId)?.full_name ?? userId.slice(0,8)}
            </span>
            <button onClick={() => setUserId(null)} className="text-xs text-muted-foreground">Change</button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={userQ} onChange={(e) => setUserQ(e.target.value)} placeholder="Search by name or phone…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm" />
            </div>
            {users && users.length > 0 && (
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {users.map((u: any) => (
                  <button key={u.id} onClick={() => setUserId(u.id)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted text-sm">
                    <span className="font-semibold text-foreground">{u.full_name || '(no name)'}</span>
                    <span className="text-muted-foreground"> · {u.phone || '—'}</span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-2">
              User must sign up at least once before they appear here.
            </p>
          </>
        )}
      </div>

      <button onClick={assign} disabled={!targetId || !userId || busy}
        className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        {targetKind === 'school' ? 'Assign Institute to User' : 'Assign Shop to User'}
      </button>
    </div>
  );
}

/* ─── Owners (grouped by user, across Shops & Institutes) ────────── */
type OwnerRow = {
  id: string;
  entity_kind: 'shop' | 'school';
  target_id: string;
  user_id: string;
  assigned_at: string;
  role_title?: string | null;
  target: { name: string; area: string | null } | null;
  profiles: { full_name: string | null; phone: string | null } | null;
};
type Group = {
  user_id: string;
  full_name: string;
  phone: string | null;
  items: OwnerRow[];
};

function OwnersGrouped() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [reassign, setReassign] = useState<{ row: OwnerRow } | null>(null);
  const [revokeFor, setRevokeFor] = useState<OwnerRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-owners-grouped'],
    queryFn: async () => {
      const [shopRes, schoolRes] = await Promise.all([
        supabase
          .from('shop_owners')
          .select('id, shop_id, user_id, assigned_at')
          .order('assigned_at', { ascending: false }),
        (supabase.from('school_owners' as any) as any)
          .select('id, school_id, user_id, role_title, assigned_at')
          .order('assigned_at', { ascending: false }),
      ]);

      if (shopRes.error) throw shopRes.error;
      if (schoolRes.error && !isMissingRelationErr(schoolRes.error)) {
        throw schoolRes.error;
      }

      const shopOwnerRows = shopRes.data || [];
      const schoolOwnerRows = schoolRes.error ? [] : (schoolRes.data || []);

      if (!shopOwnerRows.length && !schoolOwnerRows.length) return [] as OwnerRow[];

      const userIds = Array.from(
        new Set([
          ...shopOwnerRows.map((r: any) => r.user_id),
          ...schoolOwnerRows.map((r: any) => r.user_id),
        ]),
      );
      const shopIds = Array.from(new Set(shopOwnerRows.map((r: any) => r.shop_id)));
      const schoolIds = Array.from(new Set(schoolOwnerRows.map((r: any) => r.school_id)));

      const [{ data: profs }, { data: shops }, { data: schools }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, phone').in('id', userIds),
        shopIds.length > 0
          ? supabase.from('shops').select('id, name, area').in('id', shopIds)
          : Promise.resolve({ data: [] as any[] }),
        schoolIds.length > 0
          ? (supabase.from('schools') as any).select('id, name, area').in('id', schoolIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const profilesById: Record<string, any> = {};
      (profs || []).forEach((p: any) => { profilesById[p.id] = p; });
      const shopsById: Record<string, any> = {};
      (shops || []).forEach((s: any) => { shopsById[s.id] = s; });
      const schoolsById: Record<string, any> = {};
      (schools || []).forEach((s: any) => { schoolsById[s.id] = s; });

      const mappedShops: OwnerRow[] = shopOwnerRows.map((r: any) => ({
        id: r.id,
        entity_kind: 'shop',
        target_id: r.shop_id,
        user_id: r.user_id,
        assigned_at: r.assigned_at,
        profiles: profilesById[r.user_id] || null,
        target: shopsById[r.shop_id] || null,
      }));

      const mappedSchools: OwnerRow[] = schoolOwnerRows.map((r: any) => ({
        id: r.id,
        entity_kind: 'school',
        target_id: r.school_id,
        user_id: r.user_id,
        assigned_at: r.assigned_at,
        role_title: r.role_title ?? null,
        profiles: profilesById[r.user_id] || null,
        target: schoolsById[r.school_id] || null,
      }));

      return [...mappedSchools, ...mappedShops].sort(
        (a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime(),
      );
    },
  });

  const groups = useMemo<Group[]>(() => {
    if (!data) return [];
    const map = new Map<string, Group>();
    for (const r of data) {
      if (!map.has(r.user_id)) {
        map.set(r.user_id, {
          user_id: r.user_id,
          full_name: r.profiles?.full_name || `User ${r.user_id.slice(0, 8)}`,
          phone: r.profiles?.phone ?? null,
          items: [],
        });
      }
      map.get(r.user_id)!.items.push(r);
    }
    let arr = Array.from(map.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));
    const needle = q.trim().toLowerCase();
    if (needle) {
      arr = arr.filter((g) =>
        g.full_name.toLowerCase().includes(needle)
        || (g.phone || '').toLowerCase().includes(needle)
        || g.items.some((s) => (s.target?.name || '').toLowerCase().includes(needle))
      );
    }
    return arr;
  }, [data, q]);

  // Expand all groups by default once data loads.
  useEffect(() => {
    if (!data) return;
    setExpanded((prev) => {
      const next = { ...prev };
      for (const r of data) if (!(r.user_id in next)) next[r.user_id] = true;
      return next;
    });
  }, [data]);

  async function doRevoke(row: OwnerRow) {
    const { error } =
      row.entity_kind === 'school'
        ? await supabase.rpc('revoke_school_owner' as any, {
            _school_id: row.target_id,
            _user_id: row.user_id,
          })
        : await supabase.rpc('revoke_shop_owner' as any, {
            _shop_id: row.target_id,
            _user_id: row.user_id,
          });
    if (error) { toast.error(error.message); return; }
    toast.success('Ownership revoked.');
    setRevokeFor(null);
    qc.invalidateQueries({ queryKey: ['admin-owners-grouped'] });
    qc.invalidateQueries({ queryKey: ['admin-stats'] });
    if (row.entity_kind === 'school') {
      qc.invalidateQueries({ queryKey: ['admin-schools'] });
      qc.invalidateQueries({ queryKey: ['schools'] });
    }
  }

  if (isLoading) return <Loading />;
  if (!data?.length) return (
    <EmptyState
      icon={<UserCog className="w-6 h-6" />}
      title="No owners assigned yet"
      hint="Approve a claim or use Direct Assign to link an owner to a shop or institute."
    />
  );

  const handleExportOwnersCsv = () => {
    const flatRows = groups.flatMap((g) => g.items.map((row) => ({ group: g, row })));
    if (!flatRows.length) {
      toast.info('No matching owners to export');
      return;
    }
    const headers = [
      'Owner Name',
      'Owner Phone',
      'Listing Type',
      'Listing Name',
      'Area',
      'Role Title',
      'Assigned At',
    ];
    const csvRows = flatRows.map(({ group, row }) => [
      group.full_name,
      group.phone || '',
      row.entity_kind === 'school' ? 'institute' : 'shop',
      row.target?.name || '',
      row.target?.area || '',
      row.role_title || (row.entity_kind === 'school' ? 'Principal / Owner' : 'Shop Owner'),
      row.assigned_at,
    ]);
    downloadCsv(townCsvFilename(null, 'assigned-owners'), headers, csvRows);
    toast.success(`Exported ${csvRows.length} owner assignment${csvRows.length === 1 ? '' : 's'} to CSV`);
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by owner name, phone, shop, or institute…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm" />
        </div>
        <button
          type="button"
          onClick={handleExportOwnersCsv}
          disabled={!groups.length}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50 shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Export Owners CSV
        </button>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={<Search className="w-6 h-6" />}
          title={`No owners match "${q}"`}
        />
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const open = expanded[g.user_id] !== false;
            return (
              <div key={g.user_id} className="bg-card rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => setExpanded((p) => ({ ...p, [g.user_id]: !open }))}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {open ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <UserCog className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">{g.full_name}</p>
                      {g.phone && (
                        <p className="text-[11px] text-muted-foreground truncate inline-flex items-center gap-1">
                          <Phone className="w-3 h-3" />{g.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] font-bold bg-muted text-foreground px-2 py-0.5 rounded-full">
                    {g.items.length} {g.items.length === 1 ? 'listing' : 'listings'}
                  </span>
                </button>

                {open && (
                  <div className="border-t border-border divide-y divide-border">
                    {g.items.map((row) => {
                      const isSchool = row.entity_kind === 'school';
                      return (
                        <div key={`${row.entity_kind}-${row.id}`} className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 px-3 py-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                                  isSchool
                                    ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
                                    : 'bg-primary/10 text-primary border-primary/20'
                                }`}
                              >
                                {isSchool ? <GraduationCap className="w-2.5 h-2.5" /> : <Store className="w-2.5 h-2.5" />}
                                {isSchool ? 'Institute' : 'Shop'}
                              </span>
                              <p className="text-sm font-semibold text-foreground truncate">{row.target?.name ?? '—'}</p>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {row.target?.area ?? '—'}
                              {row.role_title ? ` · ${row.role_title}` : ''}
                            </p>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <button onClick={() => setReassign({ row })}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                              <ArrowRightLeft className="w-3.5 h-3.5" /> Reassign
                            </button>
                            <button onClick={() => setRevokeFor(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-bold">
                              <Trash2 className="w-3.5 h-3.5" /> Revoke
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ReassignDialog
        row={reassign?.row ?? null}
        onClose={() => setReassign(null)}
        onDone={() => {
          setReassign(null);
          qc.invalidateQueries({ queryKey: ['admin-owners-grouped'] });
        }}
      />

      <AlertDialog open={!!revokeFor} onOpenChange={(o) => !o && setRevokeFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke ownership?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeFor?.profiles?.full_name || 'This user'} will lose edit access to{' '}
              <span className="font-semibold text-foreground">{revokeFor?.target?.name}</span>.
              If this is their only listing, their partner role will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeFor && doRevoke(revokeFor)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ─── Reassign Dialog ─────────────────────────────────────────────── */
function ReassignDialog({
  row, onClose, onDone,
}: { row: OwnerRow | null; onClose: () => void; onDone: () => void }) {
  const [q, setQ] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!row) { setQ(''); setPickedId(null); setBusy(false); }
  }, [row]);

  const { data: users } = useQuery({
    queryKey: ['admin-user-search-reassign', q],
    enabled: !!row && q.length >= 2,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, phone')
        .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`).limit(8);
      return (data || []).filter((u: any) => u.id !== row?.user_id);
    },
  });

  async function reassign() {
    if (!row || !pickedId) return;
    setBusy(true);
    const isSchool = row.entity_kind === 'school';
    const { error: e1 } = isSchool
      ? await supabase.rpc('revoke_school_owner' as any, {
          _school_id: row.target_id, _user_id: row.user_id,
        })
      : await supabase.rpc('revoke_shop_owner' as any, {
          _shop_id: row.target_id, _user_id: row.user_id,
        });
    if (e1) { setBusy(false); toast.error(`Revoke failed: ${e1.message}`); return; }

    const { error: e2 } = isSchool
      ? await supabase.rpc('assign_school_owner' as any, {
          _school_id: row.target_id,
          _user_id: pickedId,
          _role_title: row.role_title || 'Principal / Owner',
        })
      : await supabase.rpc('assign_shop_owner' as any, {
          _shop_id: row.target_id, _user_id: pickedId,
        });
    setBusy(false);
    if (e2) {
      // Try to roll back the revoke so the listing isn't left orphaned.
      if (isSchool) {
        await supabase.rpc('assign_school_owner' as any, {
          _school_id: row.target_id,
          _user_id: row.user_id,
          _role_title: row.role_title || 'Principal / Owner',
        });
      } else {
        await supabase.rpc('assign_shop_owner' as any, {
          _shop_id: row.target_id, _user_id: row.user_id,
        });
      }
      toast.error(`Assign failed, reverted: ${e2.message}`);
      return;
    }
    toast.success(isSchool ? 'Institute reassigned.' : 'Shop reassigned.');
    onDone();
  }

  const picked = users?.find((u: any) => u.id === pickedId);

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row?.entity_kind === 'school' ? 'Reassign institute' : 'Reassign shop'}</DialogTitle>
          <DialogDescription>
            Move <span className="font-semibold text-foreground">{row?.target?.name}</span> from{' '}
            <span className="font-semibold text-foreground">{row?.profiles?.full_name || 'current owner'}</span> to a new user.
          </DialogDescription>
        </DialogHeader>

        {pickedId && picked ? (
          <div className="flex items-center justify-between bg-muted rounded-lg px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{picked.full_name || '(no name)'}</p>
              {picked.phone && <p className="text-[11px] text-muted-foreground">{picked.phone}</p>}
            </div>
            <button onClick={() => setPickedId(null)} className="text-xs text-muted-foreground">Change</button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search new owner by name or phone…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm" />
            </div>
            {users && users.length > 0 && (
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {users.map((u: any) => (
                  <button key={u.id} onClick={() => setPickedId(u.id)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted text-sm">
                    <span className="font-semibold text-foreground">{u.full_name || '(no name)'}</span>
                    <span className="text-muted-foreground"> · {u.phone || '—'}</span>
                  </button>
                ))}
              </div>
            )}
            {q.length >= 2 && users && users.length === 0 && (
              <p className="text-[11px] text-muted-foreground mt-2">No matching users.</p>
            )}
          </>
        )}

        <DialogFooter>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm font-semibold bg-muted text-foreground">
            Cancel
          </button>
          <button onClick={reassign} disabled={!pickedId || busy}
            className="px-3 py-2 rounded-lg text-sm font-bold bg-primary text-primary-foreground disabled:opacity-50 inline-flex items-center gap-1.5">
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Reassign
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Shared ──────────────────────────────────────────────────────── */
function Loading() {
  return <div className="text-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;
}
