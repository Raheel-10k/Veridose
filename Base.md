# Project: VeriDose Lite — End-to-End Pharmaceutical Anti-Counterfeit & Recall Prototype on Base Sepolia

## 1. Product Vision & Problem Context
We are building **VeriDose Lite**, a working Web3 hackathon prototype that solves the two fatal flaws of existing pharmaceutical track-and-trace systems (like static QR/barcodes):
1. **Physical Label Cloning:** Static QR codes only prove a serial number exists—counterfeiters photocopy valid codes onto fake medicine boxes, poisoning track-and-trace logs. We solve this using **dynamic rolling cryptographic URLs** (modeled on NXP NTAG 424 DNA SUN / AES-128 CMAC + monotonic tap counters), where every physical tap increments a counter and signs a fresh message; replaying a copied URL fails immediately.
2. **Commercial Opacity & Delayed Recalls:** Manufacturers and distributors refuse to publish sensitive route/volume data on public ledgers, while substandard batches take months to pull from pharmacies. We solve this using **Ethereum Attestation Service (EAS)** on **Base Sepolia**:
   - **On-chain public anchors** for Authorized Trading Partner (`ATP_Credential`) licenses and `Batch_Status` (Valid / Flagged Suspicious / Recalled).
   - **Off-chain EIP-712 signed attestations** for private distributor cold-chain & custody handoffs (zero gas, verifiable signature without leaking route details on-chain).
   - **Offline-resilient local verification cache** (`localStorage`/IndexedDB) so clinics/hospitals with intermittent internet do not lock up during dispensing.

## 2. Critical UX Constraint: Zero-Friction Testnet Prototype
A real user or hackathon judge opening our public URL on their phone or laptop must be able to test the **entire end-to-end flow** without installing MetaMask extensions, switching networks, or begging faucets for Base Sepolia ETH:
- **Reads (`/verify`):** Public RPC read from Base Sepolia (`https://sepolia.base.org`) + off-chain EIP-712 signature check—requires zero wallet and zero gas.
- **Writes (Manufacturer Issue, Pharmacist Flag, Regulator Recall):** Backed by a **server-side sponsored testnet relayer wallet** (`RELAYER_PRIVATE_KEY` in `.env`) calling EAS on Base Sepolia, paired with a clean **Role Switcher** in the UI (`Regulator`, `Manufacturer`, `Distributor`, `Pharmacist`, `Patient`) so any tester can execute real Base Sepolia transactions in 1 click and inspect live `base-sepolia.easscan.org` links.
- **NFC Hardware + Remote Simulator:** Support real URL query parameters (`?uid=...&counter=...&cmac=...` and `?picc_data=...&cmac=...`) for physical NTAG 424 DNA stickers, PLUS a built-in **"Simulate NFC Tap"** (mints next valid counter + AES-128 CMAC) and **"Simulate Cloned Label Replay"** (replays previous URL) so remote judges without physical NFC tags can test the exact cryptography.

## 3. Tech Stack & Verified Base Sepolia Constants
- **Framework:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, Lucide Icons.
- **Web3 / Attestations:** `@ethereum-attestation-service/eas-sdk`, `ethers` (v6).
- **Network:** Base Sepolia (`chainId: 84532`, RPC: `https://sepolia.base.org`).
- **Pre-deployed EAS Contracts on Base Sepolia:**
  - `EAS_CONTRACT_ADDRESS = "0x4200000000000000000000000000000000000021"`
  - `SCHEMA_REGISTRY_ADDRESS = "0x4200000000000000000000000000000000000020"`
  - `EAS_EXPLORER_URL = "https://base-sepolia.easscan.org"`
- **Persistence:** SQLite (via `better-sqlite3` or Prisma/LibSQL) or clean file/KV adapter for local dev & serverless persistence storing:
  - Registered NFC tags (`uid`, `batchAttestationUID`, `aesKeyHex`, `lastCounter`)
  - Demo ATP entities & off-chain signed custody attestations.

## 4. EAS Schemas to Register & Use
1. **`ATP_Credential` Schema:**
   - Definition: `address entity, string role, string licenseId, bool active`
   - Purpose: Proves an entity is a licensed Manufacturer, Distributor, or Pharmacist. Revocable (`true`).
