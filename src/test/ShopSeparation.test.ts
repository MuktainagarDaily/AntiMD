import { describe, it, expect } from 'vitest';
import {
  isSpecializedCategoryName,
  isSpecializedEntity,
  filterRetailShops,
  prioritizeRelatedShops,
  getSpecializedEntityDomain,
  getEntityDetailPath,
} from '@/lib/shopUtils';
import { getEstablishmentCategory } from '@/lib/living/livingTypes';

describe('Shop & Entity Separation Logic', () => {
  describe('isSpecializedCategoryName', () => {
    it('identifies mess, hotel and dining category variations', () => {
      expect(isSpecializedCategoryName('Mess & Dining')).toBe(true);
      expect(isSpecializedCategoryName('Mess')).toBe(true);
      expect(isSpecializedCategoryName('भोजनालय व मेस')).toBe(true);
      expect(isSpecializedCategoryName('Tiffin Services')).toBe(true);
      expect(isSpecializedCategoryName('Hotel & Restaurant')).toBe(true);
      expect(isSpecializedCategoryName('Restaurant')).toBe(true);
      expect(isSpecializedCategoryName('हॉटेल व रेस्टॉरंट')).toBe(true);
      expect(isSpecializedCategoryName('Dhaba')).toBe(true);
    });

    it('identifies PG and hostel category variations', () => {
      expect(isSpecializedCategoryName('PG & Hostels')).toBe(true);
      expect(isSpecializedCategoryName('Boys PG')).toBe(true);
      expect(isSpecializedCategoryName('Girls Hostel')).toBe(true);
      expect(isSpecializedCategoryName('वसतिगृह')).toBe(true);
    });

    it('identifies school and hospital categories', () => {
      expect(isSpecializedCategoryName('Schools & Colleges')).toBe(true);
      expect(isSpecializedCategoryName('शाळा')).toBe(true);
      expect(isSpecializedCategoryName('Hospitals & Clinics')).toBe(true);
      expect(isSpecializedCategoryName('रुग्णालय')).toBe(true);
    });

    it('allows genuine retail shop categories', () => {
      expect(isSpecializedCategoryName('Grocery & Kirana')).toBe(false);
      expect(isSpecializedCategoryName('Clothing & Fashion')).toBe(false);
      expect(isSpecializedCategoryName('Electronics & Mobiles')).toBe(false);
      expect(isSpecializedCategoryName('Medical Store & Pharmacy')).toBe(false);
      expect(isSpecializedCategoryName('Hardware & Electrical')).toBe(false);
    });
  });

  describe('isSpecializedEntity', () => {
    it('detects entity linked to mess_profiles', () => {
      const shopWithMess = {
        id: '1',
        name: 'Annapurna Kitchen',
        mess_profiles: [{ id: 'm1', is_pure_veg: true }],
      };
      expect(isSpecializedEntity(shopWithMess)).toBe(true);
    });

    it('detects entity linked to pg_profiles', () => {
      const shopWithPG = {
        id: '2',
        name: 'Sai Residency',
        pg_profiles: [{ id: 'p1', sharing_types: ['2-sharing'] }],
      };
      expect(isSpecializedEntity(shopWithPG)).toBe(true);
    });

    it('detects entity having a specialized category in shop_categories', () => {
      const shopWithCat = {
        id: '3',
        name: 'Khandesh Bhojanalaya',
        shop_categories: [{ categories: { name: 'Mess & Dining' } }],
      };
      expect(isSpecializedEntity(shopWithCat)).toBe(true);
    });

    it('detects mess by name heuristics even if joins are empty', () => {
      expect(isSpecializedEntity({ name: 'Shri Ram Mess' })).toBe(true);
      expect(isSpecializedEntity({ name: 'Mahalaxmi Bhojanalay' })).toBe(true);
      expect(isSpecializedEntity({ name: 'Shree Krishna टिफिन सेंटर' })).toBe(true);
      expect(isSpecializedEntity({ name: 'Om Boys Hostel' })).toBe(true);
      expect(isSpecializedEntity({ name: 'Hotel Visawa Family Restaurant' })).toBe(true);
      expect(isSpecializedEntity({ name: 'हॉटेल आनंद' })).toBe(true);
      expect(isSpecializedEntity({ name: 'Khandesh Dhaba' })).toBe(true);
    });

    it('does not falsely flag retail shops with similar English substrings', () => {
      // e.g. "Message" or "Messenger"
      expect(isSpecializedEntity({ name: 'Messenger Cyber Cafe' })).toBe(false);
      expect(isSpecializedEntity({ name: 'Sai Kirana Store' })).toBe(false);
      expect(isSpecializedEntity({ name: 'Mauli Medical' })).toBe(false);
      expect(isSpecializedEntity({ name: 'Balaji Sarees' })).toBe(false);
    });
  });

  describe('getSpecializedEntityDomain & getEntityDetailPath', () => {
    it('routes hotels, family restaurants, dhabas, and messes to /:citySlug/mess/:slug even without mess_profiles', () => {
      const hotel = {
        id: 'h-1',
        name: 'Hotel Visawa Family Restaurant',
        slug: 'hotel-visawa-family-restaurant-parandwadi',
      };
      expect(getSpecializedEntityDomain(hotel)).toBe('mess');
      expect(getEntityDetailPath('maval', hotel)).toBe(
        '/maval/mess/hotel-visawa-family-restaurant-parandwadi',
      );

      expect(getEntityDetailPath('maval', { id: 'h-2', name: 'हॉटेल विसावा', slug: 'hotel-visawa' })).toBe(
        '/maval/mess/hotel-visawa',
      );
      expect(getEntityDetailPath('maval', { id: 'h-3', name: 'Ruchira Bhojanalay', slug: 'ruchira' })).toBe(
        '/maval/mess/ruchira',
      );
    });

    it('routes PGs and hostels (profiled or unprofiled) to /:citySlug/pg/:slug', () => {
      expect(
        getEntityDetailPath('maval', {
          id: 'p-1',
          name: 'Sai Residency',
          slug: 'sai-residency',
          pg_profiles: [{ shop_id: 'p-1' }],
        }),
      ).toBe('/maval/pg/sai-residency');

      expect(
        getEntityDetailPath('maval', {
          id: 'p-2',
          name: 'Omkar PG',
          slug: 'omkar-pg-parandwadi',
        }),
      ).toBe('/maval/pg/omkar-pg-parandwadi');

      expect(
        getEntityDetailPath('maval', {
          id: 'p-3',
          name: 'मुलींचे वसतिगृह',
          slug: 'girls-residency',
        }),
      ).toBe('/maval/pg/girls-residency');
    });

    it('keeps regular commercial shops on /:citySlug/shop/:slug', () => {
      const shop = { id: 's-1', name: 'Patil Kirana', slug: 'patil-kirana' };
      expect(getSpecializedEntityDomain(shop)).toBeNull();
      expect(getEntityDetailPath('maval', shop)).toBe('/maval/shop/patil-kirana');
    });
  });

  describe('filterRetailShops', () => {
    it('filters out specialized entities and keeps pure commercial shops', () => {
      const mixedList = [
        { id: '1', name: 'Patil Kirana', is_active: true },
        { id: '2', name: 'Anand Mess', mess_profiles: [{ id: 'm1' }] },
        { id: '3', name: 'Balaji Mobile Shopee', is_active: true },
        { id: '4', name: 'Shivaji Boys Hostel', pg_profiles: [{ id: 'p1' }] },
        { id: '5', name: 'Jai Hind Hardware', is_active: true },
      ];

      const retailOnly = filterRetailShops(mixedList);
      expect(retailOnly).toHaveLength(3);
      expect(retailOnly.map((s) => s.name)).toEqual([
        'Patil Kirana',
        'Balaji Mobile Shopee',
        'Jai Hind Hardware',
      ]);
    });
  });

  describe('getEstablishmentCategory', () => {
    it('accurately categorizes hotel, tiffin, and mess establishments', () => {
      expect(getEstablishmentCategory({ name: 'Hotel Visawa Family Restaurant' })).toBe('hotel');
      expect(getEstablishmentCategory({ name: 'हॉटेल आनंद शुद्ध शाकाहारी' })).toBe('hotel');
      expect(getEstablishmentCategory({ name: 'Annapurna Home Tiffin Service' })).toBe('tiffin');
      expect(getEstablishmentCategory({ name: 'Shree Swami Samarth Bhojanalay' })).toBe('mess');
      expect(getEstablishmentCategory({ name: 'Kolhapuri Ruchira Mess' })).toBe('mess');
    });
  });

  describe('Related Shops Geographic & Hyper-Local Prioritization', () => {
    const MUKTAINAGAR_CITY_ID = 'city-muktainagar';
    const MAVAL_CITY_ID = 'city-maval';
    const KURHA_VILLAGE_ID = 'v-kurha';
    const ANTURLI_VILLAGE_ID = 'v-anturli';
    const PARANDWADI_VILLAGE_ID = 'v-parandwadi';

    // Seed test shops exactly per verification requirements:
    // Seed Shop A (Muktainagar, Category: Grocery, Village: Kurha).
    // Seed Shop B (Muktainagar, Category: Grocery, Village: Kurha).
    // Seed Shop C (Muktainagar, Category: Grocery, Village: Anturli).
    // Seed Shop D (Maval, Category: Grocery, Village: Parandwadi).
    const shopA = {
      id: 'shop-a',
      name: 'Shop A (Muktainagar - Kurha)',
      city_id: MUKTAINAGAR_CITY_ID,
      village_id: KURHA_VILLAGE_ID,
      category: 'Grocery',
    };
    const shopB = {
      id: 'shop-b',
      name: 'Shop B (Muktainagar - Kurha)',
      city_id: MUKTAINAGAR_CITY_ID,
      village_id: KURHA_VILLAGE_ID,
      category: 'Grocery',
    };
    const shopC = {
      id: 'shop-c',
      name: 'Shop C (Muktainagar - Anturli)',
      city_id: MUKTAINAGAR_CITY_ID,
      village_id: ANTURLI_VILLAGE_ID,
      category: 'Grocery',
    };
    const shopD = {
      id: 'shop-d',
      name: 'Shop D (Maval - Parandwadi)',
      city_id: MAVAL_CITY_ID,
      village_id: PARANDWADI_VILLAGE_ID,
      category: 'Grocery',
    };

    it('asserts viewing Shop A returns Shop B first (same village), then Shop C (same city), and strictly excludes Shop D (different city)', () => {
      const candidates = [shopA, shopB, shopC, shopD];

      const related = prioritizeRelatedShops(
        candidates,
        shopA.id,
        shopA.city_id,
        shopA.village_id,
        12
      );

      // Shop A must be excluded (cannot recommend itself)
      expect(related.find((s) => s.id === shopA.id)).toBeUndefined();

      // Shop D (Maval) must be strictly excluded (different city)
      expect(related.find((s) => s.id === shopD.id)).toBeUndefined();

      // Exactly Shop B and Shop C returned
      expect(related).toHaveLength(2);

      // Shop B is in the same village (Kurha), so it must be first
      expect(related[0].id).toBe(shopB.id);

      // Shop C is in the same city (Muktainagar), so it must be second
      expect(related[1].id).toBe(shopC.id);
    });

    it('handles candidate rows returned with nested .shops structure', () => {
      const dbRows = [
        { shop_id: shopB.id, shops: shopB },
        { shop_id: shopC.id, shops: shopC },
        { shop_id: shopD.id, shops: shopD },
      ];

      const related = prioritizeRelatedShops(
        dbRows,
        shopA.id,
        shopA.city_id,
        shopA.village_id
      );

      expect(related.map((s) => s.id)).toEqual([shopB.id, shopC.id]);
    });

    it('returns empty array when no candidate shops exist in the target city', () => {
      const candidates = [shopA, shopD]; // Only Shop A (current) and Shop D (other town)

      const related = prioritizeRelatedShops(
        candidates,
        shopA.id,
        shopA.city_id,
        shopA.village_id
      );

      expect(related).toEqual([]);
    });

    it('caps recommendations to maxResults (12)', () => {
      const manyShops = Array.from({ length: 25 }, (_, i) => ({
        id: `shop-${i}`,
        name: `Shop ${i}`,
        city_id: MUKTAINAGAR_CITY_ID,
        village_id: i % 2 === 0 ? KURHA_VILLAGE_ID : null,
      }));

      const related = prioritizeRelatedShops(
        manyShops,
        'current-shop',
        MUKTAINAGAR_CITY_ID,
        KURHA_VILLAGE_ID,
        12
      );

      expect(related).toHaveLength(12);
      expect(related[0].village_id).toBe(KURHA_VILLAGE_ID);
    });
  });
});
