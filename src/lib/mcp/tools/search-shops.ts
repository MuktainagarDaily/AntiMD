import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getSupabase } from "../supabaseClient";

export default defineTool({
  name: "search_shops",
  title: "Search shops",
  description:
    "Search the local business directory by name or description. Returns active shops with basic details.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Text to match against shop name or description."),
    city: z.string().trim().optional().describe("Optional city/taluka slug (e.g. 'muktainagar', 'bhusawal')."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, city, limit }) => {
    const supabase = getSupabase();
    const safeQuery = query.replace(/[%,()\\]/g, " ").trim();
    if (!safeQuery) {
      return {
        content: [{ type: "text", text: "[]" }],
        structuredContent: { shops: [] },
      };
    }
    let q = supabase
      .from("shops")
      .select("id, slug, name, description, address, phone, opening_time, closing_time, is_verified")
      .eq("is_active", true)
      .or(`name.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`);
    if (city) {
      const { data: cityRow } = await supabase.from("geo_cities").select("id").eq("slug", city.toLowerCase()).maybeSingle();
      if (cityRow?.id) q = q.eq("city_id", cityRow.id);
    }
    const { data, error } = await q.limit(limit ?? 10);
    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { shops: data ?? [] },
    };
  },
});
