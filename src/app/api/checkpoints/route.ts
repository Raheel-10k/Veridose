import { listCheckpointsByBatch, listAllCheckpoints, createCheckpoint } from "@/lib/db";
import { createCheckpointAttestation } from "@/lib/eas";
import { jsonError, jsonOk } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const batchUid = searchParams.get("batchUid");
    if (batchUid) {
      const checkpoints = listCheckpointsByBatch(batchUid);
      return jsonOk({ checkpoints });
    }
    const checkpoints = listAllCheckpoints();
    return jsonOk({ checkpoints });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load checkpoints";
    return jsonError(message, 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const batchAttestationUID = String(body.batchAttestationUID ?? "").trim();
    const routePlan = String(body.routePlan ?? "").trim();
    const checkpointName = String(body.checkpointName ?? "").trim();
    const location = String(body.location ?? "").trim();
    const estimatedArrival = String(body.estimatedArrival ?? "").trim();
    const lastTxHash = String(body.lastTxHash ?? "").trim();

    if (!batchAttestationUID || !routePlan || !checkpointName || !estimatedArrival) {
      return jsonError("batchAttestationUID, routePlan, checkpointName, and estimatedArrival are required", 400);
    }

    // Anchor on EAS/offchain attestation with Route, ETA and last transaction hash
    const attestation = await createCheckpointAttestation({
      batchAttestationUID,
      routePlan,
      checkpointName,
      estimatedArrival,
      lastTxHash: lastTxHash || "0xgenesis00000000000000000000000000000000000000000000000000000000",
      status: "SCHEDULED",
    });

    const checkpoint = createCheckpoint({
      batchAttestationUID,
      routePlan,
      checkpointName,
      location: location || "En Route Checkpoint",
      estimatedArrival,
      lastTxHash: attestation.txHash,
    });

    return jsonOk({
      checkpoint: {
        ...checkpoint,
        attestationUID: attestation.uid,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create checkpoint";
    return jsonError(message, 500);
  }
}
