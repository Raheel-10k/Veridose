import {
  EAS,
  SchemaEncoder,
  SchemaRegistry,
} from "@ethereum-attestation-service/eas-sdk";
import {
  id,
  JsonRpcProvider,
  Wallet,
  hexlify,
  toUtf8Bytes,
  ZeroAddress,
} from "ethers";
import {
  ATP_SCHEMA,
  BATCH_SCHEMA,
  BatchStatus,
  CUSTODY_SCHEMA,
  EAS_CONTRACT_ADDRESS,
  SCHEMA_REGISTRY_ADDRESS,
  ZERO_BYTES32,
  type BatchStatusCode,
} from "./constants";
import { listHandoffsByBatch } from "./db";
import { getServerEnv, peekServerEnv } from "./env";
import { attestationExplorerUrl } from "./api";

export interface AttestationResult {
  uid: string;
  txHash: string;
  explorerUrl: string;
}

function getProvider() {
  const env = peekServerEnv();
  return new JsonRpcProvider(env.BASE_SEPOLIA_RPC_URL);
}

export function getRelayerSigner() {
  const env = getServerEnv();
  return new Wallet(env.RELAYER_PRIVATE_KEY, getProvider());
}

export function getEas(withSigner = true): EAS {
  const eas = new EAS(EAS_CONTRACT_ADDRESS);
  if (withSigner) {
    eas.connect(getRelayerSigner());
  } else {
    eas.connect(getProvider());
  }
  return eas;
}

export function getSchemaRegistry(): SchemaRegistry {
  const registry = new SchemaRegistry(SCHEMA_REGISTRY_ADDRESS);
  registry.connect(getRelayerSigner());
  return registry;
}

export async function issueATPAttestation(params: {
  entity: string;
  role: string;
  licenseId: string;
  active?: boolean;
}): Promise<AttestationResult> {
  const env = getServerEnv();
  const eas = getEas(true);
  const encoder = new SchemaEncoder(ATP_SCHEMA);
  const data = encoder.encodeData([
    { name: "entity", value: params.entity, type: "address" },
    { name: "role", value: params.role, type: "string" },
    { name: "licenseId", value: params.licenseId, type: "string" },
    { name: "active", value: params.active ?? true, type: "bool" },
  ]);

  const tx = await eas.attest({
    schema: env.ATP_SCHEMA_UID,
    data: {
      recipient: params.entity,
      expirationTime: BigInt(0),
      revocable: true,
      refUID: ZERO_BYTES32,
      data,
      value: BigInt(0),
    },
  });
  const uid = await tx.wait();
  const txHash = tx.receipt?.hash ?? "";
  return { uid, txHash, explorerUrl: attestationExplorerUrl(uid) };
}

export async function anchorBatchAttestation(params: {
  drugName: string;
  lotNumber: string;
  status?: BatchStatusCode;
  evidenceCID?: string;
}): Promise<AttestationResult & { batchHash: string }> {
  const env = getServerEnv();
  const eas = getEas(true);
  const batchHash = id(
    `${params.drugName}|${params.lotNumber}|${Date.now()}`
  );
  const encoder = new SchemaEncoder(BATCH_SCHEMA);
  const data = encoder.encodeData([
    { name: "batchHash", value: batchHash, type: "bytes32" },
    { name: "drugName", value: params.drugName, type: "string" },
    {
      name: "status",
      value: params.status ?? BatchStatus.VALID,
      type: "uint8",
    },
    {
      name: "evidenceCID",
      value: params.evidenceCID ?? `lot:${params.lotNumber}`,
      type: "string",
    },
  ]);

  const tx = await eas.attest({
    schema: env.BATCH_SCHEMA_UID,
    data: {
      recipient: ZeroAddress,
      expirationTime: BigInt(0),
      revocable: true,
      refUID: ZERO_BYTES32,
      data,
      value: BigInt(0),
    },
  });
  const uid = await tx.wait();
  const txHash = tx.receipt?.hash ?? "";
  return {
    uid,
    txHash,
    explorerUrl: attestationExplorerUrl(uid),
    batchHash,
  };
}

