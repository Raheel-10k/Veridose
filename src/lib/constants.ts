export const CHAIN_ID = 84532;
export const CHAIN_NAME = "Base Sepolia";

export const EAS_CONTRACT_ADDRESS =
  "0x4200000000000000000000000000000000000021" as const;

export const SCHEMA_REGISTRY_ADDRESS =
  "0x4200000000000000000000000000000000000020" as const;

export const EAS_EXPLORER_URL = "https://base-sepolia.easscan.org" as const;

export const DEFAULT_RPC_URL = "https://sepolia.base.org" as const;

export const ATP_SCHEMA =
  "address entity, string role, string licenseId, bool active" as const;

export const BATCH_SCHEMA =
  "bytes32 batchHash, string drugName, uint8 status, string evidenceCID" as const;

export const CUSTODY_SCHEMA =
  "bytes32 batchAttestationUID, string fromFacility, string toFacility, string tempRangeC, uint64 handoffTimestamp" as const;

export const BatchStatus = {
  VALID: 0,
  FLAGGED_SUSPICIOUS: 1,
  RECALLED: 2,
} as const;

export type BatchStatusCode =
  (typeof BatchStatus)[keyof typeof BatchStatus];

export const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
