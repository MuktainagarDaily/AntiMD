import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import BusTimetable from "@/pages/BusTimetable";
import {
  matchesForgivingBusQuery,
  scoreForgivingMatch,
  PARANDWADI_DEPOT_SEEDS,
} from "@/lib/bus/busHelpers";
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
          const busPayload = {
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
          };
          const chain: any = {
            eq: () => chain,
            or: () => chain,
            order: () => chain,
            then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
              Promise.resolve(busPayload).then(resolve, reject),
          };
          return chain;
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

  it("supports forgiving shorthand, typo, Marathi, and via-stop search plus Sahayak AI fallback CTA", async () => {
    const nigdiRow = PARANDWADI_DEPOT_SEEDS[0];
    const talegaonRow = PARANDWADI_DEPOT_SEEDS[4];

    // Shorthand subsequence: "ng" matches Nigdi
    expect(matchesForgivingBusQuery("ng", nigdiRow)).toBeGreaterThan(0);
    // Typos / phonetic variations: "nidgi" and "talegav"
    expect(matchesForgivingBusQuery("nidgi", nigdiRow)).toBeGreaterThan(0);
    expect(matchesForgivingBusQuery("talegav", talegaonRow)).toBeGreaterThan(0);
    // Via stops & Marathi destination
    expect(matchesForgivingBusQuery("Somatane", nigdiRow)).toBeGreaterThan(0);
    expect(matchesForgivingBusQuery("निगडी", nigdiRow)).toBeGreaterThan(0);
    // Non-matching unrelated stop
    expect(scoreForgivingMatch("Amravati", [nigdiRow.destination, nigdiRow.destination_mr])).toBe(0);

    // Interactive search UI test on Maval bus timetable
    renderWithProviders(<BusTimetable />, '/maval/bus-timetable');
    expect(await screen.findByText(/PMPML Route 342/i)).toBeInTheDocument();
    const searchInput = screen.getByRole('textbox');

    // Type shorthand "ng" -> Nigdi stays visible
    fireEvent.change(searchInput, { target: { value: 'ng' } });
    expect(await screen.findByRole('heading', { name: /Nigdi \(Bhakti Shakti/i })).toBeInTheDocument();

    // Type completely unknown destination -> triggers "Ask Sahayak AI" fallback CTA & dispatches open-town-assistant
    const aiSpy = vi.fn();
    window.addEventListener('open-town-assistant', aiSpy as EventListener);
    fireEvent.change(searchInput, { target: { value: 'Kolhapur Express' } });

    const aiBtn = await screen.findByRole(
      'button',
      { name: /Ask Sahayak AI about "Kolhapur Express"/i },
      { timeout: 2000 },
    );
    fireEvent.click(aiBtn);
    expect(aiSpy).toHaveBeenCalledTimes(1);
    const evt = aiSpy.mock.calls[0][0] as CustomEvent;
    expect(evt.detail).toMatchObject({
      autoSend: true,
    });
    expect(evt.detail.query).toContain('Kolhapur Express');
    window.removeEventListener('open-town-assistant', aiSpy as EventListener);
  });
});
