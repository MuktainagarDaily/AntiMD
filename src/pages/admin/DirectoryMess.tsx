import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BranchTabs } from '@/components/admin/layout/BranchTabs';
import { ADMIN_NAV } from '@/components/admin/layout/adminNav';
import { useAdminOutletInbox } from './_useAdminOutlet';
import { fetchMessesForCity, saveMessDailyMenu, getTodayDateString } from '@/lib/living/livingService';
import { getEstablishmentCategory, type MessWithDetails } from '@/lib/living/livingTypes';
import { useCity } from '@/hooks/useCity';
import {
  UtensilsCrossed, Plus, Search, Sparkles, Clock, Phone, MapPin,
  ExternalLink, Pencil, Check, Loader2, X, AlertCircle, Calendar,
  Download, Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { MessModal } from '@/components/admin/MessModal';
import { MessCsvImportModal } from '@/components/admin/MessCsvImportModal';
import { ImageCropPicker } from '@/components/shared/ImageCropPicker';
import { uploadShopImage } from '@/lib/storageNaming';
import { downloadCsv, townCsvFilename } from '@/lib/csvUtils';
import { cn } from '@/lib/utils';

export default function DirectoryMess() {
  const qc = useQueryClient();
  const { currentCity, townName } = useCity();
  const inbox = useAdminOutletInbox();
  const directory = ADMIN_NAV.find((h) => h.key === 'directory')!;

  const [search, setSearch] = useState('');
  const [editingShop, setEditingShop] = useState<Partial<MessWithDetails> | null>(null);
  const [menuModalMess, setMenuModalMess] = useState<MessWithDetails | null>(null);
  const [showMessImport, setShowMessImport] = useState(false);

  const { data: messes = [], isLoading } = useQuery<MessWithDetails[]>({
    queryKey: ['living-messes', currentCity.id],
    queryFn: () => fetchMessesForCity(currentCity.id),
  });

  const todayIso = getTodayDateString();

  const filteredMesses = messes.filter((m) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      (m.area && m.area.toLowerCase().includes(q)) ||
      (m.phone && m.phone.includes(q))
    );
  });

  const handleExportCsv = () => {
    if (filteredMesses.length === 0) {
      toast.info('No mess listings to export');
      return;
    }
    const headers = [
      'Name',
      'Name (Marathi)',
      'Establishment Type',
      'Phone',
      'WhatsApp',
      'Town',
      'Area',
      'Address',
      'Mess Type',
      'Monthly Rate',
      'Single Thali Rate',
      'Tiffin Delivery',
      'Sunday Feast',
      'Lunch Timing',
      'Dinner Timing',
      'Amenities',
      'Today Lunch',
      'Today Dinner',
      'Today Special',
      'Verified',
      'Active',
    ];
    const csvRows = filteredMesses.map((m) => {
      const p = m.mess_profile;
      const menu = m.today_menu ?? m.latest_menu;
      return [
        m.name,
        m.name_mr || '',
        getEstablishmentCategory(m),
        m.phone || '',
        m.whatsapp || '',
        townName,
        m.area || '',
        m.address || '',
        p?.mess_type || 'pure_veg',
        p?.monthly_rate ?? '',
        p?.single_thali_rate ?? '',
        p?.tiffin_delivery ? 'Yes' : 'No',
        p?.sunday_feast ? 'Yes' : 'No',
        p?.lunch_timing || '',
        p?.dinner_timing || '',
        (m.amenities || []).join('|'),
        menu?.lunch_text || '',
        menu?.dinner_text || '',
        menu?.special_tag || '',
        m.is_verified ? 'Yes' : 'No',
        m.is_active !== false ? 'Yes' : 'No',
      ];
    });
    downloadCsv(townCsvFilename(currentCity.slug, 'mess-directory'), headers, csvRows);
    toast.success(`Exported ${csvRows.length} mess listing${csvRows.length === 1 ? '' : 's'} to CSV`);
  };

  return (
    <div className="space-y-4">
      <BranchTabs leaves={directory.leaves} badges={{ inbox: inbox.total }} />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border p-4 rounded-2xl">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex flex-wrap items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-amber-600" />
            <span>Mess & Hotels Directory</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
              {messes.length} Listings
            </span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage daily thali menus, hotels, restaurants, tiffin services, and dining in {townName}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredMesses.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-border bg-card text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            type="button"
            onClick={() => setShowMessImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-border bg-card text-foreground hover:bg-muted transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Import CSV
          </button>
          <button
            onClick={() => setEditingShop({})}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" /> Add Mess / Hotel
          </button>
        </div>
      </div>

      {/* Search and stats */}
      <div className="flex items-center gap-2 bg-card border border-border px-3 py-2 rounded-xl">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search mess or hotel by name, area, or phone..."
          className="bg-transparent border-none text-xs text-foreground placeholder:text-muted-foreground focus:outline-none w-full"
        />
        {search && (
          <button onClick={() => setSearch('')} className="p-1 hover:bg-muted rounded text-muted-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Messes Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading mess listings...
          </div>
        ) : filteredMesses.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-xs">
            No mess listings found. Tap <strong>"Add Mess"</strong> above to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Mess / Bhojanalay</th>
                  <th className="py-3 px-4">Type & Rates</th>
                  <th className="py-3 px-4">Today's Menu ({todayIso})</th>
                  <th className="py-3 px-4">Tiffin / Timing</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredMesses.map((mess) => {
                  const hasMenuToday = mess.today_menu !== null;
                  const profile = mess.mess_profile;

                  return (
                    <tr key={mess.id} className="hover:bg-muted/20 transition-colors">
                      {/* Name & Details */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-muted shrink-0 border border-border">
                            {mess.image_url ? (
                              <img src={mess.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">🍲</div>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                              {mess.name}
                              {mess.is_verified && <span className="text-primary text-xs" title="Verified">✓</span>}
                            </div>
                            <div className="text-muted-foreground text-[11px] flex items-center gap-2 mt-0.5">
                              <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {mess.area || 'Muktainagar'}</span>
                              <span>·</span>
                              <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" /> {mess.phone || '—'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Type & Rates */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <span className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border',
                            profile?.mess_type === 'pure_veg'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                          )}>
                            {profile?.mess_type === 'pure_veg' ? '🟢 Pure Veg' : '🔴 Veg & Non-Veg'}
                          </span>
                          <div className="text-[11px] text-muted-foreground">
                            Pass: <strong className="text-foreground">{profile?.monthly_rate ? `₹${profile.monthly_rate}/mo` : '—'}</strong>
                            {' · '}
                            Thali: <strong className="text-foreground">{profile?.single_thali_rate ? `₹${profile.single_thali_rate}` : '—'}</strong>
                          </div>
                        </div>
                      </td>

                      {/* Today's Menu */}
                      <td className="py-3 px-4 max-w-xs">
                        {hasMenuToday ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              <Check className="w-3 h-3" /> Published Today
                            </span>
                            <p className="text-[11px] text-foreground line-clamp-1 truncate">
                              {mess.today_menu?.lunch_text || mess.today_menu?.dinner_text || 'Menu updated'}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              <AlertCircle className="w-3 h-3" /> No menu yet
                            </span>
                            <p className="text-[10px] text-muted-foreground">Click "Update Menu" to post</p>
                          </div>
                        )}
                      </td>

                      {/* Tiffin & Timings */}
                      <td className="py-3 px-4">
                        <div className="text-[11px] space-y-0.5">
                          <div className="text-foreground font-medium">
                            {profile?.tiffin_delivery ? '🛵 Tiffin Available' : 'No Delivery'}
                          </div>
                          <div className="text-muted-foreground text-[10px]">
                            {profile?.lunch_timing || 'Lunch: 11:30 AM'}
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setMenuModalMess(mess)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-all active:scale-95 border border-amber-500/30"
                          >
                            <UtensilsCrossed className="w-3 h-3" />
                            <span>Today's Menu</span>
                          </button>
                          <button
                            onClick={() => setEditingShop(mess)}
                            aria-label="Edit mess details"
                            className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={`/${currentCity.slug}/mess`}
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

      {/* Today's Menu Manager Modal */}
      {menuModalMess && (
        <MessMenuQuickModal
          mess={menuModalMess}
          onClose={() => setMenuModalMess(null)}
          onSaved={() => {
            setMenuModalMess(null);
            qc.invalidateQueries({ queryKey: ['living-messes'] });
          }}
        />
      )}

      {/* Edit Mess Details Modal */}
      {editingShop !== null && (
        <MessModal
          mess={editingShop}
          onClose={() => setEditingShop(null)}
          onSaved={() => {
            setEditingShop(null);
            qc.invalidateQueries({ queryKey: ['living-messes'] });
            qc.invalidateQueries({ queryKey: ['admin-shops'] });
            qc.invalidateQueries({ queryKey: ['admin-stats'] });
          }}
        />
      )}

      {/* Bulk Mess CSV Import Modal */}
      {showMessImport && (
        <MessCsvImportModal
          onClose={() => setShowMessImport(false)}
          onDone={() => {
            setShowMessImport(false);
            qc.invalidateQueries({ queryKey: ['living-messes'] });
            qc.invalidateQueries({ queryKey: ['admin-shops'] });
            qc.invalidateQueries({ queryKey: ['admin-stats'] });
          }}
        />
      )}
    </div>
  );
}

/** Quick Menu Updater Dialog */
function MessMenuQuickModal({
  mess,
  onClose,
  onSaved,
}: {
  mess: MessWithDetails;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [lunch, setLunch] = useState(mess.today_menu?.lunch_text || '');
  const [dinner, setDinner] = useState(mess.today_menu?.dinner_text || '');
  const [specialTag, setSpecialTag] = useState(mess.today_menu?.special_tag || '');
  const [photoUrl, setPhotoUrl] = useState(mess.today_menu?.photo_url || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleUploadPhoto = async (blob: Blob) => {
    setUploading(true);
    try {
      const { publicUrl, isExisting } = await uploadShopImage(blob, `${mess.name}-menu`, { prefix: 'menu' });
      setPhotoUrl(publicUrl);
      if (isExisting) {
        toast.info('Existing menu photo found in storage and linked.');
      } else {
        toast.success('Menu photo uploaded ✓');
      }
    } catch {
      toast.error('Failed to upload menu photo');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lunch.trim() && !dinner.trim() && !photoUrl) {
      toast.error('Please enter lunch, dinner, or a menu photo');
      return;
    }
    setSaving(true);
    const { error } = await saveMessDailyMenu({
      shop_id: mess.id,
      lunch_text: lunch.trim() || null,
      dinner_text: dinner.trim() || null,
      special_tag: specialTag.trim() || null,
      photo_url: photoUrl || null,
    });
    setSaving(false);
    if (error) {
      toast.error('Failed to save menu: ' + error.message);
      return;
    }
    toast.success("Today's menu updated successfully!");
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl p-4 sm:p-6 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-border mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base text-foreground leading-tight truncate">{mess.name}</h3>
              <p className="text-[11px] text-muted-foreground">Post / Update Today's Daily Menu</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-foreground mb-1">
              ☀️ Lunch Menu (दुपारचे जेवण)
            </label>
            <textarea
              value={lunch}
              onChange={(e) => setLunch(e.target.value)}
              placeholder="उदा. शेव भाजी, डाळ-भात, ४ चपाती, पापड, कांदा लिंबू"
              className="w-full p-2.5 rounded-xl border border-input bg-background text-foreground text-xs min-h-[70px] resize-y"
            />
          </div>

          <div>
            <label className="block font-semibold text-foreground mb-1">
              🌙 Dinner Menu (रात्रीचे जेवण)
            </label>
            <textarea
              value={dinner}
              onChange={(e) => setDinner(e.target.value)}
              placeholder="उदा. पनीर बटर मसाला, जीरा राईस, चपाती, गोड शिरा"
              className="w-full p-2.5 rounded-xl border border-input bg-background text-foreground text-xs min-h-[70px] resize-y"
            />
          </div>

          <div>
            <label className="block font-semibold text-foreground mb-1">
              ✨ Special Highlight / Feast Tag (optional)
            </label>
            <input
              value={specialTag}
              onChange={(e) => setSpecialTag(e.target.value)}
              placeholder="उदा. आजची मेजवानी: गुलाबजाम व पनीर मसाला"
              className="w-full p-2.5 rounded-xl border border-input bg-background text-foreground text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-foreground mb-1">
              📸 Menu Board Photo (optional)
            </label>
            <ImageCropPicker
              previewUrl={photoUrl || undefined}
              onCropComplete={(blob) => handleUploadPhoto(blob)}
              onClear={() => setPhotoUrl('')}
              uploading={uploading}
              maxMB={5}
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-all shadow-md active:scale-95 disabled:opacity-60 flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save & Publish Menu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
