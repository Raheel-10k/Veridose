import { listHandoffsByBatch, listTags } from "@/lib/db";
import { jsonOk } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tags = await listTags();
  const batches = await Promise.all(
    tags.map(async (tag) => {
      const handoffs = await listHandoffsByBatch(tag.batchAttestationUID);
      return {
        ...tag,
        aesKeyHex: undefined,
        handoffCount: handoffs.length,
      };
    })
  );
  return jsonOk({ batches });
}
