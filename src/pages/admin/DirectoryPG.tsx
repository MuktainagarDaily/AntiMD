import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BranchTabs } from '@/components/admin/layout/BranchTabs';
import { ADMIN_NAV } from '@/components/admin/layout/adminNav';
import { useAdminOutletInbox } from './_useAdminOutlet';
import { fetchPGsForCity, savePGProfile } from '@/lib/living/livingService';
import type { PGWithDetails, PGGender } from '@/lib/living/livingTypes';
import { useCity } from '@/hooks/useCity';
import {
  BedDouble, Plus, Search, Users, Phone, MapPin,
  ExternalLink, Pencil, Check, Loader2, X, AlertCircle, Wifi, Flame,
} from 'lucide-react';
import { toast } from 'sonner';
import { PGModal } from '@/components/admin/PGModal';
import { cn } from '@/lib/utils';

export default function DirectoryPG() {
  const qc = useQueryClient();
  const { currentCity, townName } = useCity();
  const inbox = useAdminOutletInbox();
  const directory = ADMIN_NAV.find((h) => h.key === 'directory')!;

  const [search, setSearch] = useState('');
  const [editingShop, setEditingShop] = useState<any>(null);
  const [vacancyModalPG, setVacancyModalPG] = useState<PGWithDetails | null>(null);

  const { data: pgs = [], isLoading } = useQuery<PGWithDetails[]>({
    queryKey: ['living-pgs', currentCity.id],
    queryFn: () => fetchPGsForCity(currentCity.id),
  });

  const filteredPGs = pgs.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.area && p.area.toLowerCase().includes(q)) ||
      (p.phone && p.phone.includes(q))
    );
  });

  return (
    <div className="space-y-4">
      <BranchTabs leaves={directory.leaves} badges={{ inbox: inbox.total }} />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border p-4 rounded-2xl">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BedDouble className="w-5 h-5 text-blue-600" />
            <span>PG & Hostels Directory</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
              {pgs.length} Listings
            </span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage live room vacancies, student/working hostels, and sharing rates in {townName}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditingShop({})}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" /> Add PG / Hostel
          </button>
        </div>
      </div>

      {/* Search and filter */}
      <div className="flex items-center gap-2 bg-card border border-border px-3 py-2 rounded-xl">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search PG by name, area, or phone..."
          className="bg-transparent border-none text-xs text-foreground placeholder:text-muted-foreground focus:outline-none w-full"
        />
        {search && (
          <button onClick={() => setSearch('')} className="p-1 hover:bg-muted rounded text-muted-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* PGs Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading PG listings...
          </div>
        ) : filteredPGs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-xs">
            No PG listings found. Tap <strong>"Add PG / Hostel"</strong> above to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">PG / Hostel</th>
                  <th className="py-3 px-4">For Whom</th>
                  <th className="py-3 px-4">Live Vacancy</th>
                  <th className="py-3 px-4">Sharing Rates</th>
                  <th className="py-3 px-4">Food & Rules</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPGs.map((pg) => {
                  const profile = pg.pg_profile;
                  const available = profile?.available_beds || 0;
                  const total = profile?.total_beds || 0;
                  const hasVacancy = available > 0;

                  return (
                    <tr key={pg.id} className="hover:bg-muted/20 transition-colors">
                      {/* Name & Details */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-muted shrink-0 border border-border">
                            {pg.image_url ? (
                              <img src={pg.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">🛏️</div>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                              {pg.name}
                              {pg.is_verified && <span className="text-primary text-xs" title="Verified">✓</span>}
                            </div>
                            <div className="text-muted-foreground text-[11px] flex items-center gap-2 mt-0.5">
                              <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {pg.area || 'Muktainagar'}</span>
                              <span>·</span>
                              <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" /> {pg.phone || '—'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* For Whom */}
                      <td className="py-3 px-4">
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border',
                          profile?.gender === 'boys' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                          profile?.gender === 'girls' ? 'bg-pink-500/10 text-pink-600 border-pink-500/20' :
                          'bg-purple-500/10 text-purple-600 border-purple-500/20'
                        )}>
                          {profile?.gender === 'boys' ? '👦 Boys Only' :
                           profile?.gender === 'girls' ? '👧 Girls Only' : '👥 Both / Co-ed'}
                        </span>
                        <div className="text-[10px] text-muted-foreground mt-0.5 capitalize">
                          {profile?.occupancy_target || 'Students'}
                        </div>
                      </td>

                      {/* Vacancy */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border',
                            hasVacancy
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                          )}>
                            <span className={cn('w-1.5 h-1.5 rounded-full', hasVacancy ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500')} />
                            {hasVacancy ? `${available} Vacant` : 'Fully Occupied'}
                          </span>
                          <p className="text-[10px] text-muted-foreground">
                            {total > 0 ? `Out of ${total} total beds` : 'Capacity not set'}
                          </p>
                        </div>
                      </td>

                      {/* Sharing Rates */}
                      <td className="py-3 px-4">
                        <div className="text-[11px] space-y-0.5">
                          {profile?.sharing_rates?.['2_sharing'] && (
                            <div>2-Sharing: <strong className="text-foreground">₹{profile.sharing_rates['2_sharing']}</strong></div>
                          )}
                          {profile?.sharing_rates?.['3_sharing'] && (
                            <div className="text-muted-foreground">3-Sharing: ₹{profile.sharing_rates['3_sharing']}</div>
                          )}
                          {profile?.sharing_rates?.['1_sharing'] && (
                            <div className="text-muted-foreground">Single: ₹{profile.sharing_rates['1_sharing']}</div>
                          )}
                          {!profile?.sharing_rates?.['1_sharing'] && !profile?.sharing_rates?.['2_sharing'] && (
                            <span className="text-muted-foreground italic">Contact for rates</span>
                          )}
                        </div>
                      </td>

                      {/* Food & Rules */}
                      <td className="py-3 px-4">
                        <div className="text-[11px] space-y-0.5">
                          <div className="text-foreground font-medium">
                            {profile?.food_included ? '🍲 Food Included' : 'Food Not Included'}
                          </div>
                          <div className="text-muted-foreground text-[10px]">
                            Gate: {profile?.gate_closing_time || '10:00 PM'}
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setVacancyModalPG(pg)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition-all active:scale-95 border border-blue-500/30"
                          >
                            <BedDouble className="w-3 h-3" />
                            <span>Update Vacancies</span>
                          </button>
                          <button
                            onClick={() => setEditingShop(pg)}
                            aria-label="Edit PG details"
                            className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={`/${currentCity.slug}/pg`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="View on public site"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Vacancy Quick Updater Modal */}
      {vacancyModalPG && (
        <PGVacancyQuickModal
          pg={vacancyModalPG}
          onClose={() => setVacancyModalPG(null)}
          onSaved={() => {
            setVacancyModalPG(null);
            qc.invalidateQueries({ queryKey: ['living-pgs'] });
          }}
        />
      )}

      {/* Edit PG / Hostel Details Modal */}
      {editingShop !== null && (
        <PGModal
          pg={editingShop}
          onClose={() => setEditingShop(null)}
          onSaved={() => {
            setEditingShop(null);
            qc.invalidateQueries({ queryKey: ['living-pgs'] });
            qc.invalidateQueries({ queryKey: ['admin-shops'] });
            qc.invalidateQueries({ queryKey: ['admin-stats'] });
          }}
        />
      )}
    </div>
  );
}

/** Quick Vacancy Updater Dialog */
function PGVacancyQuickModal({
  pg,
  onClose,
  onSaved,
}: {
  pg: PGWithDetails;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [totalBeds, setTotalBeds] = useState(pg.pg_profile?.total_beds ?? 0);
  const [availableBeds, setAvailableBeds] = useState(pg.pg_profile?.available_beds ?? 0);
  const [gateClosingTime, setGateClosingTime] = useState(pg.pg_profile?.gate_closing_time || '10:00 PM');
  const [foodIncluded, setFoodIncluded] = useState(pg.pg_profile?.food_included ?? false);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (availableBeds > totalBeds && totalBeds > 0) {
      toast.error('Available beds cannot exceed total beds');
      return;
    }
    setSaving(true);
    const { error } = await savePGProfile({
      shop_id: pg.id,
      total_beds: Number(totalBeds),
      available_beds: Number(availableBeds),
      gate_closing_time: gateClosingTime,
      food_included: foodIncluded,
    });
    setSaving(false);
    if (error) {
      toast.error('Failed to update vacancies: ' + error.message);
      return;
    }
    toast.success('Live vacancies updated successfully!');
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <BedDouble className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground leading-tight">{pg.name}</h3>
              <p className="text-[11px] text-muted-foreground">Update Available Vacant Beds</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-center">
            <label className="block font-bold text-sm text-foreground mb-1">
              Currently Available / Vacant Beds
            </label>
            <div className="flex items-center justify-center gap-3 my-2">
              <button
                type="button"
                onClick={() => setAvailableBeds((v) => Math.max(0, v - 1))}
                className="w-10 h-10 rounded-xl border border-border bg-card hover:bg-muted font-bold text-base flex items-center justify-center transition-all active:scale-95"
              >
                -
              </button>
              <input
                type="number"
                value={availableBeds}
                onChange={(e) => setAvailableBeds(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-20 text-center font-bold text-xl py-1.5 rounded-xl border border-input bg-background text-foreground"
              />
              <button
                type="button"
                onClick={() => setAvailableBeds((v) => v + 1)}
                className="w-10 h-10 rounded-xl border border-border bg-card hover:bg-muted font-bold text-base flex items-center justify-center transition-all active:scale-95"
              >
                +
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Students see this live badge immediately on the app.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-foreground mb-1">Total Bed Capacity</label>
              <input
                type="number"
                value={totalBeds}
                onChange={(e) => setTotalBeds(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full p-2.5 rounded-xl border border-input bg-background text-foreground text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-foreground mb-1">Gate Closing Time</label>
              <input
                value={gateClosingTime}
                onChange={(e) => setGateClosingTime(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-input bg-background text-foreground text-xs"
                placeholder="10:00 PM"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl border border-border bg-card">
            <input
              type="checkbox"
              checked={foodIncluded}
              onChange={(e) => setFoodIncluded(e.target.checked)}
              className="w-4 h-4 accent-blue-600 rounded"
            />
            <span className="text-xs font-semibold text-foreground">
              Food / Mess included in rent
            </span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-md active:scale-95 disabled:opacity-60 flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save Vacancies
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
