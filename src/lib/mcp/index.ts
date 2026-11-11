import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchShops from "./tools/search-shops";
import getShop from "./tools/get-shop";
import listCategories from "./tools/list-categories";
import getBusTimetable from "./tools/get-bus-timetable";
import getLocalNews from "./tools/get-local-news";
import searchSchools from "./tools/search-schools";
import getCivicServices from "./tools/get-civic-services";

// The OAuth issuer MUST be the direct Supabase host, built from the project
// ref so it stays import-safe (Vite inlines this as a literal at build time
// and no runtime env read happens during the manifest extract or edge cold
// start). Never derive from VITE_SUPABASE_URL — on Lovable Cloud that's a
// `.lovable.cloud` proxy and mcp-js rejects any issuer that doesn't match
// the discovery document's `issuer` (RFC 8414 §3.3).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "muktainagar-daily-mcp",
  title: "Muktainagar Daily MCP",
  version: "0.1.0",
  instructions:
    "Read-only tools for the Muktainagar Daily directory. Callers must be signed in. Use `search_shops` and `get_shop` to look up local businesses, `list_categories` to enumerate categories, `get_bus_timetable` for bus departure times, `get_local_news` for town headlines, `search_schools` for colleges/schools/admissions, and `get_civic_services` for water/power alerts & helplines.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    searchShops,
    getShop,
    listCategories,
    getBusTimetable,
    getLocalNews,
    searchSchools,
    getCivicServices,
  ],
});
