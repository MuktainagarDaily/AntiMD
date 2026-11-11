import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getSupabase } from "../supabaseClient";

export default defineTool({
  name: "get_bus_timetable",
  title: "Get bus timetable",
  description: "Fetch the bus timetable for the specified or default town, optionally filtered by destination.",
  inputSchema: {
    city: z
      .string()
      .trim()
      .optional()
      .describe("Optional city/taluka slug (e.g. 'muktainagar', 'bhusawal', 'varangaon')."),
    destination: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe("Optional destination filter (case-insensitive substring)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ city, destination }) => {
    const supabase = getSupabase();
    let q = supabase.from("bus_timetable").select("*").order("departure_time");
    if (destination) q = q.ilike("destination", `%${destination}%`);
    if (city) {
      const { data: cityRow } = await supabase.from("geo_cities").select("id").eq("slug", city.toLowerCase()).maybeSingle();
      if (cityRow?.id) q = q.eq("city_id", cityRow.id);
    }
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { buses: data ?? [] },
    };
  },
});
