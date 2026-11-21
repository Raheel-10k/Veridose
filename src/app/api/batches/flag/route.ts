import { BatchStatus } from "@/lib/constants";
import {
  getDemoRoleRecord,
  getTagByBatchUid,
  updateTagBatchStatus,
} from "@/lib/db";
import { updateOrFlagBatchAttestation } from "@/lib/eas";
import { jsonError, jsonOk, txExplorerUrl } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const batchAttestationUID = String(body.batchAttestationUID ?? "").trim();
    const status = Number(body.status);
    const evidenceNote = String(body.evidenceNote ?? body.evidenceCID ?? "").trim();

    if (!batchAttestationUID) {
      return jsonError("batchAttestationUID is required");
    }
    if (
      status !== BatchStatus.FLAGGED_SUSPICIOUS &&
      status !== BatchStatus.RECALLED
    ) {
      return jsonError("status must be 1 (FLAGGED_SUSPICIOUS) or 2 (RECALLED)");
    }
    if (!evidenceNote) {
      return jsonError("evidenceNote is required");
    }

    const pharmacist = await getDemoRoleRecord("Pharmacist");
    if (!pharmacist) {
      return jsonError("Pharmacist demo role missing", 500);
    }

    // Prototype ATP check: pharmacist must be a seeded licensed role.
    // Live ATP_Credential UID (if seeded) is surfaced to the UI.
    if (!pharmacist.licenseId) {
      return jsonError("Pharmacist ATP credential not available", 403);
    }

    const tag = await getTagByBatchUid(batchAttestationUID);
    if (!tag) {
      return jsonError("Unknown batch", 404);
    }

    const result = await updateOrFlagBatchAttestation({
      originalBatchUID: batchAttestationUID,
      drugName: tag.drugName,
      status: status as 1 | 2,
      evidenceCID: evidenceNote,
      revokeOriginal: status === BatchStatus.RECALLED,
    });

    await updateTagBatchStatus(batchAttestationUID, status, result.uid);

    return jsonOk({
      flagAttestationUID: result.uid,
      txHash: result.txHash,
      explorerUrl: result.explorerUrl,
      txExplorerUrl: result.txHash ? txExplorerUrl(result.txHash) : null,
      status,
      statusLabel:
        status === BatchStatus.RECALLED ? "RECALLED" : "FLAGGED_SUSPICIOUS",
      pharmacistAtpUid: pharmacist.atpAttestationUID,
      pharmacistAddress: pharmacist.address,
      pharmacistLicenseId: pharmacist.licenseId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Flag failed";
    return jsonError(message, 500);
  }
}
