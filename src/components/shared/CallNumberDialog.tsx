import { useEffect, useState } from 'react';
import { Check, Copy, MessageCircle, Phone, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { OPEN_CALL_DIALOG_EVENT, type CallDialogDetail } from '@/lib/engagement';
import { useT } from '@/i18n';

function getIndianWaDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
  if (/^0[6-9]\d{9}$/.test(digits)) return `91${digits.slice(1)}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return digits;
  return null;
}

export function CallNumberDialog() {
  const { locale } = useT();
  const isMr = locale === 'mr';
  const [detail, setDetail] = useState<CallDialogDetail | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<CallDialogDetail>;
      if (custom.detail?.phone) {
        setCopied(false);
        setDetail(custom.detail);
      }
    };
    window.addEventListener(OPEN_CALL_DIALOG_EVENT, handler);
    return () => window.removeEventListener(OPEN_CALL_DIALOG_EVENT, handler);
  }, []);

  const handleCopy = async () => {
    if (!detail?.phone) return;
    try {
      await navigator.clipboard.writeText(detail.phone);
      setCopied(true);
      toast.success(isMr ? 'नंबर कॉपी झाला!' : 'Number copied to clipboard');
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = detail.phone;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        toast.success(isMr ? 'नंबर कॉपी झाला!' : 'Number copied to clipboard');
      } catch {
        toast.error(isMr ? 'नंबर कॉपी करता आला नाही' : 'Could not copy number');
      }
    }
  };

  const waDigits = detail?.phone ? getIndianWaDigits(detail.phone) : null;

  return (
    <Dialog open={!!detail} onOpenChange={(open) => { if (!open) setDetail(null); }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
              <Phone className="h-4 w-4" />
            </span>
            <span className="truncate">
              {detail?.label || (isMr ? 'संपर्क क्रमांक' : 'Contact Number')}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {isMr
              ? 'संगणकावर थेट कॉलिंग अॅप नाही. हा नंबर तुमच्या फोनवरून डायल करा किंवा कॉपी करा.'
              : 'Dial this number from your phone, or copy it to your clipboard.'}
          </DialogDescription>
        </DialogHeader>

        {detail && (
          <div className="my-2 rounded-xl border border-primary/20 bg-primary/5 p-4 text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <Smartphone className="h-3.5 w-3.5" />
              <span>{isMr ? 'फोन नंबर' : 'Phone Number'}</span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold tracking-wide text-foreground tabular-nums select-all">
              {detail.phone}
            </p>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
          <Button
            type="button"
            onClick={() => void handleCopy()}
            className="flex-1 gap-2 rounded-xl font-bold"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>
              {copied
                ? (isMr ? 'कॉपी झाले!' : 'Copied!')
                : (isMr ? 'नंबर कॉपी करा' : 'Copy Number')}
            </span>
          </Button>

          {waDigits && (
            <Button
              type="button"
              variant="outline"
              asChild
              className="flex-1 gap-2 rounded-xl border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 font-bold"
            >
              <a
                href={`https://wa.me/${waDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setDetail(null)}
              >
                <MessageCircle className="h-4 w-4" />
                <span>WhatsApp</span>
              </a>
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            onClick={() => setDetail(null)}
            className="rounded-xl"
          >
            {isMr ? 'बंद करा' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
