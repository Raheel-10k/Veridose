import { listDemoRoles } from "@/lib/db";
import { jsonOk } from "@/lib/api";
import { attestationExplorerUrl } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const allRoles = await listDemoRoles();
  const roles = allRoles.map((r) => ({
    ...r,
    explorerUrl: r.atpAttestationUID
      ? attestationExplorerUrl(r.atpAttestationUID)
      : null,
  }));
  return jsonOk({ roles });
}
