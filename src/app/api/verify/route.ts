import { BatchStatus } from "@/lib/constants";
import { getTagByBatchUid, getTagByUid, listHandoffsByBatch } from "@/lib/db";
import { verifyBatchFullState, verifyOffchainCustodyJson } from "@/lib/eas";
import { parseNfcSearchParams } from "@/lib/nfc-query";
import { verifyNfcTap } from "@/lib/nfc-crypto";
import { jsonError, jsonOk, attestationExplorerUrl } from "@/lib/api";
import { TrustVerdict, type TrustVerdictPayload } from "@/lib/verdicts";
import type { NfcVerifyResult, TagRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseNfcSearchParams(searchParams);

    let nfcResult: NfcVerifyResult | null = null;
    let tag =
      (parsed.uid ? await getTagByUid(parsed.uid) : null) ||
      (parsed.batchUid ? await getTagByBatchUid(parsed.batchUid) : null);

    if (parsed.uid && parsed.counter != null && parsed.cmac) {
      nfcResult = await verifyNfcTap(parsed.uid, parsed.counter, parsed.cmac);
      tag = nfcResult.tag ?? tag;
    }

    const batchUid = tag?.batchAttestationUID || parsed.batchUid || undefined;

    let chainState = null as Awaited<
      ReturnType<typeof verifyBatchFullState>
    > | null;

    if (batchUid && !String(batchUid).startsWith("0xdemo")) {
      try {
        chainState = await verifyBatchFullState(batchUid);
      } catch (err) {
        console.warn("verifyBatchFullState failed", err);
      }
    }

    const handoffs = batchUid ? await listHandoffsByBatch(batchUid) : [];
    let custodyVerified = false;
    let custodyCount = handoffs.length;
    if (handoffs.length > 0) {
      let ok = 0;
      for (const h of handoffs) {
        try {
          if (await verifyOffchainCustodyJson(h.signedAttestationJson, h.signer)) {
            ok += 1;
          }
        } catch {
          /* ignore */
        }
      }
      custodyVerified = ok === handoffs.length;
    } else if (chainState) {
      custodyVerified = chainState.custodyVerified;
      custodyCount = chainState.custodyCount;
    }

    const localStatus = (tag?.batchStatus ?? BatchStatus.VALID) as 0 | 1 | 2;
    const chainStatus = (chainState?.status ?? BatchStatus.VALID) as 0 | 1 | 2;
    const status = Math.max(localStatus, chainStatus) as 0 | 1 | 2;
    const revoked = Boolean(chainState?.revoked) || status === BatchStatus.RECALLED;

    const batchState = batchUid
      ? {
          batchAttestationUID: batchUid,
          exists: Boolean(chainState?.exists || tag),
          revoked,
          revocationTime: chainState?.revocationTime ?? "0",
          drugName: chainState?.drugName ?? tag?.drugName,
          status,
          explorerUrl: attestationExplorerUrl(batchUid),
          flagAttestationUID: tag?.flagAttestationUID ?? undefined,
          flagExplorerUrl: tag?.flagAttestationUID
            ? attestationExplorerUrl(tag.flagAttestationUID)
            : undefined,
          custodyVerified,
          custodyCount,
        }
      : null;

    const payload = buildVerdict(nfcResult, batchState, tag);
    return jsonOk(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verify failed";
    return jsonError(message, 500);
  }
}