2. **`Batch_Status` Schema:**
   - Definition: `bytes32 batchHash, string drugName, uint8 status, string evidenceCID`
   - Status Enum: `0 = VALID`, `1 = FLAGGED_SUSPICIOUS`, `2 = RECALLED`
   - Purpose: Public, immutable origin and live recall status of a pharmaceutical batch. Revocable (`true`).
3. **`Custody_Handoff` Schema (Used for Off-Chain EIP-712 Attestations):**
   - Definition: `bytes32 batchAttestationUID, string fromFacility, string toFacility, string tempRangeC, uint64 handoffTimestamp`
   - Purpose: Gasless off-chain cryptographic proof of cold-chain custody transfer.

---

## 5. Step-by-Step Commit Execution Plan
Execute this project strictly commit-by-commit. After completing each commit, ensure TypeScript compiles cleanly with zero errors, summarize what was built, and ask for confirmation before moving to the next commit.

### Commit 1: Project Scaffold, Environment Config & Persistent Tag/Attestation Store
- Initialize Next.js (App Router, TypeScript, Tailwind CSS) with `@ethereum-attestation-service/eas-sdk` and `ethers`.
- Create `.env.example` with `BASE_SEPOLIA_RPC_URL`, `RELAYER_PRIVATE_KEY`, `ATP_SCHEMA_UID`, `BATCH_SCHEMA_UID`, and `CUSTODY_SCHEMA_UID`.
- Build `src/lib/db.ts` to persist:
  - `tags`: `{ uid: string, batchAttestationUID: string, drugName: string, lotNumber: string, aesKeyHex: string, lastCounter: number, createdAt: string }`
  - `offchainHandoffs`: `{ id: string, batchAttestationUID: string, signedAttestationJson: string, signer: string, createdAt: string }`
  - `demoRoles`: pre-seeded demo wallets/identities (`Regulator`, `Manufacturer`, `Distributor`, `Pharmacist`) with deterministic addresses derived from `RELAYER_PRIVATE_KEY` (or dedicated demo keys) so the prototype works out of the box.

### Commit 2: Base Sepolia EAS Client & Schema Registration Script
- Create `src/lib/eas.ts` wrapping `@ethereum-attestation-service/eas-sdk` connected to Base Sepolia (`0x4200000000000000000000000000000000000021`):
  - `issueATPAttestation(...)` -> creates on-chain `ATP_Credential` attestation and returns `{ uid, txHash }`.
  - `anchorBatchAttestation(...)` -> encodes `Batch_Status` via `SchemaEncoder`, calls `eas.attest(...)`, and returns `{ uid, txHash }`.
  - `updateOrFlagBatchAttestation(...)` -> creates a referenced status attestation (`refUID: originalBatchUID`) or revokes via `eas.revoke(...)` when recalled/flagged.
  - `createOffchainCustodyAttestation(...)` -> uses `eas.getOffchain()` + `signOffchainAttestation(...)` to produce a portable EIP-712 off-chain attestation.
  - `verifyBatchFullState(batchAttestationUID)` -> fetches on-chain attestation via `eas.getAttestation(uid)`, checks `revocationTime`, fetches any linked flag/recall updates, and verifies stored off-chain custody signatures via `verifyOffchainAttestationSignature(...)`.
- Create `scripts/register-schemas.ts` using `SchemaRegistry` (`0x4200000000000000000000000000000000000020`) to register all 3 schemas on Base Sepolia in one command and print the exact `.env` lines to paste.

### Commit 3: NTAG 424 DNA Rolling Counter & AES-128 CMAC Cryptographic Engine
- Create `src/lib/nfc-crypto.ts` implementing dynamic SUN (Secure Unique NFC) message generation and verification using Node's native `crypto` module (`aes-128-cbc` / AES-CMAC per NIST SP 800-38B / NXP AN12196):
  - `generateSimulatedTapUrl(uid, aesKeyHex, nextCounter, baseUrl)` -> computes a valid 8-byte truncated AES-128 CMAC over `uid + counter` and returns `/verify?uid=...&counter=...&cmac=...`.
  - `verifyNfcTap(uid, counter, cmac)` -> looks up `aesKeyHex` and `lastCounter` in `db.ts`, verifies the CMAC in constant time, and checks `counter > lastCounter`.
    - If CMAC is invalid -> returns `{ status: "INVALID_SIGNATURE", authentic: false }`.
    - If `counter <= lastCounter` -> returns `{ status: "CLONED_REPLAY_DETECTED", authentic: false, previousCounter: lastCounter }`.
    - If valid and `counter > lastCounter` -> atomically updates `lastCounter = counter` in `db.ts` and returns `{ status: "AUTHENTIC_TAG", authentic: true, counter }`.

