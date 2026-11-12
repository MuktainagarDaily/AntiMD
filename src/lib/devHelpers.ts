/**
 * Examiner / Test Autofill Helpers.
 *
 * Kept active in production builds so external reviewers & examiners can
 * quickly evaluate listing forms and 1-tap admin flows with genuine sample data.
 */
import type { RequestEntityType } from '@/components/RequestListingModal';
import type { SchoolType, SchoolMedium, AdmissionStatus, ManagementType } from '@/lib/schools/schoolHelpers';

export const EXAMINER_MODE_ENABLED = true;
export const DEV_AUTOFILL: boolean = EXAMINER_MODE_ENABLED;

export const DUMMY_SHOP_DATA = {
  name: 'Sahyadri Kirana & Super Market',
  phone: '9876543210',
  whatsapp: '9876543210',
  address: 'Shop No. 4, Near ST Bus Stand, Station Road',
  area: 'Station Road',
  sub_area: 'Opp. Police Station',
  category_text: 'Grocery & Kirana',
  opening_time: '08:30',
  closing_time: '21:30',
  description: 'Neighborhood grocery store supplying fresh grains, pulses, dairy products, spices, and household essentials with home delivery.',
  keywords: 'grocery, kirana, rice, wheat, dairy, daily essentials',
  submitter_name: 'Rajesh Patil',
  latitude: '21.044700',
  longitude: '75.734200',
  amenities: ['UPI Accepted', 'Home Delivery', 'Parking'],
  mr: {
    name: 'सह्याद्री किराणा अँड सुपर मार्केट',
    area: 'स्टेशन रोड',
    sub_area: 'पोलीस स्टेशनसमोर',
    address: 'दुकान क्र. ४, एसटी बस स्टँडजवळ, स्टेशन रोड',
    description: 'ताजे धान्य, डाळी, दुग्धजन्य पदार्थ, मसाले आणि घरगुती गरजेच्या वस्तू होम डिलिव्हरीसह उपलब्ध.',
    keywords: 'किराणा, धान्य, दूध, घरगुती सामान',
  },
};

export interface EntityAutofillPayload {
  common: typeof DUMMY_SHOP_DATA;
  mess?: {
    messType: 'pure_veg' | 'veg_nonveg' | 'jain_available';
    monthlyRate: string;
    singleThaliRate: string;
    tiffinDelivery: boolean;
    sundayFeast: boolean;
    lunchTiming: string;
    dinnerTiming: string;
  };
  pg?: {
    pgGender: 'boys' | 'girls' | 'both';
    occupancyTarget: 'students' | 'professionals' | 'any';
    totalBeds: string;
    availableBeds: string;
    depositAmount: string;
    gateClosingTime: string;
    foodIncluded: boolean;
    rateSingle: string;
    rateDouble: string;
    rateTriple: string;
  };
  school?: {
    schoolType: SchoolType;
    schoolMedium: SchoolMedium;
    schoolBoard: string;
    schoolManagement: ManagementType;
    schoolAdmissionStatus: AdmissionStatus;
    schoolStreams: string;
    schoolEmail: string;
    schoolWebsite: string;
  };
}

