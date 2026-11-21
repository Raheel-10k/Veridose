import { HDNodeWallet, Mnemonic, Wallet } from "ethers";
import type { DemoRoleName } from "./types";

const ROLE_ORDER: DemoRoleName[] = [
  "Regulator",
  "Manufacturer",
  "Depot",
  "Distributor",
  "Pharmacist",
];

const LICENSE_BY_ROLE: Record<DemoRoleName, string> = {
  Regulator: "REG-BASE-001",
  Manufacturer: "MFG-FDA-4421",
  Depot: "DEPOT-MFG-0089",
  Distributor: "DIST-GDP-8890",
  Pharmacist: "PHARM-NABP-3312",
};

/**
 * Deterministic demo wallets from a fixed mnemonic so the prototype works
 * out of the box. Relayer key (when present) remains the on-chain attester;
 * demo addresses stay stable for UI ATP badges.
 */
export function deriveDemoRoles(relayerPrivateKey?: string) {
  if (relayerPrivateKey) {
    const key = relayerPrivateKey.startsWith("0x")
      ? relayerPrivateKey
      : `0x${relayerPrivateKey}`;
    // Touch relayer construction so misconfigured keys fail early at seed time.
    void new Wallet(key).address;
  }

  const mnemonic = Mnemonic.fromPhrase(
    "test test test test test test test test test test test junk"
  );
  const root = HDNodeWallet.fromMnemonic(mnemonic);

  return ROLE_ORDER.map((role, index) => {
    const child = root.deriveChild(index);
    return {
      role,
      address: child.address,
      licenseId: LICENSE_BY_ROLE[role],
      privateKey: child.privateKey,
    };
  });
}

export function getDemoRole(role: DemoRoleName, relayerPrivateKey?: string) {
  return deriveDemoRoles(relayerPrivateKey).find((r) => r.role === role)!;
}
