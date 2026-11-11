import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getSupabase } from "../supabaseClient";

export default defineTool({
  name: "get_civic_services",
  title: "Get civic alerts & helplines",
  description:
    "Fetch active/scheduled water, electricity (MSEDCL), and municipal civic announcements plus official department helplines.",
  inputSchema: {
    city: z
      .string()
      .trim()
      .optional()
      .describe("Optional city/taluka slug (e.g. 'maval', 'muktainagar', 'bhusawal')."),
    department: z
      .enum(["water", "electricity", "municipal"])
      .optional()
      .describe("Optional civic department filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ city, department }) => {
    const supabase = getSupabase();
    let cityId = "";
    if (city) {
      const { data: cityRow } = await supabase
        .from("geo_cities")
        .select("id")
        .eq("slug", city.toLowerCase())
        .maybeSingle();
      if (cityRow?.id) cityId = String(cityRow.id);
    }

    let annQ = supabase
      .from("authority_announcements")
      .select(
        "id, title, title_mr, description, description_mr, category, priority, status, start_time, end_time, department:authority_departments(name, slug)",
      )
      .in("status", ["active", "scheduled"])
      .order("published_at", { ascending: false })
      .limit(15);

    let orgQ = supabase
      .from("authority_organizations")
      .select("id, name, name_mr, office_address, visiting_hours, helpline_phone, emergency_phone")
      .eq("is_active", true)
      .limit(15);

    if (cityId) {
      annQ = annQ.eq("city_id", cityId);
      orgQ = orgQ.eq("city_id", cityId);
    }

    const [annRes, orgRes] = await Promise.all([annQ, orgQ]);
    if (annRes.error && orgRes.error) {
      return {
        content: [{ type: "text", text: `Error: ${annRes.error.message}` }],
        isError: true,
      };
    }

    const announcements = (annRes.data ?? []).filter((a: any) => {
      if (!department) return true;
      const dept = Array.isArray(a.department) ? a.department[0] : a.department;
      return dept?.slug === department;
    });
    const organizations = orgRes.data ?? [];

    return {
      content: [
        { type: "text", text: JSON.stringify({ announcements, organizations }, null, 2) },
      ],
      structuredContent: { announcements, organizations },
    };
  },
});
