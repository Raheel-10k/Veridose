/**
 * Browser Web NFC helpers (Chrome on Android).
 * Prototype model: manufacturer writes a signed /verify URL onto a blank
 * NTAG213/215/216 sticker; patient scans that tag to verify the batch.
 * True NTAG 424 DNA SUN rolling hardware still works via OS URL open.
 */

export type WebNfcSupport = {
  supported: boolean;
  reason?: string;
};

export function getWebNfcSupport(): WebNfcSupport {
  if (typeof window === "undefined") {
    return { supported: false, reason: "Server-side only" };
  }
  if (!window.isSecureContext) {
    return {
      supported: false,
      reason:
        "Web NFC needs HTTPS (or localhost). On a phone use a tunnel like ngrok, not http://LAN-IP.",
    };
  }
  if (!("NDEFReader" in window)) {
    return {
      supported: false,
      reason:
        "Web NFC is not available here. Use Chrome on Android with NFC enabled.",
    };
  }
  return { supported: true };
}

function decodeRecordData(record: NDEFRecord): string {
  if (!record.data) return "";
  try {
    const encoding =
      record.encoding === "utf-16" || record.encoding === "utf-16be"
        ? "utf-16"
        : "utf-8";
    return new TextDecoder(encoding).decode(record.data);
  } catch {
    return "";
  }
}

/** Pull a VeriDose /verify URL (or query string) out of NDEF records / free text. */
export function extractVerifyTarget(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  // Absolute or relative verify URL
  const urlMatch = text.match(
    /https?:\/\/[^\s"'<>]+\/verify\?[^\s"'<>]+/i
  );
  if (urlMatch) return urlMatch[0];

  const pathMatch = text.match(/\/verify\?[^\s"'<>]+/i);
  if (pathMatch) return pathMatch[0];

  // Bare query already
  if (
    /(?:^|[?&])uid=/i.test(text) &&
    /(?:^|[?&])cmac=/i.test(text)
  ) {
    const q = text.startsWith("?") ? text : `?${text.replace(/^\?/, "")}`;
    return `/verify${q}`;
  }

  // JSON payload { uid, counter, cmac } or { url }
  try {
    const parsed = JSON.parse(text) as {
      url?: string;
      uid?: string;
      counter?: number | string;
      cmac?: string;
    };
    if (parsed.url) return extractVerifyTarget(parsed.url);
    if (parsed.uid && parsed.cmac != null && parsed.counter != null) {
      return `/verify?uid=${encodeURIComponent(String(parsed.uid))}&counter=${encodeURIComponent(String(parsed.counter))}&cmac=${encodeURIComponent(String(parsed.cmac))}`;
    }
  } catch {
    /* not JSON */
  }

  return null;
}

export function extractVerifyTargetFromMessage(
  message: NDEFMessage
): string | null {
  for (const record of message.records) {
    const type = record.recordType.toLowerCase();
    if (
      type === "url" ||
      type === "absolute-url" ||
      type === "text" ||
      type === "mime"
    ) {
      const decoded = decodeRecordData(record);
      const target = extractVerifyTarget(decoded);
      if (target) return target;
    }
  }
  return null;
}

export async function writeBatchUrlToNfcTag(
  absoluteVerifyUrl: string,
  options?: { signal?: AbortSignal }
): Promise<void> {
  const support = getWebNfcSupport();
  if (!support.supported) {
    throw new Error(support.reason || "Web NFC unavailable");
  }

  const ndef = new NDEFReader();
  await ndef.write(
    {
      records: [
        { recordType: "url", data: absoluteVerifyUrl },
        {
          recordType: "text",
          data: JSON.stringify({
            app: "VeriDose",
            url: absoluteVerifyUrl,
          }),
        },
      ],
    },
    { overwrite: true, signal: options?.signal }
  );
}

export async function scanNfcForVerifyUrl(
  onReading: (verifyPathOrUrl: string, serialNumber?: string) => void,
  options?: { signal?: AbortSignal }
): Promise<void> {
  const support = getWebNfcSupport();
  if (!support.supported) {
    throw new Error(support.reason || "Web NFC unavailable");
  }

  const ndef = new NDEFReader();
  await ndef.scan({ signal: options?.signal });

  ndef.addEventListener("reading", (event) => {
    const target = extractVerifyTargetFromMessage(event.message);
    if (target) {
      onReading(target, event.serialNumber);
      return;
    }
    // Fallback: serial-only tags can't prove CMAC; surface a clear miss.
    onReading("", event.serialNumber);
  });
}

export function toAbsoluteVerifyUrl(
  pathOrUrl: string,
  origin = typeof window !== "undefined" ? window.location.origin : ""
): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${origin.replace(/\/$/, "")}${path}`;
}
