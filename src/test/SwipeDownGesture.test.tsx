import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useSwipeDownToClose } from '@/hooks/useSwipeDownToClose';
import { EditProfileDrawer } from '@/components/EditProfileDrawer';
import { UserMenuDrawer } from '@/components/UserMenuDrawer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { CityProvider } from '@/hooks/useCity';
import { AuthProvider } from '@/hooks/useAuth';
import { I18nProvider } from '@/i18n';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => {
  const mockProfile = {
    id: 'test-user-id',
    full_name: 'john_doe',
    phone: '9876543210',
    birth_date: '1995-05-15',
    gender: 'male',
    full_name_changed_at: null,
    city_id: '644b68eb-472c-40d3-9f83-c7d26e121498',
    village_id: null,
  };

  const createChain = () => {
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      neq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      limit: vi.fn(() => chain),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'test-user-id',
          city_id: '644b68eb-472c-40d3-9f83-c7d26e121498',
          geo_cities: { slug: 'muktainagar' },
        },
        error: null,
      }),
      update: vi.fn().mockResolvedValue({ data: null, error: null }),
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
    user: { id: 'test-user-id', email: 'john@example.com' },
    isAdmin: false,
    isShopkeeper: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function TestSwipeDrawer({
  isOpen = true,
  onClose = vi.fn(),
  beforeClose,
  threshold = 70,
  velocityThreshold = 0.35,
}: {
  isOpen?: boolean;
  onClose?: () => void;
  beforeClose?: () => boolean | Promise<boolean>;
  threshold?: number;
  velocityThreshold?: number;
}) {
  const { ref, isPulling } = useSwipeDownToClose({
    isOpen,
    onClose,
    beforeClose,
    threshold,
    velocityThreshold,
  });

  return (
    <div
      ref={ref}
      data-testid="swipe-drawer"
      data-pulling={isPulling ? 'true' : 'false'}
      style={{ height: '300px' }}
    >
      <div data-testid="drawer-handle" style={{ height: '24px' }}>
        Handle
      </div>
      <div data-testid="drawer-content" style={{ height: '276px' }}>
        Content
      </div>
    </div>
  );
}