### Commit 4: Backend API Routes (Anchor, Handoff, Tap Verify, Simulate & Flag)
- Build clean Next.js App Router API endpoints under `src/app/api/`:
  - `POST /api/batches/issue`: Manufacturer anchors a new medicine batch on Base Sepolia via `anchorBatchAttestation(...)`, generates an NFC tag UID + random 16-byte `aesKeyHex` (`lastCounter = 0`), saves to `db.ts`, and returns the `attestationUID`, `txHash`, Explorer URL, and initial simulated tap URL.
  - `POST /api/batches/handoff`: Distributor creates a gasless off-chain EIP-712 `Custody_Handoff` attestation (`fromFacility`, `toFacility`, `tempRangeC`), verifies its signature, and attaches it to the batch.
  - `POST /api/batches/flag`: Licensed Pharmacist (verified against `ATP_Credential`) submits a `FLAGGED_SUSPICIOUS` (`status = 1`) or `RECALLED` (`status = 2`) on-chain attestation referencing `batchAttestationUID` with an evidence note.
  - `GET /api/verify`: Accepts `?uid=...&counter=...&cmac=...` (or `?batchUid=...` for direct lookup), runs `verifyNfcTap(...)` + `verifyBatchFullState(...)`, and returns the unified trust verdict (`VERIFIED_AUTHENTIC`, `CLONE_REPLAY_DETECTED`, `FLAGGED_SUSPICIOUS`, `RECALLED`, or `TAMPERED`).
  - `POST /api/nfc/simulate`: Helper endpoint for testers without physical NFC stickers—either mints the next valid tap (`counter = lastCounter + 1`) or returns the last already-spent URL to demonstrate clone detection.

### Commit 5: Role-Based Command Dashboard (Manufacturer, Distributor, Pharmacist & Regulator)
- Build `src/app/page.tsx` with a clear, high-trust medical/supply-chain aesthetic and a top **Active Role Switcher** (`Manufacturer`, `Distributor`, `Pharmacist`, `Patient / Scanner`):
  - **Manufacturer Panel:** Form to issue a batch (e.g., *Amoxicillin 500mg*, *Artemether-Lumefantrine*, lot number, expiry), triggers real Base Sepolia EAS transaction, displays live `easscan.org` link, and shows the minted NFC tag + **"Simulate Patient Scan"** and **"Simulate Cloned Label Replay"** test buttons.
  - **Distributor Panel:** Select an anchored batch and sign a zero-gas off-chain cold-chain custody attestation, with a downloadable JSON proof and verified EIP-712 badge.
  - **Pharmacist Panel:** Shows active `ATP_Credential` badge on Base Sepolia and provides a 1-click **"Flag Substandard / Adverse Batch"** button that immediately updates on-chain batch status.

### Commit 6: Patient & Dispensary Mobile Verification Screen + Offline Resilience Mode
- Build `src/app/verify/page.tsx` optimized for mobile scanning:
  - Displays a prominent, unambiguous trust banner:
    - Green **`VERIFIED AUTHENTIC`** (Valid rolling NFC counter + Valid Base Sepolia EAS origin + Active Manufacturer ATP + Verified Off-Chain Cold-Chain Handoff).
    - Red **`COUNTERFEIT WARNING: CLONED LABEL / REPLAY DETECTED`** (Explains exact counter mismatch: e.g., `Scanned Counter #1 <= Last Recorded Counter #1`).
    - Amber/Red **`DO NOT DISPENSE: BATCH FLAGGED / RECALLED ON-CHAIN`** (Shows pharmacist/regulator attestation UID and `easscan.org` link).
  - **Offline Hospital Resilience:** Automatically caches verified batch attestations in `localStorage`. Add an **"Offline Clinic Mode"** toggle on the `/verify` page that simulates network loss (`navigator.onLine = false`) and verifies cached batches locally without RPC lockups.

### Commit 7: Demo Seed Data, Guided End-to-End Walkthrough & README
- Add a **"Load Pre-Seeded Demo Scenario"** button and `README.md` with exact setup steps (`npm install`, `.env` configuration, `npx tsx scripts/register-schemas.ts`, `npm run dev`, and Vercel deployment notes) plus a 5-step judge walkthrough script.