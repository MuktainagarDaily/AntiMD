import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getSupabase } from "../supabaseClient";

export default defineTool({
  name: "search_schools",
  title: "Search schools & colleges",
  description:
    "Search schools, junior/degree colleges, engineering/ITI institutes, coaching classes, admissions status, and live notices.",
  inputSchema: {
    query: z
      .string()
      .trim()
      .optional()
      .describe("Optional name, board, stream, village, or keyword filter."),
    city: z
      .string()
      .trim()
      .optional()
      .describe("Optional city/taluka slug (e.g. 'maval', 'muktainagar', 'bhusawal')."),
    admission_status: z
      .enum(["open", "ongoing", "upcoming", "closed"])
      .optional()
      .describe("Optional admission status filter."),
    limit: z.number().int().min(1).max(30).optional().describe("Max institutes (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, city, admission_status, limit }) => {
    const supabase = getSupabase();
    let cityId = "";
    const citySlug = (city || "").toLowerCase();
    if (citySlug) {
      const { data: cityRow } = await supabase
        .from("geo_cities")
        .select("id")
        .eq("slug", citySlug)
        .maybeSingle();
      if (cityRow?.id) cityId = String(cityRow.id);
    }

    const enrichedCols =
      "id, slug, name, name_mr, school_type, medium, management_type, area, address, phone, board, admission_status, admission_deadline, fee_tier, annual_fee_min, annual_fee_max, streams, scholarships, transport_villages, available_seats, is_verified";
    const legacyCols = "id, name, name_mr, school_type, medium, area, address, phone";

    const runQuery = (cols: string, useBoardFilter: boolean) => {
      let q = supabase.from("schools").select(cols).eq("is_active", true).limit(limit ?? 10);
      if (cityId) {
        q = citySlug === "muktainagar" ? q.or(`city_id.eq.${cityId},city_id.is.null`) : q.eq("city_id", cityId);
      }
      if (useBoardFilter && admission_status) {
        q = q.eq("admission_status", admission_status);
      }
      if (query) {
        const safeQuery = query.replace(/[%,()\\]/g, " ").trim();
        if (safeQuery) {
          q = useBoardFilter
            ? q.or(`name.ilike.%${safeQuery}%,area.ilike.%${safeQuery}%,board.ilike.%${safeQuery}%`)
            : q.or(`name.ilike.%${safeQuery}%,area.ilike.%${safeQuery}%`);
        }
      }
      return q;
    };

    let { data, error } = await runQuery(enrichedCols, true);
    if (error && /column|does not exist|schema cache/i.test(error.message || "")) {
      const legacyRes = await runQuery(legacyCols, false);
      data = legacyRes.data;
      error = legacyRes.error;
    }

    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }

    const rows = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { schools: rows },
    };
  },
});
