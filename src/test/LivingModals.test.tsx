import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MessModal } from "@/components/admin/MessModal";
import { PGModal } from "@/components/admin/PGModal";
import { I18nProvider } from "@/i18n";
import { BrowserRouter } from "react-router-dom";
import { CityProvider } from "@/hooks/useCity";

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
            order: () => Promise.resolve({ data: [], error: null }),
          }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          order: () => Promise.resolve({ data: [], error: null }),
          lt: () => ({
            neq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
        ilike: () => ({
          limit: () => ({
            maybeSingle: () => Promise.resolve({ data: { id: "cat-1", name: "Mess & Dining" } }),
          }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: "shop-test-1" }, error: null }),
        }),
      }),
      upsert: () => Promise.resolve({ data: null, error: null }),
      delete: () => ({
        eq: () => Promise.resolve({ data: null, error: null }),
      }),
    }),
  },
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <I18nProvider>
          <CityProvider>
            {ui}
          </CityProvider>
        </I18nProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe("Living Directory Dedicated Modals", () => {
  it("renders MessModal with specialized mess fields", () => {
    renderWithProviders(
      <MessModal
        mess={{}}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    // Modal Title
    expect(screen.getByText(/Add New Mess \/ Hotel/i)).toBeInTheDocument();
    expect(screen.getByText(/Hotel & Restaurant/i)).toBeInTheDocument();

    // Dietary Category
    expect(screen.getAllByText(/Pure Veg/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Veg & Non-Veg/i)).toBeInTheDocument();

    // Rates
    expect(screen.getByText(/Monthly Pass Rate/i)).toBeInTheDocument();
    expect(screen.getByText(/Single Thali Rate/i)).toBeInTheDocument();

    // Tiffin delivery
    expect(screen.getByText(/Tiffin Delivery Service/i)).toBeInTheDocument();
  });

  it("renders PGModal with specialized PG fields", () => {
    renderWithProviders(
      <PGModal
        pg={{}}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    // Modal Title
    expect(screen.getByText(/Add New PG & Hostel/i)).toBeInTheDocument();

    // Gender Eligibility
    expect(screen.getByText(/👦 Boys/i)).toBeInTheDocument();
    expect(screen.getByText(/👧 Girls/i)).toBeInTheDocument();

    // Capacity & Vacancy
    expect(screen.getByText(/Total Bed Capacity/i)).toBeInTheDocument();
    expect(screen.getByText(/Live Available Beds/i)).toBeInTheDocument();

    // Sharing Rates
    expect(screen.getByText(/2-Sharing/i)).toBeInTheDocument();
  });
});
