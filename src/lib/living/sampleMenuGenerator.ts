import type { MessMenuItem, MessType, MessWithDetails } from './livingTypes';

export interface SampleMessMenuBundle {
  messType: MessType;
  lunch_text: string;
  dinner_text: string;
  special_tag: string;
  menu_items: MessMenuItem[];
}

const PURE_VEG_BUNDLES: Omit<SampleMessMenuBundle, 'messType'>[] = [
  {
    lunch_text: 'खानदेशी शेव भाजी, मसूर आमटी, ४ गरम फुलके / चपाती, इंद्रायणी भात, कोशिंबीर व पापड',
    dinner_text: 'मटकीची उसळ, पनीर मटर मसाला, ४ चपाती, जीरा राईस, लिंबू-कांदा व ताजं ताक',
    special_tag: 'स्पेशल ताजी शेव भाजी व गरम तूप-पोळी',
    menu_items: [
      { id: 'gen-pv-1', name: 'साधी घरगुती पोळी-भाजी थाळी (Regular Veg Thali)', price: 70, is_available: true, category: 'thali' },
      { id: 'gen-pv-2', name: 'स्पेशल अनलिमिटेड पनीर थाळी (Special Veg Thali)', price: 110, is_available: true, category: 'thali' },
      { id: 'gen-pv-3', name: 'जादा गरम गव्हाची चपाती (Extra Chapati)', price: 10, is_available: true, category: 'extra' },
      { id: 'gen-pv-4', name: 'शेव भाजी / पनीर अर्धी प्लेट (Extra Sabji Bowl)', price: 35, is_available: true, category: 'extra' },
      { id: 'gen-pv-5', name: 'थंडगार मसाला ताक (Masala Chaas)', price: 15, is_available: true, category: 'sweet_beverage' },
      { id: 'gen-pv-6', name: 'विद्यार्थी मासिक पास - २ वेळ (Monthly Student Pass)', price: 2200, is_available: true, category: 'pass' },
    ],
  },
  {
    lunch_text: 'खानदेशी वांग्याचं भरीत, झुणका-ठेचा, २ बाजरीची भाकरी, २ चपाती, वरण-भात व दही',
    dinner_text: 'काजू मसाला, मुगाचे वरण, तूप-भाकरी / चपाती, पुलाव, ठेचा व गुलाबजाम (२ नग)',
    special_tag: 'खानदेशी स्पेशल भरीत-भाकरी व ठेचा बेत',
    menu_items: [
      { id: 'gen-pv2-1', name: 'खानदेशी भरीत-भाकरी थाळी (Bharit Bhakri Thali)', price: 90, is_available: true, category: 'thali' },
      { id: 'gen-pv2-2', name: 'पिठलं-भाकरी ठेचा ताट (Pithla Bhakri Meal)', price: 75, is_available: true, category: 'thali' },
      { id: 'gen-pv2-3', name: 'बाजरीची / ज्वारीची गरम भाकरी (1 Bhakri)', price: 18, is_available: true, category: 'extra' },
      { id: 'gen-pv2-4', name: 'खोबऱ्याचा ठेचा व लसूण चटणी (Extra Thecha)', price: 15, is_available: true, category: 'extra' },
      { id: 'gen-pv2-5', name: 'गरमागरम गुलाबजाम २ नग (Gulabjamun)', price: 30, is_available: true, category: 'sweet_beverage' },
      { id: 'gen-pv2-6', name: 'मासिक टिफिन डबा पास (Monthly Tiffin Pass)', price: 2400, is_available: true, category: 'pass' },
    ],
  },
  {
    lunch_text: 'आलू-गोबी सुकी भाजी, फोडणीचं वरण, गरम चपाती, वाफाळलेला भात, लोणचं व भाजलेला पापड',
    dinner_text: 'पालक पनीर, दाल फ्राय, ४ चपाती, जीरा राईस, बुंदी रायता व केशरी श्रीखंड वाटी',
    special_tag: 'रविवार गोड मेजवानी: केशरी श्रीखंड व पुरी-भाजी',
    menu_items: [
      { id: 'gen-pv3-1', name: 'नियमित व्हेज डबा / थाळी (Daily Veg Meal)', price: 75, is_available: true, category: 'thali' },
      { id: 'gen-pv3-2', name: 'महारानी स्पेशल स्वीट थाळी (Special Feast Thali)', price: 120, is_available: true, category: 'thali' },
      { id: 'gen-pv3-3', name: 'पालक पनीर / दाल फ्राय वाटी (Extra Curry)', price: 40, is_available: true, category: 'extra' },
      { id: 'gen-pv3-4', name: 'जीरा राईस हाफ प्लेट (Jeera Rice Half)', price: 45, is_available: true, category: 'extra' },
      { id: 'gen-pv3-5', name: 'आमरस / केशरी श्रीखंड वाटी (Sweet Bowl)', price: 35, is_available: true, category: 'sweet_beverage' },
      { id: 'gen-pv3-6', name: 'एक वेळ मासिक पास (Single-Time Monthly Pass)', price: 1350, is_available: true, category: 'pass' },
    ],
  },
  {
    lunch_text: 'चवळीची रस्सा भाजी, भेंडी फ्राय, ४ चपाती, वरण-भात, ताक व कोशिंबीर',
    dinner_text: 'पनीर बटर मसाला, मेथी ठेपला / चपाती, दाल तडका, राईस व शेवयांची खीर',
    special_tag: 'घरगुती कमी तेलाचा स्वादिष्ट आहार',
    menu_items: [
      { id: 'gen-pv4-1', name: 'स्टुडंट मिनी व्हेज थाळी (Student Mini Thali)', price: 65, is_available: true, category: 'thali' },
      { id: 'gen-pv4-2', name: 'फुल अनलिमिटेड घरगुती थाळी (Full Home Thali)', price: 90, is_available: true, category: 'thali' },
      { id: 'gen-pv4-3', name: 'दही / ताक वाटी (Fresh Curd Bowl)', price: 20, is_available: true, category: 'sweet_beverage' },
      { id: 'gen-pv4-4', name: 'शेवयाची गोड खीर वाटी (Kheer)', price: 30, is_available: true, category: 'sweet_beverage' },
      { id: 'gen-pv4-5', name: 'जादा भाजी + २ चपाती (Extra Sabji & Roti)', price: 35, is_available: true, category: 'extra' },
      { id: 'gen-pv4-6', name: 'दोन वेळ मासिक मेस पास (2-Time Monthly Pass)', price: 2300, is_available: true, category: 'pass' },
    ],
  },
];

