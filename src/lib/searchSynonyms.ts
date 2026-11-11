/**
 * Natural-language synonym expansion for shop search — no LLM.
 *
 * Maps common user phrases (EN + Hinglish + Marathi) and brand/product/action
 * words to category-oriented tokens that the existing fuzzy pipeline already
 * indexes (category names, keywords, descriptions).
 *
 * Extend by adding entries to CATEGORY_SYNONYMS / BRAND_SYNONYMS /
 * ACTION_SYNONYMS. Keys are user-typed phrases (lowercase); values are the
 * tokens appended to the search string.
 */

/** Category phrase → target tokens present in category/keyword fields. */
const CATEGORY_SYNONYMS: Record<string, string[]> = {
  // Bakery
  cake: ['bakery', 'cake', 'bread'],
  cakes: ['bakery', 'cake'],
  'birthday cake': ['bakery', 'cake'],
  pastry: ['bakery', 'pastry'],
  pastries: ['bakery', 'pastry'],
  bread: ['bakery', 'bread'],
  bun: ['bakery', 'bun', 'pav'],
  pav: ['bakery', 'pav'],
  cookies: ['bakery', 'cookies'],
  biscuit: ['bakery', 'biscuit'],
  cupcake: ['bakery', 'cake'],
  muffin: ['bakery'],
  khari: ['bakery', 'khari'],
  rusk: ['bakery', 'rusk'],
  puff: ['bakery', 'puff'],
  donut: ['bakery', 'donut'],
  doughnut: ['bakery', 'donut'],
  bekari: ['bakery'],
  kek: ['bakery', 'cake'],
  केक: ['bakery', 'cake'],
  बेकरी: ['bakery'],

  // Medical
  medicine: ['medical', 'pharmacy', 'chemist'],
  tablet: ['medical', 'pharmacy'],
  capsule: ['medical', 'pharmacy'],
  drug: ['medical', 'pharmacy'],
  drugs: ['medical', 'pharmacy'],
  pharmacy: ['medical', 'pharmacy'],
  chemist: ['medical', 'chemist'],
  medical: ['medical'],
  painkiller: ['medical'],
  ointment: ['medical'],
  bandage: ['medical'],
  syrup: ['medical'],
  vitamin: ['medical'],
  injection: ['medical'],
  dawai: ['medical', 'pharmacy'],
  davai: ['medical', 'pharmacy'],
  dawa: ['medical', 'pharmacy'],
  औषध: ['medical', 'pharmacy'],
  गोळी: ['medical'],
  दवाखाना: ['medical', 'clinic'],
  दवा: ['medical'],

  // Grocery / Kirana
  grocery: ['grocery', 'kirana', 'supermarket'],
  groceries: ['grocery', 'kirana'],
  kirana: ['grocery', 'kirana'],
  'general store': ['grocery', 'kirana'],
  ration: ['grocery', 'kirana'],
  rice: ['grocery'],
  wheat: ['grocery'],
  atta: ['grocery'],
  flour: ['grocery'],
  dal: ['grocery'],
  oil: ['grocery'],
  sugar: ['grocery'],
  salt: ['grocery'],
  tea: ['grocery', 'tea'],
  masala: ['grocery'],
  spices: ['grocery'],
  rashan: ['grocery', 'kirana'],
  tel: ['grocery'],
  chini: ['grocery'],
  किराणा: ['grocery', 'kirana'],

  // Hardware
  cement: ['hardware'],
  paint: ['hardware', 'paint'],
  pipe: ['hardware'],
  pipes: ['hardware'],
  hammer: ['hardware', 'tool'],
  drill: ['hardware', 'tool'],
  hardware: ['hardware'],
  tool: ['hardware', 'tool'],
  tools: ['hardware', 'tool'],
  pvc: ['hardware'],
  plumbing: ['hardware'],
  tiles: ['hardware'],
  construction: ['hardware'],
  rang: ['hardware', 'paint'],

  // Mobile / Electronics
  mobile: ['mobile', 'phone', 'electronics'],
  phone: ['mobile', 'phone', 'electronics'],
  smartphone: ['mobile', 'phone', 'electronics'],
  iphone: ['mobile', 'phone'],
  android: ['mobile', 'phone'],
  charger: ['mobile', 'electronics'],
  cover: ['mobile'],
  'screen guard': ['mobile'],
  'tempered glass': ['mobile'],
  headphone: ['mobile', 'electronics'],
  earphones: ['mobile', 'electronics'],
  bluetooth: ['mobile', 'electronics'],
  sim: ['mobile', 'phone'],
  recharge: ['mobile', 'phone'],
  'mobile repair': ['mobile', 'repair', 'electronics'],
  'phone repair': ['mobile', 'repair', 'electronics'],
  display: ['mobile', 'electronics'],
  मोबाईल: ['mobile', 'phone'],

  // Electronics (large)
  tv: ['electronics'],
  television: ['electronics'],
  fridge: ['electronics'],
  refrigerator: ['electronics'],
  cooler: ['electronics'],
  'washing machine': ['electronics'],
  mixer: ['electronics'],
  grinder: ['electronics'],
  fan: ['electronics'],
  led: ['electronics', 'electrical'],
  ac: ['electronics'],
  'air conditioner': ['electronics'],
  electronic: ['electronics'],
  electronics: ['electronics'],

  // Clothing
  shirt: ['clothing', 'garment', 'fashion'],
  tshirt: ['clothing', 'fashion'],
  't-shirt': ['clothing', 'fashion'],
  jeans: ['clothing', 'fashion'],
  pant: ['clothing', 'fashion'],
  kurta: ['clothing', 'fashion'],
  dress: ['clothing', 'fashion'],
  saree: ['clothing', 'fashion'],
  blouse: ['clothing', 'fashion'],
  'kids wear': ['clothing', 'fashion'],
  clothes: ['clothing', 'garment', 'fashion'],
  garments: ['clothing', 'garment'],
  fashion: ['clothing', 'fashion', 'boutique'],
  uniform: ['clothing', 'garment'],
  tailor: ['tailor', 'clothing'],
  kapde: ['clothing'],
  कपडे: ['clothing'],

  // Footwear
  shoe: ['footwear'],
  shoes: ['footwear'],
  slipper: ['footwear'],
  sandals: ['footwear'],
  chappal: ['footwear'],
  footwear: ['footwear'],

  // Restaurant / Food
  restaurant: ['restaurant', 'hotel', 'food'],
  hotel: ['restaurant', 'hotel'],
  food: ['restaurant', 'food'],
  meal: ['restaurant'],
  lunch: ['restaurant'],
  dinner: ['restaurant'],
  thali: ['restaurant'],
  breakfast: ['restaurant'],
  dhaba: ['restaurant', 'dhaba'],
  khana: ['restaurant', 'food'],
  जेवण: ['restaurant', 'food'],

  // Tea / Snacks / Fast food
  chai: ['tea', 'snack'],
  coffee: ['tea', 'coffee'],
  tapri: ['tea'],
  pizza: ['fast food', 'restaurant'],
  burger: ['fast food', 'restaurant'],
  sandwich: ['fast food', 'restaurant'],
  momos: ['fast food'],
  pasta: ['fast food'],
  noodles: ['fast food'],
  chaat: ['snack', 'fast food'],
  vadapav: ['fast food', 'snack'],
  'pav bhaji': ['fast food', 'restaurant'],

  // Sweets
  sweet: ['sweet', 'mithai'],
  sweets: ['sweet', 'mithai'],
  mithai: ['sweet', 'mithai'],
  laddu: ['sweet'],
  barfi: ['sweet'],
  pedha: ['sweet'],
  jalebi: ['sweet'],
  rasgulla: ['sweet'],
  'gulab jamun': ['sweet'],

  // Stationery
  pen: ['stationery', 'book'],
  pencil: ['stationery'],
  book: ['stationery', 'book'],
  notebook: ['stationery'],
  xerox: ['stationery', 'xerox', 'print'],
  photocopy: ['stationery', 'xerox'],
  print: ['stationery', 'print'],
  printing: ['stationery', 'print'],
  lamination: ['stationery'],

  // Salon
  haircut: ['salon', 'saloon'],
  'hair cut': ['salon', 'saloon'],
  salon: ['salon', 'saloon'],
  saloon: ['salon', 'saloon'],
  barber: ['salon', 'saloon'],
  shaving: ['salon'],
  facial: ['salon', 'beauty'],
  spa: ['salon', 'spa'],
  'beauty parlour': ['salon', 'beauty'],
  parlour: ['salon', 'beauty'],

  // Gym / Fitness
  gym: ['gym', 'fitness'],
  fitness: ['gym', 'fitness'],
  workout: ['gym'],

  // Hospital / Clinic
  hospital: ['hospital', 'clinic', 'medical'],
  doctor: ['hospital', 'clinic'],
  clinic: ['clinic', 'hospital'],
  dentist: ['clinic', 'dental'],

  // Dairy
  milk: ['dairy'],
  dairy: ['dairy'],
  curd: ['dairy'],
  ghee: ['dairy'],
  paneer: ['dairy'],
  दूध: ['dairy'],
  doodh: ['dairy'],

  // Vegetables / Fruits
  sabji: ['vegetable', 'fruit'],
  vegetable: ['vegetable', 'fruit'],
  vegetables: ['vegetable', 'fruit'],
  fruit: ['fruit', 'vegetable'],
  fruits: ['fruit'],
  भाजी: ['vegetable'],

  // Agriculture
  fertilizer: ['agriculture'],
  seed: ['agriculture'],
  seeds: ['agriculture'],
  pesticide: ['agriculture'],
  agriculture: ['agriculture'],

  // Electrical
  wire: ['electrical'],
  switch: ['electrical'],
  bulb: ['electrical'],
  electrician: ['electrical', 'service'],
  electrical: ['electrical'],

  // Automobile
  bike: ['auto', 'vehicle', 'spare'],
  car: ['auto', 'vehicle', 'spare'],
  mechanic: ['auto', 'repair', 'service'],
  garage: ['auto', 'service'],
  tyre: ['auto', 'spare'],
  puncture: ['auto', 'repair'],
  'engine oil': ['auto', 'spare'],

  // Gas
  gas: ['gas'],
  lpg: ['gas'],
  cylinder: ['gas'],

  // ATM / Bank
  atm: ['atm', 'bank'],
  bank: ['bank', 'atm'],

  // Courier
  courier: ['courier', 'delivery'],
  parcel: ['courier', 'delivery'],
  'speed post': ['courier', 'post'],
  'post office': ['courier', 'post'],
};

