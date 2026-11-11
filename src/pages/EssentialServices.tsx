import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Droplets,
  Zap,
  Building2,
  AlertTriangle,
  Clock,
  MapPin,
  Phone,
  MessageCircle,
  Share2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldAlert,
  Info,
  UserCheck,
} from 'lucide-react';
import { PageSeo } from '@/components/seo/PageSeo';
import { LocationPill } from '@/components/shared/LocationPill';
import { DesktopNav } from '@/components/DesktopNav';
import { UserMenuDrawer } from '@/components/UserMenuDrawer';
import { Footer } from '@/components/shared/Footer';
import { useCity } from '@/hooks/useCity';
import { useT } from '@/i18n';
import {
  AuthorityDepartment,
  AuthorityOrganization,
  AuthorityAnnouncement,
} from '@/lib/services/authorityTypes';
import {
  fetchDepartments,
  fetchOrganizationsForCity,
  fetchAnnouncementsForCity,
  formatAnnouncementWhatsAppShare,
} from '@/lib/services/authorityService';
import { toast } from 'sonner';

export default function EssentialServices() {
  const navigate = useNavigate();
  const { currentCity, currentVillage, townName, getPageTitle } = useCity();
  const { t, locale } = useT();
  const isMr = locale === 'mr';

  const [departments, setDepartments] = useState<AuthorityDepartment[]>([]);
  const [organizations, setOrganizations] = useState<AuthorityOrganization[]>([]);
  const [announcements, setAnnouncements] = useState<AuthorityAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);

  // Department Filter
  const [selectedDeptSlug, setSelectedDeptSlug] = useState<string>('all');
  const [showPastHistory, setShowPastHistory] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const [depts, orgs, anns] = await Promise.all([
          fetchDepartments(),
          fetchOrganizationsForCity(currentCity.id),
          fetchAnnouncementsForCity(currentCity.id, { villageId: currentVillage?.id }),
        ]);
        if (isMounted) {
          setDepartments(depts);
          setOrganizations(orgs);
          setAnnouncements(anns);
        }
      } catch {
        if (isMounted) toast.error('Failed to load civic notices');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [currentCity.id, currentVillage?.id]);

  // Filtered by selected department
  const filteredAnnouncements = useMemo(() => {
    if (selectedDeptSlug === 'all') return announcements;
    return announcements.filter(
      (a) => a.department?.slug === selectedDeptSlug || a.department_id === selectedDeptSlug
    );
  }, [announcements, selectedDeptSlug]);

  const activeOutages = useMemo(
    () => filteredAnnouncements.filter((a) => a.status === 'active'),
    [filteredAnnouncements]
  );

  const scheduledMaintenance = useMemo(
    () => filteredAnnouncements.filter((a) => a.status === 'scheduled'),
    [filteredAnnouncements]
  );

  const pastAnnouncements = useMemo(
    () => filteredAnnouncements.filter((a) => a.status === 'completed' || a.status === 'cancelled'),
    [filteredAnnouncements]
  );

  const filteredOrgs = useMemo(() => {
    if (selectedDeptSlug === 'all') return organizations;
    const targetDept = departments.find((d) => d.slug === selectedDeptSlug);
    if (!targetDept) return organizations;
    return organizations.filter((o) => o.department_ids?.includes(targetDept.id));
  }, [organizations, departments, selectedDeptSlug]);

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

  const handleShareWhatsApp = (ann: AuthorityAnnouncement) => {
    const text = formatAnnouncementWhatsAppShare(ann, townName, locale as 'en' | 'mr');
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const formatWindow = (start?: string | null, end?: string | null) => {
    if (!start && !end) return isMr ? 'थेट सूचना' : 'Live Notice';
    const fmt = (dStr: string) => {
      try {
        const d = new Date(dStr);
        return d.toLocaleTimeString(isMr ? 'mr-IN' : 'en-IN', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      } catch {
        return dStr;
      }
    };
    if (start && end) return `${fmt(start)} – ${fmt(end)}`;
    if (start) return `${fmt(start)} onwards`;
    return `Until ${fmt(end!)}`;
  };

  const pageTitle = getPageTitle(isMr ? 'अत्यावश्यक सेवा व नागरी सूचना' : 'Essential Services & Civic Alerts');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PageSeo
        title={pageTitle}
        description={
          isMr
            ? `${townName} मधील पाणीपुरवठा, वीज वितरण व नगरपरिषद अत्यावश्यक सेवा, नियोजित दुरुस्ती वेळापत्रक आणि हेल्पलाईन संपर्क.`
            : `Water supply outages, electricity load maintenance, and municipal civic announcements for ${townName}.`
        }
        path={`/${currentCity.slug}/services`}
      />

      {/* 1. Header Bar */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-lg md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => navigate(`/${currentCity.slug}`)}
              className="p-1.5 -ml-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-95"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-foreground truncate">
                {isMr ? 'अत्यावश्यक सेवा व सूचना' : 'Essential Services & Alerts'}
              </h1>
              <p className="text-[11px] text-muted-foreground truncate">
                {isMr ? `${townName} नागरी व स्थानिक प्रशासन` : `${townName} Local Authorities`}
              </p>
            </div>
          </div>

          <DesktopNav variant="default" />

          <div className="flex items-center gap-2 shrink-0">
            <LocationPill />
            <div className="hidden md:block">
              <UserMenuDrawer />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 pb-16 flex-1 w-full space-y-4">
        {/* 2. Transparent DEMO SIMULATION Disclaimer */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-start gap-3 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="text-xs leading-relaxed space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-amber-800 dark:text-amber-200">
                {isMr ? 'डेमो सिम्युलेशन सूचना' : 'Demo Simulation System'}
              </span>
              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-md bg-amber-500/30 text-amber-900 dark:text-amber-100 border border-amber-500/40">
                [DEMO ONLY]
              </span>
            </div>
            <p className="text-amber-700/90 dark:text-amber-300/90 text-[11px]">
              {isMr
                ? 'या पेजवरील सर्व संस्था, संपर्क क्रमांक व दुरुस्ती वेळापत्रक केवळ ॲप चाचणी व सरावासाठी तयार केलेले सिम्युलेशन आहेत. वास्तविक शासकीय आणीबाणीसाठी थेट मूळ कार्यालयाशी संपर्क साधावा.'
                : 'All authority announcements, scheduled maintenance timings, and contacts shown here are illustrative test simulations for platform demonstration. For actual civic emergencies, contact official offices directly.'}
            </p>
          </div>
        </div>

        {/* 3. Department Quick-Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto md:flex-wrap scrollbar-none pb-1">
          <button
            onClick={() => setSelectedDeptSlug('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
              selectedDeptSlug === 'all'
                ? 'bg-primary text-primary-foreground font-bold shadow-2xs'
                : 'bg-card border border-border text-foreground hover:bg-muted'
            }`}
          >
            {isMr ? 'सर्व विभाग' : 'All Departments'}
          </button>
          {departments.map((dept) => {
            const isSelected = selectedDeptSlug === dept.slug;
            return (
              <button
                key={dept.id}
                onClick={() => setSelectedDeptSlug(dept.slug)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-primary text-primary-foreground font-bold shadow-2xs'
                    : 'bg-card border border-border text-foreground hover:bg-muted'
                }`}
              >
                {getDeptIcon(dept.slug)}
                <span>{isMr ? dept.name_mr : dept.name}</span>
              </button>
            );
          })}
        </div>

        {/* Civic Dashboard Layout: Split 2-Column on Desktop (>= lg), Sequential on Mobile */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
          {/* Left Column: Outages, Maintenance, and History */}
          <div className="lg:col-span-7 space-y-4">
            {/* 4. Active Outages & Interruptions */}
            <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>{isMr ? 'सध्या सुरू असलेल्या दुरुस्त्या व खंड' : 'Live Outages & Interruptions'}</span>
            </h2>
            <span className="text-[11px] text-muted-foreground font-medium">
              {activeOutages.length} {isMr ? 'सक्रिय' : 'active'}
            </span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              {isMr ? 'माहिती लोड होत आहे...' : 'Loading notices...'}
            </div>
          ) : activeOutages.length === 0 ? (
            <div className="rounded-2xl border bg-card/60 p-4 text-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
              <p className="text-xs font-semibold text-foreground">
                {isMr ? 'सध्या कोणताही खंड किंवा तातडीची दुरुस्ती नाही' : 'No active outages reported'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isMr ? 'पाणी व वीजपुरवठा सुरळीत सुरू आहे.' : 'Water and electricity supplies are running normally.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeOutages.map((ann) => {
                const org = ann.organization;
                return (
                  <div
                    key={ann.id}
                    className="rounded-2xl border-2 border-rose-500/30 bg-gradient-to-br from-rose-500/10 via-card to-card p-4 shadow-2xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                          {getDeptIcon(ann.department?.slug)}
                          <span>{isMr ? ann.department?.name_mr : ann.department?.name}</span>
                        </span>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
                          {isMr ? 'सक्रिय खंड' : 'Active Outage'}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30">
                          [DEMO]
                        </span>
                      </div>

                      <button
                        onClick={() => handleShareWhatsApp(ann)}
                        aria-label="Share alert on WhatsApp"
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 transition-all active:scale-95"
                      >
                        <Share2 className="w-3 h-3" />
                        <span>Forward</span>
                      </button>
                    </div>

                    <div>
                      <h3 className="font-extrabold text-sm sm:text-base text-foreground leading-snug">
                        {isMr ? ann.title_mr || ann.title : ann.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {isMr ? ann.description_mr || ann.description : ann.description}
                      </p>
                    </div>

                    <div className="space-y-1.5 text-xs bg-card/80 border rounded-xl p-2.5">
                      <div className="flex items-center gap-2 text-foreground font-semibold">
                        <Clock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>{formatWindow(ann.start_time, ann.end_time)}</span>
                      </div>

                      {ann.locations && ann.locations.length > 0 && (
                        <div className="flex items-start gap-2 text-muted-foreground text-[11px]">
                          <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                          <span>{ann.locations.map((l) => l.area_text).filter(Boolean).join(', ')}</span>
                        </div>
                      )}
                    </div>

                    {/* Quick Helpline Actions */}
                    {org && (
                      <div className="flex items-center gap-2 pt-1">
                        {org.emergency_phone && (
                          <a
                            href={`tel:${org.emergency_phone}`}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition-all active:scale-95 shadow-2xs"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>{isMr ? 'तातडीची हेल्पलाईन' : 'Emergency Call'}</span>
                          </a>
                        )}
                        {org.whatsapp_number && (
                          <a
                            href={`https://wa.me/${org.whatsapp_number}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-[#25D366] text-white hover:opacity-90 transition-all active:scale-95 shadow-2xs"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 5. Upcoming Scheduled Maintenance */}
        <section className="space-y-2.5 pt-2">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-primary" />
            <span>{isMr ? 'नियोजित देखभाल वेळापत्रक' : 'Scheduled Maintenance & Servicing'}</span>
          </h2>

          {scheduledMaintenance.length === 0 ? (
            <div className="rounded-2xl border bg-card/60 p-4 text-center">
              <p className="text-xs text-muted-foreground">
                {isMr ? 'कोणतेही नियोजित शटडाऊन नोंदवलेले नाही.' : 'No scheduled shutdowns on calendar.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {scheduledMaintenance.map((ann) => (
                <div key={ann.id} className="rounded-2xl border bg-card p-3.5 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                        {getDeptIcon(ann.department?.slug)}
                        <span>{isMr ? ann.department?.name_mr : ann.department?.name}</span>
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                        {isMr ? 'नियोजित काम' : 'Scheduled'}
                      </span>
                    </div>

                    <button
                      onClick={() => handleShareWhatsApp(ann)}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>Forward</span>
                    </button>
                  </div>

                  <h4 className="font-bold text-xs sm:text-sm text-foreground">
                    {isMr ? ann.title_mr || ann.title : ann.title}
                  </h4>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {isMr ? ann.description_mr || ann.description : ann.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t">
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <Clock className="w-3 h-3 text-primary shrink-0" />
                      {formatWindow(ann.start_time, ann.end_time)}
                    </span>
                    {ann.locations?.[0]?.area_text && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {ann.locations[0].area_text}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 7. Past Announcements History (Collapsible) */}
        {pastAnnouncements.length > 0 && (
          <section className="pt-2">
            <button
              onClick={() => setShowPastHistory(!showPastHistory)}
              className="w-full flex items-center justify-between p-3 rounded-xl border bg-card text-xs font-bold text-muted-foreground hover:text-foreground transition-all"
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span>
                  {isMr ? 'मागील पूर्ण झालेल्या सूचना व दुरुस्त्या' : 'Past & Resolved Announcements'} (
                  {pastAnnouncements.length})
                </span>
              </div>
              {showPastHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showPastHistory && (
              <div className="mt-2.5 space-y-2">
                {pastAnnouncements.map((ann) => (
                  <div key={ann.id} className="rounded-xl border bg-muted/30 p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        {isMr ? ann.title_mr || ann.title : ann.title}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-bold">Resolved / Completed</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {isMr ? ann.description_mr || ann.description : ann.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
          </div>
          {/* End Left Column */}

          {/* Right Column: Local Authority Directory */}
          <div className="lg:col-span-5 space-y-4 mt-6 lg:mt-0">
        {/* 6. Official Local Authority Directory */}
        <section className="space-y-2.5 pt-2 lg:pt-0">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span>{isMr ? 'स्थानिक प्रशासन कार्यालय, हेल्पलाईन व अधिकारी' : 'Department Helplines, Offices & On-Duty Officers'}</span>
          </h2>

          <div className="space-y-3">
            {filteredOrgs.map((org) => (
              <div key={org.id} className="rounded-2xl border bg-card p-4 space-y-3 shadow-2xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm sm:text-base text-foreground">
                      {isMr ? org.name_mr : org.name}
                    </h3>
                    {org.office_address && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-primary" />
                        <span>{org.office_address}</span>
                        {org.maps_url && (
                          <a
                            href={org.maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-primary hover:underline text-[11px] font-semibold ml-1"
                          >
                            <span>{isMr ? 'नकाशा' : 'Directions'}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    )}
                    {org.visiting_hours && (
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>{isMr ? `कार्यालयीन वेळ: ${org.visiting_hours}` : `Hours: ${org.visiting_hours}`}</span>
                      </div>
                    )}
                  </div>

                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30 shrink-0">
                    [DEMO]
                  </span>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {org.helpline_phone && (
                    <a
                      href={`tel:${org.helpline_phone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-all active:scale-95"
                    >
                      <Phone className="w-3 h-3 text-primary" />
                      <span>{isMr ? `हेल्पलाईन: ${org.helpline_phone}` : `Helpline: ${org.helpline_phone}`}</span>
                    </a>
                  )}
                  {org.emergency_phone && org.emergency_phone !== org.helpline_phone && (
                    <a
                      href={`tel:${org.emergency_phone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 border border-rose-500/20 transition-all active:scale-95"
                    >
                      <Phone className="w-3 h-3 text-rose-500" />
                      <span>{isMr ? `तातडीची मदत: ${org.emergency_phone}` : `24x7 Emergency: ${org.emergency_phone}`}</span>
                    </a>
                  )}
                  {org.whatsapp_number && (
                    <a
                      href={`https://wa.me/${org.whatsapp_number}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all active:scale-95"
                    >
                      <MessageCircle className="w-3 h-3 text-emerald-500" />
                      <span>{isMr ? 'तक्रार निवारण व्हॉट्सॲप' : 'WhatsApp Desk'}</span>
                    </a>
                  )}
                </div>

                {/* Key Officers & Engineers Roster */}
                {org.key_contacts && org.key_contacts.length > 0 && (
                  <div className="pt-2 border-t space-y-1.5">
                    <span className="text-[11px] font-bold text-foreground flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-primary" />
                      <span>{isMr ? 'विभाग संपर्क अधिकारी / अभियंता:' : 'On-Duty Department Officers & Engineers:'}</span>
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {org.key_contacts.map((officer, idx) => (
                        <div
                          key={officer.id || idx}
                          className="flex items-center justify-between p-2 rounded-xl border bg-muted/40 text-xs"
                        >
                          <div>
                            <span className="font-bold text-foreground">{officer.name}</span>
                            <span className="text-[11px] text-muted-foreground block">{officer.role}</span>
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
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
          </div>
          {/* End Right Column */}
        </div>
        {/* End Civic Dashboard Grid */}
      </main>

      <Footer />
    </div>
  );
}