const VEG_NONVEG_BUNDLES: Omit<SampleMessMenuBundle, 'messType'>[] = [
  {
    lunch_text: 'कोल्हापुरी सुका चिकन मसाला किंवा शेव भाजी, तांबडा-पांढरा रस्सा, ३ चपाती / १ भाकरी व इंद्रायणी राईस',
    dinner_text: 'अंडा मसाला करी / पनीर कोल्हापुरी, झणझणीत रस्सा, ४ चपाती, जीरा राईस व कांदा-लिंबू',
    special_tag: 'स्पेशल कोल्हापुरी तांबडा-पांढरा रस्सा व सुका चिकन',
    menu_items: [
      { id: 'gen-nv-1', name: 'स्पेशल कोल्हापुरी चिकन थाळी (Chicken Thali)', price: 150, is_available: true, category: 'thali' },
      { id: 'gen-nv-2', name: 'अंडा करी मसाला थाळी (Egg Curry Thali)', price: 110, is_available: true, category: 'thali' },
      { id: 'gen-nv-3', name: 'साधी व्हेज शेव भाजी थाळी (Regular Veg Thali)', price: 85, is_available: true, category: 'thali' },
      { id: 'gen-nv-4', name: 'तांबडा / पांढरा रस्सा जादा वाटी (Extra Rassa)', price: 30, is_available: true, category: 'extra' },
      { id: 'gen-nv-5', name: 'गरम ज्वारी / बाजरी भाकरी (1 Bhakri)', price: 20, is_available: true, category: 'extra' },
      { id: 'gen-nv-6', name: 'थंड कोकण सोलकढी (Fresh Solkadhi)', price: 25, is_available: true, category: 'sweet_beverage' },
      { id: 'gen-nv-7', name: 'मासिक मिक्स मेस पास (Monthly Veg-NonVeg Pass)', price: 2800, is_available: true, category: 'pass' },
    ],
  },
  {
    lunch_text: 'अस्सल गावरान मटण सुक्का / चिकन हंडी (पर्यायी पनीर मसाला), ज्वारी भाकरी, आळणी सूप व इंद्रायणी भात',
    dinner_text: 'चिकन दम बिर्याणी / अंडा भुर्जी पाव व चपाती, रायता व मसाला ताक',
    special_tag: 'फॅमिली हॉटेल स्पेशल: गावरान रस्सा व बिर्याणी',
    menu_items: [
      { id: 'gen-nv2-1', name: 'शाही मटण गावरान थाळी (Special Mutton Thali)', price: 220, is_available: true, category: 'thali' },
      { id: 'gen-nv2-2', name: 'चिकन दम बिर्याणी फुल प्लेट (Chicken Biryani)', price: 140, is_available: true, category: 'thali' },
      { id: 'gen-nv2-3', name: 'पनीर कोल्हापुरी व्हेज थाळी (Veg Paneer Thali)', price: 120, is_available: true, category: 'thali' },
      { id: 'gen-nv2-4', name: 'अंडा भुर्जी डबल + ३ चपाती (Egg Bhurji Plate)', price: 75, is_available: true, category: 'extra' },
      { id: 'gen-nv2-5', name: 'बटर रोटी / तंदुरी रोटी (Butter Roti)', price: 18, is_available: true, category: 'extra' },
      { id: 'gen-nv2-6', name: 'आळणी मटण/चिकन सूप (Alani Soup Bowl)', price: 45, is_available: true, category: 'sweet_beverage' },
    ],
  },
  {
    lunch_text: 'मालवणी चिकन करी / डाळ-मेथी व्हेज भाजी, वडे किंवा चपाती, स्टीम राईस व सोलकढी',
    dinner_text: 'चिकन अंगारा / व्हेज मराठा, दाल तडका, बटर रोटी, जीरा राईस व गुलाबजाम',
    special_tag: 'स्वतंत्र व्हेज व नॉन-व्हेज किचन गॅरंटी',
    menu_items: [
      { id: 'gen-nv3-1', name: 'चिकन फ्राय अनलिमिटेड थाळी (Chicken Fry Thali)', price: 160, is_available: true, category: 'thali' },
      { id: 'gen-nv3-2', name: 'अंडा मसाला तवा फ्राय थाळी (Egg Tawa Thali)', price: 115, is_available: true, category: 'thali' },
      { id: 'gen-nv3-3', name: 'व्हेज मराठा स्पेशल थाळी (Veg Maratha Thali)', price: 110, is_available: true, category: 'thali' },
      { id: 'gen-nv3-4', name: 'उकडलेले अंडे २ नग (Boiled Eggs - 2 pcs)', price: 30, is_available: true, category: 'extra' },
      { id: 'gen-nv3-5', name: 'सोलकढी / लिंबू सरबत (Solkadhi / Lime)', price: 25, is_available: true, category: 'sweet_beverage' },
      { id: 'gen-nv3-6', name: 'मासिक नॉन-व्हेज रविवार स्पेशल पास (Monthly Pass)', price: 2900, is_available: true, category: 'pass' },
    ],
  },
];

