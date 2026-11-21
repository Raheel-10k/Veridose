/**
 * db.ts — Pure MongoDB implementation.
 * No SQLite / better-sqlite3 anywhere in this file.
 */
import crypto from "crypto";
import { deriveDemoRoles } from "./demo-roles";
import { getMongoDb, ensureMongoIndexes } from "./mongodb";
import type {
  CheckpointRecord,
  DemoRoleName,
  DemoRoleRecord,
  MedicineCatalogRecord,
  OffchainHandoffRecord,
  TagRecord,
  UserRecord,
  UserRole,
} from "./types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const DEFAULT_USERS: Array<{
  email: string;
  name: string;
  role: UserRole;
  orgName: string;
  facilityName: string;
}> = [
  {
    email: "manufacturer@pharma.com",
    name: "Alice Manufacturer",
    role: "Manufacturer",
    orgName: "PharmaCorp Global",
    facilityName: "PharmaCorp Plant Alpha (Geneva)",
  },
  {
    email: "depot@pharma.com",
    name: "Bob Depot Manager",
    role: "Depot",
    orgName: "PharmaCorp Global",
    facilityName: "PharmaCorp Central Hub / Depot 1",
  },
  {
    email: "distributor@logistics.com",
    name: "David Distributor",
    role: "Distributor",
    orgName: "Apex ColdChain Logistics",
    facilityName: "Apex Hub West Africa",
  },
  {
    email: "pharmacist@clinic.com",
    name: "Dr. Paul Pharmacist",
    role: "Pharmacist",
    orgName: "Central Health Dispensary",
    facilityName: "Downtown Pharmacy Unit 4",
  },
  {
    email: "regulator@health.gov",
    name: "Rita Regulator",
    role: "Regulator",
    orgName: "National Medicine Regulatory Authority",
    facilityName: "Surveillance & Inspection Directorate",
  },
];

let seeded = false;
export async function ensureMongoSeeded(): Promise<void> {
  if (seeded) return;
  const mdb = await getMongoDb();
  await ensureMongoIndexes(mdb);

  // Seed demo roles
  const demoCount = await mdb.collection("demoRoles").countDocuments();
  if (demoCount === 0) {
    const relayer = process.env.RELAYER_PRIVATE_KEY?.trim();
    const roles = deriveDemoRoles(relayer);
    const now = new Date().toISOString();
    await mdb.collection("demoRoles").insertMany(
      roles.map((r) => ({
        role: r.role,
        address: r.address,
        licenseId: r.licenseId,
        atpAttestationUID: null,
        createdAt: now,
      }))
    );
  }

  // Seed default users
  const userCount = await mdb.collection("users").countDocuments();
  if (userCount === 0) {
    const now = new Date().toISOString();
    const docs = DEFAULT_USERS.map((u) => {
      const salt = crypto.randomBytes(16).toString("hex");
      const passwordHash = hashPassword("password123", salt);
      return {
        id: crypto.randomUUID(),
        email: u.email.toLowerCase(),
        passwordHash,
        salt,
        name: u.name,
        role: u.role,
        orgName: u.orgName,
        facilityName: u.facilityName,
        createdAt: now,
      };
    });
    await mdb.collection("users").insertMany(docs);
  }

  seeded = true;
}

// ─── User / Auth ──────────────────────────────────────────────────────────────

export async function getUserByEmail(
  email: string
): Promise<(UserRecord & { passwordHash: string; salt: string }) | null> {
  const normalized = email.trim().toLowerCase();
  await ensureMongoSeeded();
  const mdb = await getMongoDb();
  const doc = await mdb.collection("users").findOne({ email: normalized });
  if (!doc) return null;
  return {
    id: doc.id as string,
    email: doc.email as string,
    name: doc.name as string,
    role: doc.role as UserRole,
    orgName: doc.orgName as string,
    facilityName: doc.facilityName as string,
    passwordHash: doc.passwordHash as string,
    salt: doc.salt as string,
    createdAt: doc.createdAt as string,
  };
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  const mdb = await getMongoDb();
  const doc = await mdb.collection("users").findOne({ id });
  if (!doc) return null;
  return {
    id: doc.id as string,
    email: doc.email as string,
    name: doc.name as string,
    role: doc.role as UserRole,
    orgName: doc.orgName as string,
    facilityName: doc.facilityName as string,
    createdAt: doc.createdAt as string,
  };
}

