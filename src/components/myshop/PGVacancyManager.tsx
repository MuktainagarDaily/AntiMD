import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BedDouble, Check, Loader2, Clock, Users, Plus, Minus, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { savePGProfile } from '@/lib/living/livingService';
import type { PGProfile, PGGender } from '@/lib/living/livingTypes';
import { useT } from '@/i18n';

interface PGVacancyManagerProps {
  shopId: string;
  shopName: string;
}

export function PGVacancyManager({ shopId, shopName }: PGVacancyManagerProps) {
  const { t, locale } = useT();
  const qc = useQueryClient();

  const [availableBeds, setAvailableBeds] = useState<number>(0);
  const [totalBeds, setTotalBeds] = useState<number>(10);
  const [gender, setGender] = useState<PGGender>('boys');
  const [gateClosingTime, setGateClosingTime] = useState('10:00 PM');
  const [foodIncluded, setFoodIncluded] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(2000);
  const [rate1, setRate1] = useState<string>('');
  const [rate2, setRate2] = useState<string>('');
  const [rate3, setRate3] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Load existing PG profile
  const { data: profile, isLoading } = useQuery<PGProfile | null>({
    queryKey: ['pg-profile-manage', shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pg_profiles')
        .select('*')
        .eq('shop_id', shopId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('Error fetching PG profile:', error);
      }
      return data as PGProfile | null;
    },
  });

  useEffect(() => {
    if (profile) {
      setAvailableBeds(profile.available_beds ?? 0);
      setTotalBeds(profile.total_beds ?? 10);
      setGender(profile.gender || 'boys');
      setGateClosingTime(profile.gate_closing_time || '10:00 PM');
      setFoodIncluded(!!profile.food_included);
      setDepositAmount(profile.deposit_amount || 2000);

      const rates = profile.sharing_rates || {};
      setRate1(rates['1_sharing'] != null ? String(rates['1_sharing']) : '');
      setRate2(rates['2_sharing'] != null ? String(rates['2_sharing']) : '');
      setRate3(rates['3_sharing'] != null ? String(rates['3_sharing']) : '');
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const sharingRates = {
        '1_sharing': rate1 ? Number(rate1) : null,
        '2_sharing': rate2 ? Number(rate2) : null,
        '3_sharing': rate3 ? Number(rate3) : null,
      };

      const { error } = await savePGProfile({
        shop_id: shopId,
        available_beds: Math.max(0, availableBeds),
        total_beds: Math.max(0, totalBeds),
        gender,
        gate_closing_time: gateClosingTime.trim() || '10:00 PM',
        food_included: foodIncluded,
        deposit_amount: Number(depositAmount) || 0,
        sharing_rates: sharingRates,
      });

      if (error) throw error;

      toast.success(
        locale === 'mr'
          ? 'रिक्त जागा आणि खोली भाडे जतन केले गेले!'
          : 'Vacancies and room rates updated successfully!'
      );
      qc.invalidateQueries({ queryKey: ['pg-profile-manage', shopId] });
      qc.invalidateQueries({ queryKey: ['living-pgs'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update PG details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-primary/30 p-4 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <BedDouble className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground">
              {locale === 'mr' ? 'पीजी रिक्त जागा व माहिती' : 'PG Vacancy & Room Rates'}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {locale === 'mr' ? 'विद्यार्थ्यांना थेट चालू उपलब्ध बेड दाखवा' : 'Show live vacant beds to students'}
            </p>
          </div>
        </div>

        <span
          className={`shrink-0 whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-full ${
            availableBeds > 0
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
          }`}
        >
          {availableBeds > 0
            ? locale === 'mr'
              ? `${availableBeds} जागा उपलब्ध`
              : `${availableBeds} Beds Vacant`
            : locale === 'mr'
            ? 'पूर्ण (Full)'
            : 'Full'}
        </span>
      </div>

      {/* Vacant Bed Stepper */}
      <div className="p-3 rounded-xl bg-muted/40 border border-border flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <label className="text-xs font-bold text-foreground block">
            {locale === 'mr' ? 'सध्या रिक्त असलेले बेड' : 'Currently Available Beds'}
          </label>
          <span className="text-[10px] text-muted-foreground">
            {locale === 'mr' ? 'विद्यार्थी हे थेट कार्डवर पाहतील' : 'Displayed prominently on your card'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setAvailableBeds((b) => Math.max(0, b - 1))}
            className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted active:scale-95 transition-all text-foreground"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="text-base font-bold text-foreground w-8 text-center">{availableBeds}</span>
          <button
            type="button"
            onClick={() => setAvailableBeds((b) => b + 1)}
            className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Gender & Total Beds */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
            {locale === 'mr' ? 'हॉस्टेल प्रकार (Gender)' : 'PG Category'}
          </label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as PGGender)}
            className="w-full px-2.5 py-2 rounded-xl border border-input bg-background text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="boys">👦 Boys Only</option>
            <option value="girls">👧 Girls Only</option>
            <option value="both">👫 Both / Separate Wings</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
            {locale === 'mr' ? 'एकूण बेड क्षमता (Total Beds)' : 'Total Bed Capacity'}
          </label>
          <input
            type="number"
            value={totalBeds}
            onChange={(e) => setTotalBeds(Number(e.target.value) || 0)}
            className="w-full px-2.5 py-2 rounded-xl border border-input bg-background text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Sharing Rates */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-foreground block">
          {locale === 'mr' ? 'मासिक खोली भाडे (दर / महिना)' : 'Monthly Rent Per Bed'}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-[10px] text-muted-foreground block mb-0.5">1-Sharing (Single)</span>
            <input
              type="number"
              placeholder="उदा. 4500"
              value={rate1}
              onChange={(e) => setRate1(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border border-input bg-background text-foreground text-xs"
            />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block mb-0.5">2-Sharing (Double)</span>
            <input
              type="number"
              placeholder="उदा. 3200"
              value={rate2}
              onChange={(e) => setRate2(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border border-input bg-background text-foreground text-xs"
            />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block mb-0.5">3-Sharing (Triple)</span>
            <input
              type="number"
              placeholder="उदा. 2500"
              value={rate3}
              onChange={(e) => setRate3(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border border-input bg-background text-foreground text-xs"
            />
          </div>
        </div>
      </div>

      {/* Gate time & Deposit */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
            🕒 {locale === 'mr' ? 'गेट बंद होण्याची वेळ' : 'Gate Closing Time'}
          </label>
          <input
            type="text"
            value={gateClosingTime}
            onChange={(e) => setGateClosingTime(e.target.value)}
            placeholder="e.g. 10:00 PM"
            className="w-full px-2.5 py-1.5 rounded-xl border border-input bg-background text-foreground text-xs"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
            💰 {locale === 'mr' ? 'डिपॉझिट रक्कम (₹)' : 'Deposit Amount (₹)'}
          </label>
          <input
            type="number"
            value={depositAmount}
            onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
            placeholder="e.g. 2000"
            className="w-full px-2.5 py-1.5 rounded-xl border border-input bg-background text-foreground text-xs"
          />
        </div>
      </div>

      {/* Food Included Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-xl bg-muted/30 border border-border">
        <div className="text-xs min-w-0 flex-1">
          <p className="font-semibold text-foreground">
            🍲 {locale === 'mr' ? 'जेवण/मेस समाविष्ट आहे का?' : 'Food / Mess Included in Rent?'}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {locale === 'mr' ? 'भाड्यात सकाळचा नाश्ता किंवा जेवण समाविष्ट असल्यास निवडा' : 'Turn on if food is provided with stay'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFoodIncluded(!foodIncluded)}
          className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-colors ${
            foodIncluded
              ? 'bg-emerald-600 text-white'
              : 'bg-muted text-muted-foreground border border-border'
          }`}
        >
          {foodIncluded ? (locale === 'mr' ? 'होय (Yes)' : 'Yes') : (locale === 'mr' ? 'नाही (No)' : 'No')}
        </button>
      </div>

      {/* Save Button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xs"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{locale === 'mr' ? 'जतन करत आहे...' : 'Saving...'}</span>
          </>
        ) : (
          <>
            <Check className="w-4 h-4" />
            <span>{locale === 'mr' ? 'माहिती जतन करा' : 'Save Vacancy & Rates'}</span>
          </>
        )}
      </button>
    </div>
  );
}
