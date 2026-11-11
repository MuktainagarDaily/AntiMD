import { describe, it, expect } from 'vitest';
import { getTownBranding, formatTownPageTitle } from '@/lib/geo/townConfig';
import { SITE_NAME } from '@/components/seo/PageSeo';
import en from '@/i18n/en.json';
import mr from '@/i18n/mr.json';

describe('ApnaLocal Identity & Branding Specification', () => {
  it('formats master brand and dynamic town brand correctly for Muktainagar', () => {
    const branding = getTownBranding({
      id: 'city-1',
      district_id: 'd-1',
      slug: 'muktainagar',
      name: 'Muktainagar',
      name_mr: 'मुक्ताईनगर',
      type: 'city',
      latitude: 21.0758,
      longitude: 75.9817,
      is_active: true,
      sort_order: 1,
    });

    expect(branding.brandTitle).toBe('ApnaLocal · Muktainagar');
    expect(branding.brandTitle_mr).toBe('ApnaLocal · मुक्ताईनगर');
    expect(branding.tagline).toBe('Your town. Everything local.');
    expect(branding.tagline_mr).toBe('आपलं शहर. स्थानिक सर्वकाही.');
  });

  it('formats dynamic town brand for any town (e.g. Bhusawal, Parandwadi)', () => {
    const bhusawal = getTownBranding({
      id: 'city-2',
      district_id: 'd-1',
      slug: 'bhusawal',
      name: 'Bhusawal',
      name_mr: 'भुसावळ',
      type: 'city',
      latitude: 21.0455,
      longitude: 75.7885,
      is_active: true,
      sort_order: 2,
    });

    expect(bhusawal.brandTitle).toBe('ApnaLocal · Bhusawal');
    expect(bhusawal.brandTitle_mr).toBe('ApnaLocal · भुसावळ');
  });

  it('generates dynamic SEO page titles adhering to the canonical specification', () => {
    const city = {
      id: 'city-1',
      district_id: 'd-1',
      slug: 'muktainagar',
      name: 'Muktainagar',
      name_mr: 'मुक्ताईनगर',
      type: 'city' as const,
      latitude: 21.0758,
      longitude: 75.9817,
      is_active: true,
      sort_order: 1,
    };

    // Home page titles
    const homeEn = formatTownPageTitle('Home', city, 'en');
    expect(homeEn).toBe('ApnaLocal · Muktainagar | Your town. Everything local.');

    const homeMr = formatTownPageTitle('Home', city, 'mr');
    expect(homeMr).toBe('ApnaLocal · मुक्ताईनगर | आपलं शहर. स्थानिक सर्वकाही.');

    // Subpage titles
    const shopsEn = formatTownPageTitle('Shops', city, 'en');
    expect(shopsEn).toBe('Shops — ApnaLocal · Muktainagar');

    const messMr = formatTownPageTitle('मेस व खाद्य', city, 'mr');
    expect(messMr).toBe('मेस व खाद्य — ApnaLocal · मुक्ताईनगर');
  });

  it('verifies SEO site name is ApnaLocal', () => {
    expect(SITE_NAME).toBe('ApnaLocal');
  });

  it('verifies bilingual i18n dictionaries reflect canonical taglines, locality exploration, and trust claims', () => {
    // English
    expect(en['app.tagline']).toBe('Your town. Everything local.');
    expect(en['home.hero.subtitle']).toBe('Your town. Everything local.');
    expect(en['home.browseSection']).toBe('Explore your locality');
    expect(en['common.verified']).toBe('Admin-reviewed');
    expect(en['trust.noMiddlemen']).toBe('Direct Call & WhatsApp — No Middlemen');
    expect(en['trust.adminReviewed']).toBe('Admin-reviewed listings');

    // Marathi
    expect(mr['app.tagline']).toBe('आपलं शहर. स्थानिक सर्वकाही.');
    expect(mr['home.hero.subtitle']).toBe('आपलं शहर. स्थानिक सर्वकाही.');
    expect(mr['home.browseSection']).toBe('आपला परिसर एक्सप्लोर करा');
    expect(mr['common.verified']).toBe('पडताळणी झालेले');
    expect(mr['trust.noMiddlemen']).toBe('थेट कॉल व व्हॉट्सॲप — कोणतेही मध्यस्थ नाहीत');
    expect(mr['trust.adminReviewed']).toBe('पडताळणी झालेले व्यवसाय');
  });
});