const ENTITY_AUTOFILL_BANK: Record<RequestEntityType, EntityAutofillPayload[]> = {
  shop: [
    { common: DUMMY_SHOP_DATA },
    {
      common: {
        name: 'Omkar Medical & General Stores',
        phone: '9823456712',
        whatsapp: '9823456712',
        address: 'Plot 12, Main Market Chowk, Near Tahsil Office',
        area: 'Main Market',
        sub_area: 'Near Tahsil Kacheri',
        category_text: 'Medical & Pharmacy',
        opening_time: '08:00',
        closing_time: '22:30',
        description: 'Allopathic medicines, wellness products, baby care, BP/sugar checkup, and prescription home delivery available.',
        keywords: 'medical, pharmacy, chemist, medicine, health',
        submitter_name: 'Sagar Deshmukh',
        latitude: '21.045100',
        longitude: '75.735100',
        amenities: ['UPI Accepted', 'AC', 'Home Delivery'],
        mr: {
          name: 'ओंकार मेडिकल अँड जनरल स्टोअर्स',
          area: 'मेन मार्केट',
          sub_area: 'तहसील कचेरीजवळ',
          address: 'प्लॉट १२, मेन मार्केट चौक, तहसील कार्यालयाजवळ',
          description: 'सर्व प्रकारची औषधे, हेल्थ केअर उत्पादने, बीपी/शुगर तपासणी आणि मोफत होम डिलिव्हरी.',
          keywords: 'मेडिकल, औषधे, केमिस्ट, आरोग्य',
        },
      },
    },
  ],
  mess: [
    {
      common: {
        name: 'Annapurna Gharghuti Mess & Tiffin',
        phone: '9765432109',
        whatsapp: '9765432109',
        address: 'Near Engineering College Gate, Campus Road',
        area: 'College Road',
        sub_area: 'Opp. Boys Hostel',
        category_text: 'Mess & Dining',
        opening_time: '11:00',
        closing_time: '22:30',
        description: 'Hygienic home-style Maharashtrian thali, fresh chapati/bhakri, special Sunday sweet dish, and student monthly tiffin plans.',
        keywords: 'mess, thali, tiffin, gharghuti, student meal, veg',
        submitter_name: 'Sunita Kulkarni',
        latitude: '21.046200',
        longitude: '75.736100',
        amenities: ['Pure Veg', 'Tiffin Delivery', 'Unlimited Thali', 'RO Drinking Water', 'Monthly Pass Available'],
        mr: {
          name: 'अन्नपूर्णा घरगुती मेस व टिफिन',
          area: 'कॉलेज रोड',
          sub_area: 'मुलांच्या वसतिगृहासमोर',
          address: 'इंजिनिअरिंग कॉलेज गेटजवळ, कॅम्पस रोड',
          description: 'स्वच्छ घरगुती महाराष्ट्रीयन थाळी, ताजी भाकरी-पोळी, रविवारची खास गोड मेजवानी आणि मासिक टिफिन सेवा.',
          keywords: 'मेस, थाळी, टिफिन, घरगुती जेवण',
        },
      },
      mess: {
        messType: 'pure_veg',
        monthlyRate: '2400',
        singleThaliRate: '80',
        tiffinDelivery: true,
        sundayFeast: true,
        lunchTiming: '11:30 AM - 02:45 PM',
        dinnerTiming: '07:30 PM - 10:15 PM',
      },
    },
    {
      common: {
        name: 'Maratha Darbar Hotel & Family Mess',
        phone: '9850123498',
        whatsapp: '9850123498',
        address: 'Highway Touch, Near Main Chowk',
        area: 'Highway Chowk',
        sub_area: 'Near Petrol Pump',
        category_text: 'Hotel & Restaurant',
        opening_time: '11:00',
        closing_time: '23:00',
        description: 'Separate Veg and Non-Veg kitchens serving Kolhapuri Tambada-Pandhara Rassa, Paneer Handi, Biryani, and unlimited thalis.',
        keywords: 'hotel, non-veg, chicken thali, paneer, biryani, mess',
        submitter_name: 'Vikram Pawar',
        latitude: '21.043900',
        longitude: '75.733200',
        amenities: ['Veg & Non-Veg', 'AC', 'UPI Accepted', 'Home Delivery', 'Parking'],
        mr: {
          name: 'मराठा दरबार हॉटेल व फॅमिली मेस',
          area: 'हायवे चौक',
          sub_area: 'पेट्रोल पंपाजवळ',
          address: 'हायवे टच, मुख्य चौकाजवळ',
          description: 'स्वतंत्र व्हेज व नॉनव्हेज किचन — कोल्हापुरी तांबडा-पांढरा रस्सा, पनीर हंडी, बिर्याणी व अनलिमिटेड थाळी.',
          keywords: 'हॉटेल, नॉनव्हेज, चिकन थाळी, बिर्याणी',
        },
      },
      mess: {
        messType: 'veg_nonveg',
        monthlyRate: '3000',
        singleThaliRate: '110',
        tiffinDelivery: true,
        sundayFeast: true,
        lunchTiming: '12:00 PM - 03:30 PM',
        dinnerTiming: '07:00 PM - 11:00 PM',
      },
    },
    {
      common: {
        name: 'Mahavir Jain & Swaminarayan Bhojanalay',
        phone: '9764882211',
        whatsapp: '9764882211',
        address: 'Near Mahavir Mandir, Market Yard Road',
        area: 'Market Yard',
        sub_area: 'Opp. Grain Market Gate',
        category_text: 'Mess & Dining',
        opening_time: '11:00',
        closing_time: '21:30',
        description: 'Sattvik no-onion, no-garlic fresh Jain and Gujarati-Maharashtrian thali, pure ghee rotis, dal-khichdi, and student monthly passes.',
        keywords: 'jain mess, sattvik food, no onion garlic, pure veg, thali',
        submitter_name: 'Kiran Oswal',
        latitude: '21.044500',
        longitude: '75.734900',
        amenities: ['Jain Food Available', 'Pure Veg', 'RO Drinking Water', 'Monthly Pass Available', 'UPI Accepted'],
        mr: {
          name: 'महावीर जैन व स्वामीनारायण भोजनालय',
          area: 'मार्केट यार्ड',
          sub_area: 'धान्य मार्केट गेटसमोर',
          address: 'महावीर मंदिराजवळ, मार्केट यार्ड रोड',
          description: 'कांदा-लसूण विरहित शुद्ध सात्त्विक जैन थाळी, तूप-पोळी, डाळ-खिचडी आणि विद्यार्थ्यांसाठी मासिक पास सुविधा.',
          keywords: 'जैन मेस, सात्त्विक जेवण, शुद्ध शाकाहारी, थाळी',
        },
      },
      mess: {
        messType: 'jain_available',
        monthlyRate: '2500',
        singleThaliRate: '85',
        tiffinDelivery: true,
        sundayFeast: true,
        lunchTiming: '11:15 AM - 02:30 PM',
        dinnerTiming: '07:00 PM - 09:30 PM',
      },
    },
  ],
  pg: [
    {
      common: {
        name: 'Vidyarthi Niwas Boys PG & Study Hostel',
        phone: '9890112233',
        whatsapp: '9890112233',
        address: 'Plot 7, Shanti Nagar, Behind Polytechnic College',
        area: 'Shanti Nagar',
        sub_area: 'Behind Campus Gate',
        category_text: 'PG & Hostel',
        opening_time: '06:00',
        closing_time: '22:30',
        description: 'Spacious 2 & 3-sharing student rooms with high-speed WiFi, RO drinking water, solar geyser, study tables, and 24x7 inverter backup.',
        keywords: 'pg, boys hostel, student rooms, accommodation, wifi',
        submitter_name: 'Prakash Jadhav',
        latitude: '21.045800',
        longitude: '75.737400',
        amenities: ['Wi-Fi', 'RO Drinking Water', 'Geyser / Hot Water', 'Study Table & Chair', 'Inverter / Power Backup', 'CCTV Security'],
        mr: {
          name: 'विद्यार्थी निवास बॉईज पीजी व स्टडी हॉस्टेल',
          area: 'शांती नगर',
          sub_area: 'कॅम्पस गेटच्या मागे',
          address: 'प्लॉट ७, शांती नगर, पॉलिटेक्निक कॉलेजमागे',
          description: 'हवेशीर २ व ३ शेअरिंग खोल्या, हाय-स्पीड वाय-फाय, आरओ पाणी, सोलर गिझर, स्टडी टेबल आणि २४ तास इन्व्हर्टर बॅकअप.',
          keywords: 'पीजी, मुलांचे वसतिगृह, खोल्या, स्टडी रूम',
        },
      },
      pg: {
        pgGender: 'boys',
        occupancyTarget: 'students',
        totalBeds: '36',
        availableBeds: '7',
        depositAmount: '3000',
        gateClosingTime: '10:30 PM',
        foodIncluded: false,
        rateSingle: '4800',
        rateDouble: '3200',
        rateTriple: '2500',
      },
    },
    {
      common: {
        name: 'Saraswati Girls Hostel & PG',
        phone: '9422556677',
        whatsapp: '9422556677',
        address: 'Lane 2, Vidya Vihar Colony, Near Bus Stop',
        area: 'Vidya Vihar',
        sub_area: 'Near Library Square',
        category_text: 'PG & Hostel',
        opening_time: '06:00',
        closing_time: '21:30',
        description: 'Safe, warden-supervised girls PG with biometric entry, CCTV security, homestyle veg meals included, and washing facility.',
        keywords: 'girls pg, ladies hostel, safe stay, mess included',
        submitter_name: 'Meena Shinde',
        latitude: '21.044200',
        longitude: '75.735900',
        amenities: ['CCTV Security', 'Mess / Food Included', 'Wi-Fi', 'RO Drinking Water', 'Daily Housekeeping', 'Geyser / Hot Water'],
        mr: {
          name: 'सरस्वती गर्ल्स हॉस्टेल व पीजी',
          area: 'विद्या विहार',
          sub_area: 'लायब्ररी चौकाजवळ',
          address: 'गल्ली २, विद्या विहार कॉलनी, बस स्टॉपजवळ',
          description: 'महिला वॉर्डन व बायोमेट्रिक सुरक्षा, CCTV, घरगुती शाकाहारी जेवण समाविष्ट आणि स्वच्छ खोल्या.',
          keywords: 'मुलींचे पीजी, हॉस्टेल, सुरक्षित निवास',
        },
      },
      pg: {
        pgGender: 'girls',
        occupancyTarget: 'students',
        totalBeds: '28',
        availableBeds: '5',
        depositAmount: '4000',
        gateClosingTime: '09:30 PM',
        foodIncluded: true,
        rateSingle: '6200',
        rateDouble: '4600',
        rateTriple: '3800',
      },
    },
  ],
  school: [
    {
      common: {
        name: 'Saraswati Vidya Mandir Junior College',
        phone: '9404112299',
        whatsapp: '9404112299',
        address: 'Survey No. 18, Vidya Sankul Road, Near Taluka Krida Sankul',
        area: 'Vidya Sankul',
        sub_area: 'Near Sports Ground',
        category_text: 'School & Junior College',
        opening_time: '07:30',
        closing_time: '17:00',
        description: 'Co-educational secondary school and HSC junior college offering Science, Commerce, and Arts with well-equipped labs and bus facility.',
        keywords: 'school, junior college, hsc, ssc, science, commerce',
        submitter_name: 'Prof. Anil Joshi',
        latitude: '21.046800',
        longitude: '75.738100',
        amenities: ['RO Drinking Water', 'CCTV Security', 'Parking', 'Science Lab', 'Library'],
        mr: {
          name: 'सरस्वती विद्या मंदिर व ज्युनियर कॉलेज',
          area: 'विद्या संकुल',
          sub_area: 'तालुका क्रीडा संकुलाजवळ',
          address: 'सर्व्हे नं. १८, विद्या संकुल रोड',
          description: 'विज्ञान, वाणिज्य व कला शाखांसह माध्यमिक व उच्च माध्यमिक शिक्षण, सुसज्ज प्रयोगशाळा व बस सुविधा.',
          keywords: 'शाळा, ज्युनियर कॉलेज, विज्ञान, वाणिज्य',
        },
      },
      school: {
        schoolType: 'higher-secondary',
        schoolMedium: 'semi-english',
        schoolBoard: 'State Board (SSC/HSC)',
        schoolManagement: 'aided',
        schoolAdmissionStatus: 'open',
        schoolStreams: 'Science, Commerce, Arts',
        schoolEmail: 'admissions@saraswatividya.edu.in',
        schoolWebsite: 'https://saraswatividya.edu.in',
      },
    },
    {
      common: {
        name: 'Pragati MHT-CET & NEET Coaching Academy',
        phone: '9881776655',
        whatsapp: '9881776655',
        address: '2nd Floor, Ganesh Arcade, Station Road',
        area: 'Station Road',
        sub_area: 'Above Bank of Maharashtra',
        category_text: 'Coaching & Classes',
        opening_time: '07:00',
        closing_time: '20:30',
        description: 'Focused foundation & entrance coaching for Class 8-12 CBSE/State Board, MHT-CET, JEE, and NEET with weekly test series.',
        keywords: 'coaching, classes, mht-cet, neet, jee, tuition',
        submitter_name: 'Prof. Rahul Bhosale',
        latitude: '21.045300',
        longitude: '75.734700',
        amenities: ['AC', 'Wi-Fi', 'RO Drinking Water', 'CCTV Security'],
        mr: {
          name: 'प्रगती MHT-CET व NEET कोचिंग अकॅडमी',
          area: 'स्टेशन रोड',
          sub_area: 'बँक ऑफ महाराष्ट्र वरती',
          address: '२ रा मजला, गणेश आर्केड, स्टेशन रोड',
          description: 'इयत्ता ८ ते १२ वी विज्ञान तसेच MHT-CET, JEE आणि NEET साठी तज्ज्ञ मार्गदर्शन व साप्ताहिक टेस्ट सिरीज.',
          keywords: 'कोचिंग, क्लासेस, नीट, सीईटी, शिकवणी',
        },
      },
      school: {
        schoolType: 'coaching',
        schoolMedium: 'english',
        schoolBoard: 'Autonomous',
        schoolManagement: 'private',
        schoolAdmissionStatus: 'open',
        schoolStreams: 'Physics, Chemistry, Maths, Biology',
        schoolEmail: 'info@pragatiacademy.in',
        schoolWebsite: 'https://pragatiacademy.in',
      },
    },
  ],
};

