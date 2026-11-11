import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchActiveCities,
  fetchVillagesForCity,
  DEFAULT_CITIES,
} from '@/lib/geo/geoService';
import { getTownBranding, formatTownPageTitle } from '@/lib/geo/townConfig';
import type { GeoCity, GeoVillage, TownBranding } from '@/lib/geo/types';

interface CityContextType {
  currentCity: GeoCity;
  currentCitySlug: string;
  currentVillage: GeoVillage | null;
  allCities: GeoCity[];
  allVillages: GeoVillage[];
  isLoading: boolean;
  setCity: (citySlug: string) => void;
  setVillage: (villageSlug: string | null) => void;
  branding: TownBranding;
  townName: string;
  townBrand: string;
  districtName: string;
  stateName: string;
  getPageTitle: (pageName: string) => string;
}

const STORAGE_KEY = 'md.selected_city_slug';
const VILLAGE_STORAGE_KEY = 'md.selected_village_slug';
const DEFAULT_SLUG = 'muktainagar';

const CityContext = createContext<CityContextType | null>(null);

export function CityProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { locale } = useT();
  const location = useLocation();
  const navigate = useNavigate();

  // 1. Load active cities
  const { data: allCities = DEFAULT_CITIES, isLoading: citiesLoading } = useQuery({
    queryKey: ['geo-cities'],
    queryFn: fetchActiveCities,
    staleTime: 5 * 60 * 1000,
  });

  // Extract city slug from the first path segment (e.g. /bhusawal/shops -> 'bhusawal')
  const pathCitySlug = useMemo(() => {
    const firstSegment = location.pathname.split('/')[1]?.toLowerCase();
    if (!firstSegment) return null;
    const match = allCities.find((c) => c?.slug && c.slug.toLowerCase() === firstSegment);
    return match ? match.slug : null;
  }, [location.pathname, allCities]);

  // Selected city state
  const [selectedCitySlug, setSelectedCitySlug] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_SLUG;
    return pathCitySlug || localStorage.getItem(STORAGE_KEY) || DEFAULT_SLUG;
  });

  const [selectedVillageSlug, setSelectedVillageSlug] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(VILLAGE_STORAGE_KEY) || null;
  });

  // Sync state with path when navigation occurs
  useEffect(() => {
    if (pathCitySlug && pathCitySlug !== selectedCitySlug) {
      setSelectedCitySlug(pathCitySlug);
      try {
        localStorage.setItem(STORAGE_KEY, pathCitySlug);
      } catch { /* ignore */ }
    }
  }, [pathCitySlug, selectedCitySlug]);

  // If signed-in user has a profile city and user hasn't explicitly set a URL path, sync it
  useEffect(() => {
    if (!user || pathCitySlug) return;
    let isMounted = true;
    supabase
      .from('profiles')
      .select('city_id, geo_cities:geo_cities!profiles_city_id_fkey(slug)')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!isMounted || !data) return;
        const profileCitySlug = (data as any)?.geo_cities?.slug;
        if (profileCitySlug && profileCitySlug !== selectedCitySlug) {
          setSelectedCitySlug(profileCitySlug);
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [user, pathCitySlug, selectedCitySlug]);

  // Resolve current GeoCity object
  const currentCity = useMemo(() => {
    return allCities.find((c) => c?.slug && c.slug.toLowerCase() === selectedCitySlug.toLowerCase()) || allCities[0] || DEFAULT_CITIES[0];
  }, [allCities, selectedCitySlug]);

  // Load villages for current city
  const { data: allVillages = [] } = useQuery({
    queryKey: ['geo-villages', currentCity.id],
    queryFn: () => fetchVillagesForCity(currentCity.id),
    enabled: !!currentCity.id,
    staleTime: 5 * 60 * 1000,
  });

  const currentVillage = useMemo(() => {
    if (!selectedVillageSlug) return null;
    return allVillages.find((v) => v?.slug && v.slug.toLowerCase() === selectedVillageSlug.toLowerCase()) || null;
  }, [allVillages, selectedVillageSlug]);

  // Switch City
  const setCity = useCallback(
    (newSlug: string) => {
      const target = allCities.find((c) => c?.slug && c.slug.toLowerCase() === newSlug.toLowerCase());
      if (!target) return;

      setSelectedCitySlug(target.slug);
      setSelectedVillageSlug(null);
      try {
        localStorage.setItem(STORAGE_KEY, target.slug);
        localStorage.removeItem(VILLAGE_STORAGE_KEY);
      } catch { /* ignore */ }

      // Update signed-in user's profile if applicable
      if (user) {
        supabase
          .from('profiles')
          .update({ city_id: target.id })
          .eq('id', user.id)
          .then(() => {})
          .catch(() => {});
      }

      // If inside Admin panel, stay on the current admin route without re-routing to /:citySlug/admin
      if (location.pathname.startsWith('/admin')) {
        return;
      }

      // Re-route URL to preserve the page under the new city
      const segments = location.pathname.split('/').filter(Boolean);
      const isKnownCity = allCities.some((c) => c?.slug && c.slug.toLowerCase() === segments[0]?.toLowerCase());
      
      let nextPath = '';
      if (isKnownCity) {
        // Replace existing city segment: /bhusawal/shops -> /muktainagar/shops
        segments[0] = target.slug;
        nextPath = '/' + segments.join('/');
      } else if (location.pathname === '/' || location.pathname === '') {
        nextPath = `/${target.slug}`;
      } else {
        // Prepend new city segment: /shops -> /bhusawal/shops
        nextPath = `/${target.slug}${location.pathname}`;
      }

      navigate(`${nextPath}${location.search}${location.hash}`, { replace: false });
    },
    [allCities, location.pathname, location.search, location.hash, navigate, user]
  );

  const setVillage = useCallback((villageSlug: string | null) => {
    setSelectedVillageSlug(villageSlug);
    try {
      if (villageSlug) {
        localStorage.setItem(VILLAGE_STORAGE_KEY, villageSlug);
      } else {
        localStorage.removeItem(VILLAGE_STORAGE_KEY);
      }
    } catch { /* ignore */ }
  }, []);

  const branding = useMemo(() => getTownBranding(currentCity), [currentCity]);

  const townName = useMemo(() => {
    if (currentVillage) {
      const vName = locale === 'mr' && currentVillage.name_mr ? currentVillage.name_mr : currentVillage.name;
      const cName = locale === 'mr' && currentCity.name_mr ? currentCity.name_mr : currentCity.name;
      return `${vName} (${cName})`;
    }
    return locale === 'mr' && currentCity.name_mr ? currentCity.name_mr : currentCity.name;
  }, [locale, currentCity, currentVillage]);

  const townBrand = useMemo(() => {
    return locale === 'mr' ? branding.brandTitle_mr : branding.brandTitle;
  }, [locale, branding]);

  const districtName = useMemo(() => {
    if (locale === 'mr' && currentCity.district?.name_mr) return currentCity.district.name_mr;
    return currentCity.district?.name || 'Jalgaon';
  }, [currentCity, locale]);

  const stateName = useMemo(() => {
    return locale === 'mr' ? 'महाराष्ट्र' : 'Maharashtra';
  }, [locale]);

  const getPageTitle = useCallback(
    (pageName: string) => formatTownPageTitle(pageName, currentCity, locale as 'en' | 'mr'),
    [currentCity, locale]
  );

  const value = useMemo(
    () => ({
      currentCity,
      currentCitySlug: currentCity.slug,
      currentVillage,
      allCities,
      allVillages,
      isLoading: citiesLoading,
      setCity,
      setVillage,
      branding,
      townName,
      townBrand,
      districtName,
      stateName,
      getPageTitle,
    }),
    [
      currentCity,
      currentVillage,
      allCities,
      allVillages,
      citiesLoading,
      setCity,
      setVillage,
      branding,
      townName,
      townBrand,
      districtName,
      stateName,
      getPageTitle,
    ]
  );

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

export function useCity(): CityContextType {
  const ctx = useContext(CityContext);
  if (!ctx) {
    throw new Error('useCity must be used within a CityProvider');
  }
  return ctx;
}

export function useOptionalCity(): CityContextType | null {
  return useContext(CityContext);
}
