import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { deriveDemoRoles } from "./demo-roles";
import type {
  DemoRoleName,
  DemoRoleRecord,
  OffchainHandoffRecord,
  TagRecord,
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

    CREATE INDEX IF NOT EXISTS idx_handoffs_batch
      ON offchainHandoffs(batchAttestationUID);
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
  dbInstance = db;
  return db;
}

function seedDemoRoles(db: Database.Database) {
  const existing = db.prepare("SELECT COUNT(*) AS c FROM demoRoles").get() as {
    c: number;
  };
  if (existing.c > 0) return;

  const relayer = process.env.RELAYER_PRIVATE_KEY?.trim();
  const roles = deriveDemoRoles(relayer);
  const insert = db.prepare(`
    INSERT INTO demoRoles (role, address, licenseId, atpAttestationUID, createdAt)
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
  `);
}