let autofillCursor = 0;

export function getEntityAutofillSample(
  entityType: RequestEntityType,
  city?: { latitude?: number | null; longitude?: number | null; area?: string; name?: string },
): EntityAutofillPayload {
  const pool = ENTITY_AUTOFILL_BANK[entityType] || ENTITY_AUTOFILL_BANK.shop;
  const pick = pool[autofillCursor % pool.length];
  autofillCursor += 1;

  const baseLat = typeof city?.latitude === 'number' ? city.latitude : 21.0447;
  const baseLng = typeof city?.longitude === 'number' ? city.longitude : 75.7342;
  const jitterLat = (((autofillCursor % 7) - 3) * 0.0011).toFixed(6);
  const jitterLng = ((((autofillCursor * 2) % 7) - 3) * 0.0011).toFixed(6);

  return {
    ...pick,
    common: {
      ...pick.common,
      latitude: (baseLat + Number(jitterLat)).toFixed(6),
      longitude: (baseLng + Number(jitterLng)).toFixed(6),
    },
  };
}

export interface MessModalAutofillSample {
  name: string;
  phone: string;
  whatsapp: string;
  area: string;
  sub_area: string;
  address: string;
  description: string;
  monthlyRate: string;
  singleThaliRate: string;
  tiffinDelivery: boolean;
  sundayFeast: boolean;
  lunchTiming: string;
  dinnerTiming: string;
  amenities: string[];
  mr: {
    name: string;
    area: string;
    sub_area: string;
    address: string;
    description: string;
  };
}

