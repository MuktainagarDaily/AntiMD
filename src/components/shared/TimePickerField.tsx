/**
 * Shared 12-hour AM/PM time picker.
 * - value / onChange use "HH:MM" 24-hour strings (matches DB storage)
 * - Internal state keeps hour/minute/ampm independently so selecting
 *   AM/PM or hour doesn't get overwritten before the parent re-renders.
 */
import React, { useState, useEffect } from 'react';
import { useT } from '@/i18n';

interface TimePickerFieldProps {
  value: string; // "HH:MM" 24h or ""
  onChange: (val: string) => void; // emits "HH:MM" 24h or ""
  label?: string;
  optional?: boolean;
  error?: string;
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1)); // ["1".."12"]
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

function to12h(value: string): { hour: string; minute: string; ampm: 'AM' | 'PM' } {
  if (!value) return { hour: '', minute: '', ampm: 'AM' };
  const [hStr, mStr] = value.split(':');
  let h = parseInt(hStr, 10);
  const ampm: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h = h - 12;
  return { hour: String(h), minute: String(parseInt(mStr, 10)).padStart(2, '0'), ampm };
}

function to24h(hour: string, minute: string, ampm: 'AM' | 'PM'): string {
  if (!hour || !minute) return '';
  let h = parseInt(hour, 10);
  if (ampm === 'AM' && h === 12) h = 0;
  else if (ampm === 'PM' && h !== 12) h = h + 12;
  return `${String(h).padStart(2, '0')}:${minute}`;
}

const selectCls =
  'flex-1 min-w-0 px-2 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer appearance-none text-center';

export function TimePickerField({ value, onChange, label, optional, error }: TimePickerFieldProps) {
  const { t } = useT();
  // Internal state — independent of parent re-render timing
  const [hour, setHour]     = useState<string>(() => to12h(value).hour);
  const [minute, setMinute] = useState<string>(() => to12h(value).minute);
  const [ampm, setAmpm]     = useState<'AM' | 'PM'>(() => to12h(value).ampm);

  // Sync inward when parent resets the value to '' (e.g. user clicks Clear)
  useEffect(() => {
    if (!value) {
      setHour(''); setMinute(''); setAmpm('AM');
    } else {
      const parsed = to12h(value);
      setHour(parsed.hour);
      setMinute(parsed.minute);
      setAmpm(parsed.ampm);
    }
    // Only sync when the external value changes (don't override internal mid-edit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (h: string, m: string, ap: 'AM' | 'PM') => {
    if (!h || !m) { onChange(''); return; }
    onChange(to24h(h, m, ap));
  };

  const handleHour = (val: string) => {
    setHour(val);
    emit(val, minute, ampm);
  };

  const handleMinute = (val: string) => {
    setMinute(val);
    emit(hour, val, ampm);
  };

  const handleAmpm = (val: 'AM' | 'PM') => {
    setAmpm(val);
    emit(hour, minute, val);
  };

  const clear = () => {
    setHour(''); setMinute(''); setAmpm('AM');
    onChange('');
  };

  const hasValue = !!(hour && minute);

  return (
    <div>
      {label && (
        <label className="block text-sm font-semibold text-foreground mb-1.5">
          {label}
          {optional && <span className="text-muted-foreground font-normal"> (optional)</span>}
        </label>
      )}
      <div className="flex items-center gap-1.5">
        {/* Hour */}
        <select
          value={hour}
          onChange={(e) => handleHour(e.target.value)}
          className={selectCls + (error ? ' border-destructive' : '')}
          aria-label={t('timePicker.hourAria')}
        >
          <option value="">{t('timePicker.hourShort')}</option>
          {HOURS.map((h) => (
            <option key={h} value={h}>{h.padStart(2, '0')}</option>
          ))}
        </select>

        <span className="text-foreground font-bold text-sm select-none">:</span>

        {/* Minute */}
        <select
          value={minute}
          onChange={(e) => handleMinute(e.target.value)}
          className={selectCls + (error ? ' border-destructive' : '')}
          aria-label={t('timePicker.minuteAria')}
        >
          <option value="">{t('timePicker.minuteShort')}</option>
          {MINUTES.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        {/* AM / PM */}
        <select
          value={ampm}
          onChange={(e) => handleAmpm(e.target.value as 'AM' | 'PM')}
          className={selectCls + (error ? ' border-destructive' : '') + ' max-w-[64px]'}
          aria-label={t('timePicker.ampmAria')}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>

        {/* Clear */}
        {hasValue && (
          <button
            type="button"
            onClick={clear}
            className="px-2 py-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors text-xs font-semibold shrink-0"
            aria-label={t('timePicker.clearAria')}
          >
            ✕
          </button>
        )}
      </div>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
