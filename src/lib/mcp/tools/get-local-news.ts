import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getSupabase } from "../supabaseClient";

export default defineTool({
  name: "get_local_news",
  title: "Get local news",
  description:
    "Fetch latest active local news headlines and civic/agriculture/market updates for a town or taluka.",
  inputSchema: {
    city: z
      .string()
      .trim()
      .optional()
      .describe("Optional city/taluka slug (e.g. 'maval', 'muktainagar', 'bhusawal')."),
    category: z
      .enum(["local", "civic", "education", "agriculture", "markets", "sports", "alerts"])
      .optional()
      .describe("Optional news category filter."),
    limit: z.number().int().min(1).max(30).optional().describe("Max articles to return (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ city, category, limit }) => {
    const supabase = getSupabase();
    let q = supabase
      .from("local_news")
      .select("id, title, title_mr, summary, summary_mr, category, language, source_name, source_url, published_at, is_pinned")
      .eq("is_active", true)
      .order("is_pinned", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(limit ?? 10);

    if (city) {
      const { data: cityRow } = await supabase
        .from("geo_cities")
        .select("id")
        .eq("slug", city.toLowerCase())
        .maybeSingle();
      if (cityRow?.id) q = q.eq("city_id", cityRow.id);
    }

    if (category) {
      q = q.eq("category", category);
    }

    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { news: data ?? [] },
    };
  },
});
