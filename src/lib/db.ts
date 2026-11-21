import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { deriveDemoRoles } from "./demo-roles";
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

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "veridose.db");

let dbInstance: Database.Database | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;
  ensureDataDir();
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      uid TEXT PRIMARY KEY,
      batchAttestationUID TEXT NOT NULL,
      drugName TEXT NOT NULL,
      lotNumber TEXT NOT NULL,
      aesKeyHex TEXT NOT NULL,
      lastCounter INTEGER NOT NULL DEFAULT 0,
      batchStatus INTEGER NOT NULL DEFAULT 0,
      flagAttestationUID TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS offchainHandoffs (
      id TEXT PRIMARY KEY,
      batchAttestationUID TEXT NOT NULL,
      signedAttestationJson TEXT NOT NULL,
      signer TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS demoRoles (
      role TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      licenseId TEXT NOT NULL,
      atpAttestationUID TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      salt TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      orgName TEXT NOT NULL,
      facilityName TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS medicines (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      defaultDosage TEXT,
      category TEXT,
      createdBy TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS checkpoints (
      id TEXT PRIMARY KEY,
      batchAttestationUID TEXT NOT NULL,
      routePlan TEXT NOT NULL,
      checkpointName TEXT NOT NULL,
      location TEXT NOT NULL,
      estimatedArrival TEXT NOT NULL,
      lastTxHash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'SCHEDULED',
      inspectedAt TEXT,
      inspectorName TEXT,
      inspectorNote TEXT,
      attestationUID TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_handoffs_batch
      ON offchainHandoffs(batchAttestationUID);
    CREATE INDEX IF NOT EXISTS idx_users_email
      ON users(email);
    CREATE INDEX IF NOT EXISTS idx_checkpoints_batch
      ON checkpoints(batchAttestationUID);
  `);

  // Lightweight migrations for iterative local DBs
  const tagCols = db
    .prepare("PRAGMA table_info(tags)")
    .all() as Array<{ name: string }>;
  const names = new Set(tagCols.map((c) => c.name));
  if (!names.has("batchStatus")) {
    db.exec(
      "ALTER TABLE tags ADD COLUMN batchStatus INTEGER NOT NULL DEFAULT 0"
    );
  }
  if (!names.has("flagAttestationUID")) {
    db.exec("ALTER TABLE tags ADD COLUMN flagAttestationUID TEXT");
  }

  seedDemoRoles(db);
  seedMedicines(db);
  seedDefaultUsers(db);
  dbInstance = db;
  return db;
}

function seedDemoRoles(db: Database.Database) {
  const relayer = process.env.RELAYER_PRIVATE_KEY?.trim();
  const roles = deriveDemoRoles(relayer);
  const insert = db.prepare(`
    INSERT OR IGNORE INTO demoRoles (role, address, licenseId, atpAttestationUID, createdAt)
    VALUES (@role, @address, @licenseId, NULL, @createdAt)
  `);
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    for (const role of roles) {
      insert.run({
        role: role.role,
        address: role.address,
        licenseId: role.licenseId,
        createdAt: now,
      });
    }
  });
  tx();
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function seedMedicines(db: Database.Database) {
  // Let organizations decide their own medicine values, names, dosages, and types.
  // We do not force static pre-seeded medicines into the catalog table.
  const existing = db.prepare("SELECT COUNT(*) AS c FROM medicines").get() as {
    c: number;
  };
  if (existing.c > 0) return;
}

function seedDefaultUsers(db: Database.Database) {
  const existing = db.prepare("SELECT COUNT(*) AS c FROM users").get() as {
    c: number;
  };
  if (existing.c > 0) return;

  const defaultUsers: Array<{
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

  const insert = db.prepare(`
    INSERT INTO users (id, email, passwordHash, salt, name, role, orgName, facilityName, createdAt)
    VALUES (@id, @email, @passwordHash, @salt, @name, @role, @orgName, @facilityName, @createdAt)
  `);

  const now = new Date().toISOString();
  for (const u of defaultUsers) {
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = hashPassword("password123", salt);
    insert.run({
      id: crypto.randomUUID(),
      email: u.email,
      passwordHash,
      salt,
      name: u.name,
      role: u.role,
      orgName: u.orgName,
      facilityName: u.facilityName,
      createdAt: now,
    });
  }
}

// User / Auth DB Helpers
export function getUserByEmail(email: string): (UserRecord & { passwordHash: string; salt: string }) | null {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE lower(email) = lower(?)")
    .get(email) as (UserRecord & { passwordHash: string; salt: string }) | undefined;
  return row ?? null;
}

export function getUserById(id: string): UserRecord | null {
  const row = getDb()
    .prepare("SELECT id, email, name, role, orgName, facilityName, createdAt FROM users WHERE id = ?")
    .get(id) as UserRecord | undefined;
  return row ?? null;
}

export function createUser(params: {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  orgName?: string;
  facilityName?: string;
}): UserRecord {
  const db = getDb();
  const id = crypto.randomUUID();
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(params.password, salt);
  const now = new Date().toISOString();
  const user: UserRecord = {
    id,
    email: params.email.trim().toLowerCase(),
    name: params.name.trim(),
    role: params.role,
    orgName: params.orgName?.trim() || (params.role === "Depot" ? "PharmaCorp Global" : `${params.name} Org`),
    facilityName: params.facilityName?.trim() || (params.role === "Depot" ? "Central Depot Facility" : "Main Facility"),
    createdAt: now,
  };

  db.prepare(`
    INSERT INTO users (id, email, passwordHash, salt, name, role, orgName, facilityName, createdAt)
    VALUES (@id, @email, @passwordHash, @salt, @name, @role, @orgName, @facilityName, @createdAt)
  `).run({
    ...user,
    passwordHash,
    salt,
  });

  return user;
}

export function verifyUserPassword(email: string, password: string): UserRecord | null {
  const user = getUserByEmail(email);
  if (!user) return null;
  const hash = hashPassword(password, user.salt);
  if (crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(user.passwordHash))) {
    const { passwordHash: _ignoredPassword, salt: _ignoredSalt, ...safeUser } = user;
    void _ignoredPassword;
    void _ignoredSalt;
    return safeUser;
  }
  return null;
}

// Medicine Catalog DB Helpers
export function listMedicines(): MedicineCatalogRecord[] {
  return getDb()
    .prepare("SELECT * FROM medicines ORDER BY name ASC")
    .all() as MedicineCatalogRecord[];
}

export function addMedicine(params: {
  name: string;
  description?: string;
  defaultDosage?: string;
  category?: string;
  createdBy?: string;
}): MedicineCatalogRecord {
  const db = getDb();
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

  db.prepare(`
    INSERT INTO medicines (id, name, description, defaultDosage, category, createdBy, createdAt)
    VALUES (@id, @name, @description, @defaultDosage, @category, @createdBy, @createdAt)
  `).run(record);

  return record;
}

export function createTag(
  tag: Omit<TagRecord, "createdAt" | "batchStatus" | "flagAttestationUID"> & {
    createdAt?: string;
    batchStatus?: number;
    flagAttestationUID?: string | null;
  }
): TagRecord {
  const db = getDb();
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
  db.prepare(
    `INSERT INTO tags (uid, batchAttestationUID, drugName, lotNumber, aesKeyHex, lastCounter, batchStatus, flagAttestationUID, createdAt)
     VALUES (@uid, @batchAttestationUID, @drugName, @lotNumber, @aesKeyHex, @lastCounter, @batchStatus, @flagAttestationUID, @createdAt)`
  ).run(record);
  return record;
}

export function updateTagBatchStatus(
  batchAttestationUID: string,
  batchStatus: number,
  flagAttestationUID: string
): void {
  getDb()
    .prepare(
      `UPDATE tags SET batchStatus = ?, flagAttestationUID = ? WHERE batchAttestationUID = ?`
    )
    .run(batchStatus, flagAttestationUID, batchAttestationUID);
}

export function getTagByUid(uid: string): TagRecord | null {
  const row = getDb()
    .prepare("SELECT * FROM tags WHERE uid = ?")
    .get(uid.toLowerCase()) as TagRecord | undefined;
  return row ?? null;
}

export function getTagByBatchUid(batchAttestationUID: string): TagRecord | null {
  const found = getDb()
    .prepare("SELECT * FROM tags WHERE batchAttestationUID = ?")
    .get(batchAttestationUID) as TagRecord | undefined;
  return found ?? null;
}

export function listTags(): TagRecord[] {
  return getDb()
    .prepare("SELECT * FROM tags ORDER BY createdAt DESC")
    .all() as TagRecord[];
}

export function updateTagCounter(uid: string, lastCounter: number): void {
  getDb()
    .prepare("UPDATE tags SET lastCounter = ? WHERE uid = ?")
    .run(lastCounter, uid.toLowerCase());
}

export function saveOffchainHandoff(
  handoff: Omit<OffchainHandoffRecord, "createdAt"> & { createdAt?: string }
): OffchainHandoffRecord {
  const record: OffchainHandoffRecord = {
    ...handoff,
    createdAt: handoff.createdAt ?? new Date().toISOString(),
  };
  getDb()
    .prepare(
      `INSERT INTO offchainHandoffs (id, batchAttestationUID, signedAttestationJson, signer, createdAt)
       VALUES (@id, @batchAttestationUID, @signedAttestationJson, @signer, @createdAt)`
    )
    .run(record);
  return record;
}

export function listHandoffsByBatch(
  batchAttestationUID: string
): OffchainHandoffRecord[] {
  return getDb()
    .prepare(
      "SELECT * FROM offchainHandoffs WHERE batchAttestationUID = ? ORDER BY createdAt ASC"
    )
    .all(batchAttestationUID) as OffchainHandoffRecord[];
}

export function listDemoRoles(): DemoRoleRecord[] {
  return getDb()
    .prepare("SELECT * FROM demoRoles ORDER BY role ASC")
    .all() as DemoRoleRecord[];
}

export function getDemoRoleRecord(role: DemoRoleName): DemoRoleRecord | null {
  const row = getDb()
    .prepare("SELECT * FROM demoRoles WHERE role = ?")
    .get(role) as DemoRoleRecord | undefined;
  return row ?? null;
}

export function setDemoRoleAtpUid(
  role: DemoRoleName,
  atpAttestationUID: string
): void {
  getDb()
    .prepare("UPDATE demoRoles SET atpAttestationUID = ? WHERE role = ?")
    .run(atpAttestationUID, role);
}

export function clearDemoData(): void {
  const db = getDb();
  db.exec(`
    DELETE FROM tags;
    DELETE FROM offchainHandoffs;
    DELETE FROM checkpoints;
  `);
}

// Checkpoint and Route DB Helpers
export function createCheckpoint(params: {
  batchAttestationUID: string;
  routePlan: string;
  checkpointName: string;
  location: string;
  estimatedArrival: string;
  lastTxHash?: string;
}): CheckpointRecord {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const lastTxHash = params.lastTxHash || `0x${crypto.randomBytes(32).toString("hex")}`;
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

  db.prepare(`
    INSERT INTO checkpoints (
      id, batchAttestationUID, routePlan, checkpointName, location,
      estimatedArrival, lastTxHash, status, createdAt
    ) VALUES (
      @id, @batchAttestationUID, @routePlan, @checkpointName, @location,
      @estimatedArrival, @lastTxHash, @status, @createdAt
    )
  `).run(record);

  return record;
}

export function listCheckpointsByBatch(batchAttestationUID: string): CheckpointRecord[] {
  return getDb()
    .prepare("SELECT * FROM checkpoints WHERE batchAttestationUID = ? ORDER BY createdAt ASC")
    .all(batchAttestationUID) as CheckpointRecord[];
}

export function listAllCheckpoints(): CheckpointRecord[] {
  return getDb()
    .prepare("SELECT * FROM checkpoints ORDER BY createdAt DESC")
    .all() as CheckpointRecord[];
}

export function getCheckpointById(id: string): CheckpointRecord | null {
  const row = getDb()
    .prepare("SELECT * FROM checkpoints WHERE id = ?")
    .get(id) as CheckpointRecord | undefined;
  return row ?? null;
}

export function updateCheckpointInspection(params: {
  id: string;
  status: "INSPECTED_OK" | "FLAGGED_TAMPERED";
  inspectorName: string;
  inspectorNote?: string;
  attestationUID?: string;
  newTxHash?: string;
}): CheckpointRecord | null {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE checkpoints
    SET status = @status,
        inspectedAt = @inspectedAt,
        inspectorName = @inspectorName,
        inspectorNote = @inspectorNote,
        attestationUID = @attestationUID,
        lastTxHash = COALESCE(@newTxHash, lastTxHash)
    WHERE id = @id
  `).run({
    id: params.id,
    status: params.status,
    inspectedAt: now,
    inspectorName: params.inspectorName,
    inspectorNote: params.inspectorNote || "",
    attestationUID: params.attestationUID || null,
    newTxHash: params.newTxHash || null,
  });

  return getCheckpointById(params.id);
}
