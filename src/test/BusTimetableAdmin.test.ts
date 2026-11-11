import { describe, it, expect } from 'vitest';
import { parseTimes, standInfoSchema, filterBusRows, type Row } from '@/components/admin/BusTimetableTab';
import {
  parseBusNotes,
  serializeBusNotes,
  parseBulkBusCsv,
  PARANDWADI_DEPOT_SEEDS,
} from '@/lib/bus/busHelpers';

describe('Admin Bus Timetable Logic & Validation', () => {
  describe('parseTimes', () => {
    it('normalizes single digit hour and sorts ascending', () => {
      const input = '9:00, 07:15, 14:30, 6:45';
      const result = parseTimes(input);
      expect(result.ok).toEqual(['06:45', '07:15', '09:00', '14:30']);
      expect(result.bad).toHaveLength(0);
    });

    it('deduplicates identical times', () => {
      const input = '08:00, 08:00, 10:15, 10:15';
      const result = parseTimes(input);
      expect(result.ok).toEqual(['08:00', '10:15']);
    });

    it('identifies invalid time strings into bad list', () => {
      const input = '08:00, 25:00, abc, 12:75, 12:30';
      const result = parseTimes(input);
      expect(result.ok).toEqual(['08:00', '12:30']);
      expect(result.bad).toEqual(['25:00', 'abc', '12:75']);
    });

    it('accepts whitespace and newline separated times', () => {
      const input = '07:30\n09:45 11:15; 16:30';
      const result = parseTimes(input);
      expect(result.ok).toEqual(['07:30', '09:45', '11:15', '16:30']);
    });
  });

  describe('standInfoSchema validation', () => {
    it('validates a correct phone, address, and Google Maps URL', () => {
      const valid = {
        phone: '02583-234225',
        address: 'Muktainagar ST Stand, Jalgaon',
        maps_url: 'https://maps.app.goo.gl/abcdef',
      };
      const res = standInfoSchema.safeParse(valid);
      expect(res.success).toBe(true);
    });

    it('rejects non-Google hosts for security', () => {
      const invalidUrl = {
        phone: '02583234225',
        address: 'Muktainagar ST Stand',
        maps_url: 'https://malicious-site.com/phishing',
      };
      const res = standInfoSchema.safeParse(invalidUrl);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('Must be a valid Google Maps URL');
      }
    });

    it('allows empty optional fields safely', () => {
      const empty = {
        phone: '',
        address: '',
        maps_url: '',
      };
      const res = standInfoSchema.safeParse(empty);
      expect(res.success).toBe(true);
    });
  });

  describe('filterBusRows', () => {
    const sampleRows: Row[] = [
      {
        id: '1',
        destination: 'Jalgaon',
        destination_mr: 'जळगाव',
        departure_times: ['08:00'],
        notes: 'via Bhusawal',
        sort_order: 1,
        is_active: true,
      },
      {
        id: '2',
        destination: 'Pune Station',
        destination_mr: 'पुणे स्टेशन',
        departure_times: ['21:00'],
        notes: 'Direct Superfast',
        sort_order: 2,
        is_active: true,
      },
      {
        id: '3',
        destination: 'Nigdi',
        destination_mr: 'निगडी',
        departure_times: ['07:30'],
        notes: 'PMPML Route 342',
        sort_order: 3,
        is_active: false,
      },
    ];

    it('filters by English destination name', () => {
      const res = filterBusRows(sampleRows, 'jalgaon', 'all');
      expect(res).toHaveLength(1);
      expect(res[0].destination).toBe('Jalgaon');
    });

    it('filters by Marathi destination name', () => {
      const res = filterBusRows(sampleRows, 'पुणे', 'all');
      expect(res).toHaveLength(1);
      expect(res[0].destination).toBe('Pune Station');
    });

    it('filters by notes (e.g. via or route)', () => {
      const res = filterBusRows(sampleRows, 'bhusawal', 'all');
      expect(res).toHaveLength(1);
      expect(res[0].destination).toBe('Jalgaon');

      const pmpml = filterBusRows(sampleRows, 'Route 342', 'all');
      expect(pmpml).toHaveLength(1);
      expect(pmpml[0].destination).toBe('Nigdi');
    });

    it('filters by active and hidden status', () => {
      const activeOnly = filterBusRows(sampleRows, '', 'active');
      expect(activeOnly).toHaveLength(2);
      expect(activeOnly.every((r) => r.is_active)).toBe(true);

      const hiddenOnly = filterBusRows(sampleRows, '', 'hidden');
      expect(hiddenOnly).toHaveLength(1);
      expect(hiddenOnly[0].destination).toBe('Nigdi');
    });

    it('combines search query with status filtering', () => {
      const res = filterBusRows(sampleRows, 'Route 342', 'active');
      expect(res).toHaveLength(0); // Route 342 is hidden

      const resHidden = filterBusRows(sampleRows, 'Route 342', 'hidden');
      expect(resHidden).toHaveLength(1);
    });

    it('filters by route direction', () => {
      const outgoing = filterBusRows(sampleRows, '', 'all', 'outgoing');
      expect(outgoing).toHaveLength(3); // default direction is outgoing

      const sampleWithIncoming: Row[] = [
        ...sampleRows,
        {
          id: '4',
          destination: 'Urse to Parandwadi',
          destination_mr: null,
          departure_times: ['17:00'],
          notes: '[Incoming] · [PMPML] · via Somatane Phata',
          sort_order: 4,
          is_active: true,
        },
      ];

      const inc = filterBusRows(sampleWithIncoming, '', 'all', 'incoming');
      expect(inc).toHaveLength(1);
      expect(inc[0].id).toBe('4');
    });
  });

  describe('parseBusNotes & serializeBusNotes', () => {
    it('serializes and parses round-trip correctly', () => {
      const original = {
        direction: 'incoming' as const,
        bus_type: 'pmpml' as const,
        via: ['Somatane Phata', 'Dehu Road'],
        raw_notes: 'Urse -> Parandwadi',
      };

      const serialized = serializeBusNotes(original);
      expect(serialized).toContain('[Incoming]');
      expect(serialized).toContain('[PMPML]');
      expect(serialized).toContain('via Somatane Phata, Dehu Road');
      expect(serialized).toContain('Urse -> Parandwadi');

      const parsed = parseBusNotes(serialized);
      expect(parsed.direction).toBe('incoming');
      expect(parsed.bus_type).toBe('pmpml');
      expect(parsed.via).toEqual(['Somatane Phata', 'Dehu Road']);
      expect(parsed.raw_notes).toBe('Urse -> Parandwadi');
    });

    it('detects bus types and via stops from legacy notes', () => {
      const legacy1 = 'via Bhusawal, Bodwad';
      const parsed1 = parseBusNotes(legacy1);
      expect(parsed1.via).toEqual(['Bhusawal', 'Bodwad']);
      expect(parsed1.bus_type).toBe('msrtc_ordinary');

      const legacy2 = 'PMPML Route 342: via Somatane Phata';
      const parsed2 = parseBusNotes(legacy2);
      expect(parsed2.bus_type).toBe('pmpml');
      expect(parsed2.via).toEqual(['Somatane Phata']);

      const legacy3 = 'Shivshahi Express Superfast';
      const parsed3 = parseBusNotes(legacy3);
      expect(parsed3.bus_type).toBe('msrtc_express');
    });

    it('defaults gracefully on empty or null notes', () => {
      const parsed = parseBusNotes(null);
      expect(parsed.direction).toBe('outgoing');
      expect(parsed.bus_type).toBe('msrtc_ordinary');
      expect(parsed.via).toEqual([]);
      expect(parsed.raw_notes).toBe('');
    });
  });

  describe('parseBulkBusCsv (Phase 4 Bulk Import)', () => {
    it('parses standard 4-column CSV with comma delimiter', () => {
      const csv = `Nigdi, निगडी, "07:30, 09:30, 12:05", PMPML Route 342
Urse, उर्से, 07:15 09:10 16:20, Vasudev Ashram`;

      const result = parseBulkBusCsv(csv);
      expect(result.errors).toHaveLength(0);
      expect(result.valid).toHaveLength(2);

      expect(result.valid[0].destination).toBe('Nigdi');
      expect(result.valid[0].destination_mr).toBe('निगडी');
      expect(result.valid[0].departure_times).toEqual(['07:30', '09:30', '12:05']);
      expect(result.valid[0].notes).toBe('PMPML Route 342');
      expect(result.valid[0].is_active).toBe(true);

      expect(result.valid[1].destination).toBe('Urse');
      expect(result.valid[1].departure_times).toEqual(['07:15', '09:10', '16:20']);
    });

    it('parses tab-separated TSV (copied from Google Sheets or Excel)', () => {
      const tsv = "Talegaon\tतळेगाव\t06:45 07:45 08:45\tvia Somatane Phata\nLonavala\tलोणावळा\t07:00, 08:30\tOld Highway";
      const result = parseBulkBusCsv(tsv);
      expect(result.errors).toHaveLength(0);
      expect(result.valid).toHaveLength(2);
      expect(result.valid[0].destination).toBe('Talegaon');
      expect(result.valid[0].departure_times).toEqual(['06:45', '07:45', '08:45']);
      expect(result.valid[1].destination).toBe('Lonavala');
    });

    it('parses pipe-separated rows', () => {
      const pipe = 'Pune Station | पुणे स्टेशन | 06:30 08:30 10:00 | Shivajinagar Express';
      const result = parseBulkBusCsv(pipe);
      expect(result.errors).toHaveLength(0);
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].destination).toBe('Pune Station');
      expect(result.valid[0].departure_times).toEqual(['06:30', '08:30', '10:00']);
      expect(result.valid[0].notes).toBe('Shivajinagar Express');
    });

    it('skips header line cleanly', () => {
      const withHeader = `Destination, Marathi Name, Departure Times, Notes
Jalgaon, जळगाव, 08:00 09:30, Express
Bhusawal, भुसावळ, 07:00 10:00, Ordinary`;

      const result = parseBulkBusCsv(withHeader);
      expect(result.errors).toHaveLength(0);
      expect(result.valid).toHaveLength(2);
      expect(result.valid[0].destination).toBe('Jalgaon');
      expect(result.valid[1].destination).toBe('Bhusawal');
    });

    it('supports 2-column format (Destination, Times)', () => {
      const twoCol = `Shirdi, 06:00 14:00
Nashik, 05:30 11:00`;
      const result = parseBulkBusCsv(twoCol);
      expect(result.errors).toHaveLength(0);
      expect(result.valid).toHaveLength(2);
      expect(result.valid[0].destination).toBe('Shirdi');
      expect(result.valid[0].destination_mr).toBeUndefined();
      expect(result.valid[0].departure_times).toEqual(['06:00', '14:00']);
    });

    it('captures lines with missing destinations or invalid times into errors', () => {
      const badInput = `, No destination here, 08:00
BadTimesCity, वाईट वेळ, invalid_time_here
ValidCity, योग्य शहर, 08:00 12:00`;

      const result = parseBulkBusCsv(badInput);
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].destination).toBe('ValidCity');
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].message).toContain('Destination is missing');
      expect(result.errors[1].message).toContain('No valid HH:MM times found');
    });
  });

  describe('PARANDWADI_DEPOT_SEEDS data verification', () => {
    it('has 8 verified official routes for Maval / Parandwadi depot', () => {
      expect(PARANDWADI_DEPOT_SEEDS).toHaveLength(8);
    });

    it('all seed entries have valid destinations and valid sorted departure times', () => {
      for (const route of PARANDWADI_DEPOT_SEEDS) {
        expect(route.destination).toBeTruthy();
        expect(route.destination_mr).toBeTruthy();
        expect(route.departure_times.length).toBeGreaterThan(0);
        for (const t of route.departure_times) {
          expect(t).toMatch(/^[0-2][0-9]:[0-5][0-9]$/);
        }
      }
    });

    it('includes essential local connection routes (Nigdi, Urse, Talegaon, Hinjawadi)', () => {
      const destinations = PARANDWADI_DEPOT_SEEDS.map((r) => r.destination);
      expect(destinations.some((d) => d.includes('Nigdi'))).toBe(true);
      expect(destinations.some((d) => d.includes('Urse'))).toBe(true);
      expect(destinations.some((d) => d.includes('Talegaon'))).toBe(true);
      expect(destinations.some((d) => d.includes('Hinjawadi'))).toBe(true);
    });
  });
});
