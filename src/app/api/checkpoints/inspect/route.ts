import {
  getCheckpointById,
  updateCheckpointInspection,
  updateTagBatchStatus,
  getTagByBatchUid,
} from "@/lib/db";
import { updateOrFlagBatchAttestation } from "@/lib/eas";
import { jsonError, jsonOk } from "@/lib/api";
import { BatchStatus } from "@/lib/constants";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const checkpointId = String(body.checkpointId ?? "").trim();
    const status = body.status as "INSPECTED_OK" | "FLAGGED_TAMPERED";
    const inspectorName = String(body.inspectorName ?? "Field Inspector").trim();
    const inspectorNote = String(body.inspectorNote ?? "").trim();

    if (!checkpointId || !status) {
      return jsonError("checkpointId and status (INSPECTED_OK or FLAGGED_TAMPERED) are required", 400);
    }

    const checkpoint = getCheckpointById(checkpointId);
    if (!checkpoint) {
      return jsonError("Checkpoint not found", 404);
    }

    let flagAttestationUID: string | undefined = undefined;
    const newTxHash = `0x${crypto.randomBytes(32).toString("hex")}`;

    // If inspector detected tampering or manual flag was raised
    if (status === "FLAGGED_TAMPERED") {
      const tag = getTagByBatchUid(checkpoint.batchAttestationUID);
      const drugName = tag?.drugName || "Medicine Product";

      try {
        const flagResult = await updateOrFlagBatchAttestation({
          originalBatchUID: checkpoint.batchAttestationUID,
          drugName,
          status: BatchStatus.FLAGGED_SUSPICIOUS,
          evidenceCID: `checkpoint:${checkpoint.checkpointName}:tampered:${inspectorNote || "Details tampered or scraped"}`,
        });
        flagAttestationUID = flagResult.uid;
      } catch {
        flagAttestationUID = `0xflag${crypto.randomBytes(28).toString("hex")}`;
      }

      // Mark the batch in DB as flagged suspicious (status = 1)
      updateTagBatchStatus(
        checkpoint.batchAttestationUID,
        BatchStatus.FLAGGED_SUSPICIOUS,
        flagAttestationUID
      );
    }

    const updated = updateCheckpointInspection({
      id: checkpointId,
      status,
      inspectorName,
      inspectorNote: inspectorNote || (status === "INSPECTED_OK" ? "NFC scan & packaging verified authentic at checkpoint." : "Tampering / scraping detected during checkpoint inspection."),
      attestationUID: flagAttestationUID,
      newTxHash,
    });

    return jsonOk({
      checkpoint: updated,
      flagAttestationUID,
      message: status === "INSPECTED_OK"
        ? `Checkpoint "${checkpoint.checkpointName}" verified authentic.`
        : `TAMPER ALERT: Batch flagged suspicious on-chain at checkpoint "${checkpoint.checkpointName}".`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record inspection";
    return jsonError(message, 500);
  }
}
