export const TrustVerdict = {
  VERIFIED_AUTHENTIC: "VERIFIED_AUTHENTIC",
  CLONE_REPLAY_DETECTED: "CLONE_REPLAY_DETECTED",
  FLAGGED_SUSPICIOUS: "FLAGGED_SUSPICIOUS",
  RECALLED: "RECALLED",
  TAMPERED: "TAMPERED",
  UNKNOWN: "UNKNOWN",
} as const;

export type TrustVerdictCode =
  (typeof TrustVerdict)[keyof typeof TrustVerdict];

export interface TrustVerdictPayload {
  verdict: TrustVerdictCode;
  authentic: boolean;
  message: string;
  nfc?: {
    status: string;
    counter?: number;
    previousCounter?: number;
    uid?: string;
  };
  batch?: {
    batchAttestationUID?: string;
    drugName?: string;
    lotNumber?: string;
    status?: number;
    revocationTime?: string;
    explorerUrl?: string;
    flagAttestationUID?: string;
    flagExplorerUrl?: string;
  };
  custody?: {
    verified: boolean;
    count: number;
  };
  manufacturerAtpActive?: boolean;
}
