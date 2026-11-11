import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  UtensilsCrossed,
  Sparkles,
  Check,
  Loader2,
  Clock,
  Trash2,
  Camera,
  Share2,
  RotateCcw,
  MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { getTodayDateString, saveMessDailyMenu, REGULAR_MENU_DATE } from '@/lib/living/livingService';
import { compressImage } from '@/lib/imageUtils';
import { useT } from '@/i18n';
import { useCity } from '@/hooks/useCity';

interface MessMenuManagerProps {
  shopId: string;
  shopName: string;
  shopPhone?: string;
  shopAddress?: string;
}

export function MessMenuManager({ shopId, shopName, shopPhone, shopAddress }: MessMenuManagerProps) {
  const { locale } = useT();
  const { currentCity } = useCity();
  const qc = useQueryClient();
  const today = getTodayDateString();

  const [lunchText, setLunchText] = useState('');
  const [dinnerText, setDinnerText] = useState('');
  const [specialTag, setSpecialTag] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch today's menu for this shop if already published
  const { data: currentMenu } = useQuery({
    queryKey: ['mess-today-menu', shopId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mess_daily_menus')
        .select('*')
        .eq('shop_id', shopId)
        .eq('menu_date', today)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('Error fetching today menu:', error);
      }
      return data || null;
    },
  });

  // Fetch previous day's menu to allow 1-tap "Repeat Yesterday's Menu"
  const { data: previousMenu } = useQuery({
    queryKey: ['mess-previous-menu', shopId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mess_daily_menus')
        .select('*')
        .eq('shop_id', shopId)
        .lt('menu_date', today)
        .neq('menu_date', REGULAR_MENU_DATE)
        .order('menu_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('Error fetching previous menu:', error);
      }
      return data || null;
    },
  });

  useEffect(() => {
    if (currentMenu) {
      setLunchText(currentMenu.lunch_text || '');
      setDinnerText(currentMenu.dinner_text || '');
      setSpecialTag(currentMenu.special_tag || '');
      setPhotoUrl(currentMenu.photo_url || '');
    }
  }, [currentMenu]);

  // Quick dish chip inserts
  const lunchDishes = [
    'शेव भाजी',
    'वरण भात',
    'पनीर मसाला',
    'डाळ तडका',
    'छोले',
    'मटकी उसळ',
    'वांग्याचे भरीत',
    'आलू मेथी',
  ];

  const dinnerDishes = [
    'पनीर भुर्जी',
    'शेवगा भाजी',
    'पिठलं भाकरी',
    'आलू मटर',
    'पालक पनीर',
    'कढी खिचडी',
    'मसाला भात',
  ];

  const sweetDishes = [
    'पुरणपोळी',
    'गुलाबजाम',
    'खीर',
    'श्रीखंड',
    'जिलबी',
  ];

  const handleAddDish = (dish: string, target: 'lunch' | 'dinner' | 'special') => {
    if (target === 'lunch') {
      setLunchText((prev) => (prev ? `${prev}, ${dish}` : dish));
    } else if (target === 'dinner') {
      setDinnerText((prev) => (prev ? `${prev}, ${dish}` : dish));
    } else {
      setSpecialTag((prev) => (prev ? `${prev}, ${dish}` : `गोड: ${dish}`));
    }
  };

  const handleCopyYesterday = () => {
    if (!previousMenu) {
      toast.info(locale === 'mr' ? 'मागील दिवसाचा मेनू सापडला नाही' : 'No previous menu found');
      return;
    }
    if (previousMenu.lunch_text) setLunchText(previousMenu.lunch_text);
    if (previousMenu.dinner_text) setDinnerText(previousMenu.dinner_text);
    if (previousMenu.special_tag) setSpecialTag(previousMenu.special_tag);
    toast.success(
      locale === 'mr'
        ? 'मागील मेनू भरला गेला! आवश्यक बदल करून प्रसिद्ध करा.'
        : 'Previous menu loaded! Make adjustments and publish.'
    );
  };

  // Photo upload handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      // Compress to WebP
      const compressed = await compressImage(file, 1200, 0.85);

      const fileName = `menu_${shopId}_${today}_${Date.now()}.webp`;
      const filePath = `menus/${fileName}`;

      const { error } = await supabase.storage
        .from('shop-images')
        .upload(filePath, compressed, { upsert: true, contentType: 'image/webp' });

      if (error) {
        // Storage upload failed — do NOT persist a data: URL to the database.
        // Show an error toast so the user knows to retry.
        toast.error(locale === 'mr' ? 'फोटो अपलोड अयशस्वी. पुन्हा प्रयत्न करा.' : 'Photo upload failed. Please try again.');
      } else {
        const { data: publicData } = supabase.storage.from('shop-images').getPublicUrl(filePath);
        setPhotoUrl(publicData.publicUrl);
        toast.success(locale === 'mr' ? 'मेनू फोटो अपलोड झाला!' : 'Menu photo uploaded!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveMenu = async () => {
    const hasText = lunchText.trim() || dinnerText.trim();
    const hasPhoto = photoUrl.trim();

    if (!hasText && !hasPhoto) {
      toast.error(
        locale === 'mr'
          ? 'कृपया मेनूचे नाव किंवा मेनू बोर्डाचा फोटो अपलोड करा.'
          : 'Please enter today’s dish text or upload a menu photo.'
      );
      return;
    }

    try {
      setSaving(true);
      const { error } = await saveMessDailyMenu({
        shop_id: shopId,
        menu_date: today,
        lunch_text: lunchText.trim() || null,
        dinner_text: dinnerText.trim() || null,
        photo_url: photoUrl.trim() || null,
        special_tag: specialTag.trim() || null,
      });

      if (error) throw error;

      toast.success(
        locale === 'mr'
          ? 'आजचा मेनू यशस्वीरित्या प्रसिद्ध झाला! ✓'
          : 'Today’s menu published successfully! ✓'
      );
      qc.invalidateQueries({ queryKey: ['mess-today-menu', shopId, today] });
      qc.invalidateQueries({ queryKey: ['living-messes'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to save menu');
    } finally {
      setSaving(false);
    }
  };

  const handleShareWhatsApp = () => {
    const textLines = [
      `🍲 *${shopName}* - आजचा मेनू 🍲`,
      `📅 तारीख: ${new Date().toLocaleDateString(locale === 'mr' ? 'mr-IN' : 'en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })}`,
      '',
    ];

    if (lunchText.trim()) {
      textLines.push(`🍽️ *दुपारचे जेवण (Lunch):*`);
      textLines.push(lunchText.trim());
      textLines.push('');
    }

    if (dinnerText.trim()) {
      textLines.push(`🌙 *रात्रीचे जेवण (Dinner):*`);
      textLines.push(dinnerText.trim());
      textLines.push('');
    }

    if (specialTag.trim()) {
      textLines.push(`✨ *आजची खासियत:* ${specialTag.trim()}`);
      textLines.push('');
    }

    textLines.push('🛵 घरपोच डबा / टिफिन सुविधा उपलब्ध!');
    if (shopPhone) {
      textLines.push(`📞 संपर्क: ${shopPhone}`);
    }
    if (shopAddress) {
      textLines.push(`📍 पत्ता: ${shopAddress}`);
    }

    textLines.push('');
    textLines.push('मेसचे दर व संपूर्ण माहिती पहा:');
    textLines.push(`${window.location.origin}/${currentCity.slug}/mess`);

    const fullMsg = textLines.join('\n');
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullMsg)}`;
    window.open(waUrl, '_blank');
  };

  const hasContentToShare = Boolean(lunchText.trim() || dinnerText.trim() || currentMenu);

  return (
    <div className="bg-card rounded-2xl border border-primary/30 p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                {locale === 'mr' ? 'आजचा ताजा मेनू अपडेट करा' : 'Post Today’s Fresh Menu'}
              </h3>
              {currentMenu && (
                <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <Check className="w-3 h-3" />
                  <span>{locale === 'mr' ? 'प्रसिद्ध झाला आहे' : 'Live Today'}</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              <span>{today} (Today)</span>
            </p>
          </div>
        </div>

        {/* Previous Menu Helper Button */}
        {previousMenu && (
          <button
            type="button"
            onClick={handleCopyYesterday}
            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all shrink-0 self-start sm:self-auto"
            title="मागील मेनू कॉपी करा"
          >
            <RotateCcw className="w-3.5 h-3.5 text-primary" />
            <span>{locale === 'mr' ? 'कालचा मेनू वापरा' : 'Repeat Yesterday'}</span>
          </button>
        )}
      </div>

      {/* Lunch Text Input */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-foreground flex flex-wrap items-center justify-between gap-1">
          <span>🍲 {locale === 'mr' ? 'दुपारचा मेनू (Lunch)' : 'Lunch Menu'}</span>
          <span className="text-[10px] text-muted-foreground">उदा. शेव भाजी, वरण भात, ४ चपाती</span>
        </label>
        <input
          type="text"
          value={lunchText}
          onChange={(e) => setLunchText(e.target.value)}
          placeholder={locale === 'mr' ? 'दुपारी काय बनवले आहे? (भाज्या, डाळ, भात...)' : 'What is made for lunch? (e.g. Sev Bhaji, Rice, Roti)'}
          className="w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
        />
        {/* Quick Suggestion Chips */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
          <span className="text-[10px] text-muted-foreground shrink-0">+ जोडा:</span>
          {lunchDishes.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleAddDish(d, 'lunch')}
              className="px-2 py-0.5 text-[10px] rounded-md bg-muted/60 hover:bg-muted text-foreground shrink-0 border border-border/50 transition-colors"
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Dinner Text Input */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-foreground flex flex-wrap items-center justify-between gap-1">
          <span>🌙 {locale === 'mr' ? 'रात्रीचा मेनू (Dinner)' : 'Dinner Menu'}</span>
          <span className="text-[10px] text-muted-foreground">उदा. पनीर भुर्जी, कढी खिचडी</span>
        </label>
        <input
          type="text"
          value={dinnerText}
          onChange={(e) => setDinnerText(e.target.value)}
          placeholder={locale === 'mr' ? 'रात्री काय बनवले आहे?' : 'What is made for dinner?'}
          className="w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
        />
        {/* Quick Suggestion Chips */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
          <span className="text-[10px] text-muted-foreground shrink-0">+ जोडा:</span>
          {dinnerDishes.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleAddDish(d, 'dinner')}
              className="px-2 py-0.5 text-[10px] rounded-md bg-muted/60 hover:bg-muted text-foreground shrink-0 border border-border/50 transition-colors"
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Special Tag Input */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
          <span>✨ {locale === 'mr' ? 'आजची खासियत / गोड पदार्थ (ऐच्छिक)' : 'Special Highlight / Sweet (Optional)'}</span>
        </label>
        <input
          type="text"
          value={specialTag}
          onChange={(e) => setSpecialTag(e.target.value)}
          placeholder={locale === 'mr' ? 'उदा. रविवार स्पेशल मेजवानी, गोड: गुलाबजाम' : 'e.g. Sunday Special, Sweet: Kheer'}
          className="w-full px-3 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
        />
        {/* Quick Sweet Chips */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
          <span className="text-[10px] text-muted-foreground shrink-0">+ गोड:</span>
          {sweetDishes.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleAddDish(d, 'special')}
              className="px-2 py-0.5 text-[10px] rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 shrink-0 border border-amber-500/20 transition-colors"
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Photo Upload Area */}
      <div className="space-y-2 pt-1 border-t border-border/50">
        <label className="text-xs font-semibold text-foreground flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 min-w-0">
            <Camera className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>{locale === 'mr' ? 'मेनू ब्लॅकबोर्ड किंवा थाळीचा फोटो (ऐच्छिक)' : 'Menu Blackboard or Thali Photo (Optional)'}</span>
          </span>
          {photoUrl && (
            <button
              type="button"
              onClick={() => setPhotoUrl('')}
              className="text-[11px] text-destructive hover:underline flex items-center gap-0.5"
            >
              <Trash2 className="w-3 h-3" />
              <span>{locale === 'mr' ? 'काढून टाका' : 'Remove'}</span>
            </button>
          )}
        </label>

        {photoUrl ? (
          <div className="relative rounded-xl overflow-hidden border border-border max-h-48 bg-black/5">
            <img src={photoUrl} alt="Today Menu" className="w-full h-40 object-cover" />
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center p-4 border border-dashed border-input rounded-xl hover:bg-muted/40 cursor-pointer transition-colors text-center">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoUpload}
              disabled={uploading}
              className="hidden"
            />
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            ) : (
              <>
                <Camera className="w-5 h-5 text-muted-foreground mb-1" />
                <span className="text-xs font-semibold text-foreground">
                  {locale === 'mr' ? 'कॅमेऱ्याने फोटो काढा किंवा गॅलरीतून निवडा' : 'Take a photo or choose from gallery'}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  {locale === 'mr' ? 'ब्लॅकबोर्ड किंवा तयार थाळीचा फोटो जोडा' : 'Upload blackboard menu or prepared thali'}
                </span>
              </>
            )}
          </label>
        )}
      </div>

      {/* Action Buttons: Publish + WhatsApp Share */}
      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <button
          type="button"
          onClick={handleSaveMenu}
          disabled={saving || uploading}
          className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xs"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{locale === 'mr' ? 'जतन करत आहे...' : 'Publishing...'}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>{locale === 'mr' ? 'आजचा मेनू प्रसिद्ध करा' : 'Publish Today’s Menu'}</span>
            </>
          )}
        </button>

        {hasContentToShare && (
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition-all shadow-xs shrink-0"
            title="WhatsApp वर मेनू शेअर करा"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{locale === 'mr' ? 'व्हॉट्सॲपवर शेअर करा' : 'Share to WhatsApp'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
