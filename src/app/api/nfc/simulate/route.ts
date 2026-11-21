import { getTagByBatchUid, getTagByUid } from "@/lib/db";
import { getAppBaseUrl } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/api";
import { generateSimulatedTapUrl } from "@/lib/nfc-crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mode = String(body.mode ?? "next") as "next" | "replay";
    const uid = body.uid ? String(body.uid).toLowerCase() : undefined;
    const batchAttestationUID = body.batchAttestationUID
      ? String(body.batchAttestationUID)
      : undefined;

    const tag = uid
      ? await getTagByUid(uid)
      : batchAttestationUID
        ? await getTagByBatchUid(batchAttestationUID)
        : null;

    if (!tag) {
      return jsonError("Tag not found", 404);
    }

    const origin = new URL(request.url).origin;
    const baseUrl = getAppBaseUrl(origin);

    if (mode === "replay") {
      const replayCounter = Math.max(tag.lastCounter, 1);
      const url = generateSimulatedTapUrl(
        tag.uid,
        tag.aesKeyHex,
        replayCounter,
        baseUrl
      );
      return jsonOk({
        mode: "replay",
        uid: tag.uid,
        counter: replayCounter,
        lastCounter: tag.lastCounter,
        url,
        note: "Replays a spent/prior counter — verify should return CLONE_REPLAY_DETECTED after a real tap.",
      });
    }

    const nextCounter = tag.lastCounter + 1;
    const url = generateSimulatedTapUrl(
      tag.uid,
      tag.aesKeyHex,
      nextCounter,
      baseUrl
    );
    return jsonOk({
      mode: "next",
      uid: tag.uid,
      counter: nextCounter,
      lastCounter: tag.lastCounter,
      url,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Simulate failed";
    return jsonError(message, 500);
  }
}
