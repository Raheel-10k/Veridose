import { listHandoffsByBatch, listTags } from "@/lib/db";
import { jsonOk } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tags = listTags();
  const batches = tags.map((tag) => ({
    ...tag,
    // never expose aes key to client lists in production; demo keeps it server-side only
    aesKeyHex: undefined,
    handoffCount: listHandoffsByBatch(tag.batchAttestationUID).length,
  }));
  return jsonOk({ batches });
}
