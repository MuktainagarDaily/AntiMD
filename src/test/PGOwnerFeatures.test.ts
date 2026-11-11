import { describe, it, expect } from 'vitest';
import {
  calculatePGBedsFromRooms,
  formatPGWhatsAppBroadcast,
} from '@/lib/living/livingService';
import type { PGRoomItem } from '@/lib/living/livingTypes';

describe('PG Owner Features & Logic', () => {
  describe('calculatePGBedsFromRooms', () => {
    it('returns 0 beds for empty room array', () => {
      const result = calculatePGBedsFromRooms([]);
      expect(result).toEqual({ totalBeds: 0, availableBeds: 0 });
    });

    it('sums total and available beds across multiple rooms', () => {
      const sampleRooms: PGRoomItem[] = [
        { id: '1', room_number: '101', total_beds: 2, available_beds: 1, sharing_type: '2_sharing' },
        { id: '2', room_number: '102', total_beds: 3, available_beds: 0, sharing_type: '3_sharing' },
        { id: '3', room_number: '103', total_beds: 4, available_beds: 2, sharing_type: '4_sharing' },
      ];

      const { totalBeds, availableBeds } = calculatePGBedsFromRooms(sampleRooms);
      expect(totalBeds).toBe(9);
      expect(availableBeds).toBe(3);
    });

    it('handles numeric conversions safely', () => {
      const sampleRooms: any[] = [
        { id: '1', room_number: 'A1', total_beds: '2', available_beds: '1' },
        { id: '2', room_number: 'A2', total_beds: undefined, available_beds: null },
      ];

      const { totalBeds, availableBeds } = calculatePGBedsFromRooms(sampleRooms);
      expect(totalBeds).toBe(2);
      expect(availableBeds).toBe(1);
    });
  });

  describe('formatPGWhatsAppBroadcast', () => {
    it('generates a complete Marathi WhatsApp broadcast message', () => {
      const msg = formatPGWhatsAppBroadcast({
        shopName: 'Sai Girls Hostel',
        shopNameMr: 'साई गर्ल्स हॉस्टेल',
        area: 'कॉलेज रोड, परंडवडी',
        gender: 'girls',
        availableBeds: 3,
        rates: {
          rate1: 4500,
          rate2: 3000,
          rate3: 2500,
          rate4: null,
        },
        depositAmount: 2000,
        foodIncluded: true,
        gateClosingTime: '09:30 PM',
        amenities: ['WiFi', 'Geyser', 'RO Water'],
        phone: '9876543210',
        baseUrl: 'https://muktainagar.app',
        isMr: true,
      });

      expect(msg).toContain('साई गर्ल्स हॉस्टेल');
      expect(msg).toContain('खोल्या व बेड रिक्त आहेत!');
      expect(msg).toContain('मुलींचे वसतिगृह / पीजी');
      expect(msg).toContain('₹2500/महिन्यापासून');
      expect(msg).toContain('डिपॉझिट: ₹2000');
      expect(msg).toContain('3 बेड उपलब्ध');
      expect(msg).toContain('नाश्ता / जेवण समाविष्ट आहे');
      expect(msg).toContain('09:30 PM');
      expect(msg).toContain('WiFi, Geyser, RO Water');
      expect(msg).toContain('9876543210');
      expect(msg).toContain('https://muktainagar.app/pg');
    });

    it('generates an English broadcast message when isMr is false', () => {
      const msg = formatPGWhatsAppBroadcast({
        shopName: 'Greenfield Boys PG',
        shopNameMr: 'ग्रीनफिल्ड बॉईज पीजी',
        area: 'Near Talegaon Station',
        gender: 'boys',
        availableBeds: 2,
        rates: {
          rate2: 3500,
        },
        depositAmount: 1500,
        foodIncluded: false,
        gateClosingTime: '10:00 PM',
        amenities: ['WiFi', 'Study Desk'],
        phone: '9123456789',
        baseUrl: 'http://localhost:8081',
        isMr: false,
      });

      expect(msg).toContain('Greenfield Boys PG');
      expect(msg).toContain('Rooms & Beds Available!');
      expect(msg).toContain('Boys Hostel / PG');
      expect(msg).toContain('₹3500/month onwards');
      expect(msg).toContain('Deposit: ₹1500');
      expect(msg).toContain('2 beds vacant');
      expect(msg).toContain('Nearby mess available');
      expect(msg).toContain('WiFi, Study Desk');
      expect(msg).toContain('http://localhost:8081/pg');
    });

    it('gracefully handles missing rates', () => {
      const msg = formatPGWhatsAppBroadcast({
        shopName: 'Shree PG',
        gender: 'both',
        availableBeds: 0,
        rates: {},
        isMr: true,
      });

      expect(msg).toContain('Shree PG');
      expect(msg).toContain('माफक दरात');
      expect(msg).toContain('मर्यादित जागा');
    });
  });
});
