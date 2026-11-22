import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "veridose";

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

export function isMongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI?.trim());
}

export async function getMongoClient(): Promise<MongoClient> {
  const connectionUri = process.env.MONGODB_URI?.trim();
  if (!connectionUri) {
    throw new Error("MONGODB_URI environment variable is not configured.");
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      client = new MongoClient(connectionUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
      });
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  } else {
    if (!clientPromise) {
      client = new MongoClient(connectionUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
      });
      clientPromise = client.connect();
    }
    return clientPromise;
  }
}

export async function getMongoDb(): Promise<Db> {
  const c = await getMongoClient();
  return c.db(dbName);
}

let indexesEnsured = false;
export async function ensureMongoIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  try {
    await Promise.all([
      db.collection("users").createIndex({ email: 1 }, { unique: true }),
      db.collection("tags").createIndex({ uid: 1 }, { unique: true }),
      db.collection("tags").createIndex({ batchAttestationUID: 1 }),
      db.collection("medicines").createIndex({ name: 1 }, { unique: true }),
      db.collection("checkpoints").createIndex({ batchAttestationUID: 1 }),
      db.collection("offchainHandoffs").createIndex({ batchAttestationUID: 1 }),
      db.collection("demoRoles").createIndex({ role: 1 }, { unique: true }),
    ]);
    indexesEnsured = true;
  } catch (err) {
    console.warn("MongoDB index creation non-fatal error:", err);
  }
}