export async function createUser(params: {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  orgName?: string;
  facilityName?: string;
}): Promise<UserRecord> {
  const id = crypto.randomUUID();
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(params.password, salt);
  const now = new Date().toISOString();
  const user: UserRecord = {
    id,
    email: params.email.trim().toLowerCase(),
    name: params.name.trim(),
    role: params.role,
    orgName:
      params.orgName?.trim() ||
      (params.role === "Depot" ? "PharmaCorp Global" : `${params.name} Org`),
    facilityName:
      params.facilityName?.trim() ||
      (params.role === "Depot" ? "Central Depot Facility" : "Main Facility"),
    createdAt: now,
  };
  const mdb = await getMongoDb();
  await mdb.collection("users").insertOne({ ...user, passwordHash, salt });
  return user;
}

export async function verifyUserPassword(
  email: string,
  password: string
): Promise<UserRecord | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;
  const hash = hashPassword(password, user.salt);
  if (crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(user.passwordHash))) {
    const { passwordHash: _p, salt: _s, ...safeUser } = user;
    void _p;
    void _s;
    return safeUser;
  }
  return null;
}

// ─── Medicine Catalog ─────────────────────────────────────────────────────────

export async function listMedicines(): Promise<MedicineCatalogRecord[]> {
  const mdb = await getMongoDb();
  const docs = await mdb
    .collection<MedicineCatalogRecord>("medicines")
    .find({})
    .sort({ name: 1 })
    .toArray();
  return docs.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description || "",
    defaultDosage: d.defaultDosage || "",
    category: d.category || "General Medicine",
    createdBy: d.createdBy || "system",
    createdAt: d.createdAt,
  }));
}

export async function addMedicine(params: {
  name: string;
  description?: string;
  defaultDosage?: string;
  category?: string;
  createdBy?: string;
}): Promise<MedicineCatalogRecord> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const record: MedicineCatalogRecord = {
    id,
    name: params.name.trim(),
    description: params.description?.trim() || "",
    defaultDosage: params.defaultDosage?.trim() || "",
    category: params.category?.trim() || "General Medicine",
    createdBy: params.createdBy || "system",
    createdAt: now,
  };
  const mdb = await getMongoDb();
  await mdb.collection<MedicineCatalogRecord>("medicines").insertOne(record);
  return record;
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

export async function createTag(
  tag: Omit<TagRecord, "createdAt" | "batchStatus" | "flagAttestationUID"> & {
    createdAt?: string;
    batchStatus?: number;
    flagAttestationUID?: string | null;
  }
): Promise<TagRecord> {
  const record: TagRecord = {
    uid: tag.uid.toLowerCase(),
    batchAttestationUID: tag.batchAttestationUID,
    drugName: tag.drugName,
    lotNumber: tag.lotNumber,
    aesKeyHex: tag.aesKeyHex,
    lastCounter: tag.lastCounter,
    batchStatus: tag.batchStatus ?? 0,
    flagAttestationUID: tag.flagAttestationUID ?? null,
    createdAt: tag.createdAt ?? new Date().toISOString(),
  };
  const mdb = await getMongoDb();
  await mdb.collection("tags").insertOne({ ...record });
  return record;
}

export async function getTagByUid(uid: string): Promise<TagRecord | null> {
  const normalized = uid.toLowerCase();
  const mdb = await getMongoDb();
  const doc = await mdb.collection<TagRecord>("tags").findOne({ uid: normalized });
  if (!doc) return null;
  return {
    uid: doc.uid,
    batchAttestationUID: doc.batchAttestationUID,
    drugName: doc.drugName,
    lotNumber: doc.lotNumber,
    aesKeyHex: doc.aesKeyHex,
    lastCounter: doc.lastCounter,
    batchStatus: doc.batchStatus,
    flagAttestationUID: doc.flagAttestationUID ?? null,
    createdAt: doc.createdAt,
  };
}

