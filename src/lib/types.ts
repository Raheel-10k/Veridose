import type { BatchStatusCode } from "./constants";

export type DemoRoleName =
  | "Regulator"
  | "Manufacturer"
  | "Depot"
  | "Distributor"
  | "Pharmacist";

export type UserRole =
  | "Manufacturer"
  | "Depot"
  | "Distributor"
  | "Pharmacist"
  | "Inspector"
  | "Regulator";

export interface CheckpointRecord {
  id: string;
  batchAttestationUID: string;
  routePlan: string;
  checkpointName: string;
  location: string;
  estimatedArrival: string;
  lastTxHash: string;
  status: "SCHEDULED" | "INSPECTED_OK" | "FLAGGED_TAMPERED";
  inspectedAt?: string;
  inspectorName?: string;
  inspectorNote?: string;
  attestationUID?: string;
  createdAt: string;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  orgName: string;
  facilityName: string;
  createdAt: string;
}

export interface MedicineCatalogRecord {
  id: string;
  name: string;
  description?: string;
  defaultDosage?: string;
  category?: string;
  createdBy?: string;
  createdAt: string;
}

export interface TagRecord {
  uid: string;
  batchAttestationUID: string;
  drugName: string;
  lotNumber: string;
  aesKeyHex: string;
  lastCounter: number;
  batchStatus: number;
  flagAttestationUID: string | null;
  createdAt: string;
}

export interface OffchainHandoffRecord {
  id: string;
  batchAttestationUID: string;
  signedAttestationJson: string;
  signer: string;
  createdAt: string;
}

export interface DemoRoleRecord {
  role: DemoRoleName;
  address: string;
  licenseId: string;
  atpAttestationUID: string | null;
  createdAt: string;
}

export interface IssueBatchInput {
  drugName: string;
  lotNumber: string;
  expiry?: string;
  evidenceCID?: string;
}

export interface HandoffInput {
  batchAttestationUID: string;
  fromFacility: string;
  toFacility: string;
  tempRangeC: string;
}

export interface FlagBatchInput {
  batchAttestationUID: string;
  status: Extract<BatchStatusCode, 1 | 2>;
  evidenceNote: string;
}

export type NfcVerifyStatus =
  | "AUTHENTIC_TAG"
  | "INVALID_SIGNATURE"
  | "CLONED_REPLAY_DETECTED"
  | "UNKNOWN_TAG";

export interface NfcVerifyResult {
  status: NfcVerifyStatus;
  authentic: boolean;
  counter?: number;
  previousCounter?: number;
  uid?: string;
  tag?: TagRecord;
}
