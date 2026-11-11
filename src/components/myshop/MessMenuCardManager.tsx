import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  UtensilsCrossed, Plus, Trash2, Check, Loader2, Sparkles, AlertCircle, Save, IndianRupee, Layers, List,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchMessMenuItems, saveMessMenuItems } from '@/lib/living/livingService';
import type { MessMenuItem, MessMenuCategory } from '@/lib/living/livingTypes';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

interface MessMenuCardManagerProps {
  shopId: string;
  shopName: string;
}

const CATEGORY_DEFINITIONS: { key: MessMenuCategory; label_en: string; label_mr: string; icon: string }[] = [
  { key: 'thali', label_en: 'Thalis & Meals', label_mr: 'थाळी व नियमित जेवण', icon: '🍲' },
  { key: 'extra', label_en: 'Extra Roti & Sabji', label_mr: 'जादा चपाती, भाकरी व भाजी', icon: '🫓' },
  { key: 'sweet_beverage', label_en: 'Sweets & Beverages', label_mr: 'ताक, गोड व पेये', icon: '🥛' },
  { key: 'pass', label_en: 'Monthly & Tiffin Passes', label_mr: 'डबा व मासिक पास', icon: '🛵' },
  { key: 'other', label_en: 'Other Dishes', label_mr: 'इतर पदार्थ', icon: '🍽️' },
];

const COMMON_DISH_SUGGESTIONS: { name: string; price: number; category: MessMenuCategory }[] = [
  { name: 'साधी पोळी-भाजी थाळी (Regular Thali)', price: 70, category: 'thali' },
  { name: 'स्पेशल गोड थाळी (Special Sweet Thali)', price: 100, category: 'thali' },
  { name: 'जादा गरम चपाती (Extra Roti)', price: 10, category: 'extra' },
  { name: 'ज्वारी / बाजरी भाकरी (Bhakri)', price: 15, category: 'extra' },
  { name: 'एक वाटी जादा भाजी (Extra Sabji)', price: 25, category: 'extra' },
  { name: 'मसाला ताक (Masala Taak)', price: 15, category: 'sweet_beverage' },
  { name: 'गुलाबजाम २ नग (Gulabjamun)', price: 30, category: 'sweet_beverage' },
  { name: 'मासिक डबा पास (Monthly Tiffin Pass)', price: 2200, category: 'pass' },
];

function detectCategory(name: string): MessMenuCategory {
  const lower = name.toLowerCase();
  if (lower.includes('थाळी') || lower.includes('thali') || lower.includes('जेवण')) return 'thali';
  if (lower.includes('चपाती') || lower.includes('रोटी') || lower.includes('भाकरी') || lower.includes('भाजी') || lower.includes('roti') || lower.includes('sabji') || lower.includes('bhakri')) return 'extra';
  if (lower.includes('ताक') || lower.includes('दही') || lower.includes('गुलाब') || lower.includes('गोड') || lower.includes('खीर') || lower.includes('sweet') || lower.includes('chaas') || lower.includes('taak')) return 'sweet_beverage';
  if (lower.includes('पास') || lower.includes('डबा') || lower.includes('pass') || lower.includes('tiffin') || lower.includes('monthly')) return 'pass';
  return 'other';
}

