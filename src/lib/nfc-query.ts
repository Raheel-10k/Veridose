export interface ParsedNfcQuery {
  uid?: string;
  counter?: number;
  cmac?: string;
  batchUid?: string;
  piccData?: string;
}

/**
 * Accepts:
 * - ?uid=&counter=&cmac=
 * - ?picc_data=&cmac=  (picc_data = uid||counter hex; last 8 hex = counter uint32)
 * - ?batchUid=
 */
export function parseNfcSearchParams(
  params: URLSearchParams
): ParsedNfcQuery {
  const batchUid = params.get("batchUid") ?? undefined;
  const cmac = params.get("cmac") ?? undefined;
  const uid = params.get("uid") ?? undefined;
  const counterRaw = params.get("counter");
  const piccData = params.get("picc_data") ?? params.get("piccData") ?? undefined;

  if (uid && counterRaw != null && cmac) {
    return {
      uid: uid.toLowerCase(),
      counter: Number(counterRaw),
      cmac: cmac.toLowerCase(),
      batchUid,
    };
  }

  if (piccData && cmac) {
    const clean = piccData.replace(/^0x/, "").toLowerCase();
    // Expect uid (even hex, typically 14 chars for 7 bytes) + 8 hex counter
    if (clean.length >= 10) {
      const counterHex = clean.slice(-8);
      const uidHex = clean.slice(0, -8);
      return {
        uid: uidHex,
        counter: parseInt(counterHex, 16),
        cmac: cmac.toLowerCase(),
        piccData: clean,
        batchUid,
      };
    }
  }

  return { batchUid, cmac, uid, piccData };
}