export async function getTagByBatchUid(
  batchAttestationUID: string
): Promise<TagRecord | null> {
  const mdb = await getMongoDb();
  const doc = await mdb
    .collection<TagRecord>("tags")
    .findOne({ batchAttestationUID });
  if (!doc) return null;
  return {
    uid: doc.uid,
    batchAttestationUID: doc.batchAttestationUID,
    drugName: doc.drugName,
    lotNumber: doc.lotNumber,
    aesKeyHex: doc.aesKeyHex,
    lastCounter: doc.lastCounter,
    batchStatus: doc.batchStatus,
    flagAttestationUID: doc.flagAttestationUID ?? null,
    createdAt: doc.createdAt,
  };
}

export async function listTags(): Promise<TagRecord[]> {
  const mdb = await getMongoDb();
  const docs = await mdb
    .collection<TagRecord>("tags")
    .find({})
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map((d) => ({
    uid: d.uid,
    batchAttestationUID: d.batchAttestationUID,
    drugName: d.drugName,
    lotNumber: d.lotNumber,
    aesKeyHex: d.aesKeyHex,
    lastCounter: d.lastCounter,
    batchStatus: d.batchStatus,
    flagAttestationUID: d.flagAttestationUID ?? null,
    createdAt: d.createdAt,
  }));
}

export async function updateTagCounter(
  uid: string,
  lastCounter: number
): Promise<void> {
  const normalized = uid.toLowerCase();
  const mdb = await getMongoDb();
  await mdb
    .collection("tags")
    .updateOne({ uid: normalized }, { $set: { lastCounter } });
}

export async function updateTagBatchStatus(
  batchAttestationUID: string,
  batchStatus: number,
  flagAttestationUID: string
): Promise<void> {
  const mdb = await getMongoDb();
  await mdb
    .collection("tags")
    .updateMany(
      { batchAttestationUID },
      { $set: { batchStatus, flagAttestationUID } }
    );
}

// ─── Offchain Handoffs ────────────────────────────────────────────────────────

export async function saveOffchainHandoff(
  handoff: Omit<OffchainHandoffRecord, "createdAt"> & { createdAt?: string }
): Promise<OffchainHandoffRecord> {
  const record: OffchainHandoffRecord = {
    ...handoff,
    createdAt: handoff.createdAt ?? new Date().toISOString(),
  };
  const mdb = await getMongoDb();
  await mdb.collection("offchainHandoffs").insertOne({ ...record });
  return record;
}

export async function listHandoffsByBatch(
  batchAttestationUID: string
): Promise<OffchainHandoffRecord[]> {
  const mdb = await getMongoDb();
  const docs = await mdb
    .collection<OffchainHandoffRecord>("offchainHandoffs")
    .find({ batchAttestationUID })
    .sort({ createdAt: 1 })
    .toArray();
  return docs.map((d) => ({
    id: d.id,
    batchAttestationUID: d.batchAttestationUID,
    signedAttestationJson: d.signedAttestationJson,
    signer: d.signer,
    createdAt: d.createdAt,
  }));
}

// ─── Demo Roles ───────────────────────────────────────────────────────────────

export async function listDemoRoles(): Promise<DemoRoleRecord[]> {
  await ensureMongoSeeded();
  const mdb = await getMongoDb();
  const docs = await mdb
    .collection<DemoRoleRecord>("demoRoles")
    .find({})
    .sort({ role: 1 })
    .toArray();
  return docs.map((d) => ({
    role: d.role,
    address: d.address,
    licenseId: d.licenseId,
    atpAttestationUID: d.atpAttestationUID ?? null,
    createdAt: d.createdAt,
  }));
}

export async function getDemoRoleRecord(
  role: DemoRoleName
): Promise<DemoRoleRecord | null> {
  await ensureMongoSeeded();
  const mdb = await getMongoDb();
  const doc = await mdb.collection<DemoRoleRecord>("demoRoles").findOne({ role });
  if (!doc) return null;
  return {
    role: doc.role,
    address: doc.address,
    licenseId: doc.licenseId,
    atpAttestationUID: doc.atpAttestationUID ?? null,
    createdAt: doc.createdAt,
  };
}

export async function setDemoRoleAtpUid(
  role: DemoRoleName,
  atpAttestationUID: string
): Promise<void> {
  const mdb = await getMongoDb();
  await mdb
    .collection("demoRoles")
    .updateOne({ role }, { $set: { atpAttestationUID } });
}

export async function clearDemoData(): Promise<void> {
  const mdb = await getMongoDb();
  await Promise.all([
    mdb.collection("tags").deleteMany({}),
    mdb.collection("offchainHandoffs").deleteMany({}),
    mdb.collection("checkpoints").deleteMany({}),
  ]);
}

