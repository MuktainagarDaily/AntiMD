import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getSupabase } from "../supabaseClient";

export default defineTool({
  name: "get_shop",
  title: "Get shop details",
  description: "Fetch full details for a single shop by its slug.",
  inputSchema: {
    slug: z.string().trim().min(1).describe("The shop's URL slug."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug }) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("shops")
      .select("*, shop_categories(category_id, categories(id, name))")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
    if (!data) {
      return { content: [{ type: "text", text: `No active shop found with slug "${slug}".` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { shop: data },
    };
  },
});
