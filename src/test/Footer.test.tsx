import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "@/components/shared/Footer";
import { I18nProvider } from "@/i18n";

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe("Footer component", () => {
  it("hides the Vibe Forge hackathon link while temporarily commented out", () => {
    renderWithI18n(<Footer />);

    const link = screen.queryByRole("link", { name: /Vibe Forge/i });
    expect(link).not.toBeInTheDocument();
  });

  it("renders the directory copyright info", () => {
    renderWithI18n(<Footer />);

    const footer = screen.getByRole("contentinfo");
    expect(footer).toBeInTheDocument();
    expect(footer.textContent).toMatch(/Hyperlocal Business Directory/i);
    expect(footer.textContent).not.toMatch(/Vibe Forge/i);
  });

  it("applies custom className and hideBorder prop properly", () => {
    const { container, rerender } = renderWithI18n(<Footer className="custom-test-class" />);
    const footerEl = container.querySelector("footer");
    expect(footerEl).toHaveClass("custom-test-class");
    expect(footerEl).toHaveClass("border-t");

    rerender(
      <I18nProvider>
        <Footer hideBorder />
      </I18nProvider>
    );
    expect(footerEl).not.toHaveClass("border-t");
  });
});
