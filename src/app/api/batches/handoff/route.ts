import { randomUUID } from "crypto";
import { getTagByBatchUid, saveOffchainHandoff } from "@/lib/db";
import { createOffchainCustodyAttestation } from "@/lib/eas";
import { jsonError, jsonOk } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const batchAttestationUID = String(body.batchAttestationUID ?? "").trim();
    const fromFacility = String(body.fromFacility ?? "").trim();
    const toFacility = String(body.toFacility ?? "").trim();
    const tempRangeC = String(body.tempRangeC ?? "2-8").trim();

    if (!batchAttestationUID || !fromFacility || !toFacility) {
      return jsonError(
        "batchAttestationUID, fromFacility, and toFacility are required"
      );
    }

    const tag = getTagByBatchUid(batchAttestationUID);
    if (!tag) {
      return jsonError("Unknown batchAttestationUID — issue a batch first", 404);
    }

    const result = await createOffchainCustodyAttestation({
      batchAttestationUID,
      fromFacility,
      toFacility,
      tempRangeC,
    });

    if (!result.verified) {
      return jsonError("Off-chain custody signature failed verification", 500);
    }

    const record = saveOffchainHandoff({
      id: randomUUID(),
      batchAttestationUID,
      signedAttestationJson: result.json,
      signer: result.signer,
    });

    return jsonOk({
      id: record.id,
      signer: record.signer,
      verified: true,
      signedAttestation: JSON.parse(result.json),
      signedAttestationJson: result.json,
      drugName: tag.drugName,
      lotNumber: tag.lotNumber,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Handoff failed";
    return jsonError(message, 500);
  }
}
