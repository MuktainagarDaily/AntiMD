import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { MapPin, Search, Check, Navigation, Sparkles } from 'lucide-react';
import { useCity } from '@/hooks/useCity';
import { useT } from '@/i18n';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllActiveVillages, fetchVillagesForCity } from '@/lib/geo/geoService';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSwipeDownToClose } from '@/hooks/useSwipeDownToClose';

interface CityPickerModalProps {
  open: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
}

export function CityPickerModal({ open, onClose, onOpenChange }: CityPickerModalProps) {
  const { currentCity, currentVillage, allCities, setCity, setVillage } = useCity();
  const { t, locale } = useT();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [previewCitySlug, setPreviewCitySlug] = useState<string>(currentCity.slug);

  const handleClose = () => {
    onClose?.();
    onOpenChange?.(false);
    setSearch('');
  };

  const { ref: drawerSwipeRef } = useSwipeDownToClose({
    isOpen: open,
    onClose: handleClose,
  });

  // Pre-load all villages so instant search matches any village in Maharashtra
  const { data: allGlobalVillages = [] } = useQuery({
    queryKey: ['geo-all-global-villages'],
    queryFn: fetchAllActiveVillages,
    staleTime: 10 * 60 * 1000,
  });

  // Query active shop counts per city to display live counts and status badges
  const { data: cityShopCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ['geo-city-shop-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shops')
        .select('city_id')
        .eq('is_active', true);
      if (error || !data) return {};
      const counts: Record<string, number> = {};
      data.forEach((s: { city_id: string | null }) => {
        if (s.city_id) counts[s.city_id] = (counts[s.city_id] || 0) + 1;
      });
      return counts;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Load child villages for the currently highlighted preview city
  const activePreviewCity = useMemo(() => {
    return allCities.find((c) => c.slug === previewCitySlug) || currentCity;
  }, [allCities, previewCitySlug, currentCity]);

  const { data: activeCityVillages = [] } = useQuery({
    queryKey: ['geo-villages', activePreviewCity.id],
    queryFn: () => fetchVillagesForCity(activePreviewCity.id),
    enabled: !!activePreviewCity.id,
    staleTime: 5 * 60 * 1000,
  });

  // Filter cities by search
  const filteredCities = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allCities;
    return allCities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.name_mr && c.name_mr.toLowerCase().includes(q)) ||
        (c.district?.name && c.district.name.toLowerCase().includes(q))
    );
  }, [allCities, search]);

  // Match villages directly by search query (e.g. searching "Parandwadi")
  const matchedVillages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return allGlobalVillages.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        (v.name_mr && v.name_mr.toLowerCase().includes(q)) ||
        (v.slug && v.slug.toLowerCase().includes(q)) ||
        (v.pincode && v.pincode.includes(q))
    );
  }, [allGlobalVillages, search]);

  const handleSelectCityOnly = (slug: string) => {
    setCity(slug);
    setVillage(null);
    handleClose();
  };

  const handleSelectVillageDirect = (v: any) => {
    const parent = allCities.find((c) => c.id === v.city_id);
    if (parent) {
      setCity(parent.slug);
      setVillage(v.slug);
    }
    handleClose();
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDetecting(false);
        const { latitude, longitude } = position.coords;

        // Find nearest city by euclidean distance
        let nearest = allCities[0];
        let minDistance = Infinity;

        allCities.forEach((c) => {
          if (c.latitude != null && c.longitude != null) {
            const d = Math.hypot(c.latitude - latitude, c.longitude - longitude);
            if (d < minDistance) {
              minDistance = d;
              nearest = c;
            }
          }
        });

        if (nearest) {
          const name = locale === 'mr' && nearest.name_mr ? nearest.name_mr : nearest.name;
          toast.success(locale === 'mr' ? `जवळचे शहर: ${name}` : `Nearest town: ${name}`);
          setCity(nearest.slug);
          handleClose();
        }
      },
      (error) => {
        setDetecting(false);
        toast.error(error.message || 'Could not fetch current location');
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  const titleText = locale === 'mr' ? 'शहर किंवा गाव निवडा' : 'Select Town / Village';
  const descText = locale === 'mr'
    ? 'निवडलेल्या ठिकाणानुसार दुकाने, शाळा आणि बस वेळापत्रक दिसेल.'
    : 'Directory, shops, schools and bus schedules will show for this location.';

  const renderContent = () => (
    <>
      {/* GPS Current Location button */}
      <button
        type="button"
        onClick={handleDetectLocation}
        disabled={detecting}
        className="w-full mt-2 py-2.5 px-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
      >
        <Navigation className={`w-3.5 h-3.5 ${detecting ? 'animate-spin' : ''}`} />
        {detecting
          ? (locale === 'mr' ? 'स्थान शोधत आहे...' : 'Detecting your town...')
          : (locale === 'mr' ? 'माझे चालू स्थान वापरा (GPS)' : 'Use my current location (GPS)')}
      </button>

      {/* Search input */}
      <div className="relative mt-2">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={locale === 'mr' ? 'शहर किंवा गाव शोधा...' : 'Search city, taluka, or village...'}
          className="pl-9 h-10 rounded-xl text-sm bg-muted/50 border-input"
        />
      </div>

      {/* Direct Village Matches from Search */}
      {matchedVillages.length > 0 && (
        <div className="space-y-1.5 mt-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-secondary" />
            {locale === 'mr' ? 'गाव / परिसर निकाल' : 'Matching Villages & Localities'}
          </p>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
            {matchedVillages.map((v) => {
              const parent = allCities.find((c) => c.id === v.city_id);
              const isSelected = currentVillage?.slug === v.slug;
              const vName = locale === 'mr' && v.name_mr ? v.name_mr : v.name;
              const parentName = parent ? (locale === 'mr' && parent.name_mr ? parent.name_mr : parent.name) : '';
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => handleSelectVillageDirect(v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'border-border bg-card hover:bg-muted text-foreground'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 opacity-70 shrink-0" />
                  <span>{vName}</span>
                  {parentName && <span className="opacity-70 text-[10px]">({parentName})</span>}
                  {isSelected && <Check className="w-3.5 h-3.5 ml-1" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Popular Cities */}
      <div className="space-y-2 mt-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {locale === 'mr' ? 'प्रमुख शहरे व तालुके' : 'Towns & Talukas'}
        </p>
        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
          {filteredCities.map((city) => {
            const isSelected = city.slug === activePreviewCity.slug;
            const isActualCurrent = city.slug === currentCity.slug && !currentVillage;
            const displayName = locale === 'mr' && city.name_mr ? city.name_mr : city.name;
            const distName = locale === 'mr' && city.district?.name_mr ? city.district.name_mr : city.district?.name;
            const shopCount = cityShopCounts[city.id] || 0;

            return (
              <button
                key={city.id}
                type="button"
                onClick={() => {
                  if (previewCitySlug === city.slug) {
                    handleSelectCityOnly(city.slug);
                  } else {
                    setPreviewCitySlug(city.slug);
                  }
                }}
                className={`p-2.5 rounded-xl text-left border transition-all flex items-start justify-between gap-1.5 ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                    : 'border-border bg-background hover:bg-muted/60 text-foreground'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate leading-tight">{displayName}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {distName && (
                      <p className="text-[10px] text-muted-foreground truncate">{distName}</p>
                    )}
                    {shopCount > 0 ? (
                      <span className="inline-flex items-center text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded-full">
                        {shopCount} {locale === 'mr' ? 'दुकाने' : (shopCount === 1 ? 'shop' : 'shops')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[9px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        {locale === 'mr' ? 'लवकरच' : 'Launching'}
                      </span>
                    )}
                  </div>
                </div>
                {isActualCurrent && <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Child Villages of Selected City */}
      <div className="space-y-2 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {locale === 'mr'
              ? `${activePreviewCity.name_mr || activePreviewCity.name} जवळील गावे`
              : `Villages in ${activePreviewCity.name}`}
          </p>
          <button
            type="button"
            onClick={() => handleSelectCityOnly(activePreviewCity.slug)}
            className="text-xs text-primary hover:underline font-semibold"
          >
            {locale === 'mr' ? `सर्व ${activePreviewCity.name_mr || activePreviewCity.name}` : `Select All ${activePreviewCity.name}`}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
          <button
            type="button"
            onClick={() => handleSelectCityOnly(activePreviewCity.slug)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              currentCity.slug === activePreviewCity.slug && !currentVillage
                ? 'border-primary bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'border-border bg-muted/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            {locale === 'mr' ? `सर्व ${activePreviewCity.name_mr || activePreviewCity.name}` : `All ${activePreviewCity.name}`}
          </button>

          {activeCityVillages.map((v) => {
            const isSelected = currentCity.slug === activePreviewCity.slug && currentVillage?.slug === v.slug;
            const vName = locale === 'mr' && v.name_mr ? v.name_mr : v.name;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setCity(activePreviewCity.slug);
                  setVillage(v.slug);
                  handleClose();
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 ${
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'border-border bg-card text-foreground hover:bg-muted/70'
                }`}
              >
                <span>{vName}</span>
                {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(v) => !v && handleClose()}>
        <DrawerContent ref={drawerSwipeRef} className="max-h-[85vh] rounded-t-2xl pb-safe">
          <DrawerHeader className="text-left space-y-1 px-5 pt-3 pb-1">
            <DrawerTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <MapPin className="w-5 h-5 text-primary shrink-0" />
              {titleText}
            </DrawerTitle>
            <DrawerDescription className="text-xs text-muted-foreground">
              {descText}
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-5 pb-6 space-y-3">
            {renderContent()}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md p-5 rounded-2xl bg-card border border-border shadow-xl">
        <DialogHeader className="text-left space-y-1">
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
            <MapPin className="w-5 h-5 text-primary shrink-0" />
            {titleText}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {descText}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
