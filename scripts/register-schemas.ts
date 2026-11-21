/**
 * Registers VeriDose EAS schemas on Base Sepolia and prints .env lines.
 *
 * If a schema was already registered (AlreadyExists), reuses the deterministic UID.
 *
 * Requires:
 *   BASE_SEPOLIA_RPC_URL (default https://sepolia.base.org)
 *   RELAYER_PRIVATE_KEY  (funded Base Sepolia wallet)
 *
 * Run: npm run register-schemas
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { SchemaRegistry } from "@ethereum-attestation-service/eas-sdk";
import { JsonRpcProvider, Wallet, ZeroAddress, formatEther } from "ethers";
import {
  ATP_SCHEMA,
  BATCH_SCHEMA,
  CUSTODY_SCHEMA,
  DEFAULT_RPC_URL,
  SCHEMA_REGISTRY_ADDRESS,
} from "../src/lib/constants";

const ALREADY_EXISTS_SELECTOR = "0x23369fa6";

/** Load .env into process.env (tsx/node do not do this by default). */
function loadDotEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function isAlreadyExistsError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const data = (err as { data?: string }).data;
  if (typeof data === "string" && data.startsWith(ALREADY_EXISTS_SELECTOR)) {
    return true;
  }
  const message = String((err as { message?: string }).message ?? err);
  return (
    message.includes(ALREADY_EXISTS_SELECTOR) ||
    message.toLowerCase().includes("alreadyexists")
  );
}

loadDotEnv();

async function main() {
  const rpc = process.env.BASE_SEPOLIA_RPC_URL?.trim() || DEFAULT_RPC_URL;
  const keyRaw = process.env.RELAYER_PRIVATE_KEY?.trim();
  if (!keyRaw) {
    throw new Error(
      "RELAYER_PRIVATE_KEY is required. Put it in .env then re-run: npm run register-schemas"
    );
  }
  const key = keyRaw.startsWith("0x") ? keyRaw : `0x${keyRaw}`;
  const provider = new JsonRpcProvider(rpc);
  const signer = new Wallet(key, provider);
  const address = await signer.getAddress();
  const balance = await provider.getBalance(address);

  console.log(`Network RPC: ${rpc}`);
  console.log(`Relayer:     ${address}`);
  console.log(`Balance:     ${formatEther(balance)} ETH`);
  console.log(`Registry:    ${SCHEMA_REGISTRY_ADDRESS}`);

  if (balance === BigInt(0)) {
    throw new Error(
      `Relayer ${address} has 0 ETH on Base Sepolia. Fund it via https://portal.cdp.coinbase.com/products/faucet then re-run.`
    );
  }

  const registry = new SchemaRegistry(SCHEMA_REGISTRY_ADDRESS);
  registry.connect(signer);

  const schemas = [
    { env: "ATP_SCHEMA_UID", schema: ATP_SCHEMA },
    { env: "BATCH_SCHEMA_UID", schema: BATCH_SCHEMA },
    { env: "CUSTODY_SCHEMA_UID", schema: CUSTODY_SCHEMA },
  ] as const;

  const lines: string[] = [];

  for (const item of schemas) {
    const expectedUid = SchemaRegistry.getSchemaUID(
      item.schema,
      ZeroAddress,
      true
    );
    console.log(`\nRegistering ${item.env}: ${item.schema}`);

    try {
      const tx = await registry.register({
        schema: item.schema,
        resolverAddress: ZeroAddress,
        revocable: true,
      });
      const uid = await tx.wait();
      console.log(`  uid: ${uid}`);
      console.log(`  tx:  ${tx.receipt?.hash ?? "(pending receipt)"}`);
      lines.push(`${item.env}=${uid}`);
    } catch (err) {
      if (!isAlreadyExistsError(err)) throw err;
      // Schema UID is deterministic — safe to reuse after AlreadyExists.
      const onChain = await registry.getSchema({ uid: expectedUid });
      console.log(`  already registered — reusing uid: ${expectedUid}`);
      console.log(`  on-chain schema: ${onChain.schema}`);
      lines.push(`${item.env}=${expectedUid}`);
    }
  }

  console.log("\n--- Paste into .env ---\n");
  console.log(lines.join("\n"));
  console.log("\n-----------------------\n");
  console.log(
    "These UIDs are already in your .env from the first successful run. You can skip re-running this script."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