const JAIN_BUNDLES: Omit<SampleMessMenuBundle, 'messType'>[] = [
  {
    lunch_text: 'जैन काजू पनीर मसाला, कांदा-लसूण विरहित मुगाची डाळ, ४ शुद्ध तूप चपाती, जीरा राईस व फरसाण',
    dinner_text: 'जैन दाल तडका, मटार पनीर (विना कांदा-लसूण), ४ फुलके, साधी खिचडी व केशर पेढा / गोड शिरा',
    special_tag: '१००% कांदा-लसूण विरहित सात्त्विक जैन जेवण',
    menu_items: [
      { id: 'gen-jn-1', name: 'सात्त्विक जैन नियमित थाळी (Regular Jain Thali)', price: 85, is_available: true, category: 'thali' },
      { id: 'gen-jn-2', name: 'स्पेशल स्वामीनारायण पनीर थाळी (Special Jain Thali)', price: 120, is_available: true, category: 'thali' },
      { id: 'gen-jn-3', name: 'शुद्ध तुपाचा फुलका (Pure Ghee Phulka)', price: 12, is_available: true, category: 'extra' },
      { id: 'gen-jn-4', name: 'जैन डाळ-खिचडी कढी प्लेट (Dal Khichdi & Kadhi)', price: 75, is_available: true, category: 'extra' },
      { id: 'gen-jn-5', name: 'मूग डाळ हलवा / मसाला ताक (Moong Halwa / Taak)', price: 35, is_available: true, category: 'sweet_beverage' },
      { id: 'gen-jn-6', name: 'मासिक सात्त्विक जैन पास (Monthly Jain Pass)', price: 2500, is_available: true, category: 'pass' },
    ],
  },
  {
    lunch_text: 'केळीची सुकी भाजी, गुजराती गोड कढी, ४ तूप-पोळी, खिचडी, भाजलेला पापड व दही',
    dinner_text: 'पनीर टिक्का मसाला (कांदा-लसूण विरहित), दुधी-चणा डाळ भाजी, ४ चपाती, पुलाव व गोड लापशी',
    special_tag: 'जैन पर्व / उपवास व सात्त्विक फराळ पर्याय उपलब्ध',
    menu_items: [
      { id: 'gen-jn2-1', name: 'गुजराती-जैन घरगुती थाळी (Gujarati Jain Thali)', price: 90, is_available: true, category: 'thali' },
      { id: 'gen-jn2-2', name: 'जैन पनीर व कढी स्पेशल ताट (Jain Feast Thali)', price: 125, is_available: true, category: 'thali' },
      { id: 'gen-jn2-3', name: 'काच्या केळ्याची भाजी वाटी (Raw Banana Sabji)', price: 35, is_available: true, category: 'extra' },
      { id: 'gen-jn2-4', name: 'फराळी साबुदाणा खिचडी दही (Fasting Khichdi)', price: 50, is_available: true, category: 'extra' },
      { id: 'gen-jn2-5', name: 'ताजं गोड ताक / लस्सी (Sweet Taak / Lassi)', price: 25, is_available: true, category: 'sweet_beverage' },
      { id: 'gen-jn2-6', name: 'जैन टिफिन मासिक सेवा (Monthly Jain Tiffin)', price: 2400, is_available: true, category: 'pass' },
    ],
  },
];

