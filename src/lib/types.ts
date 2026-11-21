import type { BatchStatusCode } from "./constants";

export type DemoRoleName =
  | "Regulator"
  | "Manufacturer"
  | "Distributor"
  | "Pharmacist";

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
