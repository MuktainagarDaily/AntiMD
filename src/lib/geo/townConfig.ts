/**
 * Dynamic town branding generator for ApnaLocal.
 * Enforces the brand specification:
 *   - Master Brand: ApnaLocal (अपनाLocal)
 *   - Dynamic Town Brand: ApnaLocal · <Town> (e.g. ApnaLocal · Muktainagar)
 *   - Canonical Taglines:
 *       EN: "Your town. Everything local."
 *       MR: "आपलं शहर. स्थानिक सर्वकाही."
 *   - Page title format:
 *       Home: ApnaLocal · <Town> | Your town. Everything local.
 *       Subpage: <PageName> — ApnaLocal · <Town>
 */
import type { GeoCity, TownBranding } from './types';

export function getTownBranding(city?: GeoCity | null): TownBranding {
  const name = city?.name || 'Muktainagar';
  const name_mr = city?.name_mr || 'मुक्ताईनगर';

  return {
    name,
    name_mr,
    brandTitle: `ApnaLocal · ${name}`,
    brandTitle_mr: `ApnaLocal · ${name_mr}`,
    tagline: 'Your town. Everything local.',
    tagline_mr: 'आपलं शहर. स्थानिक सर्वकाही.',
    centerCoords: {
      lat: city?.latitude ?? 21.0758,
      lng: city?.longitude ?? 75.9817,
    },
  };
}

/** Formats dynamic page title for any page inside a town */
export function formatTownPageTitle(
  pageName: string,
  city?: GeoCity | null,
  locale: 'en' | 'mr' = 'en'
): string {
  const brand = getTownBranding(city);
  const townBrand = locale === 'mr' ? brand.brandTitle_mr : brand.brandTitle;

  if (!pageName || pageName === 'Home') {
    const subtitle = locale === 'mr' ? brand.tagline_mr : brand.tagline;
    return `${townBrand} | ${subtitle}`;
  }

  return `${pageName} — ${townBrand}`;
}