/** Brand/product word → categories. */
const BRAND_SYNONYMS: Record<string, string[]> = {
  crocin: ['medical', 'pharmacy'],
  paracetamol: ['medical', 'pharmacy'],
  amul: ['dairy', 'grocery'],
  'asian paints': ['hardware', 'paint'],
  indane: ['gas'],
  'bharat gas': ['gas'],
  'hp gas': ['gas'],
};

/** Action verb → categories where that action is offered. */
const ACTION_SYNONYMS: Record<string, string[]> = {
  repair: ['repair', 'service'],
  buy: [],
  order: [],
  deliver: ['delivery', 'courier'],
  delivery: ['delivery', 'courier'],
  laminate: ['stationery', 'xerox'],
};

const ALL_SYNONYMS: Record<string, string[]> = {
  ...ACTION_SYNONYMS,
  ...BRAND_SYNONYMS,
  ...CATEGORY_SYNONYMS,
};

// Longest phrases first so multi-word keys like "phone repair" beat "phone".
const SORTED_KEYS = Object.keys(ALL_SYNONYMS).sort((a, b) => b.length - a.length);

function normalize(q: string): string {
  return q.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Return the union of synonym tokens triggered by any phrase in `query`.
 */
export function synonymTokensFor(query: string): string[] {
  const q = normalize(query);
  if (!q) return [];
  const tokens = new Set<string>();
  for (const key of SORTED_KEYS) {
    // whole-substring match; word boundary via surrounding whitespace or ends.
    if (q === key || q.includes(key)) {
      ALL_SYNONYMS[key].forEach((t) => tokens.add(t));
    }
  }
  return Array.from(tokens);
}

/**
 * Expand a raw user query with synonym tokens. Original text is preserved so
 * name / exact matches keep their ranking priority.
 */
export function expandQuery(query: string): string {
  const extras = synonymTokensFor(query);
  if (!extras.length) return query;
  return `${query} ${extras.join(' ')}`.trim();
}

/** True when at least one synonym rule fired for the query. */
export function hasSynonymHit(query: string): boolean {
  return synonymTokensFor(query).length > 0;
}