let menuSampleCursor = 0;

/**
 * Infer a MessType from mess_profile, amenities, or listing name if missing.
 */
export function inferDietaryTagFromMess(mess?: Partial<MessWithDetails> | null): MessType {
  const profileType = mess?.mess_profile?.mess_type;
  if (profileType === 'pure_veg' || profileType === 'veg_nonveg' || profileType === 'jain_available') {
    return profileType;
  }
  const combined = `${mess?.name || ''} ${mess?.name_mr || ''} ${(mess?.amenities || []).join(' ')}`.toLowerCase();
  if (combined.includes('jain') || combined.includes('जैन')) return 'jain_available';
  if (combined.includes('non-veg') || combined.includes('nonveg') || combined.includes('chicken') || combined.includes('mutton') || combined.includes('नॉन')) {
    return 'veg_nonveg';
  }
  return 'pure_veg';
}

/**
 * Generate a unique, genuine local menu bundle (Today's Menu + General Menu Card)
 * strictly aligned with the establishment's dietary tag (`pure_veg`, `veg_nonveg`, `jain_available`).
 */
export function generateSampleMessMenu(
  messType: MessType | string = 'pure_veg',
  cursor?: number,
): SampleMessMenuBundle {
  const normalized: MessType =
    messType === 'veg_nonveg' || messType === 'jain_available' || messType === 'pure_veg'
      ? messType
      : 'pure_veg';

  const idx = typeof cursor === 'number' ? Math.abs(cursor) : menuSampleCursor++;
  const pool =
    normalized === 'veg_nonveg'
      ? VEG_NONVEG_BUNDLES
      : normalized === 'jain_available'
      ? JAIN_BUNDLES
      : PURE_VEG_BUNDLES;

  const picked = pool[idx % pool.length];
  const stamp = Date.now().toString(36).slice(-4);

  return {
    messType: normalized,
    lunch_text: picked.lunch_text,
    dinner_text: picked.dinner_text,
    special_tag: picked.special_tag,
    menu_items: picked.menu_items.map((item, i) => ({
      ...item,
      id: `${item.id}-${stamp}-${i}`,
    })),
  };
}
