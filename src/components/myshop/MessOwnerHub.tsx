import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  UtensilsCrossed,
  BookOpen,
  Settings,
  Eye,
  Clock,
  Sparkles,
  ExternalLink,
  Share2,
  Check,
  CheckCircle2,
  MapPin,
  Phone,
  Power,
  ChevronRight,
  MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/i18n';
import { useCity } from '@/hooks/useCity';
import { getTodayDateString, getMessServingStatus, isSundaySpecialActive } from '@/lib/living/livingService';
import { supabase } from '@/integrations/supabase/client';
import { updateShopWithConcurrency } from '@/lib/shopConcurrency';
import { MessMenuManager } from './MessMenuManager';
import { MessMenuCardManager } from './MessMenuCardManager';
import { MessProfileManager } from './MessProfileManager';
import { ClaimedBadge } from '@/components/shared/ClaimedBadge';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface MessOwnerHubProps {
  shop: any;
  onSaved?: () => void;
}

type MessTab = 'today_menu' | 'menu_card' | 'profile' | 'preview';

export function MessOwnerHub({ shop, onSaved }: MessOwnerHubProps) {
  const { locale } = useT();
  const { currentCity } = useCity();
  const [activeTab, setActiveTab] = useState<MessTab>('today_menu');
  const today = getTodayDateString();

  // Fetch today's menu status to show a live badge on the hero
  const { data: todayMenu } = useQuery({
    queryKey: ['mess-today-menu', shop.id, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mess_daily_menus')
        .select('*')
        .eq('shop_id', shop.id)
        .eq('menu_date', today)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('Error fetching today menu:', error);
      }
      return data || null;
    },
  });

  const [isOpen, setIsOpen] = useState<boolean>(shop.is_open ?? true);
  const [togglingOpen, setTogglingOpen] = useState(false);

  const handleToggleOpen = async () => {
    if (togglingOpen) return;
    try {
      setTogglingOpen(true);
      const next = !isOpen;
      setIsOpen(next);
      const res = await updateShopWithConcurrency(shop.id, shop.updated_at, { is_open: next });
      if (!res.ok) {
        setIsOpen(!next);
        toast.error('Failed to toggle open status');
      } else {
        toast.success(
          next
            ? locale === 'mr'
              ? 'मेस सुरू (Open) म्हणून चिन्हांकित केली!'
              : 'Mess marked OPEN!'
            : locale === 'mr'
            ? 'मेस बंद (Closed) म्हणून चिन्हांकित केली!'
            : 'Mess marked CLOSED!'
        );
      }
    } finally {
      setTogglingOpen(false);
    }
  };

  const copyPublicLink = () => {
    const slug = shop.slug || shop.id;
    const url = `${window.location.origin}/${currentCity.slug}/mess/${slug}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success(locale === 'mr' ? 'मेस लिंक कॉपी झाली!' : 'Mess link copied!'),
      () => toast.error('Failed to copy link')
    );
  };

  const displayName = locale === 'mr' && shop.name_mr ? shop.name_mr : shop.name;

  return (
    <div className="space-y-4">
      {/* ─── Hero Summary Header ─── */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-emerald-500/10 via-card to-card p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Avatar & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-muted shrink-0 border border-border/80 shadow-xs">
              {shop.image_url ? (
                <img
                  src={shop.image_url}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-emerald-500/10 text-emerald-600">
                  <UtensilsCrossed className="w-7 h-7" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-foreground truncate">
                  {displayName}
                </h1>
                {shop.is_claimed && <ClaimedBadge size="sm" />}
              </div>

              {shop.area && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                  <MapPin className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                  <span>{shop.area}</span>
                </p>
              )}

              {/* Status Pills */}
              <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px]">
                {/* Live Menu Status */}
                {todayMenu ? (
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{locale === 'mr' ? 'आजचा मेनू लाइव्ह' : 'Today’s Menu Live'}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/20">
                    <span>⚠️</span>
                    <span>{locale === 'mr' ? 'आजचा मेनू टाका' : 'Post Today’s Menu'}</span>
                  </span>
                )}

                {/* Open / Closed status */}
                <button
                  type="button"
                  onClick={handleToggleOpen}
                  disabled={togglingOpen}
                  className={cn(
                    'inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full border transition-all text-[11px]',
                    isOpen
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-600 border-rose-500/30 hover:bg-rose-500/20'
                  )}
                  title="क्लिक करून सुरू किंवा बंद करा"
                >
                  <Power className="w-3 h-3" />
                  <span>{isOpen ? (locale === 'mr' ? 'मेस चालू आहे' : 'Open Now') : (locale === 'mr' ? 'मेस बंद आहे' : 'Closed')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center justify-end gap-2 self-stretch sm:self-auto shrink-0">
            <Link
              to={`/${currentCity.slug}/mess`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-border bg-background hover:bg-muted text-foreground transition-all shadow-2xs"
            >
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{locale === 'mr' ? 'मेस पेज पहा' : 'View on Mess'}</span>
            </Link>

            <button
              type="button"
              onClick={copyPublicLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-border bg-background hover:bg-muted text-foreground transition-all shadow-2xs"
            >
              <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{locale === 'mr' ? 'लिंक कॉपी' : 'Copy Link'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Tab Navigation Bar ─── */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-card border border-border overflow-x-auto no-scrollbar shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('today_menu')}
          className={cn(
            'shrink-0 flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap',
            activeTab === 'today_menu'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          )}
        >
          <span>🍲</span>
          <span>{locale === 'mr' ? 'आजचा मेनू' : 'Today’s Menu'}</span>
          {todayMenu && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('menu_card')}
          className={cn(
            'shrink-0 flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap',
            activeTab === 'menu_card'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          )}
        >
          <span>📋</span>
          <span>{locale === 'mr' ? 'दरपत्रक व मेनू कार्ड' : 'Menu Card & Rates'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={cn(
            'shrink-0 flex-1 min-w-[110px] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap',
            activeTab === 'profile'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          )}
        >
          <span>⚙️</span>
          <span>{locale === 'mr' ? 'मेस प्रोफाईल' : 'Mess Profile'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={cn(
            'shrink-0 flex-1 min-w-[100px] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap',
            activeTab === 'preview'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          )}
        >
          <span>👁️</span>
          <span>{locale === 'mr' ? 'ग्राहक दृश्य' : 'Customer View'}</span>
        </button>
      </div>

      {/* ─── Active Tab Content ─── */}
      <div className="pt-1">
        {activeTab === 'today_menu' && (
          <MessMenuManager
            shopId={shop.id}
            shopName={displayName}
            shopPhone={shop.phone || shop.whatsapp}
            shopAddress={shop.area || shop.address}
          />
        )}

        {activeTab === 'menu_card' && (
          <MessMenuCardManager
            shopId={shop.id}
            shopName={displayName}
          />
        )}

        {activeTab === 'profile' && (
          <MessProfileManager
            shop={shop}
            onSaved={onSaved}
          />
        )}

        {activeTab === 'preview' && (
          <MessCustomerPreview
            shop={shop}
            todayMenu={todayMenu}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Live preview of how the customer sees this Mess in the directory.
 */
function MessCustomerPreview({ shop, todayMenu }: { shop: any; todayMenu: any }) {
  const { locale } = useT();
  const { currentCity } = useCity();
  const displayName = locale === 'mr' && shop.name_mr ? shop.name_mr : shop.name;
  const profile = shop.mess_profile || shop.mess_profiles?.[0];
  const servingInfo = getMessServingStatus(shop, locale);
  const isSundayFeastToday = isSundaySpecialActive(profile);

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl bg-muted/40 border border-border/80 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground min-w-0 flex-1">
          {locale === 'mr'
            ? 'खालील कार्ड तुमच्या ग्राहकांना "मेस व भोजनालय" पानावर असे दिसेल:'
            : 'This is how your mess appears to customers on the Mess Directory:'}
        </p>
        <Link
          to={`/${currentCity.slug}/mess/${shop.slug || shop.id}`}
          target="_blank"
          className="text-xs font-bold text-primary hover:underline flex items-center gap-1 shrink-0"
        >
          <span>{locale === 'mr' ? 'सार्वजनिक पान उघडा' : 'Open Public Page'}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Preview Container */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-md max-w-lg mx-auto">
        {shop.image_url && (
          <div className="relative h-44 w-full overflow-hidden bg-muted">
            <img src={shop.image_url} alt={displayName} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
            <div className="absolute top-2.5 left-3 flex items-center gap-1.5">
              <span className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border backdrop-blur-md shadow-xs',
                servingInfo.isLive ? 'bg-black/60 text-emerald-300 border-emerald-400/40' : 'bg-black/60 text-white/90 border-white/20'
              )}>
                {servingInfo.isLive && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
                <span>{servingInfo.label}</span>
              </span>
            </div>
            <div className="absolute bottom-2.5 left-3 right-3 flex flex-wrap items-center justify-between gap-1.5 text-white">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs border border-white/20">
                {profile?.mess_type === 'pure_veg'
                  ? '🥦 Pure Veg'
                  : profile?.mess_type === 'jain_available'
                  ? '🥬 Jain Available'
                  : '🍗 Veg & Non-Veg'}
              </span>
              {profile?.monthly_rate && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground shadow-xs">
                  ₹{profile.monthly_rate}/mo
                </span>
              )}
            </div>
          </div>
        )}

        {/* Sunday Special Feast Alert Banner in Preview */}
        {isSundayFeastToday && (
          <div className="p-2.5 bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border-b border-amber-500/30 flex items-center gap-2">
            <span className="text-sm">✨</span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                {locale === 'mr' ? 'आज रविवार स्पेशल मेजवानी उपलब्ध आहे!' : 'Sunday Special Feast Serving Today!'}
              </p>
              <p className="text-[10px] text-amber-700/80 dark:text-amber-400">
                {locale === 'mr' ? 'पुरणपोळी, गोड पदार्थ व विशेष बेत!' : 'Special feast menu available!'}
              </p>
            </div>
          </div>
        )}

        <div className="p-4 border-b border-border/50">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-foreground leading-tight">{displayName}</h2>
              {shop.area && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-muted-foreground/70" />
                  <span>{shop.area}</span>
                </p>
              )}
              {!shop.image_url && (
                <div className="mt-1.5">
                  <span className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border',
                    servingInfo.colorCls
                  )}>
                    {servingInfo.isLive && (
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                    )}
                    <span>{servingInfo.label}</span>
                  </span>
                </div>
              )}
            </div>

            {!shop.image_url && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 bg-muted/50 border-border">
                {profile?.mess_type === 'pure_veg'
                  ? '🥦 Pure Veg'
                  : profile?.mess_type === 'jain_available'
                  ? '🥬 Jain Available'
                  : '🍗 Veg & Non-Veg'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2.5 flex-wrap text-xs">
            {profile?.monthly_rate && !shop.image_url && (
              <span className="font-bold text-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                ₹{profile.monthly_rate}
                <span className="text-[10px] font-normal text-muted-foreground">/mo</span>
              </span>
            )}
            {profile?.single_thali_rate && (
              <span className="font-medium text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md">
                ₹{profile.single_thali_rate}
                <span className="text-[10px] text-muted-foreground">/thali</span>
              </span>
            )}
            {profile?.tiffin_delivery && (
              <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                🍱 {locale === 'mr' ? 'डबा / टिफिन उपलब्ध' : 'Tiffin Delivery'}
              </span>
            )}
            {profile?.sunday_feast && (
              <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md">
                ✨ {locale === 'mr' ? 'रविवार स्पेशल मेजवानी' : 'Sunday Feast'}
              </span>
            )}
          </div>
        </div>

        {/* Today's Menu Preview */}
        <div className="p-4 bg-muted/20">
          {todayMenu ? (
            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/30">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-500 text-white">
                  <span>🟢</span>
                  <span>{locale === 'mr' ? 'आजचा मेनू (Today)' : "Today's Menu"}</span>
                </span>
                {todayMenu.special_tag && (
                  <span className="text-[10px] font-semibold text-primary truncate">
                    {todayMenu.special_tag}
                  </span>
                )}
              </div>

              <div className="space-y-1 text-xs">
                {todayMenu.lunch_text && (
                  <div>
                    <span className="font-semibold text-muted-foreground">🍲 दुपार: </span>
                    <span className="text-foreground font-medium">{todayMenu.lunch_text}</span>
                  </div>
                )}
                {todayMenu.dinner_text && (
                  <div>
                    <span className="font-semibold text-muted-foreground">🌙 रात्र: </span>
                    <span className="text-foreground font-medium">{todayMenu.dinner_text}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl border border-dashed border-border bg-card text-center">
              <p className="text-xs text-muted-foreground">
                {locale === 'mr' ? 'आजचा मेनू अजून प्रसिद्ध झालेला नाही.' : 'Today’s menu not posted yet.'}
              </p>
            </div>
          )}

          {/* Timings */}
          {(profile?.lunch_timing || profile?.dinner_timing) && (
            <div className="flex items-center gap-3 mt-2.5 text-[11px] text-muted-foreground">
              <Clock className="w-3.5 h-3.5 shrink-0 opacity-70" />
              <div className="flex items-center gap-2 flex-wrap">
                {profile.lunch_timing && <span>Lunch: {profile.lunch_timing}</span>}
                {profile.dinner_timing && <span>· Dinner: {profile.dinner_timing}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Action CTA */}
        <div className="p-3 bg-card border-t border-border flex flex-wrap items-center gap-2">
          {shop.phone && (
            <div className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-xs">
              <Phone className="w-3.5 h-3.5" />
              <span>{locale === 'mr' ? 'कॉल करा' : 'Call Mess'}</span>
            </div>
          )}
          {shop.whatsapp && (
            <div className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-xs">
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
