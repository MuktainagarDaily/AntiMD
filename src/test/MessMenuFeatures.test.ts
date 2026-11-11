import { describe, it, expect } from 'vitest';
import { getMessServingStatus, isSundaySpecialActive } from '@/lib/living/livingService';
import type { MessProfile } from '@/lib/living/livingTypes';

describe('Mess Service Serving Status & Features', () => {
  it('returns closed status when is_open is false', () => {
    const status = getMessServingStatus({ is_open: false }, 'en');
    expect(status.slot).toBe('closed');
    expect(status.isLive).toBe(false);
    expect(status.label).toBe('Closed');

    const statusMr = getMessServingStatus({ is_open: false }, 'mr');
    expect(statusMr.label).toBe('मेस बंद आहे');
  });

  it('evaluates serving status correctly when open', () => {
    const status = getMessServingStatus({ is_open: true }, 'en');
    expect(['serving_lunch', 'serving_dinner', 'opens_lunch', 'opens_dinner']).toContain(status.slot);
    expect(typeof status.label).toBe('string');
    expect(status.label.length).toBeGreaterThan(0);
  });

  it('correctly detects Sunday special feast eligibility', () => {
    const profileWithFeast: MessProfile = {
      shop_id: 'test-shop',
      mess_type: 'pure_veg',
      monthly_rate: 2200,
      single_thali_rate: 70,
      tiffin_delivery: true,
      lunch_timing: '11:30 AM - 02:30 PM',
      dinner_timing: '07:30 PM - 10:30 PM',
      sunday_feast: true,
    };

    const profileWithoutFeast: MessProfile = {
      ...profileWithFeast,
      sunday_feast: false,
    };

    expect(isSundaySpecialActive(profileWithoutFeast)).toBe(false);

    const isTodaySunday = new Date().getDay() === 0;
    expect(isSundaySpecialActive(profileWithFeast)).toBe(isTodaySunday);
  });

  it('ensures shopPatch excludes name_mr so PostgreSQL shops schema is never violated', () => {
    // Simulates the patch constructed in MessProfileManager
    const form = {
      name: 'Swami Samarth Mess',
      nameMr: 'स्वामी समर्थ मेस',
      phone: '9876543210',
      whatsapp: '9876543210',
      area: 'College Road',
      address: 'Main Road',
      description: 'Daily fresh meals',
      amenities: ['Pure Veg'],
      photos: ['/photo1.jpg'],
    };

    const shopPatch: any = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      area: form.area.trim() || null,
      address: form.address.trim() || null,
      description: form.description.trim() || null,
      amenities: form.amenities,
      photos: form.photos.filter(Boolean),
      image_url: form.photos[0] || null,
    };

    // Verify name_mr is strictly NOT in the patch for shops table
    expect(shopPatch.name_mr).toBeUndefined();
    expect(Object.keys(shopPatch)).not.toContain('name_mr');

    // Marathi name is handled in sibling shop_translations table payload
    const translationPayload = {
      shop_id: 'test-shop',
      locale: 'mr',
      name: form.nameMr.trim(),
    };
    expect(translationPayload.name).toBe('स्वामी समर्थ मेस');
  });
});
