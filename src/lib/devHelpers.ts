/**
 * Dev-only autofill helpers.
 *
 * Set DEV_AUTOFILL = false (or remove entirely) before production deploy.
 * In production builds (import.meta.env.DEV === false) this is always false.
 */

export const DEV_AUTOFILL: boolean = import.meta.env.DEV === true;

export const DUMMY_SHOP_DATA = {
  name: 'Dev Test Shop',
  phone: '9876543210',
  whatsapp: '9876543210',
  address: 'Near Bus Stand, Station Road',
  area: 'Main Road',
  sub_area: 'Near Police Station',
  category_text: 'Grocery',
  opening_time: '09:00',
  closing_time: '21:00',
  description: 'A sample grocery shop for testing purposes. Sells daily essentials.',
  keywords: 'grocery, daily needs, kirana, vegetables',
  submitter_name: 'Test User',
  latitude: '21.044700',
  longitude: '75.734200',
};
