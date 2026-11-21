import { randomUUID } from "crypto";
import { createTag } from "@/lib/db";
import { anchorBatchAttestation } from "@/lib/eas";
import { getAppBaseUrl } from "@/lib/env";
import { jsonError, jsonOk, txExplorerUrl } from "@/lib/api";
import {
  generateAesKeyHex,
  generateSimulatedTapUrl,
  generateTagUid,
} from "@/lib/nfc-crypto";
import { BatchStatus } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const drugName = String(body.drugName ?? "").trim();
    const lotNumber = String(body.lotNumber ?? "").trim();
    const evidenceCID = body.evidenceCID
      ? String(body.evidenceCID)
      : body.expiry
        ? `expiry:${body.expiry}`
        : undefined;

    if (!drugName || !lotNumber) {
      return jsonError("drugName and lotNumber are required");
    }

    const anchored = await anchorBatchAttestation({
      drugName,
      lotNumber,
      status: BatchStatus.VALID,
      evidenceCID,
    });

    const uid = generateTagUid();
    const aesKeyHex = generateAesKeyHex();
    const tag = await createTag({
      uid,
      batchAttestationUID: anchored.uid,
      drugName,
      lotNumber,
      aesKeyHex,
      lastCounter: 0,
    });

    const origin = new URL(request.url).origin;
    const tapUrl = generateSimulatedTapUrl(
      uid,
      aesKeyHex,
      1,
      getAppBaseUrl(origin)
    );

    return jsonOk({
      id: randomUUID(),
      attestationUID: anchored.uid,
      batchHash: anchored.batchHash,
      txHash: anchored.txHash,
      explorerUrl: anchored.explorerUrl,
      txExplorerUrl: anchored.txHash
        ? txExplorerUrl(anchored.txHash)
        : null,
      tag: {
        uid: tag.uid,
        lastCounter: tag.lastCounter,
        drugName: tag.drugName,
        lotNumber: tag.lotNumber,
      },
      simulateTapUrl: tapUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Issue failed";
    return jsonError(message, 500);
  }
}