describe('Swipe-Down to Close Mobile Gesture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useSwipeDownToClose hook', () => {
    it('initializes and attaches to the DOM element', () => {
      const onClose = vi.fn();
      render(<TestSwipeDrawer isOpen={true} onClose={onClose} />);
      const drawer = screen.getByTestId('swipe-drawer');
      expect(drawer).toBeInTheDocument();
      expect(drawer.getAttribute('data-pulling')).toBe('false');
    });

    it('translates drawer downwards on swipe down and closes when threshold exceeded', async () => {
      const onClose = vi.fn();
      render(<TestSwipeDrawer isOpen={true} onClose={onClose} threshold={50} />);
      const drawer = screen.getByTestId('swipe-drawer');

      // Start drag at y=100
      fireEvent.touchStart(drawer, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      // Move down to y=180 (+80px)
      fireEvent.touchMove(drawer, {
        touches: [{ clientX: 100, clientY: 180 }],
        cancelable: true,
      });

      expect(drawer.style.transform).toBe('translate3d(0, 80px, 0)');

      // End touch -> 80px >= 50px threshold -> closes
      fireEvent.touchEnd(drawer);
      expect(drawer.style.transform).toBe('translate3d(0, 100%, 0)');

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('snaps back without closing when swipe distance is below threshold', () => {
      const onClose = vi.fn();
      render(<TestSwipeDrawer isOpen={true} onClose={onClose} threshold={70} />);
      const drawer = screen.getByTestId('swipe-drawer');

      fireEvent.touchStart(drawer, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      // Move down only 20px
      fireEvent.touchMove(drawer, {
        touches: [{ clientX: 100, clientY: 120 }],
        cancelable: true,
      });

      expect(drawer.style.transform).toBe('translate3d(0, 20px, 0)');

      fireEvent.touchEnd(drawer);

      // Snapped back
      expect(onClose).not.toHaveBeenCalled();
      expect(drawer.style.transform).toBe('translate3d(0, 0, 0)');
    });

    it('aborts close and snaps back when beforeClose returns false', async () => {
      const onClose = vi.fn();
      const beforeClose = vi.fn().mockResolvedValue(false);
      render(
        <TestSwipeDrawer
          isOpen={true}
          onClose={onClose}
          beforeClose={beforeClose}
          threshold={50}
        />
      );
      const drawer = screen.getByTestId('swipe-drawer');

      fireEvent.touchStart(drawer, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      // Move down 120px
      fireEvent.touchMove(drawer, {
        touches: [{ clientX: 100, clientY: 220 }],
        cancelable: true,
      });

      await act(async () => {
        fireEvent.touchEnd(drawer);
      });

      expect(beforeClose).toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(drawer.style.transform).toBe('translate3d(0, 0, 0)');
    });
  });

  describe('EditProfileDrawer Unsaved Edits Guard', () => {
    const createQueryClient = () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
        },
      });

    it('renders the edit profile drawer with swipe grab handle and form fields', async () => {
      const onOpenChange = vi.fn();
      render(
        <HelmetProvider>
          <QueryClientProvider client={createQueryClient()}>
            <MemoryRouter initialEntries={['/muktainagar']}>
              <AuthProvider>
                <CityProvider>
                  <I18nProvider>
                    <EditProfileDrawer open={true} onOpenChange={onOpenChange} />
                  </I18nProvider>
                </CityProvider>
              </AuthProvider>
            </MemoryRouter>
          </QueryClientProvider>
        </HelmetProvider>
      );

      await waitFor(() => {
        expect(screen.getAllByText('Edit profile').length).toBeGreaterThan(0);
      });
    });

    it('closes directly without dialog when no fields are modified', async () => {
      const onOpenChange = vi.fn();
      render(
        <HelmetProvider>
          <QueryClientProvider client={createQueryClient()}>
            <MemoryRouter initialEntries={['/muktainagar']}>
              <AuthProvider>
                <CityProvider>
                  <I18nProvider>
                    <EditProfileDrawer open={true} onOpenChange={onOpenChange} />
                  </I18nProvider>
                </CityProvider>
              </AuthProvider>
            </MemoryRouter>
          </QueryClientProvider>
        </HelmetProvider>
      );

      // Wait for initial profile data to load
      await waitFor(() => {
        expect(screen.getByDisplayValue('9876543210')).toBeInTheDocument();
      });

      // Click the Back / Close button without modifying anything
      const backButton = screen.getByRole('button', { name: 'Back' });
      fireEvent.click(backButton);

      // Should close directly without showing discard dialog
      expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('shows confirmation dialog if user modifies fields and keeps editing', async () => {
      const onOpenChange = vi.fn();
      render(
        <HelmetProvider>
          <QueryClientProvider client={createQueryClient()}>
            <MemoryRouter initialEntries={['/muktainagar']}>
              <AuthProvider>
                <CityProvider>
                  <I18nProvider>
                    <EditProfileDrawer open={true} onOpenChange={onOpenChange} />
                  </I18nProvider>
                </CityProvider>
              </AuthProvider>
            </MemoryRouter>
          </QueryClientProvider>
        </HelmetProvider>
      );

      // Wait for initial profile data to load
      await waitFor(() => {
        expect(screen.getByDisplayValue('9876543210')).toBeInTheDocument();
      });

      // Modify the phone number field
      const phoneInput = screen.getByDisplayValue('9876543210');
      fireEvent.change(phoneInput, { target: { value: '9123456789' } });

      // Click the Back / Close button (which calls requestClose)
      const backButton = screen.getByRole('button', { name: 'Back' });
      fireEvent.click(backButton);

      // Dialog should appear asking to discard changes
      await waitFor(() => {
        expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();
        expect(
          screen.getByText('You have unsaved changes in your profile. Are you sure you want to discard them and close?')
        ).toBeInTheDocument();
      });

      // If user chooses "Keep editing", dialog closes and onOpenChange(false) was NOT called
      const keepEditingBtn = screen.getByRole('button', { name: 'Keep editing' });
      fireEvent.click(keepEditingBtn);

      await waitFor(() => {
        expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
      });

      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    it('discards changes and closes when user confirms Discard & close', async () => {
      const onOpenChange = vi.fn();
      render(
        <HelmetProvider>
          <QueryClientProvider client={createQueryClient()}>
            <MemoryRouter initialEntries={['/muktainagar']}>
              <AuthProvider>
                <CityProvider>
                  <I18nProvider>
                    <EditProfileDrawer open={true} onOpenChange={onOpenChange} />
                  </I18nProvider>
                </CityProvider>
              </AuthProvider>
            </MemoryRouter>
          </QueryClientProvider>
        </HelmetProvider>
      );

      // Wait for initial profile data to load
      await waitFor(() => {
        expect(screen.getByDisplayValue('9876543210')).toBeInTheDocument();
      });

      // Modify phone number
      const phoneInput = screen.getByDisplayValue('9876543210');
      fireEvent.change(phoneInput, { target: { value: '9123456789' } });

      // Click Back
      const backButton = screen.getByRole('button', { name: 'Back' });
      fireEvent.click(backButton);

      // Wait for dialog
      await waitFor(() => {
        expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();
      });

      // Click Discard & close
      const discardBtn = screen.getByRole('button', { name: 'Discard & close' });
      fireEvent.click(discardBtn);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('invokes onBack when Back is clicked cleanly or after confirming Discard & close', async () => {
      const onOpenChange = vi.fn();
      const onBack = vi.fn();

      const { rerender } = render(
        <HelmetProvider>
          <QueryClientProvider client={createQueryClient()}>
            <MemoryRouter initialEntries={['/muktainagar']}>
              <AuthProvider>
                <CityProvider>
                  <I18nProvider>
                    <EditProfileDrawer open={true} onOpenChange={onOpenChange} onBack={onBack} />
                  </I18nProvider>
                </CityProvider>
              </AuthProvider>
            </MemoryRouter>
          </QueryClientProvider>
        </HelmetProvider>
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('9876543210')).toBeInTheDocument();
      });

      // Clean back triggers onBack
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onBack).toHaveBeenCalledTimes(1);

      // Re-open with dirty edits -> Keep editing should NOT invoke onBack, Discard & close SHOULD invoke onBack
      onOpenChange.mockClear();
      onBack.mockClear();

      rerender(
        <HelmetProvider>
          <QueryClientProvider client={createQueryClient()}>
            <MemoryRouter initialEntries={['/muktainagar']}>
              <AuthProvider>
                <CityProvider>
                  <I18nProvider>
                    <EditProfileDrawer open={false} onOpenChange={onOpenChange} onBack={onBack} />
                  </I18nProvider>
                </CityProvider>
              </AuthProvider>
            </MemoryRouter>
          </QueryClientProvider>
        </HelmetProvider>
      );
      rerender(
        <HelmetProvider>
          <QueryClientProvider client={createQueryClient()}>
            <MemoryRouter initialEntries={['/muktainagar']}>
              <AuthProvider>
                <CityProvider>
                  <I18nProvider>
                    <EditProfileDrawer open={true} onOpenChange={onOpenChange} onBack={onBack} />
                  </I18nProvider>
                </CityProvider>
              </AuthProvider>
            </MemoryRouter>
          </QueryClientProvider>
        </HelmetProvider>
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('9876543210')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByDisplayValue('9876543210'), { target: { value: '9123456789' } });
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));

      await waitFor(() => {
        expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();
      });
      expect(onBack).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Discard & close' }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('returns to the main UserMenuDrawer profile menu when clicking Back in EditProfileDrawer', async () => {
      render(
        <HelmetProvider>
          <QueryClientProvider client={createQueryClient()}>
            <MemoryRouter initialEntries={['/muktainagar']}>
              <AuthProvider>
                <CityProvider>
                  <I18nProvider>
                    <UserMenuDrawer />
                  </I18nProvider>
                </CityProvider>
              </AuthProvider>
            </MemoryRouter>
          </QueryClientProvider>
        </HelmetProvider>
      );

      const flushClosingDrawers = () => {
        act(() => {
          document.querySelectorAll('[data-vaul-drawer][data-state="closed"]').forEach((el) => {
            const ev = new Event('animationend', { bubbles: true });
            Object.defineProperty(ev, 'animationName', { value: 'slideToBottom' });
            el.dispatchEvent(ev);
          });
          document.querySelectorAll('[data-vaul-overlay][data-state="closed"]').forEach((el) => {
            const ev = new Event('animationend', { bubbles: true });
            Object.defineProperty(ev, 'animationName', { value: 'fadeOut' });
            el.dispatchEvent(ev);
          });
        });
      };

      // Open main Profile drawer
      fireEvent.click(screen.getByRole('button', { name: /menu/i }));
      const editBtn = await screen.findByRole('button', { name: 'Edit profile' });
      fireEvent.click(editBtn);
      flushClosingDrawers();

      // EditProfileDrawer opens and loads initial profile
      await waitFor(() => {
        expect(screen.getByDisplayValue('9876543210')).toBeInTheDocument();
      });

      // Clicking Back in EditProfileDrawer returns to main Profile drawer
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      flushClosingDrawers();

      await waitFor(() => {
        expect(screen.queryByText('Account details — visible to you')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Edit profile' })).toBeInTheDocument();
        expect(screen.getByText('My Businesses')).toBeInTheDocument();
      });
    });
  });
});
