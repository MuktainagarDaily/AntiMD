import React, { useState, useEffect, useMemo } from 'react';
import {
  Droplets,
  Zap,
  Building2,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldAlert,
  Users,
  Eye,
  Check,
  Calendar,
  X,
  Phone,
  MessageCircle,
  ExternalLink,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { useCity } from '@/hooks/useCity';
import { useT } from '@/i18n';
import { ConfirmTapButton } from '@/components/admin/_shared/ConfirmTapButton';
import {
  AuthorityAnnouncement,
  AuthorityDepartment,
  AuthorityOrganization,
  OfficerContact,
  AnnouncementCategory,
  AnnouncementPriority,
  AnnouncementStatus,
} from '@/lib/services/authorityTypes';
import {
  fetchDepartments,
  fetchAnnouncementsForCity,
  fetchOrganizationsForCity,
  saveAnnouncement,
  deleteAnnouncement,
  updateAnnouncementStatus,
  saveOrganizationContact,
} from '@/lib/services/authorityService';
import {
  getDevAuthorityRole,
  setDevAuthorityRole,
  canManageDepartment,
  canManageOrganization,
  DEV_AUTHORITY_ROLES,
  DevAuthorityRole,
} from '@/lib/services/devRoleSwitcher';
import { toast } from 'sonner';

export function GovernmentServicesTab() {
  const { currentCity, allVillages } = useCity();
  const { locale } = useT();
  const isMr = locale === 'mr';

  const [activeRole, setActiveRole] = useState<DevAuthorityRole>(getDevAuthorityRole());
  const [departments, setDepartments] = useState<AuthorityDepartment[]>([]);
  const [organizations, setOrganizations] = useState<AuthorityOrganization[]>([]);
  const [announcements, setAnnouncements] = useState<AuthorityAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);

  // Sub-Tab Navigation
  const [adminSubTab, setAdminSubTab] = useState<'announcements' | 'contacts'>('announcements');

  // Filters for Announcements
  const [selectedDeptSlug, setSelectedDeptSlug] = useState<string>('all');
  const [selectedStatusTab, setSelectedStatusTab] = useState<'active' | 'scheduled' | 'completed' | 'draft'>('active');

  // Announcement Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAnn, setEditingAnn] = useState<Partial<AuthorityAnnouncement> | null>(null);

  // Announcement Form Fields
  const [formData, setFormData] = useState({
    title: '',
    title_mr: '',
    description: '',
    description_mr: '',
    department_id: '',
    category: 'interruption' as AnnouncementCategory,
    priority: 'high' as AnnouncementPriority,
    status: 'active' as AnnouncementStatus,
    start_time: '',
    end_time: '',
    selectedVillageId: '',
    area_text: '',
  });

  // Contact Modal State
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<AuthorityOrganization | null>(null);
  const [contactFormData, setContactFormData] = useState({
    helpline_phone: '',
    emergency_phone: '',
    whatsapp_number: '',
    office_address: '',
    maps_url: '',
    visiting_hours: '',
    key_contacts: [] as OfficerContact[],
  });

  // Listen to external role change events
  useEffect(() => {
    const handleRoleChanged = (e: any) => {
      if (e.detail?.role) setActiveRole(e.detail.role);
    };
    window.addEventListener('dev-authority-role-changed', handleRoleChanged);
    return () => window.removeEventListener('dev-authority-role-changed', handleRoleChanged);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [depts, anns, orgs] = await Promise.all([
        fetchDepartments(),
        fetchAnnouncementsForCity(currentCity.id, { includeDrafts: true }),
        fetchOrganizationsForCity(currentCity.id),
      ]);
      setDepartments(depts);
      setAnnouncements(anns);
      setOrganizations(orgs);
    } catch {
      toast.error('Failed to load services data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentCity.id]);

  // Scoped department permissions based on active dev role
  const allowedDepartments = useMemo(() => {
    return departments.filter((d) => canManageDepartment(activeRole, d.slug));
  }, [departments, activeRole]);

  const canCreate = activeRole !== 'citizen';

  // Filtered announcements
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((a) => {
      // 1. RBAC check: if not super admin and not citizen, only show own department
      if (activeRole !== 'super_admin' && activeRole !== 'citizen') {
        const userDeptSlug = DEV_AUTHORITY_ROLES.find((r) => r.id === activeRole)?.departmentSlug;
        if (a.department?.slug !== userDeptSlug) return false;
      }

      // 2. Department filter
      if (selectedDeptSlug !== 'all') {
        if (a.department?.slug !== selectedDeptSlug && a.department_id !== selectedDeptSlug) return false;
      }

      // 3. Status tab filter
      if (selectedStatusTab === 'active' && a.status !== 'active') return false;
      if (selectedStatusTab === 'scheduled' && a.status !== 'scheduled') return false;
      if (selectedStatusTab === 'completed' && a.status !== 'completed') return false;
      if (selectedStatusTab === 'draft' && a.status !== 'draft') return false;

      return true;
    });
  }, [announcements, activeRole, selectedDeptSlug, selectedStatusTab]);

  const handleOpenCreateModal = () => {
    // If a specific department tab is selected, prioritize it if user has access
    const tabDept = selectedDeptSlug !== 'all' ? departments.find((d) => d.slug === selectedDeptSlug) : null;
    const defaultDept =
      (tabDept && canManageDepartment(activeRole, tabDept.slug) ? tabDept : null) ||
      allowedDepartments[0] ||
      departments[0];
    const now = new Date();
    const end = new Date(now.getTime() + 4 * 3600 * 1000);

    setEditingAnn(null);
    setFormData({
      title: '',
      title_mr: '',
      description: '',
      description_mr: '',
      department_id: defaultDept?.id || '',
      category: 'interruption',
      priority: 'high',
      status: 'active',
      start_time: now.toISOString().slice(0, 16),
      end_time: end.toISOString().slice(0, 16),
      selectedVillageId: '',
      area_text: 'Ward No. 1, Main Road',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (ann: AuthorityAnnouncement) => {
    setEditingAnn(ann);
    setFormData({
      title: ann.title || '',
      title_mr: ann.title_mr || '',
      description: ann.description || '',
      description_mr: ann.description_mr || '',
      department_id: ann.department_id || '',
      category: ann.category || 'interruption',
      priority: ann.priority || 'medium',
      status: ann.status || 'draft',
      start_time: ann.start_time ? new Date(ann.start_time).toISOString().slice(0, 16) : '',
      end_time: ann.end_time ? new Date(ann.end_time).toISOString().slice(0, 16) : '',
      selectedVillageId: ann.locations?.[0]?.village_id || '',
      area_text: ann.locations?.[0]?.area_text || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    try {
      const toSafeIso = (val?: string | null): string | null => {
        if (!val || !val.trim()) return null;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d.toISOString();
      };

      const payload: Partial<AuthorityAnnouncement> = {
        ...(editingAnn ? { id: editingAnn.id } : {}),
        city_id: currentCity.id,
        department_id: formData.department_id,
        title: formData.title.trim(),
        title_mr: formData.title_mr.trim() || formData.title.trim(),
        description: formData.description.trim(),
        description_mr: formData.description_mr.trim() || formData.description.trim(),
        category: formData.category,
        priority: formData.priority,
        status: formData.status,
        start_time: toSafeIso(formData.start_time),
        end_time: toSafeIso(formData.end_time),
        is_demo: true,
        locations: [
          {
            city_id: currentCity.id,
            village_id: formData.selectedVillageId || null,
            area_text: formData.area_text.trim() || 'Town-wide',
          },
        ],
      };

      await saveAnnouncement(payload);
      toast.success(editingAnn ? 'Announcement updated' : 'Announcement published');
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error('Failed to save announcement: ' + (err?.message || 'Error'));
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await deleteAnnouncement(id);
      toast.success('Announcement removed');
      await loadData();
    } catch {
      toast.error('Failed to delete announcement');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: AnnouncementStatus) => {
    const nextStatus: AnnouncementStatus = currentStatus === 'active' ? 'completed' : 'active';
    try {
      await updateAnnouncementStatus(id, nextStatus);
      toast.success(`Status updated to ${nextStatus}`);
      await loadData();
    } catch {
      toast.error('Failed to update status');
    }
  };

  // Organization Contact Handlers
  const handleOpenContactModal = (org: AuthorityOrganization) => {
    setEditingOrg(org);
    setContactFormData({
      helpline_phone: org.helpline_phone || '',
      emergency_phone: org.emergency_phone || '',
      whatsapp_number: org.whatsapp_number || '',
      office_address: org.office_address || '',
      maps_url: org.maps_url || '',
      visiting_hours: org.visiting_hours || '10:30 AM - 05:30 PM (Mon-Sat)',
      key_contacts: Array.isArray(org.key_contacts) ? [...org.key_contacts] : [],
    });
    setIsContactModalOpen(true);
  };

  const handleAddOfficer = () => {
    setContactFormData({
      ...contactFormData,
      key_contacts: [
        ...contactFormData.key_contacts,
        { id: `kc-${Date.now()}`, role: '', name: '', phone: '' },
      ],
    });
  };

  const handleOfficerChange = (index: number, field: keyof OfficerContact, value: string) => {
    const updated = [...contactFormData.key_contacts];
    updated[index] = { ...updated[index], [field]: value };
    setContactFormData({ ...contactFormData, key_contacts: updated });
  };

  const handleRemoveOfficer = (index: number) => {
    const updated = contactFormData.key_contacts.filter((_, i) => i !== index);
    setContactFormData({ ...contactFormData, key_contacts: updated });
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrg) return;
    if (!contactFormData.helpline_phone.trim()) {
      toast.error('Primary Helpline phone is required');
      return;
    }

    try {
      await saveOrganizationContact({
        id: editingOrg.id,
        helpline_phone: contactFormData.helpline_phone.trim(),
        emergency_phone: contactFormData.emergency_phone.trim() || null,
        whatsapp_number: contactFormData.whatsapp_number.trim() || null,
        office_address: contactFormData.office_address.trim() || null,
        maps_url: contactFormData.maps_url.trim() || null,
        visiting_hours: contactFormData.visiting_hours.trim() || null,
        key_contacts: contactFormData.key_contacts.filter(
          (c) => c.role.trim() || c.name.trim() || c.phone.trim()
        ),
      });

      toast.success('Department contact details and roster updated');
      setIsContactModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error('Failed to update contacts: ' + (err?.message || 'Error'));
    }
  };

  const getDeptIcon = (slug?: string) => {
    switch (slug) {
      case 'water':
        return <Droplets className="w-4 h-4 text-blue-500" />;
      case 'electricity':
        return <Zap className="w-4 h-4 text-amber-500" />;
      case 'municipal':
        return <Building2 className="w-4 h-4 text-emerald-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Dev Role Switcher Banner */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-secondary/10 p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dev RBAC Switcher</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  Local 1-Tap Simulation
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Testing multi-tenant authority permissions. Click a persona to simulate its exact grant scope:
              </p>
            </div>
          </div>

          {/* Persona Pills */}
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            {DEV_AUTHORITY_ROLES.map((role) => {
              const isSelected = activeRole === role.id;
              return (
                <button
                  key={role.id}
                  onClick={() => {
                    setActiveRole(role.id);
                    setDevAuthorityRole(role.id);
                    toast.info(`Switched role to: ${role.label}`);
                  }}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all active:scale-95 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-card text-foreground hover:bg-muted border-border'
                  }`}
                  title={role.description}
                >
                  {role.id === 'water_admin' && <Droplets className="w-3 h-3 text-blue-400" />}
                  {role.id === 'electricity_admin' && <Zap className="w-3 h-3 text-amber-400" />}
                  {role.id === 'municipal_admin' && <Building2 className="w-3 h-3 text-emerald-400" />}
                  <span>{role.label}</span>
                  {isSelected && <Check className="w-3 h-3" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Sub-Tab Switcher: Announcements vs Contacts */}
      <div className="flex items-center gap-2 border-b border-border pb-1">
        <button
          onClick={() => setAdminSubTab('announcements')}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition-all ${
            adminSubTab === 'announcements'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Announcements & Outages</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted font-semibold">
            {announcements.length}
          </span>
        </button>

        <button
          onClick={() => setAdminSubTab('contacts')}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition-all ${
            adminSubTab === 'contacts'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Phone className="w-4 h-4" />
          <span>Department Contacts & Helplines</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted font-semibold">
            {organizations.length}
          </span>
        </button>
      </div>

      {/* =========================================================================
          SUB-TAB 1: ANNOUNCEMENTS & OUTAGES
          ========================================================================= */}
      {adminSubTab === 'announcements' && (
        <div className="space-y-4">
          {/* Header & Action Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <span>Civic Outages & Broadcasts</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {currentCity.name}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Broadcast water pipeline repairs, feeder maintenance cuts, and municipal alerts.
              </p>
            </div>

            {canCreate ? (
              <button
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 transition-all active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Post New Announcement</span>
              </button>
            ) : (
              <div className="text-xs px-3 py-1.5 rounded-lg bg-muted text-muted-foreground border">
                Citizen Mode: Read Only
              </div>
            )}
          </div>

          {/* Department Tabs & Status Sub-Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border pb-3">
            {/* Department Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
              <button
                onClick={() => setSelectedDeptSlug('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedDeptSlug === 'all'
                    ? 'bg-foreground text-background font-bold'
                    : 'bg-muted/70 hover:bg-muted text-muted-foreground'
                }`}
              >
                All Departments
              </button>
              {departments.map((dept) => {
                const hasAccess = canManageDepartment(activeRole, dept.slug);
                const isSelected = selectedDeptSlug === dept.slug;
                return (
                  <button
                    key={dept.id}
                    onClick={() => setSelectedDeptSlug(dept.slug)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                      isSelected
                        ? 'bg-foreground text-background font-bold'
                        : 'bg-muted/70 hover:bg-muted text-muted-foreground'
                    } ${!hasAccess && activeRole !== 'citizen' ? 'opacity-50' : ''}`}
                    title={!hasAccess && activeRole !== 'citizen' ? 'No admin grant for this department' : undefined}
                  >
                    {getDeptIcon(dept.slug)}
                    <span>{isMr ? dept.name_mr : dept.name}</span>
                    {!hasAccess && activeRole !== 'citizen' && <span className="text-[10px]">🔒</span>}
                  </button>
                );
              })}
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl self-start sm:self-auto">
              {(['active', 'scheduled', 'completed', 'draft'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedStatusTab(tab)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                    selectedStatusTab === tab
                      ? 'bg-card text-foreground shadow-2xs font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'active' && 'Active Outages'}
                  {tab === 'scheduled' && 'Scheduled'}
                  {tab === 'completed' && 'Past Updates'}
                  {tab === 'draft' && 'Drafts'}
                </button>
              ))}
            </div>
          </div>

          {/* Announcements List */}
          {loading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">Loading announcements...</div>
          ) : filteredAnnouncements.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed bg-card p-10 text-center">
              <AlertTriangle className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
              <h3 className="font-semibold text-sm text-foreground">No announcements in this view</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                No notices match the selected department or status filters.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAnnouncements.map((ann) => {
                const hasEditGrant = canManageDepartment(activeRole, ann.department?.slug);
                const isActive = ann.status === 'active';

                return (
                  <div
                    key={ann.id}
                    className="rounded-2xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Department Badge */}
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border">
                          {getDeptIcon(ann.department?.slug)}
                          <span>{isMr ? ann.department?.name_mr : ann.department?.name}</span>
                        </span>

                        {/* Priority Badge */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                            ann.priority === 'critical'
                              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                              : ann.priority === 'high'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                              : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'
                          }`}
                        >
                          {ann.priority}
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                            isActive
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              : ann.status === 'scheduled'
                              ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
                              : 'bg-muted text-muted-foreground border-border'
                          }`}
                        >
                          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                          <span className="capitalize">{ann.status}</span>
                          {ann.isExpiredOutage && ' (Auto-Expired)'}
                        </span>

                        {/* Demo Flag Badge */}
                        {ann.is_demo && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30">
                            [DEMO SIMULATION]
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      {hasEditGrant && (
                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                          <ConfirmTapButton
                            onConfirm={() => handleToggleStatus(ann.id, ann.status)}
                            className="text-xs px-2.5 py-1 rounded-lg border font-semibold bg-muted hover:bg-muted/80 text-foreground transition-all"
                            confirmClassName="text-xs px-2.5 py-1 rounded-lg border font-bold bg-amber-500 text-white"
                            confirmLabel="Tap to toggle"
                          >
                            {isActive ? 'Mark Resolved' : 'Set Active'}
                          </ConfirmTapButton>

                          <button
                            onClick={() => handleOpenEditModal(ann)}
                            aria-label="Edit announcement"
                            className="p-1.5 rounded-lg border hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <ConfirmTapButton
                            onConfirm={() => handleDeleteAnnouncement(ann.id)}
                            className="p-1.5 rounded-lg border text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all"
                            confirmClassName="px-2 py-1 rounded-lg text-xs font-bold bg-rose-600 text-white"
                            confirmLabel="Delete?"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </ConfirmTapButton>
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="font-bold text-sm sm:text-base text-foreground leading-snug">
                        {isMr ? ann.title_mr || ann.title : ann.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {isMr ? ann.description_mr || ann.description : ann.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                      {ann.locations && ann.locations.length > 0 && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-primary shrink-0" />
                          <span>{ann.locations.map((l) => l.area_text).filter(Boolean).join(', ')}</span>
                        </div>
                      )}

                      {(ann.start_time || ann.end_time) && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>
                            {ann.start_time
                              ? new Date(ann.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : '—'}{' '}
                            to{' '}
                            {ann.end_time
                              ? new Date(ann.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : 'Ongoing'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 2: DEPARTMENT HELPLINES & CONTACTS CRUD
          ========================================================================= */}
      {adminSubTab === 'contacts' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <span>Department Helplines, Addresses & Key Roster</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {currentCity.name}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Manage 24x7 control room numbers, WhatsApp desks, office visiting hours, and on-duty engineers.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {organizations.map((org) => {
              const hasOrgAccess = canManageOrganization(activeRole, org, departments);
              const orgDeptSlug = departments.find((d) => org.department_ids?.includes(d.id))?.slug;

              return (
                <div
                  key={org.id}
                  className="rounded-2xl border bg-card p-5 space-y-4 shadow-2xs hover:border-primary/40 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 mt-0.5">
                        {getDeptIcon(orgDeptSlug)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-base text-foreground">
                            {isMr ? org.name_mr : org.name}
                          </h3>
                          {org.is_demo && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30">
                              [DEMO SIMULATION]
                            </span>
                          )}
                        </div>

                        {org.office_address && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>{org.office_address}</span>
                            {org.maps_url && (
                              <a
                                href={org.maps_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-primary hover:underline text-[11px] font-semibold ml-1"
                              >
                                <span>Directions</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        )}

                        {org.visiting_hours && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span>Hours: {org.visiting_hours}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {hasOrgAccess ? (
                      <button
                        onClick={() => handleOpenContactModal(org)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 transition-all active:scale-95 shrink-0 self-start"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit Department Details</span>
                      </button>
                    ) : (
                      <span className="text-[11px] px-2.5 py-1 rounded-lg bg-muted text-muted-foreground border shrink-0">
                        🔒 Scoped: Read Only
                      </span>
                    )}
                  </div>

                  {/* Public Contact Channels */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t">
                    <div className="p-3 rounded-xl bg-muted/50 border space-y-1">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3 text-primary" />
                        <span>Primary Helpline</span>
                      </span>
                      <p className="font-bold text-sm text-foreground">{org.helpline_phone || '—'}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3 text-rose-500" />
                        <span>24x7 Emergency Line</span>
                      </span>
                      <p className="font-bold text-sm text-rose-800 dark:text-rose-200">
                        {org.emergency_phone || 'Same as Helpline'}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                        <MessageCircle className="w-3 h-3 text-emerald-500" />
                        <span>WhatsApp Desk</span>
                      </span>
                      <p className="font-bold text-sm text-emerald-800 dark:text-emerald-200">
                        {org.whatsapp_number ? `+${org.whatsapp_number}` : 'Not configured'}
                      </p>
                    </div>
                  </div>

                  {/* Key Officer Roster */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-primary" />
                        <span>On-Duty Officers & Engineers Roster</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {org.key_contacts?.length || 0} officers listed
                      </span>
                    </div>

                    {org.key_contacts && org.key_contacts.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {org.key_contacts.map((officer, idx) => (
                          <div
                            key={officer.id || idx}
                            className="flex items-center justify-between p-2.5 rounded-xl border bg-muted/30 text-xs"
                          >
                            <div>
                              <p className="font-bold text-foreground">{officer.name}</p>
                              <p className="text-[11px] text-muted-foreground">{officer.role}</p>
                            </div>
                            {officer.phone && (
                              <a
                                href={`tel:${officer.phone}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                              >
                                <Phone className="w-3 h-3" />
                                <span>{officer.phone}</span>
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No individual officers rostered yet. Click "Edit Department Details" to add duty engineers.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          ANNOUNCEMENT MODAL
          ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
          <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/40">
              <h3 className="font-bold text-base text-foreground">
                {editingAnn ? 'Edit Authority Announcement' : 'Post Authority Announcement'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAnnouncement} className="p-5 space-y-4 overflow-y-auto">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200">
                <strong>[DEMO SIMULATION]:</strong> All notices created here will carry the prominent demonstration badge to ensure zero confusion with real civic bodies.
              </div>

              {/* Department Picker */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Department</label>
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  className="w-full text-xs rounded-xl border border-border bg-background px-3 py-2"
                >
                  {allowedDepartments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.name_mr})
                    </option>
                  ))}
                </select>
              </div>

              {/* Titles */}
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Title (English)</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Scheduled Water Pipeline Maintenance at Station Road"
                    className="w-full text-xs rounded-xl border border-border bg-background px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Title (Marathi)</label>
                  <input
                    type="text"
                    value={formData.title_mr}
                    onChange={(e) => setFormData({ ...formData, title_mr: e.target.value })}
                    placeholder="उदा. स्टेशन रोड येथे नियोजित जलवाहिनी दुरुस्ती काम"
                    className="w-full text-xs rounded-xl border border-border bg-background px-3 py-2"
                  />
                </div>
              </div>

              {/* Descriptions */}
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Description (English)</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Explain the outage, reason, and estimated completion time..."
                    className="w-full text-xs rounded-xl border border-border bg-background px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Description (Marathi)</label>
                  <textarea
                    rows={2}
                    value={formData.description_mr}
                    onChange={(e) => setFormData({ ...formData, description_mr: e.target.value })}
                    placeholder="दुरुस्तीचे कारण, बाधित परिसर व पूर्ववत होण्याची अंदाजित वेळ..."
                    className="w-full text-xs rounded-xl border border-border bg-background px-3 py-2"
                  />
                </div>
              </div>

              {/* Priority, Category & Status */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full text-xs rounded-xl border border-border bg-background px-2.5 py-2"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical (Emergency)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full text-xs rounded-xl border border-border bg-background px-2.5 py-2"
                  >
                    <option value="interruption">Interruption (Outage)</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="emergency">Emergency</option>
                    <option value="notice">Notice</option>
                    <option value="advisory">Advisory</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full text-xs rounded-xl border border-border bg-background px-2.5 py-2"
                  >
                    <option value="active">Active Now</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="draft">Draft</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              {/* Window */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Start Time</label>
                  <input
                    type="datetime-local"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full text-xs rounded-xl border border-border bg-background px-2.5 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">End Time</label>
                  <input
                    type="datetime-local"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full text-xs rounded-xl border border-border bg-background px-2.5 py-2"
                  />
                </div>
              </div>

              {/* Affected Location Target */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-foreground">Target Geographic Area</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={formData.selectedVillageId}
                    onChange={(e) => setFormData({ ...formData, selectedVillageId: e.target.value })}
                    className="w-full text-xs rounded-xl border border-border bg-background px-2.5 py-2"
                  >
                    <option value="">{currentCity.name} (Town Proper)</option>
                    {allVillages.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.name_mr || ''})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={formData.area_text}
                    onChange={(e) => setFormData({ ...formData, area_text: e.target.value })}
                    placeholder="Specific wards e.g. Ward 2, Station Rd"
                    className="w-full text-xs rounded-xl border border-border bg-background px-2.5 py-2"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
                >
                  {editingAnn ? 'Update Announcement' : 'Publish Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          ORGANIZATION CONTACTS & ROSTER MODAL
          ========================================================================= */}
      {isContactModalOpen && editingOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
          <div className="bg-card w-full max-w-xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/40">
              <div>
                <h3 className="font-bold text-base text-foreground">
                  Edit Department Contacts & Officer Roster
                </h3>
                <p className="text-xs text-muted-foreground">{editingOrg.name}</p>
              </div>
              <button
                onClick={() => setIsContactModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="p-5 space-y-4 overflow-y-auto">
              {/* Helplines */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Primary Helpline Phone *
                  </label>
                  <input
                    type="text"
                    required
                    value={contactFormData.helpline_phone}
                    onChange={(e) =>
                      setContactFormData({ ...contactFormData, helpline_phone: e.target.value })
                    }
                    placeholder="e.g. 02583-222101 or 1912"
                    className="w-full text-xs rounded-xl border border-border bg-background px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    24x7 Emergency / Control Room Phone
                  </label>
                  <input
                    type="text"
                    value={contactFormData.emergency_phone}
                    onChange={(e) =>
                      setContactFormData({ ...contactFormData, emergency_phone: e.target.value })
                    }
                    placeholder="e.g. 9822001100"
                    className="w-full text-xs rounded-xl border border-border bg-background px-3 py-2"
                  />
                </div>
              </div>

              {/* WhatsApp & Visiting Hours */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    WhatsApp Complaint Number
                  </label>
                  <input
                    type="text"
                    value={contactFormData.whatsapp_number}
                    onChange={(e) =>
                      setContactFormData({ ...contactFormData, whatsapp_number: e.target.value })
                    }
                    placeholder="e.g. 919822001100"
                    className="w-full text-xs rounded-xl border border-border bg-background px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Office / Visiting Hours
                  </label>
                  <input
                    type="text"
                    value={contactFormData.visiting_hours}
                    onChange={(e) =>
                      setContactFormData({ ...contactFormData, visiting_hours: e.target.value })
                    }
                    placeholder="e.g. 10:30 AM - 05:30 PM (Mon-Sat)"
                    className="w-full text-xs rounded-xl border border-border bg-background px-3 py-2"
                  />
                </div>
              </div>

              {/* Physical Office Address */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Physical Office Address
                </label>
                <input
                  type="text"
                  value={contactFormData.office_address}
                  onChange={(e) =>
                    setContactFormData({ ...contactFormData, office_address: e.target.value })
                  }
                  placeholder="e.g. Near Old Water Tank, Main Road, Muktainagar"
                  className="w-full text-xs rounded-xl border border-border bg-background px-3 py-2"
                />
              </div>

              {/* Google Maps Pin URL */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Google Maps Location / Pin URL
                </label>
                <input
                  type="url"
                  value={contactFormData.maps_url}
                  onChange={(e) =>
                    setContactFormData({ ...contactFormData, maps_url: e.target.value })
                  }
                  placeholder="https://maps.google.com/?q=..."
                  className="w-full text-xs rounded-xl border border-border bg-background px-3 py-2"
                />
              </div>

              {/* Dynamic Key Officer Roster */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-foreground">
                      On-Duty Officers & Engineers Roster
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      List key officers, section engineers, and line supervisors citizens can contact directly.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddOfficer}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-muted hover:bg-muted/80 text-foreground border"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add Officer</span>
                  </button>
                </div>

                {contactFormData.key_contacts.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed text-center text-xs text-muted-foreground">
                    No individual officers rostered. Click "Add Officer" to list section engineers or technicians.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {contactFormData.key_contacts.map((officer, idx) => (
                      <div
                        key={officer.id || idx}
                        className="flex items-center gap-2 p-2.5 rounded-xl border bg-muted/40"
                      >
                        <input
                          type="text"
                          value={officer.role}
                          onChange={(e) => handleOfficerChange(idx, 'role', e.target.value)}
                          placeholder="Designation e.g. Section Engineer"
                          className="w-1/3 text-xs rounded-lg border border-border bg-background px-2.5 py-1.5"
                        />
                        <input
                          type="text"
                          value={officer.name}
                          onChange={(e) => handleOfficerChange(idx, 'name', e.target.value)}
                          placeholder="Officer Name"
                          className="w-1/3 text-xs rounded-lg border border-border bg-background px-2.5 py-1.5"
                        />
                        <input
                          type="text"
                          value={officer.phone}
                          onChange={(e) => handleOfficerChange(idx, 'phone', e.target.value)}
                          placeholder="Mobile Number"
                          className="w-1/3 text-xs rounded-lg border border-border bg-background px-2.5 py-1.5"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveOfficer(idx)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Remove officer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
                >
                  Save Department Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
