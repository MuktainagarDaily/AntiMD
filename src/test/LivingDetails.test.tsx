import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { I18nProvider } from "@/i18n";
import { CityProvider } from "@/hooks/useCity";
import { fetchMessBySlugOrId, fetchPGBySlugOrId } from "@/lib/living/livingService";
import MessDetail from "@/pages/MessDetail";
import PGDetail from "@/pages/PGDetail";

// Chainable mock builder for Supabase queries
const createChain = () => {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    or: () => chain,
    order: () => chain,
    in: () => chain,
    ilike: () => chain,
    limit: () => chain,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    single: () => Promise.resolve({ data: null, error: null }),
  };
  return chain;
};

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => createChain(),
  },
}));

function renderWithProviders(ui: React.ReactElement, initialRoute: string = "/") {
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
        <MemoryRouter initialEntries={[initialRoute]}>
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

describe("Living Service Detail Data Fetchers", () => {
  it("fetchMessBySlugOrId retrieves demo mess by slug or ID when database returns null", async () => {
    const messBySlug = await fetchMessBySlugOrId("shree-swami-samarth-bhojanalay");
    expect(messBySlug).not.toBeNull();
    expect(messBySlug?.name).toContain("Swami Samarth");
    expect(messBySlug?.mess_profile?.mess_type).toBe("pure_veg");

    const messById = await fetchMessBySlugOrId("demo-mess-2");
    expect(messById).not.toBeNull();
    expect(messById?.name).toContain("Ruchira");

    const messNotFound = await fetchMessBySlugOrId("non-existent-mess-xyz");
    expect(messNotFound).toBeNull();
  });

  it("fetchPGBySlugOrId retrieves demo PG by slug or ID when database returns null", async () => {
    const pgBySlug = await fetchPGBySlugOrId("shree-sai-boys-hostel");
    expect(pgBySlug).not.toBeNull();
    expect(pgBySlug?.name).toContain("Sai");
    expect(pgBySlug?.pg_profile?.gender).toBe("boys");

    const pgById = await fetchPGBySlugOrId("demo-pg-2");
    expect(pgById).not.toBeNull();
    expect(pgById?.name).toContain("Matoshree");

    const pgNotFound = await fetchPGBySlugOrId("non-existent-pg-xyz");
    expect(pgNotFound).toBeNull();
  });
});

describe("MessDetail & PGDetail Pages", () => {
  it("renders MessDetail without throwing runtime errors", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/:citySlug/mess/:id" element={<MessDetail />} />
      </Routes>,
      "/muktainagar/mess/shree-swami-samarth-bhojanalay"
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Swami Samarth/i).length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/Pure Veg/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/WhatsApp/i).length).toBeGreaterThan(0);
    const header = document.querySelector("header");
    expect(header?.className).toContain("bg-primary");
    expect(header?.className).toContain("text-primary-foreground");
  });

  it("renders PGDetail without throwing runtime errors", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/:citySlug/pg/:id" element={<PGDetail />} />
      </Routes>,
      "/muktainagar/pg/shree-sai-boys-hostel"
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Sai Boys/i).length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/Boys/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/WhatsApp/i).length).toBeGreaterThan(0);
    const header = document.querySelector("header");
    expect(header?.className).toContain("bg-primary");
    expect(header?.className).toContain("text-primary-foreground");
  });
});
