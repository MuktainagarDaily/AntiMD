/**
 * Single button that translates a batch of English source fields into their
 * Marathi mirror values in one tap. Used at the top of a form's Marathi
 * section instead of per-field translate buttons.
 *
 * Default behaviour: translate only pairs whose Marathi value is empty.
 * When every non-empty source already has a Marathi value, the button
 * switches to "Retranslate all" and overwrites them on click.
 */
import { useEffect, useMemo, useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { translateEnToMr } from '@/lib/translateApi';

export interface TranslatePair {
  source: string;
  value: string;
  onChange: (v: string) => void;
}

interface Props {
  pairs: TranslatePair[];
  className?: string;
}

type BulkTranslateState = {
  running: boolean;
  completed: number;
  total: number;
};

const listeners = new Set<(state: BulkTranslateState) => void>();
let bulkTranslateState: BulkTranslateState = { running: false, completed: 0, total: 0 };

function emitBulkTranslateState(next: BulkTranslateState) {
  bulkTranslateState = next;
  listeners.forEach((listener) => listener(next));
}

function subscribeBulkTranslate(listener: (state: BulkTranslateState) => void) {
  listeners.add(listener);
  listener(bulkTranslateState);
  return () => {
    listeners.delete(listener);
  };
}

export function TranslateAllButton({ pairs, className = '' }: Props) {
  const [job, setJob] = useState<BulkTranslateState>(bulkTranslateState);

  useEffect(() => subscribeBulkTranslate(setJob), []);

  const { hasAnySource, allFilled } = useMemo(() => {
    const withSource = pairs.filter((p) => p.source.trim().length > 0);
    return {
      hasAnySource: withSource.length > 0,
      allFilled: withSource.length > 0 && withSource.every((p) => p.value.trim().length > 0),
    };
  }, [pairs]);

  const run = async () => {
    if (bulkTranslateState.running) return;

    const targets = pairs.filter(
      (p) => p.source.trim().length > 0 && (allFilled || p.value.trim().length === 0),
    );
    if (targets.length === 0) {
      toast.info('Nothing to translate yet — fill in English first.');
      return;
    }

    emitBulkTranslateState({ running: true, completed: 0, total: targets.length });
    let ok = 0;
    let failed = 0;

    await Promise.all(
      targets.map(async (p) => {
        try {
          const mr = await translateEnToMr(p.source.trim());
          if (mr) { p.onChange(mr); ok++; } else { failed++; }
        } catch { failed++; }
        finally {
          emitBulkTranslateState({
            running: true,
            completed: Math.min(ok + failed, targets.length),
            total: targets.length,
          });
        }
      }),
    );

    emitBulkTranslateState({ running: false, completed: targets.length, total: targets.length });
    if (ok && !failed) toast.success(`Translated ${ok} field${ok === 1 ? '' : 's'}`);
    else if (ok && failed) toast.warning(`Translated ${ok}, failed ${failed}`);
    else toast.error('Translation service unavailable. Please type Marathi manually.');
  };

  const loading = job.running;
  const label = allFilled ? 'Retranslate all' : 'Translate to Marathi';
  const progressLabel = loading
    ? `Translating ${Math.min(job.completed, job.total)}/${job.total}…`
    : label;

  return (
    <button
      type="button"
      onClick={run}
      disabled={!hasAnySource || loading}
      aria-busy={loading}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
      title="Translate all English fields to Marathi (cached project-wide)"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Languages className="w-3.5 h-3.5" />}
      {progressLabel}
    </button>
  );
}