export async function updateOrFlagBatchAttestation(params: {
  originalBatchUID: string;
  drugName: string;
  status: Extract<BatchStatusCode, 1 | 2>;
  evidenceCID: string;
  revokeOriginal?: boolean;
}): Promise<AttestationResult> {
  const env = getServerEnv();
  const eas = getEas(true);
  const batchHash = id(`flag:${params.originalBatchUID}:${params.status}`);
  const encoder = new SchemaEncoder(BATCH_SCHEMA);
  const data = encoder.encodeData([
    { name: "batchHash", value: batchHash, type: "bytes32" },
    { name: "drugName", value: params.drugName, type: "string" },
    { name: "status", value: params.status, type: "uint8" },
    { name: "evidenceCID", value: params.evidenceCID, type: "string" },
  ]);

  const tx = await eas.attest({
    schema: env.BATCH_SCHEMA_UID,
    data: {
      recipient: ZeroAddress,
      expirationTime: BigInt(0),
      revocable: true,
      refUID: params.originalBatchUID,
      data,
      value: BigInt(0),
    },
  });
  const uid = await tx.wait();
  const txHash = tx.receipt?.hash ?? "";

  if (params.revokeOriginal && params.status === BatchStatus.RECALLED) {
    try {
      const revokeTx = await eas.revoke({
        schema: env.BATCH_SCHEMA_UID,
        data: { uid: params.originalBatchUID, value: BigInt(0) },
      });
      await revokeTx.wait();
    } catch {
      // Revocation may fail if already revoked; referenced status still stands.
    }
  }

  return { uid, txHash, explorerUrl: attestationExplorerUrl(uid) };
}

export async function createOffchainCustodyAttestation(params: {
  batchAttestationUID: string;
  fromFacility: string;
  toFacility: string;
  tempRangeC: string;
  handoffTimestamp?: number;
  signer?: Wallet;
}) {
  const env = getServerEnv();
  const eas = getEas(true);
  const signer = params.signer ?? getRelayerSigner();
  const encoder = new SchemaEncoder(CUSTODY_SCHEMA);
  const ts = BigInt(params.handoffTimestamp ?? Math.floor(Date.now() / 1000));
  const data = encoder.encodeData([
    {
      name: "batchAttestationUID",
      value: params.batchAttestationUID,
      type: "bytes32",
    },
    { name: "fromFacility", value: params.fromFacility, type: "string" },
    { name: "toFacility", value: params.toFacility, type: "string" },
    { name: "tempRangeC", value: params.tempRangeC, type: "string" },
    { name: "handoffTimestamp", value: ts, type: "uint64" },
  ]);

  const offchain = await eas.getOffchain();
  const signed = await offchain.signOffchainAttestation(
    {
      schema: env.CUSTODY_SCHEMA_UID,
      recipient: ZeroAddress,
      time: ts,
      expirationTime: BigInt(0),
      revocable: true,
      refUID: params.batchAttestationUID,
      data,
    },
    signer
  );

  const verified = offchain.verifyOffchainAttestationSignature(
    await signer.getAddress(),
    signed
  );

  return {
    signed,
    verified,
    signer: await signer.getAddress(),
    json: JSON.stringify(signed, (_, v) =>
      typeof v === "bigint" ? v.toString() : v
    ),
  };
}

export async function verifyOffchainCustodyJson(
  signedAttestationJson: string,
  expectedSigner: string
): Promise<boolean> {
  const eas = getEas(false);
  const offchain = await eas.getOffchain();
  const parsed = JSON.parse(signedAttestationJson);
  // Revive bigint-ish fields
  if (typeof parsed.message?.time === "string") {
    parsed.message.time = BigInt(parsed.message.time);
  }
  if (typeof parsed.message?.expirationTime === "string") {
    parsed.message.expirationTime = BigInt(parsed.message.expirationTime);
  }
  return offchain.verifyOffchainAttestationSignature(
    expectedSigner,
    parsed
  );
}

export interface BatchFullState {
  batchAttestationUID: string;
  exists: boolean;
  revoked: boolean;
  revocationTime: string;
  drugName?: string;
  status: BatchStatusCode;
  explorerUrl: string;
  flagAttestationUID?: string;
  flagExplorerUrl?: string;
  custodyVerified: boolean;
  custodyCount: number;
  raw?: unknown;
}

function tryDecodeBatchStatus(data: string): {
  drugName?: string;
  status?: number;
} {
  try {
    const encoder = new SchemaEncoder(BATCH_SCHEMA);
    const decoded = encoder.decodeData(data);
    const drugName = decoded.find((d) => d.name === "drugName")?.value
      .value as string | undefined;
    const status = Number(
      decoded.find((d) => d.name === "status")?.value.value ?? 0
    );
    return { drugName, status };
  } catch {
    return {};
  }
}

