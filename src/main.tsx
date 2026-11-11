import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { I18nProvider } from "@/i18n";
import { ThemeProvider } from "@/components/theme-provider";
import { registerPwa } from "@/lib/pwa/register";

const rootEl = document.getElementById("root")!;
rootEl.classList.add("app-fade-in");
createRoot(rootEl).render(
  <ThemeProvider>
    <HelmetProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </HelmetProvider>
  </ThemeProvider>
);


// Remove the splash once React has rendered the first frame.
requestAnimationFrame(() => {
  const splash = document.getElementById("initial-splash");
  if (!splash) return;
  splash.style.opacity = "0";
  window.setTimeout(() => splash.remove(), 260);
});

// Register the service worker. The wrapper refuses to register in dev,
// iframes, and Lovable preview hosts — so this is a no-op in the editor.
registerPwa();
