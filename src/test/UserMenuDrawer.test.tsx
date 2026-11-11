import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UserMenuDrawer } from "@/components/UserMenuDrawer";
import { I18nProvider } from "@/i18n";
import { CityProvider } from "@/hooks/useCity";
import { AuthProvider } from "@/hooks/useAuth";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderDrawer() {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <CityProvider>
            <I18nProvider>
              <UserMenuDrawer />
            </I18nProvider>
          </CityProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe("UserMenuDrawer component", () => {
  it("renders without crashing and mounts the user menu trigger with locale in scope", () => {
    renderDrawer();
    const button = screen.getByRole("button", { name: /menu/i });
    expect(button).toBeInTheDocument();
  });
});