export function MessMenuCardManager({ shopId, shopName }: MessMenuCardManagerProps) {
  const { locale } = useT();
  const qc = useQueryClient();

  const [items, setItems] = useState<MessMenuItem[]>([]);
  const [viewMode, setViewMode] = useState<'simple' | 'categorized'>('simple');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<MessMenuCategory | 'all'>('all');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<MessMenuCategory>('thali');
  const [saving, setSaving] = useState(false);

  // Fetch current menu items
  const { data: remoteItems, isLoading } = useQuery({
    queryKey: ['mess-menu-card-items', shopId],
    queryFn: () => fetchMessMenuItems(shopId),
  });

  useEffect(() => {
    if (remoteItems && Array.isArray(remoteItems)) {
      setItems(remoteItems);
    }
  }, [remoteItems]);

  const handleAddItem = (nameToAdd?: string, priceToAdd?: number, categoryToAdd?: MessMenuCategory) => {
    const finalName = (nameToAdd || newItemName).trim();
    const finalPrice = priceToAdd !== undefined ? priceToAdd : Number(newItemPrice);
    const finalCategory = categoryToAdd || (nameToAdd ? detectCategory(nameToAdd) : newItemCategory);

    if (!finalName) {
      toast.error(locale === 'mr' ? 'कृपया पदार्थाचे नाव टाका' : 'Please enter item name');
      return;
    }
    if (isNaN(finalPrice) || finalPrice <= 0) {
      toast.error(locale === 'mr' ? 'कृपया योग्य दर (रुपये) टाका' : 'Please enter a valid price in ₹');
      return;
    }

    const newItem: MessMenuItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: finalName,
      price: finalPrice,
      is_available: true,
      category: finalCategory,
    };

    setItems((prev) => [...prev, newItem]);
    setNewItemName('');
    setNewItemPrice('');
    toast.success(locale === 'mr' ? `"${finalName}" मेनू कार्डात जोडले!` : `Added "${finalName}"!`);
  };

  const handlePriceChange = (id: string, newPriceStr: string) => {
    const num = Number(newPriceStr);
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, price: isNaN(num) ? item.price : num } : item))
    );
  };

  const handleToggleAvailable = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, is_available: !item.is_available } : item))
    );
  };

  const handleCategoryChange = (id: string, cat: MessMenuCategory) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, category: cat } : item))
    );
  };

  const handleDeleteItem = (id: string, name: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    toast.info(locale === 'mr' ? `"${name}" काढून टाकले.` : `Removed "${name}".`);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const { error } = await saveMessMenuItems(shopId, items);
      if (error) throw error;

      toast.success(
        locale === 'mr'
          ? 'मेनू कार्ड व दर यशस्वीरित्या सेव्ह झाले! ✓'
          : 'Menu Card & Rates saved successfully! ✓'
      );
      qc.invalidateQueries({ queryKey: ['mess-menu-card-items', shopId] });
      qc.invalidateQueries({ queryKey: ['living-messes'] });
    } catch (err: any) {
      console.error('[MessMenuCardManager] Error saving menu card:', err);
      toast.error(err?.message || 'Failed to save menu card');
    } finally {
      setSaving(false);
    }
  };

  const displayedItems = useMemo(() => {
    if (viewMode === 'simple' || activeCategoryFilter === 'all') return items;
    return items.filter((item) => (item.category || detectCategory(item.name)) === activeCategoryFilter);
  }, [items, viewMode, activeCategoryFilter]);

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 space-y-5 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <UtensilsCrossed className="w-4 h-4" />
            </span>
            <span>{locale === 'mr' ? 'कायमस्वरूपी मेनू कार्ड व दरपत्रक' : 'Regular Menu Card & Price List'}</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {locale === 'mr'
              ? 'येथे तुमच्या मेसमधील सर्व थाळी, जादा चपाती, भाजी व पदार्थांचे दर निश्चित करा.'
              : 'Set standard rates for thalis, extra rotis, sabjis, and monthly passes.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveAll}
          disabled={saving}
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition-all shadow-sm shrink-0 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>{locale === 'mr' ? 'दरपत्रक जतन करा' : 'Save Menu Card'}</span>
        </button>
      </div>

      {/* Mode Switcher: Simple vs Categorized */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2 rounded-xl bg-muted/30 border border-border">
        <div className="flex items-center gap-1 bg-card p-1 rounded-lg border border-border shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode('simple')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all',
              viewMode === 'simple'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <List className="w-3.5 h-3.5" />
            <span>{locale === 'mr' ? '⚡ साधी यादी (लहान मेस)' : '⚡ Simple List (Small Mess)'}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('categorized')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all',
              viewMode === 'categorized'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{locale === 'mr' ? '📋 वर्गवारीनुसार (हॉटेल / मोठे मेस)' : '📋 Categorized (Hotel Style)'}</span>
          </button>
        </div>

        <span className="text-[11px] text-muted-foreground">
          {viewMode === 'simple'
            ? locale === 'mr' ? 'सोपी व जलद पद्धत — सर्व पदार्थ एकाच सरळ यादीत' : 'Fast flat list — all items in one view'
            : locale === 'mr' ? 'थाळी, चपाती, गोड पदार्थ अशा विभागांनुसार' : 'Grouped by meals, extras, and beverages'}
        </span>
      </div>

      {/* Category filter tabs if in Categorized Mode */}
      {viewMode === 'categorized' && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <button
            type="button"
            onClick={() => setActiveCategoryFilter('all')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all',
              activeCategoryFilter === 'all'
                ? 'bg-foreground text-background shadow-2xs'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {locale === 'mr' ? 'सर्व विभाग' : 'All Categories'} ({items.length})
          </button>
          {CATEGORY_DEFINITIONS.map((cat) => {
            const count = items.filter((i) => (i.category || detectCategory(i.name)) === cat.key).length;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setActiveCategoryFilter(cat.key)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1',
                  activeCategoryFilter === cat.key
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                )}
              >
                <span>{cat.icon}</span>
                <span>{locale === 'mr' ? cat.label_mr : cat.label_en}</span>
                {count > 0 && (
                  <span className={cn(
                    'text-[10px] px-1 py-0.2 rounded-full font-bold',
                    activeCategoryFilter === cat.key ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Inline Add Dish Form */}
      <div className="p-3 sm:p-4 rounded-xl bg-muted/40 border border-border/60 space-y-2.5">
        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5 text-primary" />
          <span>{locale === 'mr' ? 'नवीन पदार्थ जोडा' : 'Add New Item / Dish'}</span>
        </span>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex-1">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => {
                setNewItemName(e.target.value);
                setNewItemCategory(detectCategory(e.target.value));
              }}
              placeholder={locale === 'mr' ? 'उदा. स्पेशल व्हेज थाळी, जादा चपाती' : 'e.g. Special Veg Thali, Extra Roti'}
              className="w-full px-3 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="w-full sm:w-28 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₹</span>
            <input
              type="number"
              min="1"
              value={newItemPrice}
              onChange={(e) => setNewItemPrice(e.target.value)}
              placeholder="दर (उदा. 80)"
              className="w-full pl-7 pr-3 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {viewMode === 'categorized' && (
            <div className="w-full sm:w-44">
              <select
                value={newItemCategory}
                onChange={(e) => setNewItemCategory(e.target.value as MessMenuCategory)}
                className="w-full px-2.5 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer font-medium"
              >
                {CATEGORY_DEFINITIONS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.icon} {locale === 'mr' ? c.label_mr : c.label_en}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => handleAddItem()}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all shadow-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{locale === 'mr' ? '+ जोडा' : '+ Add Item'}</span>
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        {items.length < 8 && (
          <div className="pt-2">
            <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">
              {locale === 'mr' ? '💡 एका क्लिकवर जोडा (लोकप्रिय पदार्थ):' : '💡 1-Tap Add (Popular Dishes):'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_DISH_SUGGESTIONS.map((sug) => (
                <button
                  key={sug.name}
                  type="button"
                  onClick={() => handleAddItem(sug.name, sug.price, sug.category)}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-card border border-border/80 hover:bg-muted text-foreground transition-colors shadow-2xs"
                >
                  + {sug.name} <strong className="text-primary">₹{sug.price}</strong>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Menu Items List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>
            {locale === 'mr' ? `एकूण पदार्थ (${displayedItems.length})` : `Total Menu Items (${displayedItems.length})`}
          </span>
          <span className="text-[10px]">
            {locale === 'mr' ? 'दर बदलण्यासाठी रकमेवर थेट टाईप करा' : 'Tap price to edit directly'}
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>{locale === 'mr' ? 'दरपत्रक लोड होत आहे...' : 'Loading menu card...'}</span>
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-border text-center bg-muted/10 space-y-2">
            <UtensilsCrossed className="w-8 h-8 mx-auto text-muted-foreground/40" />
            <p className="text-xs font-semibold text-foreground">
              {locale === 'mr' ? 'या विभागात अजून कोणताही पदार्थ जोडलेला नाही' : 'No menu items in this section'}
            </p>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
              {locale === 'mr'
                ? 'वर दिलेल्या फॉर्ममधून तुमच्या मेसचे दर जोडा, जेणेकरून ग्राहकांना मेनू कार्ड स्पष्ट दिसेल.'
                : 'Add dishes above so customers can see your full rate list on the directory.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
            {displayedItems.map((item, idx) => {
              const itemCat = item.category || detectCategory(item.name);
              const catDef = CATEGORY_DEFINITIONS.find((c) => c.key === itemCat);

              return (
                <div
                  key={item.id}
                  className={cn(
                    'p-3 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors',
                    !item.is_available && 'opacity-60 bg-muted/10'
                  )}
                >
                  {/* Number & Name */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-xs font-mono font-bold text-muted-foreground w-5 shrink-0">
                      {idx + 1}.
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{item.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span
                          className={cn(
                            'inline-flex items-center text-[10px] font-semibold px-1.5 py-0.2 rounded-md',
                            item.is_available
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-rose-500/10 text-rose-600'
                          )}
                        >
                          {item.is_available
                            ? locale === 'mr' ? 'उपलब्ध आहे' : 'Available'
                            : locale === 'mr' ? 'आज संपले' : 'Out of stock'}
                        </span>

                        {viewMode === 'categorized' && catDef && (
                          <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded">
                            {catDef.icon} {locale === 'mr' ? catDef.label_mr : catDef.label_en}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Price editor & Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Price Input */}
                    <div className="relative w-24">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₹</span>
                      <input
                        type="number"
                        min="1"
                        value={item.price}
                        onChange={(e) => handlePriceChange(item.id, e.target.value)}
                        className="w-full pl-6 pr-2 py-1 text-xs font-bold text-foreground rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary text-right"
                      />
                    </div>

                    {/* Available Switch */}
                    <button
                      type="button"
                      onClick={() => handleToggleAvailable(item.id)}
                      title={item.is_available ? 'Mark out of stock' : 'Mark available'}
                      className={cn(
                        'px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors',
                        item.is_available
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                          : 'bg-muted text-muted-foreground border-border'
                      )}
                    >
                      {item.is_available ? '🟢' : '⚪'}
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id, item.name)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Save Bottom CTA */}
      {items.length > 0 && (
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition-all shadow-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{locale === 'mr' ? 'सर्व बदल जतन करा' : 'Save Changes'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