export function getMessModalAutofillSample(
  establishmentType: 'mess' | 'hotel' | 'tiffin',
  messType: 'pure_veg' | 'veg_nonveg' | 'jain_available',
  townName = 'Muktainagar',
  cursor?: number,
): MessModalAutofillSample {
  const idx = cursor ?? autofillCursor++;

  if (establishmentType === 'hotel') {
    const hotelPool: Record<'pure_veg' | 'veg_nonveg' | 'jain_available', MessModalAutofillSample[]> = {
      pure_veg: [
        {
          name: 'Hotel Sai Prasad Pure Veg Family Dining',
          phone: '9823411220',
          whatsapp: '9823411220',
          area: 'Station Road',
          sub_area: 'Opp. ST Bus Stand',
          address: `Plot 14, Station Road, ${townName}`,
          description: 'AC family restaurant serving unlimited Maharashtrian thali, Punjabi gravies, South Indian breakfast, and parcel service.',
          monthlyRate: '',
          singleThaliRate: '120',
          tiffinDelivery: false,
          sundayFeast: true,
          lunchTiming: '11:30 AM - 03:30 PM',
          dinnerTiming: '07:00 PM - 11:00 PM',
          amenities: ['Hotel / Restaurant', 'Pure Veg', 'Family Dining Hall', 'AC Seating Available', 'Dine-in Available', 'Parcel / Takeaway Available', 'UPI / Online Payment'],
          mr: {
            name: 'हॉटेल साई प्रसाद प्युअर व्हेज फॅमिली डायनिंग',
            area: 'स्टेशन रोड',
            sub_area: 'एसटी बस स्थानकासमोर',
            address: `प्लॉट १४, स्टेशन रोड, ${townName}`,
            description: 'एसी फॅमिली रेस्टॉरंट — अनलिमिटेड महाराष्ट्रीयन थाळी, पंजाबी डिशेस, साउथ इंडियन नाश्ता व पार्सल सुविधा.',
          },
        },
      ],
      veg_nonveg: [
        {
          name: 'Hotel Rajmudra Kolhapuri Family Kitchen',
          phone: '9850774411',
          whatsapp: '9850774411',
          area: 'Highway Chowk',
          sub_area: 'Near Bus Stop',
          address: `Shop 1-3, Highway Touch, ${townName}`,
          description: 'Authentic Kolhapuri Chicken/Mutton Thali, Tambada-Pandhara Rassa, Paneer Handi, Biryani, and separate Veg-NonVeg family seating.',
          monthlyRate: '',
          singleThaliRate: '150',
          tiffinDelivery: true,
          sundayFeast: true,
          lunchTiming: '12:00 PM - 04:00 PM',
          dinnerTiming: '07:00 PM - 11:30 PM',
          amenities: ['Hotel / Restaurant', 'Family Dining Hall', 'Dine-in Available', 'Parcel / Takeaway Available', 'Hygienic Kitchen', 'UPI / Online Payment'],
          mr: {
            name: 'हॉटेल राजमुद्रा कोल्हापुरी फॅमिली किचन',
            area: 'हायवे चौक',
            sub_area: 'बस स्टॉपजवळ',
            address: `शॉप १-३, हायवे टच, ${townName}`,
            description: 'अस्सल कोल्हापुरी चिकन-मटण थाळी, तांबडा-पांढरा रस्सा, पनीर हंडी, बिर्याणी व फॅमिली डायनिंग.',
          },
        },
      ],
      jain_available: [
        {
          name: 'Hotel Navkar Sattvik & Pure Veg Dining Hall',
          phone: '9765123490',
          whatsapp: '9765123490',
          area: 'Market Yard',
          sub_area: 'Near Jain Temple',
          address: `Market Yard Corner, ${townName}`,
          description: 'Dedicated no-onion, no-garlic kitchen counter available alongside traditional Gujarati and Maharashtrian thali.',
          monthlyRate: '2800',
          singleThaliRate: '110',
          tiffinDelivery: true,
          sundayFeast: true,
          lunchTiming: '11:30 AM - 03:00 PM',
          dinnerTiming: '07:00 PM - 10:00 PM',
          amenities: ['Hotel / Restaurant', 'Pure Veg', 'Jain Food Available', 'Family Dining Hall', 'Hygienic Kitchen', 'RO Drinking Water'],
          mr: {
            name: 'हॉटेल नवकार सात्त्विक व प्युअर व्हेज डायनिंग हॉल',
            area: 'मार्केट यार्ड',
            sub_area: 'जैन मंदिराजवळ',
            address: `मार्केट यार्ड कॉर्नर, ${townName}`,
            description: 'स्वतंत्र कांदा-लसूण विरहित जैन स्वयंपाक विभाग तसेच गुजराती व महाराष्ट्रीयन थाळी.',
          },
        },
      ],
    };
    const pool = hotelPool[messType];
    return pool[idx % pool.length];
  }

  if (establishmentType === 'tiffin') {
    const sample = ENTITY_AUTOFILL_BANK.mess.find((m) => m.mess?.messType === messType) || ENTITY_AUTOFILL_BANK.mess[0];
    return {
      name: sample.common.name,
      phone: sample.common.phone,
      whatsapp: sample.common.whatsapp,
      area: sample.common.area,
      sub_area: sample.common.sub_area,
      address: `${sample.common.address}, ${townName}`,
      description: sample.common.description,
      monthlyRate: sample.mess?.monthlyRate || '2300',
      singleThaliRate: sample.mess?.singleThaliRate || '75',
      tiffinDelivery: true,
      sundayFeast: sample.mess?.sundayFeast ?? true,
      lunchTiming: sample.mess?.lunchTiming || '11:30 AM - 02:30 PM',
      dinnerTiming: sample.mess?.dinnerTiming || '07:30 PM - 10:00 PM',
      amenities: ['Tiffin Delivery', 'Monthly Pass Available', 'RO Drinking Water', 'Hygienic Kitchen', 'UPI / Online Payment', ...(messType === 'pure_veg' ? ['Pure Veg'] : messType === 'jain_available' ? ['Pure Veg', 'Jain Food Available'] : [])],
      mr: sample.common.mr,
    };
  }

  const sample = ENTITY_AUTOFILL_BANK.mess.find((m) => m.mess?.messType === messType) || ENTITY_AUTOFILL_BANK.mess[0];
  return {
    name: sample.common.name,
    phone: sample.common.phone,
    whatsapp: sample.common.whatsapp,
    area: sample.common.area,
    sub_area: sample.common.sub_area,
    address: `${sample.common.address}, ${townName}`,
    description: sample.common.description,
    monthlyRate: sample.mess?.monthlyRate || '2400',
    singleThaliRate: sample.mess?.singleThaliRate || '80',
    tiffinDelivery: sample.mess?.tiffinDelivery ?? true,
    sundayFeast: sample.mess?.sundayFeast ?? true,
    lunchTiming: sample.mess?.lunchTiming || '11:30 AM - 02:30 PM',
    dinnerTiming: sample.mess?.dinnerTiming || '07:30 PM - 10:15 PM',
    amenities: [
      'Mess / Bhojanalay',
      'Unlimited Thali',
      'Monthly Pass Available',
      'RO Drinking Water',
      'Hygienic Kitchen',
      'UPI / Online Payment',
      ...(messType === 'pure_veg' ? ['Pure Veg'] : messType === 'jain_available' ? ['Pure Veg', 'Jain Food Available'] : []),
    ],
    mr: sample.common.mr,
  };
}
