import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import BusTimetable from "@/pages/BusTimetable";
import { I18nProvider } from "@/i18n";
import { MemoryRouter } from "react-router-dom";
import { CityProvider } from "@/hooks/useCity";

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: (table: string) => ({
      select: () => {
        if (table === 'bus_timetable') {
          return {
            eq: () => ({
              order: () => ({
                order: () => Promise.resolve({
                  data: [
                    {
                      id: 'test-parandwadi-nigdi',
                      destination: 'Nigdi (Bhakti Shakti / Pawale Chowk)',
                      destination_mr: 'निगडी (भक्ती शक्ती / पावले चौक)',
                      departure_times: ['07:30', '09:30', '12:05', '16:35', '18:35'],
                      notes: 'PMPML Route 342',
                      sort_order: 1,
                      is_active: true,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
            order: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          };
        }
        if (table === 'bus_stand_info') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({
                  data: {
                    phone: '02024503300',
                    address: 'Parandwadi Bus Stop, Maval',
                    maps_url: 'https://maps.google.com/?q=Parandwadi',
                  },
                  error: null,
                }),
              }),
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          };
        }
        return {
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
            order: () => Promise.resolve({ data: [], error: null }),
          }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          order: () => Promise.resolve({ data: [], error: null }),
        };
      },
    }),
  },
}));

function renderWithProviders(ui: React.ReactElement, initialPath = '/maval/bus-timetable') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>
          <I18nProvider>
            <CityProvider>
              {ui}
            </CityProvider>
          </I18nProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

describe("BusTimetable component", () => {
  it("renders Parandwadi bus timetable and transit guide for Maval", async () => {
    renderWithProviders(<BusTimetable />, '/maval/bus-timetable');

    // Should render the Parandwadi Route 342 guide card
    expect(await screen.findByText(/PMPML 342/i)).toBeInTheDocument();
    expect(screen.getByText(/ZP School|जि. प. शाळा/i)).toBeInTheDocument();
    expect(screen.getByText(/Shantai Niwas|शांताई निवास/i)).toBeInTheDocument();
    expect(screen.getByText(/Bhote Wasti|भोते वस्ती/i)).toBeInTheDocument();
  });
});
