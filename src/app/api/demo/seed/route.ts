import { loadPreSeededDemoScenario } from "@/lib/demo-seed";
import { jsonError, jsonOk } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await loadPreSeededDemoScenario();
    return jsonOk(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Demo seed failed";
    return jsonError(message, 500);
  }
}
