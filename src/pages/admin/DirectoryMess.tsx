import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BranchTabs } from '@/components/admin/layout/BranchTabs';
import { ADMIN_NAV } from '@/components/admin/layout/adminNav';
import { useAdminOutletInbox } from './_useAdminOutlet';
import {
  fetchMessesForCity,
  fetchMessMenuItems,
  saveMessDailyMenu,
  saveMessMenuItems,
  getTodayDateString,
} from '@/lib/living/livingService';
import {
  getEstablishmentCategory,
  type MessMenuCategory,
  type MessMenuItem,
  type MessType,
  type MessWithDetails,
} from '@/lib/living/livingTypes';
import { generateSampleMessMenu, inferDietaryTagFromMess } from '@/lib/living/sampleMenuGenerator';
import { useCity } from '@/hooks/useCity';
import {
  UtensilsCrossed, Plus, Search, Sparkles, Clock, Phone, MapPin,
  ExternalLink, Pencil, Check, Loader2, X, AlertCircle, Calendar,
  Download, Upload, Trash2, List,
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
                              : profile?.mess_type === 'jain_available'
                              ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/25'
                              : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                          )}>
                            {profile?.mess_type === 'pure_veg'
                              ? '🟢 Pure Veg'
                              : profile?.mess_type === 'jain_available'
                              ? '🟡 Jain Available'
                              : '🔴 Veg & Non-Veg'}
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
                            <span>Menus & Card</span>
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

      {/* Today's & Regular Menu Manager Modal */}
      {menuModalMess && (
        <MessMenuQuickModal
          mess={menuModalMess}
          onClose={() => setMenuModalMess(null)}
          onSaved={() => {
            const savedShopId = menuModalMess.id;
            setMenuModalMess(null);
            qc.invalidateQueries({ queryKey: ['living-messes'] });
            qc.invalidateQueries({ queryKey: ['living-mess-detail'] });
            qc.invalidateQueries({ queryKey: ['mess-menu-card-items', savedShopId] });
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

const MENU_CATEGORY_OPTIONS: { value: MessMenuCategory; label: string }[] = [
  { value: 'thali', label: '🍲 Thalis & Meals' },
  { value: 'extra', label: '🫓 Extra Roti & Sabji' },
  { value: 'sweet_beverage', label: '🥛 Sweets & Beverages' },
  { value: 'pass', label: '🛵 Monthly & Tiffin Passes' },
  { value: 'other', label: '🍽️ Other Dishes' },
];

/** Quick Menu Updater Dialog (Today's Menu + General Menu Card) */
function MessMenuQuickModal({
  mess,
  onClose,
  onSaved,
}: {
  mess: MessWithDetails;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'today' | 'general'>('today');
  const [dietaryTag, setDietaryTag] = useState<MessType>(() => inferDietaryTagFromMess(mess));
  const [autoFillCount, setAutoFillCount] = useState(0);

  // Today's Menu fields
  const [lunch, setLunch] = useState(mess.today_menu?.lunch_text || '');
  const [dinner, setDinner] = useState(mess.today_menu?.dinner_text || '');
  const [specialTag, setSpecialTag] = useState(mess.today_menu?.special_tag || '');
  const [photoUrl, setPhotoUrl] = useState(mess.today_menu?.photo_url || '');

  // General Menu Card items
  const initialMenuList = Array.isArray(mess.menu_items) ? mess.menu_items : [];
  const [menuItems, setMenuItems] = useState<MessMenuItem[]>(initialMenuList);
  const [menuItemsLoaded, setMenuItemsLoaded] = useState(initialMenuList.length > 0);
  const [hadInitialMenuItems, setHadInitialMenuItems] = useState(initialMenuList.length > 0);
  const [loadingItems, setLoadingItems] = useState(false);

  // Quick-add General Menu item state
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<MessMenuCategory>('thali');

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingItems(true);
    fetchMessMenuItems(mess.id)
      .then((fetched) => {
        if (cancelled) return;
        if (Array.isArray(fetched) && fetched.length > 0) {
          setMenuItems(fetched);
          setHadInitialMenuItems(true);
        }
        setMenuItemsLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setMenuItemsLoaded(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingItems(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mess.id]);

  const handleAutoFillMenu = () => {
    const bundle = generateSampleMessMenu(dietaryTag, autoFillCount);
    setAutoFillCount((c) => c + 1);
    setLunch(bundle.lunch_text);
    setDinner(bundle.dinner_text);
    setSpecialTag(bundle.special_tag);
    setMenuItems(bundle.menu_items);
    setMenuItemsLoaded(true);
    const tagLabel =
      dietaryTag === 'pure_veg'
        ? 'Pure Veg'
        : dietaryTag === 'jain_available'
        ? 'Jain Available'
        : 'Veg & Non-Veg';
    toast.success(`Filled unique ${tagLabel} Today's Menu & ${bundle.menu_items.length} General Menu Card items`);
  };

  const handleAddGeneralItem = () => {
    const trimmed = newItemName.trim();
    const price = Number(newItemPrice);
    if (!trimmed) {
      toast.error('Please enter dish name');
      return;
    }
    if (isNaN(price) || price <= 0) {
      toast.error('Please enter a valid price in ₹');
      return;
    }
    setMenuItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: trimmed,
        price,
        is_available: true,
        category: newItemCategory,
      },
    ]);
    setMenuItemsLoaded(true);
    setNewItemName('');
    setNewItemPrice('');
  };

  const handleUpdateItem = (id: string, patch: Partial<MessMenuItem>) => {
    setMenuItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const handleRemoveItem = (id: string) => {
    setMenuItems((prev) => prev.filter((it) => it.id !== id));
  };

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
    const hasTodayContent = Boolean(lunch.trim() || dinner.trim() || specialTag.trim() || photoUrl);
    const cleanedItems = menuItems
      .map((item) => ({
        ...item,
        name: item.name.trim(),
        price: Number(item.price) || 0,
      }))
      .filter((item) => item.name.length > 0 && item.price > 0);

    if (!hasTodayContent && cleanedItems.length === 0) {
      toast.error("Please add Today's Menu details, a menu photo, or at least one General Menu Card item");
      return;
    }

    setSaving(true);
    try {
      if (hasTodayContent) {
        const { error: todayErr } = await saveMessDailyMenu({
          shop_id: mess.id,
          lunch_text: lunch.trim() || null,
          dinner_text: dinner.trim() || null,
          special_tag: specialTag.trim() || null,
          photo_url: photoUrl || null,
        });
        if (todayErr) {
          toast.error("Failed to save today's menu: " + todayErr.message);
          setSaving(false);
          return;
        }
      }

      if (menuItemsLoaded && (cleanedItems.length > 0 || hadInitialMenuItems)) {
        const { error: cardErr } = await saveMessMenuItems(mess.id, cleanedItems);
        if (cardErr) {
          toast.error('Failed to save General Menu Card: ' + cardErr.message);
          setSaving(false);
          return;
        }
      }

      toast.success("Today's menu & General Menu Card saved!");
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl p-4 sm:p-6 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-border mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base text-foreground leading-tight truncate">{mess.name}</h3>
              <p className="text-[11px] text-muted-foreground">Manage Today's Daily Menu &amp; General Menu Card</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dietary Tag + 1-Tap Auto-fill Genuine Menu */}
        <div className="mb-4 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-foreground mr-1">Dietary Tag:</span>
            {[
              { id: 'pure_veg' as MessType, label: '🟢 Pure Veg' },
              { id: 'veg_nonveg' as MessType, label: '🔴 Veg & Non-Veg' },
              { id: 'jain_available' as MessType, label: '🟡 Jain' },
            ].map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => setDietaryTag(tag.id)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all',
                  dietaryTag === tag.id
                    ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                    : 'bg-card text-muted-foreground border-border hover:text-foreground',
                )}
              >
                {tag.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAutoFillMenu}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all active:scale-95 shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto-fill Genuine Menu</span>
          </button>
        </div>

        {/* Modal View Tabs: Today's Menu | General Menu Card */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-muted/50 border border-border mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className={cn(
              'py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all',
              activeTab === 'today'
                ? 'bg-card text-foreground shadow-xs border border-border'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span>Today&apos;s Menu</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={cn(
              'py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all',
              activeTab === 'general'
                ? 'bg-card text-foreground shadow-xs border border-border'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <List className="w-3.5 h-3.5 text-emerald-600" />
            <span>General Menu Card ({menuItems.length})</span>
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {activeTab === 'today' ? (
            <>
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
            </>
          ) : (
            <div className="space-y-3">
              {/* Quick Add Item Bar */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-2">
                <p className="font-bold text-foreground">Add Dish to General Menu Card</p>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <input
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Dish name (e.g. Special Thali / Chicken Handi)"
                    className="sm:col-span-5 px-2.5 py-2 rounded-lg border border-input bg-background text-foreground text-xs"
                  />
                  <input
                    type="number"
                    min="1"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    placeholder="₹ Price"
                    className="sm:col-span-2 px-2.5 py-2 rounded-lg border border-input bg-background text-foreground text-xs"
                  />
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value as MessMenuCategory)}
                    className="sm:col-span-3 px-2 py-2 rounded-lg border border-input bg-background text-foreground text-xs cursor-pointer"
                  >
                    {MENU_CATEGORY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddGeneralItem}
                    className="sm:col-span-2 py-2 px-3 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>

              {loadingItems ? (
                <div className="py-6 text-center text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading general menu card...
                </div>
              ) : menuItems.length === 0 ? (
                <div className="py-8 text-center rounded-xl border border-dashed border-border text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground">No general menu items yet</p>
                  <p className="text-[11px]">
                    Click <strong>Auto-fill Genuine Menu</strong> above to generate authentic dishes matching this hotel/mess dietary tag, or add manually.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                  {menuItems.map((item, idx) => (
                    <div key={item.id} className="p-2.5 bg-background flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="text-[11px] font-mono text-muted-foreground w-5 shrink-0">{idx + 1}.</span>
                      <input
                        value={item.name}
                        onChange={(e) => handleUpdateItem(item.id, { name: e.target.value })}
                        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-input bg-card text-foreground text-xs font-medium"
                      />
                      <div className="flex items-center gap-1.5 shrink-0">
                        <select
                          value={item.category || 'other'}
                          onChange={(e) => handleUpdateItem(item.id, { category: e.target.value as MessMenuCategory })}
                          className="px-2 py-1.5 rounded-lg border border-input bg-card text-foreground text-[11px] cursor-pointer"
                        >
                          {MENU_CATEGORY_OPTIONS.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                        <div className="relative w-20">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted-foreground">₹</span>
                          <input
                            type="number"
                            min="1"
                            value={item.price}
                            onChange={(e) => handleUpdateItem(item.id, { price: Number(e.target.value) || 0 })}
                            className="w-full pl-5 pr-1.5 py-1.5 rounded-lg border border-input bg-card text-foreground text-xs font-bold text-right"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUpdateItem(item.id, { is_available: !item.is_available })}
                          title={item.is_available ? 'Available' : 'Out of stock'}
                          className={cn(
                            'px-2 py-1.5 rounded-lg text-[10px] font-bold border',
                            item.is_available
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                              : 'bg-muted text-muted-foreground border-border',
                          )}
                        >
                          {item.is_available ? 'Avail' : 'Off'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          aria-label="Remove item"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
            <span className="text-[11px] text-muted-foreground">
              {activeTab === 'today'
                ? `Also saving ${menuItems.length} General Menu item${menuItems.length === 1 ? '' : 's'}`
                : 'Saves both General Menu Card & Today’s Menu'}
            </span>
            <div className="flex items-center gap-2">
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
                Save &amp; Publish Menus
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
