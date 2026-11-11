import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ImageLightbox } from '@/components/shared/ImageLightbox';
import { useEdgeSwipeBack } from '@/hooks/useEdgeSwipeBack';
import { CityPickerModal } from '@/components/shared/CityPickerModal';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { CityProvider } from '@/hooks/useCity';
import { AuthProvider } from '@/hooks/useAuth';
import { I18nProvider } from '@/i18n';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => {
  const createChain = () => {
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      neq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      limit: vi.fn(() => chain),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'test-user-id',
          city_id: 'city-1',
          geo_cities: { slug: 'muktainagar' },
        },
        error: null,
      }),
      update: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
    };
    return chain;
  };

  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
      from: vi.fn(() => createChain()),
    },
  };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    isAdmin: false,
    isShopkeeper: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function EdgeSwipeTestComponent({ onBack, enabled = true }: { onBack?: () => void; enabled?: boolean }) {
  const { isSwiping, indicatorNode } = useEdgeSwipeBack({
    onBack,
    enabled,
    edgeZonePx: 28,
    thresholdPx: 60,
  });

  return (
    <div data-testid="edge-swipe-container" data-swiping={isSwiping ? 'true' : 'false'}>
      <h1>Page Content</h1>
      {indicatorNode}
    </div>
  );
}

function createPointerEvent(type: string, clientX: number, clientY: number) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  }) as any;
  Object.defineProperty(event, 'clientX', { value: clientX, configurable: true });
  Object.defineProperty(event, 'clientY', { value: clientY, configurable: true });
  Object.defineProperty(event, 'pointerId', { value: 1, configurable: true });
  return event;
}

describe('Mobile Touch & Swipe Gestures Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ImageLightbox Drag & Fade Swipe-to-Dismiss', () => {
    it('renders the image lightbox with mobile swipe hint bar', () => {
      const onClose = vi.fn();
      render(
        <I18nProvider>
          <ImageLightbox
            images={['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg']}
            alt="Sample Shop"
            onClose={onClose}
          />
        </I18nProvider>
      );

      const lightbox = screen.getByRole('dialog', { name: /Sample Shop — image viewer/i });
      expect(lightbox).toBeInTheDocument();
      expect(screen.getByText('1 / 2')).toBeInTheDocument();
    });

    it('translates image downwards on pointer drag and closes when released past threshold', async () => {
      const onClose = vi.fn();
      render(
        <I18nProvider>
          <ImageLightbox
            images={['https://example.com/photo1.jpg']}
            alt="Sample Shop"
            onClose={onClose}
          />
        </I18nProvider>
      );

      const img = screen.getByRole('img');
      const container = img.parentElement!;

      // 1. Pointer down at y=100 & drag down to y=220 (+120px)
      act(() => {
        container.dispatchEvent(createPointerEvent('pointerdown', 150, 100));
        container.dispatchEvent(createPointerEvent('pointermove', 150, 220));
      });

      // Should translate downwards and scale slightly down
      expect(img.style.transform).toContain('translate(0px, 120px)');

      // 2. Pointer up -> 120px >= 80px threshold -> triggers close
      act(() => {
        container.dispatchEvent(createPointerEvent('pointerup', 150, 220));
      });

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('snaps back when drag distance is below threshold', () => {
      const onClose = vi.fn();
      render(
        <I18nProvider>
          <ImageLightbox
            images={['https://example.com/photo1.jpg']}
            alt="Sample Shop"
            onClose={onClose}
          />
        </I18nProvider>
      );

      const img = screen.getByRole('img');
      const container = img.parentElement!;

      act(() => {
        container.dispatchEvent(createPointerEvent('pointerdown', 150, 100));
        container.dispatchEvent(createPointerEvent('pointermove', 150, 125));
      });

      expect(img.style.transform).toContain('translate(0px, 25px)');

      act(() => {
        container.dispatchEvent(createPointerEvent('pointerup', 150, 125));
      });

      // Below threshold -> snaps back to 0px
      expect(onClose).not.toHaveBeenCalled();
      expect(img.style.transform).toContain('translate(0px, 0px)');
    });
  });

  describe('Edge Swipe-to-Go-Back Navigation Hook', () => {
    it('triggers back navigation when dragged rightwards from the left edge (<=28px)', async () => {
      const onBack = vi.fn();
      render(
        <MemoryRouter>
          <EdgeSwipeTestComponent onBack={onBack} />
        </MemoryRouter>
      );

      // Start drag at x=10 (within edgeZonePx of 28px)
      fireEvent.touchStart(window, {
        touches: [{ clientX: 10, clientY: 200 }],
      });

      // Drag rightwards to x=85 (+75px)
      fireEvent.touchMove(window, {
        touches: [{ clientX: 85, clientY: 205 }],
        cancelable: true,
      });

      // Indicator should be mounted
      expect(screen.getByTestId('edge-swipe-indicator')).toBeInTheDocument();

      // Release touch past threshold
      fireEvent.touchEnd(window, {
        changedTouches: [{ clientX: 85, clientY: 205 }],
      });

      expect(onBack).toHaveBeenCalled();
    });

    it('ignores swipes that start away from the screen edge (>28px)', () => {
      const onBack = vi.fn();
      render(
        <MemoryRouter>
          <EdgeSwipeTestComponent onBack={onBack} />
        </MemoryRouter>
      );

      // Start at x=100 (in middle of screen)
      fireEvent.touchStart(window, {
        touches: [{ clientX: 100, clientY: 200 }],
      });

      fireEvent.touchMove(window, {
        touches: [{ clientX: 200, clientY: 200 }],
        cancelable: true,
      });

      expect(screen.queryByTestId('edge-swipe-indicator')).not.toBeInTheDocument();

      fireEvent.touchEnd(window, {
        changedTouches: [{ clientX: 200, clientY: 200 }],
      });

      expect(onBack).not.toHaveBeenCalled();
    });

    it('aborts edge swipe if vertical scrolling is detected', () => {
      const onBack = vi.fn();
      render(
        <MemoryRouter>
          <EdgeSwipeTestComponent onBack={onBack} />
        </MemoryRouter>
      );

      fireEvent.touchStart(window, {
        touches: [{ clientX: 10, clientY: 200 }],
      });

      // Move predominantly vertically
      fireEvent.touchMove(window, {
        touches: [{ clientX: 20, clientY: 280 }],
        cancelable: true,
      });

      expect(screen.queryByTestId('edge-swipe-indicator')).not.toBeInTheDocument();

      fireEvent.touchEnd(window, {
        changedTouches: [{ clientX: 20, clientY: 280 }],
      });

      expect(onBack).not.toHaveBeenCalled();
    });
  });

  describe('CityPickerModal Responsive Drawer & Dialog', () => {
    const createQueryClient = () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      });

    it('renders the town and village selector with search and location options', async () => {
      const onClose = vi.fn();
      render(
        <HelmetProvider>
          <QueryClientProvider client={createQueryClient()}>
            <MemoryRouter initialEntries={['/muktainagar']}>
              <AuthProvider>
                <CityProvider>
                  <I18nProvider>
                    <CityPickerModal open={true} onClose={onClose} />
                  </I18nProvider>
                </CityProvider>
              </AuthProvider>
            </MemoryRouter>
          </QueryClientProvider>
        </HelmetProvider>
      );

      // Search input is rendered
      expect(screen.getByPlaceholderText(/Search city, taluka, or village.../i)).toBeInTheDocument();
      // GPS button is rendered
      expect(screen.getByText(/Use my current location \(GPS\)/i)).toBeInTheDocument();
    });
  });
});
