import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BedDouble,
  Bus,
  ChevronRight,
  ExternalLink,
  GraduationCap,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  Newspaper,
  Phone,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  Store,
  Utensils,
  X,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCity } from '@/hooks/useCity';
import { useSwipeDownToClose } from '@/hooks/useSwipeDownToClose';
import { useT } from '@/i18n';
import {
  askTownAssistant,
  resolveRecommendationEntityType,
  type AssistantRecommendation,
  type AssistantResponsePayload,
  type EntityType,
} from '@/lib/assistant/assistantService';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  payload?: AssistantResponsePayload;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function getEntityIcon(entityType: EntityType) {
  switch (entityType) {
    case 'mess':
      return Utensils;
    case 'pg':
      return BedDouble;
    case 'bus':
      return Bus;
    case 'school':
      return GraduationCap;
    case 'news':
      return Newspaper;
    case 'service':
      return ShieldAlert;
    case 'shop':
    default:
      return Store;
  }
}

export function TownAssistantDrawer() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentCity, currentVillage } = useCity();
  const { locale } = useT();
  const isMr = locale === 'mr';

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const msgCounterRef = useRef(0);

  const { ref: swipeRef } = useSwipeDownToClose({
    isOpen,
    onClose: () => setIsOpen(false),
  });

  const hiddenRoute = /^\/(admin|auth|reset-password|oauth)(\/|$)/i.test(location.pathname);
  const isShopsRoute = /\/shops(\/|$)/i.test(location.pathname);
  const isDetailRoute =
    /\/(shop|mess|pg|schools)\/[^/]+/i.test(location.pathname) ||
    /\/(saved-shops|my-shop|my-institute)(\/|$)/i.test(location.pathname);

  const fabPositionClass = isDetailRoute
    ? 'bottom-24 right-4'
    : isShopsRoute
      ? 'bottom-20 right-4 sm:right-6 lg:right-10'
      : 'bottom-5 right-4';

  const locationLabel = useMemo(() => {
    const cityLabel = isMr && currentCity.name_mr ? currentCity.name_mr : currentCity.name;
    if (currentVillage) {
      const villageLabel =
        isMr && currentVillage.name_mr ? currentVillage.name_mr : currentVillage.name;
      return `${villageLabel}, ${cityLabel}`;
    }
    return cityLabel;
  }, [currentCity, currentVillage, isMr]);

  const defaultQuickPrompts = useMemo(
    () =>
      isMr
        ? [
            'स्वस्त जेवण कुठे मिळेल?',
            'आज मेसमध्ये स्पेशल काय आहे?',
            'पुढची बस कधी आहे?',
            'मुलांचे/मुलींचे PG उपलब्ध आहे का?',
            'आजच्या ताज्या बातम्या',
            'प्रवेश सुरू असलेली कॉलेजेस?',
            'वीज / पाणी बंद सूचना व हेल्पलाईन',
          ]
        : [
            'Affordable meals near me',
            "What's special cooked today?",
            'Next bus departing soon',
            'Boys/Girls PG availability',
            "Today's local news",
            'College admissions open?',
            'Power / water helpline',
          ],
    [isMr],
  );

  const speechSupported = useMemo(() => Boolean(getSpeechRecognitionCtor()), []);

  // Reset conversation automatically when user switches town/village
  useEffect(() => {
    setMessages([]);
    setInput('');
  }, [currentCity.id, currentVillage?.id]);

  // Auto-scroll only the internal message container so Vaul's fixed drawer never shifts
  useEffect(() => {
    if (!isOpen) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollToBottom = () => {
      container.scrollTop = container.scrollHeight;
    };

    scrollToBottom();
    const rafId =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(scrollToBottom)
        : 0;

    return () => {
      if (rafId && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafId);
      }
    };
  }, [messages, isLoading, isOpen]);

  // Stop speech recognition if drawer closes or unmounts
  useEffect(() => {
    if (!isOpen && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore stop errors
      }
      setIsListening(false);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  if (hiddenRoute) {
    return null;
  }

  const handleSendQuery = async (rawText: string) => {
    const query = rawText.trim();
    if (!query || isLoading) return;

    msgCounterRef.current += 1;
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}-${msgCounterRef.current}`,
      role: 'user',
      text: query,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const payload = await askTownAssistant({
        query,
        cityId: currentCity.id,
        citySlug: currentCity.slug,
        villageId: currentVillage?.id || null,
        villageName: currentVillage?.name || null,
        locationLabel,
        history: messages.slice(-6).map((m) => ({
          role: m.role,
          text: m.text,
        })),
      });

      msgCounterRef.current += 1;
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}-${msgCounterRef.current}`,
        role: 'assistant',
        text: payload.replyText,
        payload,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      msgCounterRef.current += 1;
      const errorMsg: ChatMessage = {
        id: `assistant-err-${Date.now()}-${msgCounterRef.current}`,
        role: 'assistant',
        text: isMr
          ? 'माफ करा, माहिती शोधताना अडचण आली. कृपया पुन्हा प्रयत्न करा.'
          : 'Sorry, something went wrong while searching the town directory. Please try again.',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSendQuery(input);
  };

  const handleRecommendationClick = (rec: AssistantRecommendation) => {
    const effectiveEntityType = resolveRecommendationEntityType(rec);
    const slugOrId = rec.slug || rec.id;
    let targetPath = `/${currentCity.slug}`;

    switch (effectiveEntityType) {
      case 'mess':
        targetPath = `/${currentCity.slug}/mess/${slugOrId}`;
        break;
      case 'pg':
        targetPath = `/${currentCity.slug}/pg/${slugOrId}`;
        break;
      case 'shop':
        targetPath = `/${currentCity.slug}/shop/${slugOrId}`;
        break;
      case 'bus':
        targetPath = `/${currentCity.slug}/bus-timetable`;
        break;
      case 'school':
        targetPath = slugOrId
          ? `/${currentCity.slug}/schools/${slugOrId}`
          : `/${currentCity.slug}/schools`;
        break;
      case 'news':
        targetPath = `/${currentCity.slug}/news`;
        break;
      case 'service':
        targetPath = `/${currentCity.slug}/services`;
        break;
    }

    setIsOpen(false);
    navigate(targetPath);
  };

  const toggleVoiceInput = () => {
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    try {
      const recognition = new Ctor();
      recognition.lang = isMr ? 'mr-IN' : 'en-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim();
        if (transcript) {
          setInput(transcript);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      setIsListening(true);
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant');
  const activeSuggestions =
    lastAssistantMessage?.payload?.followUpSuggestions?.length
      ? lastAssistantMessage.payload.followUpSuggestions
      : defaultQuickPrompts;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={isMr ? 'आपला स्थानिक सहाय्यक उघडा' : 'Open ApnaTown Sahayak'}
        data-testid="town-assistant-fab"
        className={`fixed ${fabPositionClass} z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg ring-2 ring-background/80 transition-transform hover:scale-105 active:scale-95`}
      >
        <Sparkles className="h-5 w-5 shrink-0" />
        <span className="text-sm font-semibold tracking-tight">
          {isMr ? 'सहाय्यक' : 'Sahayak'}
        </span>
      </button>

      <Drawer open={isOpen} onOpenChange={setIsOpen} repositionInputs={false}>
        <DrawerContent
          ref={swipeRef}
          className="mt-0 mx-auto flex h-[78vh] supports-[height:78dvh]:h-[78dvh] max-h-[85vh] supports-[height:85dvh]:max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden"
        >
          <DrawerHeader className="shrink-0 border-b px-4 pb-3 pt-2 text-left">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <DrawerTitle className="text-base font-bold truncate">
                    {isMr ? 'अपनाटाऊन सहाय्यक' : 'ApnaTown Sahayak'}
                  </DrawerTitle>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                    <MapPin className="h-3 w-3 text-primary shrink-0" />
                    <span data-testid="assistant-location-badge" className="truncate">{locationLabel}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {messages.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setMessages([])}
                    aria-label={isMr ? 'संभाषण साफ करा' : 'Reset conversation'}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsOpen(false)}
                  aria-label={isMr ? 'बंद करा' : 'Close assistant'}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <DrawerDescription className="sr-only">
              {isMr
                ? 'तुमच्या शहरातील मेस, जेवण, पीजी, बस, शाळा-कॉलेज, ताज्या बातम्या, नागरी सेवा आणि दुकाने शोधण्यासाठी सहाय्यक'
                : 'Hyper-local assistant to search affordable meals, daily specials, PGs, buses, colleges, local news, civic alerts, and shops in your town'}
            </DrawerDescription>
          </DrawerHeader>

          <div
            ref={scrollContainerRef}
            data-vaul-no-drag=""
            data-testid="assistant-messages-scroll"
            className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4"
          >
            {messages.length === 0 ? (
              <div className="space-y-4">
                <div className="rounded-xl border bg-muted/40 p-3.5 text-sm text-foreground">
                  <p className="font-medium">
                    {isMr
                      ? `नमस्कार! मी ${locationLabel} साठी तुमचा स्थानिक सहाय्यक आहे.`
                      : `Hi! Ask me anything about ${locationLabel}.`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isMr
                      ? 'स्वस्त जेवण, मेस स्पेशल मेनू, बस वेळ, पीजी, शाळा-कॉलेज प्रवेश, ताज्या बातम्या व वीज/पाणी हेल्पलाईन एका टॅपवर शोधा.'
                      : 'Find meals, daily mess specials, PGs, buses, college admissions, local news, or water/power helplines.'}
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {isMr ? 'झटपट प्रश्न' : 'Quick prompts'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {defaultQuickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void handleSendQuery(prompt)}
                        className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-primary hover:bg-primary/5"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'border bg-muted/40 text-foreground'
                      }`}
                    >
                      <p className="whitespace-pre-line">{msg.text}</p>

                      {msg.role === 'assistant' && msg.payload && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium">
                            {msg.payload.mode === 'gemini'
                              ? isMr
                                ? 'AI सहाय्यक'
                                : 'AI Powered'
                              : isMr
                                ? 'थेट निर्देशिका'
                                : 'Live Directory'}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {msg.role === 'assistant' &&
                      msg.payload?.recommendations &&
                      msg.payload.recommendations.length > 0 && (
                        <div className="mt-2.5 grid w-full gap-2">
                          {msg.payload.recommendations.map((rec) => {
                            const effectiveEntityType = resolveRecommendationEntityType(rec);
                            const Icon = getEntityIcon(effectiveEntityType);
                            const safePhone =
                              rec.phone && /^[+\d][\d\s-]{2,18}$/.test(rec.phone.trim())
                                ? rec.phone.trim().replace(/\s+/g, '')
                                : null;
                            const safeExternal =
                              rec.externalUrl && /^https?:\/\//i.test(rec.externalUrl)
                                ? rec.externalUrl
                                : null;
                            const isUrgent =
                              rec.priority === 'critical' || rec.priority === 'high';
                            return (
                              <div
                                key={`${effectiveEntityType}-${rec.id}`}
                                className={`flex w-full items-stretch overflow-hidden rounded-xl border bg-card shadow-sm transition-all ${
                                  isUrgent ? 'border-rose-500/40' : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleRecommendationClick(rec)}
                                  className="flex min-w-0 flex-1 items-start justify-between gap-2 p-3 text-left transition-colors hover:bg-accent/30"
                                >
                                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                                    <div
                                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                        isUrgent
                                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                          : 'bg-primary/10 text-primary'
                                      }`}
                                    >
                                      <Icon className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="truncate text-sm font-semibold text-foreground">
                                          {rec.title}
                                        </span>
                                        <Badge variant="outline" className="shrink-0 text-[10px]">
                                          {rec.highlightBadge}
                                        </Badge>
                                      </div>
                                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                        {rec.reason}
                                      </p>
                                    </div>
                                  </div>
                                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                                </button>
                                {safePhone && (
                                  <a
                                    href={`tel:${safePhone}`}
                                    aria-label={isMr ? `${rec.title} ला कॉल करा` : `Call ${rec.title}`}
                                    className="flex shrink-0 items-center justify-center border-l px-2.5 text-primary transition-colors hover:bg-primary/10"
                                  >
                                    <Phone className="h-4 w-4" />
                                  </a>
                                )}
                                {!safePhone && effectiveEntityType === 'news' && safeExternal && (
                                  <a
                                    href={safeExternal}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={isMr ? 'मूळ बातमी वाचा' : `Read source for ${rec.title}`}
                                    className="flex shrink-0 items-center justify-center border-l px-2.5 text-primary transition-colors hover:bg-primary/10"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span>{isMr ? 'माहिती शोधत आहे...' : `Searching ${locationLabel}...`}</span>
                  </div>
                )}

                {!isLoading && messages.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {activeSuggestions.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => void handleSendQuery(chip)}
                        className="rounded-full border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <form
            onSubmit={handleFormSubmit}
            data-vaul-no-drag=""
            className="flex shrink-0 items-center gap-2 border-t bg-background px-3 sm:px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isMr
                  ? `${locationLabel} मध्ये काहीही विचारा...`
                  : `Ask about meals, buses, PGs in ${locationLabel}...`
              }
              aria-label={isMr ? 'तुमचा प्रश्न टाइप करा' : 'Ask a question'}
              className="min-w-0 flex-1 rounded-full border bg-muted/40 px-3.5 sm:px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            {speechSupported && (
              <Button
                type="button"
                variant={isListening ? 'destructive' : 'outline'}
                size="icon"
                onClick={toggleVoiceInput}
                aria-label={
                  isListening
                    ? isMr
                      ? 'ऐकणे थांबवा'
                      : 'Stop voice input'
                    : isMr
                      ? 'आवाजाने विचारा'
                      : 'Start voice input'
                }
                className="h-9 w-9 shrink-0 rounded-full"
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            )}
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              aria-label={isMr ? 'पाठवा' : 'Send'}
              className="h-9 w-9 shrink-0 rounded-full"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </DrawerContent>
      </Drawer>
    </>
  );
}
