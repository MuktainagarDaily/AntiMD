import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getSupabase } from "../supabaseClient";

export default defineTool({
  name: "list_categories",
  title: "List categories",
  description: "List all active shop categories in the directory.",
  inputSchema: {} as Record<string, z.ZodTypeAny>,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, icon")
      .eq("is_active", true)
      .order("name");
    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { categories: data ?? [] },
    };
  },
});