// ─── Checkpoints ──────────────────────────────────────────────────────────────

export async function createCheckpoint(params: {
  batchAttestationUID: string;
  routePlan: string;
  checkpointName: string;
  location: string;
  estimatedArrival: string;
  lastTxHash?: string;
}): Promise<CheckpointRecord> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const lastTxHash =
    params.lastTxHash || `0x${crypto.randomBytes(32).toString("hex")}`;
  const record: CheckpointRecord = {
    id,
    batchAttestationUID: params.batchAttestationUID,
    routePlan: params.routePlan.trim(),
    checkpointName: params.checkpointName.trim(),
    location: params.location.trim(),
    estimatedArrival: params.estimatedArrival.trim(),
    lastTxHash,
    status: "SCHEDULED",
    createdAt: now,
  };
  const mdb = await getMongoDb();
  await mdb.collection("checkpoints").insertOne({ ...record });
  return record;
}

export async function listCheckpointsByBatch(
  batchAttestationUID: string
): Promise<CheckpointRecord[]> {
  const mdb = await getMongoDb();
  const docs = await mdb
    .collection<CheckpointRecord>("checkpoints")
    .find({ batchAttestationUID })
    .sort({ createdAt: 1 })
    .toArray();
  return docs.map((d) => ({
    id: d.id,
    batchAttestationUID: d.batchAttestationUID,
    routePlan: d.routePlan,
    checkpointName: d.checkpointName,
    location: d.location,
    estimatedArrival: d.estimatedArrival,
    lastTxHash: d.lastTxHash,
    status: d.status,
    inspectedAt: d.inspectedAt,
    inspectorName: d.inspectorName,
    inspectorNote: d.inspectorNote,
    attestationUID: d.attestationUID,
    createdAt: d.createdAt,
  }));
}

export async function listAllCheckpoints(): Promise<CheckpointRecord[]> {
  const mdb = await getMongoDb();
  const docs = await mdb
    .collection<CheckpointRecord>("checkpoints")
    .find({})
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map((d) => ({
    id: d.id,
    batchAttestationUID: d.batchAttestationUID,
    routePlan: d.routePlan,
    checkpointName: d.checkpointName,
    location: d.location,
    estimatedArrival: d.estimatedArrival,
    lastTxHash: d.lastTxHash,
    status: d.status,
    inspectedAt: d.inspectedAt,
    inspectorName: d.inspectorName,
    inspectorNote: d.inspectorNote,
    attestationUID: d.attestationUID,
    createdAt: d.createdAt,
  }));
}

export async function getCheckpointById(
  id: string
): Promise<CheckpointRecord | null> {
  const mdb = await getMongoDb();
  const doc = await mdb.collection<CheckpointRecord>("checkpoints").findOne({ id });
  if (!doc) return null;
  return {
    id: doc.id,
    batchAttestationUID: doc.batchAttestationUID,
    routePlan: doc.routePlan,
    checkpointName: doc.checkpointName,
    location: doc.location,
    estimatedArrival: doc.estimatedArrival,
    lastTxHash: doc.lastTxHash,
    status: doc.status,
    inspectedAt: doc.inspectedAt,
    inspectorName: doc.inspectorName,
    inspectorNote: doc.inspectorNote,
    attestationUID: doc.attestationUID,
    createdAt: doc.createdAt,
  };
}

export async function updateCheckpointInspection(params: {
  id: string;
  status: "INSPECTED_OK" | "FLAGGED_TAMPERED";
  inspectorName: string;
  inspectorNote?: string;
  attestationUID?: string;
  newTxHash?: string;
}): Promise<CheckpointRecord | null> {
  const now = new Date().toISOString();
  const mdb = await getMongoDb();
  const updateDoc: Record<string, unknown> = {
    status: params.status,
    inspectedAt: now,
    inspectorName: params.inspectorName,
    inspectorNote: params.inspectorNote || "",
    attestationUID: params.attestationUID || null,
  };
  if (params.newTxHash) {
    updateDoc.lastTxHash = params.newTxHash;
  }
  await mdb
    .collection("checkpoints")
    .updateOne({ id: params.id }, { $set: updateDoc });
  return getCheckpointById(params.id);
}