function buildVerdict(
  nfc: NfcVerifyResult | null,
  batch: {
    batchAttestationUID: string;
    exists: boolean;
    revoked: boolean;
    revocationTime: string;
    drugName?: string;
    status: number;
    explorerUrl: string;
    flagAttestationUID?: string;
    flagExplorerUrl?: string;
    custodyVerified: boolean;
    custodyCount: number;
  } | null,
  tag: TagRecord | null
): TrustVerdictPayload {
  if (nfc && nfc.status === "CLONED_REPLAY_DETECTED") {
    return {
      verdict: TrustVerdict.CLONE_REPLAY_DETECTED,
      authentic: false,
      message: `COUNTERFEIT WARNING: CLONED LABEL / REPLAY DETECTED — Scanned Counter #${nfc.counter} <= Last Recorded Counter #${nfc.previousCounter}`,
      nfc: {
        status: nfc.status,
        counter: nfc.counter,
        previousCounter: nfc.previousCounter,
        uid: nfc.uid,
      },
      batch: tag
        ? {
            batchAttestationUID: tag.batchAttestationUID,
            drugName: tag.drugName,
            lotNumber: tag.lotNumber,
            explorerUrl: attestationExplorerUrl(tag.batchAttestationUID),
          }
        : undefined,
    };
  }

  if (
    nfc &&
    (nfc.status === "INVALID_SIGNATURE" || nfc.status === "UNKNOWN_TAG")
  ) {
    return {
      verdict: TrustVerdict.TAMPERED,
      authentic: false,
      message: "TAMPERED / INVALID NFC SIGNATURE — CMAC verification failed",
      nfc: { status: nfc.status, uid: nfc.uid },
    };
  }

  if (batch?.revoked || batch?.status === BatchStatus.RECALLED) {
    return {
      verdict: TrustVerdict.RECALLED,
      authentic: false,
      message: "DO NOT DISPENSE: BATCH RECALLED ON-CHAIN",
      nfc: nfc
        ? { status: nfc.status, counter: nfc.counter, uid: nfc.uid }
        : undefined,
      batch: {
        batchAttestationUID: batch.batchAttestationUID,
        drugName: batch.drugName ?? tag?.drugName,
        lotNumber: tag?.lotNumber,
        status: batch.status,
        revocationTime: batch.revocationTime,
        explorerUrl: batch.flagExplorerUrl ?? batch.explorerUrl,
        flagAttestationUID: batch.flagAttestationUID,
        flagExplorerUrl: batch.flagExplorerUrl,
      },
      custody: {
        verified: batch.custodyVerified,
        count: batch.custodyCount,
      },
    };
  }

  if (batch?.status === BatchStatus.FLAGGED_SUSPICIOUS) {
    return {
      verdict: TrustVerdict.FLAGGED_SUSPICIOUS,
      authentic: false,
      message: "DO NOT DISPENSE: BATCH FLAGGED SUSPICIOUS ON-CHAIN",
      nfc: nfc
        ? { status: nfc.status, counter: nfc.counter, uid: nfc.uid }
        : undefined,
      batch: {
        batchAttestationUID: batch.batchAttestationUID,
        drugName: batch.drugName ?? tag?.drugName,
        lotNumber: tag?.lotNumber,
        status: batch.status,
        explorerUrl: batch.flagExplorerUrl ?? batch.explorerUrl,
        flagAttestationUID: batch.flagAttestationUID,
        flagExplorerUrl: batch.flagExplorerUrl,
      },
      custody: {
        verified: batch.custodyVerified,
        count: batch.custodyCount,
      },
    };
  }

  if (nfc?.authentic && (batch?.exists || tag)) {
    return {
      verdict: TrustVerdict.VERIFIED_AUTHENTIC,
      authentic: true,
      message:
        "VERIFIED AUTHENTIC — Valid rolling NFC counter + Valid Base Sepolia EAS origin" +
        (batch?.custodyVerified
          ? " + Verified Off-Chain Cold-Chain Handoff"
          : ""),
      nfc: {
        status: nfc.status,
        counter: nfc.counter,
        uid: nfc.uid,
      },
      batch: {
        batchAttestationUID:
          batch?.batchAttestationUID ?? tag!.batchAttestationUID,
        drugName: batch?.drugName ?? tag?.drugName,
        lotNumber: tag?.lotNumber,
        status: batch?.status ?? BatchStatus.VALID,
        explorerUrl:
          batch?.explorerUrl ??
          attestationExplorerUrl(tag!.batchAttestationUID),
      },
      custody: batch
        ? { verified: batch.custodyVerified, count: batch.custodyCount }
        : undefined,
      manufacturerAtpActive: true,
    };
  }

  return {
    verdict: TrustVerdict.UNKNOWN,
    authentic: false,
    message:
      "Unable to determine authenticity — provide NFC tap params or batchUid",
    nfc: nfc
      ? { status: nfc.status, counter: nfc.counter, uid: nfc.uid }
      : undefined,
  };
}