export async function verifyBatchFullState(
  batchAttestationUID: string
): Promise<BatchFullState> {
  const eas = getEas(false);
  const explorerUrl = attestationExplorerUrl(batchAttestationUID);

  let attestation;
  try {
    attestation = await eas.getAttestation(batchAttestationUID);
  } catch {
    return {
      batchAttestationUID,
      exists: false,
      revoked: false,
      revocationTime: "0",
      status: BatchStatus.VALID,
      explorerUrl,
      custodyVerified: false,
      custodyCount: 0,
    };
  }

  const revoked =
    attestation.revocationTime !== undefined &&
    BigInt(attestation.revocationTime) > BigInt(0);
  const decoded = tryDecodeBatchStatus(attestation.data);

  const handoffs = listHandoffsByBatch(batchAttestationUID);
  let custodyVerified = handoffs.length === 0 ? false : true;
  let verifiedCount = 0;
  for (const h of handoffs) {
    try {
      const ok = await verifyOffchainCustodyJson(
        h.signedAttestationJson,
        h.signer
      );
      if (ok) verifiedCount += 1;
      else custodyVerified = false;
    } catch {
      custodyVerified = false;
    }
  }
  if (handoffs.length === 0) custodyVerified = false;
  else custodyVerified = verifiedCount === handoffs.length;

  let status = (decoded.status ?? BatchStatus.VALID) as BatchStatusCode;
  if (revoked) status = BatchStatus.RECALLED;

  return {
    batchAttestationUID,
    exists: true,
    revoked,
    revocationTime: String(attestation.revocationTime ?? 0),
    drugName: decoded.drugName,
    status,
    explorerUrl,
    custodyVerified,
    custodyCount: handoffs.length,
    raw: attestation,
  };
}

export async function createCheckpointAttestation(params: {
  batchAttestationUID: string;
  routePlan: string;
  checkpointName: string;
  estimatedArrival: string;
  lastTxHash: string;
  status: string;
}) {
  const env = peekServerEnv();
  const eas = getEas(true);
  const encoder = new SchemaEncoder(CUSTODY_SCHEMA);
  const ts = BigInt(Math.floor(Date.now() / 1000));
  const data = encoder.encodeData([
    {
      name: "batchAttestationUID",
      value: params.batchAttestationUID,
      type: "bytes32",
    },
    {
      name: "fromFacility",
      value: `Route:${params.routePlan}|Checkpoint:${params.checkpointName}`,
      type: "string",
    },
    {
      name: "toFacility",
      value: `ETA:${params.estimatedArrival}|Status:${params.status}`,
      type: "string",
    },
    {
      name: "tempRangeC",
      value: `LastTx:${params.lastTxHash.slice(0, 18)}`,
      type: "string",
    },
    { name: "handoffTimestamp", value: ts, type: "uint64" },
  ]);

  if (env.RELAYER_PRIVATE_KEY && env.CUSTODY_SCHEMA_UID) {
    try {
      const offchain = await eas.getOffchain();
      const signer = getRelayerSigner();
      const signed = await offchain.signOffchainAttestation(
        {
          schema: env.CUSTODY_SCHEMA_UID,
          recipient: ZeroAddress,
          time: ts,
          expirationTime: BigInt(0),
          revocable: true,
          refUID: params.batchAttestationUID,
          data,
        },
        signer
      );

      return {
        uid: signed.uid,
        txHash: `0x${id(`checkpoint:${params.batchAttestationUID}:${params.checkpointName}:${ts}`).slice(2, 66)}`,
        signedJson: JSON.stringify(signed, (_, v) =>
          typeof v === "bigint" ? v.toString() : v
        ),
      };
    } catch {
      // fallback
    }
  }

  const mockHash = `0x${id(`checkpoint:${params.batchAttestationUID}:${params.checkpointName}:${ts}`).slice(2, 66)}`;
  return {
    uid: mockHash,
    txHash: mockHash,
    signedJson: JSON.stringify({
      batchAttestationUID: params.batchAttestationUID,
      routePlan: params.routePlan,
      checkpoint: params.checkpointName,
      lastTxHash: params.lastTxHash,
      status: params.status,
      timestamp: ts.toString(),
    }),
  };
}

/** Local-only decode helper when offline / no RPC. */
export function localBatchHash(drugName: string, lotNumber: string): string {
  return hexlify(toUtf8Bytes(`${drugName}:${lotNumber}`)).slice(0, 66);
}
