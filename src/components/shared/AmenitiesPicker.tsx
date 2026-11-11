/**
 * AmenitiesPicker
 * Preset checkboxes + free-text custom amenities.
 * Stores final list as string[] (deduped, trimmed). Compatible with shops.amenities text[].
 */
import { useState, useMemo } from 'react';
import { X, Plus, Sparkles } from 'lucide-react';
import { useT } from '@/i18n';

export const PRESET_AMENITIES = [
  // General & Business
  'Parking',
  'AC',
  'Wi-Fi',
  'UPI Accepted',
  'Home Delivery',
  // Mess & Dining
  'Pure Veg',
  'Veg & Non-Veg',
  'Tiffin Delivery',
  'Unlimited Thali',
  'Monthly Pass Available',
  'Sunday Special Feast',
  'Jain Food Available',
  // PG & Hostels
  'RO Drinking Water',
  'Geyser / Hot Water',
  'Attached Washroom',
  'Inverter / Power Backup',
  'Daily Housekeeping',
  'CCTV Security',
  'Study Table & Chair',
  'Washing Machine / Laundry',
  'Cupboard / Almirah',
  'Mess / Food Included',
] as const;

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
}

export function AmenitiesPicker({ value, onChange }: Props) {
  const { t } = useT();
  const [customInput, setCustomInput] = useState('');


  const valueSet = useMemo(
    () => new Set(value.map((v) => v.trim().toLowerCase())),
    [value],
  );

  const togglePreset = (label: string) => {
    const key = label.toLowerCase();
    if (valueSet.has(key)) {
      onChange(value.filter((v) => v.trim().toLowerCase() !== key));
    } else {
      onChange([...value, label]);
    }
  };

  const addCustom = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (valueSet.has(trimmed.toLowerCase())) {
      setCustomInput('');
      return;
    }
    onChange([...value, trimmed]);
    setCustomInput('');
  };

  const removeChip = (label: string) => {
    onChange(value.filter((v) => v !== label));
  };

  // Custom = anything in `value` not in presets
  const presetSet = new Set(PRESET_AMENITIES.map((a) => a.toLowerCase()));
  const customValues = value.filter((v) => !presetSet.has(v.trim().toLowerCase()));

  return (
    <div className="space-y-2.5">
      {/* Preset checkboxes */}
      <div className="flex flex-wrap gap-2">
        {PRESET_AMENITIES.map((label) => {
          const selected = valueSet.has(label.toLowerCase());
          return (
            <button
              key={label}
              type="button"
              onClick={() => togglePreset(label)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                selected
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:border-primary'
              }`}
            >
              {selected && <Sparkles className="w-3 h-3" />}
              {label}
            </button>
          );
        })}
      </div>

      {/* Custom input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder={t('amenities.customPlaceholder')}
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          maxLength={40}
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!customInput.trim()}
          className="shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1"
          style={{ background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))' }}
        >
          <Plus className="w-3.5 h-3.5" /> {t('amenities.add')}
        </button>
      </div>

      {/* Custom chips */}
      {customValues.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {customValues.map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border border-border bg-muted"
            >
              {label}
              <button
                type="button"
                onClick={() => removeChip(label)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${label}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Pick from common amenities or add your own. Leave empty to hide the section on the shop page.
      </p>
    </div>
  );
}

/** Normalize a stored value (text[] or comma string or null) into a clean string[] */
export function parseAmenities(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}
