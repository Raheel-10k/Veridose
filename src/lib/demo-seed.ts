import { randomUUID } from "crypto";
import {
  clearDemoData,
  createTag,
  getDemoRoleRecord,
  listDemoRoles,
  setDemoRoleAtpUid,
} from "./db";
import { peekServerEnv } from "./env";
import {
  anchorBatchAttestation,
  issueATPAttestation,
} from "./eas";
import {
  generateAesKeyHex,
  generateSimulatedTapUrl,
  generateTagUid,
} from "./nfc-crypto";
import { BatchStatus } from "./constants";

export async function loadPreSeededDemoScenario() {
  const env = peekServerEnv();
  await clearDemoData();

  const roles = await listDemoRoles();
  const atpResults: Record<string, string | null> = {};

  if (env.RELAYER_PRIVATE_KEY && env.ATP_SCHEMA_UID) {
    for (const role of roles) {
      if (role.role === "Regulator") {
        atpResults[role.role] = role.atpAttestationUID;
        continue;
      }
      try {
        const result = await issueATPAttestation({
          entity: role.address,
          role: role.role,
          licenseId: role.licenseId,
          active: true,
        });
        await setDemoRoleAtpUid(role.role, result.uid);
        atpResults[role.role] = result.uid;
      } catch (err) {
        atpResults[role.role] = null;
        console.warn(`ATP seed failed for ${role.role}`, err);
      }
    }
  }

  let batchAttestationUID: string;
  let txHash = "";
  let explorerUrl = "";
  let onChain = false;

  if (env.RELAYER_PRIVATE_KEY && env.BATCH_SCHEMA_UID) {
    try {
      const anchored = await anchorBatchAttestation({
        drugName: "Amoxicillin 500mg",
        lotNumber: "DEMO-LOT-001",
        status: BatchStatus.VALID,
        evidenceCID: "demo:seed:amoxicillin",
      });
      batchAttestationUID = anchored.uid;
      txHash = anchored.txHash;
      explorerUrl = anchored.explorerUrl;
      onChain = true;
    } catch (err) {
      console.warn("On-chain batch seed failed; using local placeholder UID", err);
      batchAttestationUID = `0xdemo${randomUUID().replace(/-/g, "").slice(0, 60)}`;
    }
  } else {
    batchAttestationUID = `0xdemo${randomUUID().replace(/-/g, "").slice(0, 60)}`;
  }

  const uid = generateTagUid();
  const aesKeyHex = generateAesKeyHex();
  const tag = await createTag({
    uid,
    batchAttestationUID,
    drugName: "Amoxicillin 500mg",
    lotNumber: "DEMO-LOT-001",
    aesKeyHex,
    lastCounter: 0,
  });

  const tapUrl = generateSimulatedTapUrl(uid, aesKeyHex, 1);

  return {
    onChain,
    roles: await listDemoRoles(),
    manufacturer: await getDemoRoleRecord("Manufacturer"),
    pharmacist: await getDemoRoleRecord("Pharmacist"),
    atpResults,
    tag,
    batchAttestationUID,
    txHash,
    explorerUrl,
    simulateTapUrl: tapUrl,
    message:
      "Demo scenario loaded: Amoxicillin 500mg / DEMO-LOT-001 with NFC tag ready for simulate scan.",
  };
}
