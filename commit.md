# VeriDose Lite — Atomic Commit Sequence

Blueprint for building the Base.md prototype as many small, TypeScript-clean slices.
**Do not treat this file as executed git history** — it is the planned sequence and human time estimates.
Actual git commits are optional and only when explicitly requested.

---

## Decisions

- **Framework:** Next.js 14+ App Router, TypeScript, Tailwind CSS, Lucide Icons
- **Web3:** `@ethereum-attestation-service/eas-sdk` + `ethers` v6 on Base Sepolia (`chainId: 84532`)
- **Persistence:** `better-sqlite3` → `data/veridose.db` via `src/lib/db.ts`
- **Crypto:** Node `crypto` AES-128 CMAC (8-byte truncated SUN over `uid || counter`)
- **Writes:** server-side relayer (`RELAYER_PRIVATE_KEY`); UI Role Switcher; no MetaMask required for judges
- **Hardcoded constants:**
  - `EAS_CONTRACT_ADDRESS = 0x4200000000000000000000000000000000000021`
  - `SCHEMA_REGISTRY_ADDRESS = 0x4200000000000000000000000000000000000020`
  - `EAS_EXPLORER_URL = https://base-sepolia.easscan.org`

---

## Env vars (source table)

| Variable | Used by | Purpose | Where to get it |
|---|---|---|---|
| `BASE_SEPOLIA_RPC_URL` | `src/lib/eas.ts`, `scripts/register-schemas.ts`, chain-touching API routes | JSON-RPC to Base Sepolia | Default: `https://sepolia.base.org` ([Base network docs](https://docs.base.org/docs/network-information)). Optional: Alchemy/QuickNode Base Sepolia URL from their dashboards. |
| `RELAYER_PRIVATE_KEY` | Server-only: `eas.ts`, issue/flag routes, register-schemas, demo role derivation | Sponsored testnet signer for EAS attest/revoke/register | Generate throwaway wallet (`cast wallet new` or MetaMask). Fund via [Base Sepolia faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet). **Never commit the real key.** |
| `ATP_SCHEMA_UID` | `issueATPAttestation`, ATP checks, demo seed | Schema UID for `ATP_Credential` | Printed by `npx tsx scripts/register-schemas.ts`; also on [base-sepolia.easscan.org](https://base-sepolia.easscan.org) |
| `BATCH_SCHEMA_UID` | `anchorBatchAttestation`, flag/recall, verify | Schema UID for `Batch_Status` | Same as above |
| `CUSTODY_SCHEMA_UID` | off-chain custody sign/verify, handoff API | Schema UID for `Custody_Handoff` | Same as above |
| `NEXT_PUBLIC_APP_URL` (optional) | Simulated tap absolute URLs in prod | Public app origin | Your deploy URL (e.g. Vercel) |

---

## External APIs / SDK methods

**EAS SDK (`@ethereum-attestation-service/eas-sdk`) + ethers v6**

- `JsonRpcProvider(BASE_SEPOLIA_RPC_URL)` + `Wallet(RELAYER_PRIVATE_KEY, provider)`
- `SchemaRegistry.register({ schema, resolverAddress, revocable })`
- `SchemaEncoder` + `eas.attest(...)` / `eas.revoke(...)` / `eas.getAttestation(uid)`
- `eas.getOffchain()` → `signOffchainAttestation` / `verifyOffchainAttestationSignature`
- Explorer: `${EAS_EXPLORER_URL}/attestation/view/${uid}`

**App Router HTTP APIs**

- `POST /api/batches/issue`
- `POST /api/batches/handoff`
- `POST /api/batches/flag`
- `GET /api/verify`
- `POST /api/nfc/simulate`

**Local crypto:** Node `crypto` AES-128 CMAC in `src/lib/nfc-crypto.ts`

---

## Totals

| Metric | Value |
|---|---|
| Atomic commits | 39 |
| Estimated human time | **~32 hours** focused solo work |
| Suggested pace | ~8–10 atomic slices/day with compile gates ≈ 4 calendar days |
| Gate rule | After each slice: TypeScript/`next build` clean; summarize what landed |

### Macro → atomic map

| Base.md | Atomic | Theme |
|---|---|---|
| Commit 1 | 01–08 | Scaffold, env, SQLite, demo roles |
| Commit 2 | 09–15 | EAS client + schema registration |
| Commit 3 | 16–19 | NFC CMAC engine |
| Commit 4 | 20–25 | API routes |
| Commit 5 | 26–31 | Role dashboard panels |
| Commit 6 | 32–35 | `/verify` + offline mode |
| Commit 7 | 36–39 | Demo seed + README |

### Judge demo path (requires commits 01–39 complete + funded `.env`)

1. Load pre-seeded demo (or issue batch as Manufacturer)
2. Simulate patient NFC scan → green VERIFIED AUTHENTIC
3. Distributor signs cold-chain handoff (zero gas)
4. Simulate cloned label replay → red CLONE DETECTED
5. Pharmacist flags/recalls → amber/red DO NOT DISPENSE + EASScan link

---

## Sequence

### Commit 001 — Scaffold Next.js App Router + TypeScript + Tailwind

- **Message:** `chore: scaffold Next.js App Router with TypeScript and Tailwind`
- **Base.md:** Commit 1
- **Est. time:** 45 min
- **Env:** none yet
- **APIs:** none
- **Files:** `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`
- **Delivers:** `create-next-app` style app boots with `npm run dev`
- **Verify:** `npm run build` succeeds

### Commit 002 — Add Web3 and persistence dependencies

- **Message:** `chore: add eas-sdk, ethers v6, better-sqlite3, lucide-react`
- **Base.md:** Commit 1
- **Est. time:** 20 min
- **Env:** none
- **APIs:** package installs only
- **Files:** `package.json`, `package-lock.json`
- **Delivers:** deps available; `@types/better-sqlite3` if needed
- **Verify:** `tsc` resolves imports

### Commit 003 — Base Sepolia constants and .env.example

- **Message:** `chore: add Base Sepolia constants and env example`
- **Base.md:** Commit 1
- **Est. time:** 25 min
- **Env:** documents all five required vars + optional `NEXT_PUBLIC_APP_URL`
- **APIs:** none (constants only)
- **Files:** `.env.example`, `src/lib/constants.ts`, `.gitignore` (`.env*`, `data/`)
- **Delivers:** EAS/registry/explorer/chainId constants; example env
- **Verify:** constants compile

### Commit 004 — Domain types for tags, handoffs, roles

- **Message:** `feat(db): define Tag, OffchainHandoff, and DemoRole types`
- **Base.md:** Commit 1
- **Est. time:** 30 min
- **Env:** none
- **APIs:** none
- **Files:** `src/lib/types.ts`
- **Delivers:** typed shapes matching Base.md persistence model + batch status enum
- **Verify:** types export cleanly

### Commit 005 — SQLite bootstrap and tags CRUD

- **Message:** `feat(db): bootstrap SQLite and implement tags CRUD`
- **Base.md:** Commit 1
- **Est. time:** 50 min
- **Env:** none (local file DB)
- **APIs:** `better-sqlite3`
- **Files:** `src/lib/db.ts` (partial), `data/.gitkeep`
- **Delivers:** `tags` table; get/create/update `lastCounter`
- **Verify:** unit smoke via node script or import

### Commit 006 — Off-chain handoffs persistence

- **Message:** `feat(db): persist off-chain custody handoffs`
- **Base.md:** Commit 1
- **Est. time:** 35 min
- **Env:** none
- **APIs:** `better-sqlite3`
- **Files:** `src/lib/db.ts`
- **Delivers:** `offchainHandoffs` insert/list-by-batch
- **Verify:** insert + query round-trip

### Commit 007 — Demo roles table and seeding helper

- **Message:** `feat(db): seed demo roles from relayer-derived wallets`
- **Base.md:** Commit 1
- **Est. time:** 45 min
- **Env:** `RELAYER_PRIVATE_KEY` (optional at seed time; fallback deterministic HD paths)
- **APIs:** `ethers.HDNodeWallet` / `Wallet` for deterministic addresses
- **Files:** `src/lib/db.ts`, `src/lib/demo-roles.ts`
- **Delivers:** Regulator / Manufacturer / Distributor / Pharmacist identities
- **Verify:** four roles with stable addresses

### Commit 008 — Server env loader helper

- **Message:** `feat(config): add typed server env loader`
- **Base.md:** Commit 1
- **Est. time:** 30 min
- **Env:** reads all required vars with clear errors
- **APIs:** none
- **Files:** `src/lib/env.ts`
- **Delivers:** `getServerEnv()` used by EAS + APIs
- **Verify:** missing key throws readable error

### Commit 009 — EAS provider and client factory

- **Message:** `feat(eas): wire Base Sepolia EAS client factory`
- **Base.md:** Commit 2
- **Est. time:** 40 min
- **Env:** `BASE_SEPOLIA_RPC_URL`, `RELAYER_PRIVATE_KEY`
- **APIs:** `JsonRpcProvider`, `Wallet`, `EAS`, `SchemaRegistry`
- **Files:** `src/lib/eas.ts` (factory)
- **Delivers:** `getEas()`, `getSchemaRegistry()`, `getRelayerSigner()`
- **Verify:** types compile against eas-sdk

### Commit 010 — issueATPAttestation

- **Message:** `feat(eas): issue on-chain ATP_Credential attestations`
- **Base.md:** Commit 2
- **Est. time:** 45 min
- **Env:** `ATP_SCHEMA_UID`, RPC, relayer key
- **APIs:** `SchemaEncoder`, `eas.attest`
- **Files:** `src/lib/eas.ts`
- **Delivers:** `{ uid, txHash }` for entity/role/licenseId/active
- **Verify:** function signature + encode path compiles

### Commit 011 — anchorBatchAttestation

- **Message:** `feat(eas): anchor Batch_Status attestations on Base Sepolia`
- **Base.md:** Commit 2
- **Est. time:** 45 min
- **Env:** `BATCH_SCHEMA_UID`, RPC, relayer key
- **APIs:** `SchemaEncoder`, `eas.attest`
- **Files:** `src/lib/eas.ts`
- **Delivers:** encodes `batchHash, drugName, status, evidenceCID` → `{ uid, txHash }`
- **Verify:** compiles

### Commit 012 — updateOrFlagBatchAttestation

- **Message:** `feat(eas): flag or recall batches via refUID attestations`
- **Base.md:** Commit 2
- **Est. time:** 50 min
- **Env:** `BATCH_SCHEMA_UID`
- **APIs:** `eas.attest` with `refUID`; optional `eas.revoke`
- **Files:** `src/lib/eas.ts`
- **Delivers:** status 1/2 updates referencing original batch UID
- **Verify:** compiles

### Commit 013 — Off-chain custody attestation create + verify helpers

- **Message:** `feat(eas): create and verify off-chain Custody_Handoff EIP-712 attestations`
- **Base.md:** Commit 2
- **Est. time:** 60 min
- **Env:** `CUSTODY_SCHEMA_UID`
- **APIs:** `eas.getOffchain()`, `signOffchainAttestation`, `verifyOffchainAttestationSignature`
- **Files:** `src/lib/eas.ts`
- **Delivers:** portable JSON attestation + signature check
- **Verify:** compiles

### Commit 014 — verifyBatchFullState

- **Message:** `feat(eas): verify full batch state from on-chain + off-chain proofs`
- **Base.md:** Commit 2
- **Est. time:** 75 min
- **Env:** schema UIDs, RPC
- **APIs:** `eas.getAttestation`, off-chain verify, DB handoff list
- **Files:** `src/lib/eas.ts`
- **Delivers:** origin status, revocation, linked flags, custody validity
- **Verify:** compiles

### Commit 015 — Schema registration script

- **Message:** `feat(scripts): register ATP, Batch, and Custody schemas on Base Sepolia`
- **Base.md:** Commit 2
- **Est. time:** 50 min
- **Env:** `BASE_SEPOLIA_RPC_URL`, `RELAYER_PRIVATE_KEY`
- **APIs:** `SchemaRegistry.register` × 3
- **Files:** `scripts/register-schemas.ts`, `package.json` script entry
- **Delivers:** prints paste-ready `ATP_SCHEMA_UID=...` etc.
- **Verify:** script typechecks with `tsx`

### Commit 016 — AES-128 CMAC primitive

- **Message:** `feat(nfc): implement AES-128 CMAC truncate helper`
- **Base.md:** Commit 3
- **Est. time:** 90 min
- **Env:** none
- **APIs:** Node `crypto` (AES-CBC + CMAC per NIST SP 800-38B)
- **Files:** `src/lib/nfc-crypto.ts` (partial)
- **Delivers:** 8-byte truncated CMAC over message bytes
- **Verify:** known-vector or self-roundtrip test

### Commit 017 — generateSimulatedTapUrl

- **Message:** `feat(nfc): generate simulated SUN tap URLs`
- **Base.md:** Commit 3
- **Est. time:** 40 min
- **Env:** optional `NEXT_PUBLIC_APP_URL` for absolute URLs
- **APIs:** local CMAC
- **Files:** `src/lib/nfc-crypto.ts`
- **Delivers:** `/verify?uid=&counter=&cmac=`
- **Verify:** URL parses + CMAC length 16 hex chars

### Commit 018 — verifyNfcTap with clone detection

- **Message:** `feat(nfc): verify taps and detect cloned label replays`
- **Base.md:** Commit 3
- **Est. time:** 75 min
- **Env:** none
- **APIs:** DB tag lookup + CMAC compare (constant-time)
- **Files:** `src/lib/nfc-crypto.ts`
- **Delivers:** `AUTHENTIC_TAG` | `INVALID_SIGNATURE` | `CLONED_REPLAY_DETECTED`; advances `lastCounter`
- **Verify:** compile + logic branches covered by comments/tests

### Commit 019 — Shared verdict types for verify pipeline

- **Message:** `feat(verify): add unified trust verdict types`
- **Base.md:** Commit 3–4
- **Est. time:** 25 min
- **Env:** none
- **APIs:** none
- **Files:** `src/lib/verdicts.ts`
- **Delivers:** `VERIFIED_AUTHENTIC`, `CLONE_REPLAY_DETECTED`, `FLAGGED_SUSPICIOUS`, `RECALLED`, `TAMPERED`
- **Verify:** exports compile

### Commit 020 — Shared API helpers (JSON errors, explorer links)

- **Message:** `feat(api): add JSON helpers and EASScan link builders`
- **Base.md:** Commit 4
- **Est. time:** 30 min
- **Env:** none (uses constants)
- **APIs:** none
- **Files:** `src/lib/api.ts`
- **Delivers:** `jsonOk` / `jsonError` / `attestationExplorerUrl`
- **Verify:** compiles

### Commit 021 — POST /api/batches/issue

- **Message:** `feat(api): issue batch anchors and mint NFC tags`
- **Base.md:** Commit 4
- **Est. time:** 75 min
- **Env:** `BATCH_SCHEMA_UID`, RPC, relayer
- **APIs:** `anchorBatchAttestation`, `generateSimulatedTapUrl`, DB insert
- **Files:** `src/app/api/batches/issue/route.ts`
- **Delivers:** attestationUID, txHash, explorer URL, initial tap URL, tag uid
- **Verify:** route typechecks

### Commit 022 — POST /api/batches/handoff

- **Message:** `feat(api): create gasless off-chain custody handoffs`
- **Base.md:** Commit 4
- **Est. time:** 60 min
- **Env:** `CUSTODY_SCHEMA_UID`
- **APIs:** `createOffchainCustodyAttestation`, verify signature, DB save
- **Files:** `src/app/api/batches/handoff/route.ts`
- **Delivers:** downloadable signed attestation JSON
- **Verify:** route typechecks

### Commit 023 — POST /api/batches/flag

- **Message:** `feat(api): flag or recall batches on-chain as pharmacist`
- **Base.md:** Commit 4
- **Est. time:** 60 min
- **Env:** `BATCH_SCHEMA_UID`, `ATP_SCHEMA_UID`
- **APIs:** ATP check + `updateOrFlagBatchAttestation`
- **Files:** `src/app/api/batches/flag/route.ts`
- **Delivers:** status 1/2 attestation with evidence note + explorer link
- **Verify:** route typechecks

### Commit 024 — GET /api/verify

- **Message:** `feat(api): unified NFC + EAS verify endpoint`
- **Base.md:** Commit 4
- **Est. time:** 75 min
- **Env:** schema UIDs, RPC
- **APIs:** `verifyNfcTap`, `verifyBatchFullState`
- **Files:** `src/app/api/verify/route.ts`
- **Delivers:** unified trust verdict payload for UI
- **Verify:** route typechecks

### Commit 025 — POST /api/nfc/simulate

- **Message:** `feat(api): simulate next tap and cloned replay URLs`
- **Base.md:** Commit 4
- **Est. time:** 45 min
- **Env:** optional app URL
- **APIs:** `generateSimulatedTapUrl`, DB lastCounter
- **Files:** `src/app/api/nfc/simulate/route.ts`
- **Delivers:** `mode: next | replay` responses
- **Verify:** route typechecks

### Commit 026 — App shell and medical aesthetic tokens

- **Message:** `feat(ui): apply VeriDose medical supply-chain aesthetic shell`
- **Base.md:** Commit 5
- **Est. time:** 60 min
- **Env:** none
- **APIs:** none
- **Files:** `src/app/globals.css`, `src/app/layout.tsx`, fonts
- **Delivers:** CSS variables, typography, layout chrome with brand-forward header
- **Verify:** page renders

### Commit 027 — Active Role Switcher

- **Message:** `feat(ui): add Manufacturer Distributor Pharmacist Patient role switcher`
- **Base.md:** Commit 5
- **Est. time:** 45 min
- **Env:** none
- **APIs:** none (client state)
- **Files:** `src/components/RoleSwitcher.tsx`, `src/app/page.tsx`
- **Delivers:** top switcher drives visible panel
- **Verify:** client compiles

### Commit 028 — Manufacturer panel

- **Message:** `feat(ui): manufacturer batch issue panel with simulate actions`
- **Base.md:** Commit 5
- **Est. time:** 2 hr
- **Env:** indirect via APIs
- **APIs:** `POST /api/batches/issue`, `POST /api/nfc/simulate`
- **Files:** `src/components/ManufacturerPanel.tsx`
- **Delivers:** drug/lot form, EASScan link, simulate scan + clone replay buttons
- **Verify:** UI builds

### Commit 029 — Distributor panel

- **Message:** `feat(ui): distributor cold-chain handoff panel`
- **Base.md:** Commit 5
- **Est. time:** 90 min
- **Env:** indirect
- **APIs:** `POST /api/batches/handoff`
- **Files:** `src/components/DistributorPanel.tsx`
- **Delivers:** select batch, facilities + temp, downloadable JSON, verified badge
- **Verify:** UI builds

### Commit 030 — Pharmacist panel

- **Message:** `feat(ui): pharmacist flag and recall panel`
- **Base.md:** Commit 5
- **Est. time:** 75 min
- **Env:** indirect
- **APIs:** `POST /api/batches/flag`
- **Files:** `src/components/PharmacistPanel.tsx`
- **Delivers:** ATP badge display + one-click flag/recall
- **Verify:** UI builds

### Commit 031 — Wire dashboard page to panels

- **Message:** `feat(ui): compose role dashboard on home page`
- **Base.md:** Commit 5
- **Est. time:** 40 min
- **Env:** none
- **APIs:** client fetch to local APIs
- **Files:** `src/app/page.tsx`
- **Delivers:** full command dashboard
- **Verify:** `next build`

### Commit 032 — Verify page trust banner states

- **Message:** `feat(verify): render authentic clone and recall trust banners`
- **Base.md:** Commit 6
- **Est. time:** 2 hr
- **Env:** none (reads query + API)
- **APIs:** `GET /api/verify`
- **Files:** `src/app/verify/page.tsx`, `src/components/TrustBanner.tsx`
- **Delivers:** green / red / amber banners with counter mismatch and EASScan links
- **Verify:** page builds

### Commit 033 — Verify page query parsing (uid/counter/cmac + picc)

- **Message:** `feat(verify): accept SUN and picc_data NFC query formats`
- **Base.md:** Commit 6
- **Est. time:** 45 min
- **Env:** none
- **APIs:** `GET /api/verify`
- **Files:** `src/app/verify/page.tsx`, `src/lib/nfc-query.ts`
- **Delivers:** supports `uid/counter/cmac` and `picc_data/cmac`
- **Verify:** parser unit smoke

### Commit 034 — localStorage verification cache

- **Message:** `feat(verify): cache verified batches in localStorage`
- **Base.md:** Commit 6
- **Est. time:** 50 min
- **Env:** none
- **APIs:** browser `localStorage`
- **Files:** `src/lib/offline-cache.ts`, verify page wiring
- **Delivers:** store successful verifies for offline reuse
- **Verify:** compiles

### Commit 035 — Offline Clinic Mode toggle

- **Message:** `feat(verify): add Offline Clinic Mode for network-loss simulation`
- **Base.md:** Commit 6
- **Est. time:** 90 min
- **Env:** none
- **APIs:** cached local verify path (no RPC when offline mode on)
- **Files:** `src/app/verify/page.tsx`, `src/components/OfflineToggle.tsx`
- **Delivers:** toggle forces cache-only verification path
- **Verify:** UI builds

### Commit 036 — Demo seed API

- **Message:** `feat(demo): add API to load pre-seeded demo scenario`
- **Base.md:** Commit 7
- **Est. time:** 75 min
- **Env:** all schema UIDs + relayer (for optional on-chain ATP seed; graceful if missing)
- **APIs:** EAS ATP/batch helpers, DB seed
- **Files:** `src/app/api/demo/seed/route.ts`, `src/lib/demo-seed.ts`
- **Delivers:** deterministic demo batch + tag + roles
- **Verify:** route typechecks

### Commit 037 — Load Pre-Seeded Demo button

- **Message:** `feat(ui): add Load Pre-Seeded Demo Scenario control`
- **Base.md:** Commit 7
- **Est. time:** 35 min
- **Env:** indirect
- **APIs:** `POST /api/demo/seed`
- **Files:** `src/components/DemoSeedButton.tsx`, dashboard wiring
- **Delivers:** one-click demo load for judges
- **Verify:** UI builds

### Commit 038 — Batch list helper API for panels

- **Message:** `feat(api): list anchored batches for distributor and pharmacist panels`
- **Base.md:** Commit 5–7
- **Est. time:** 40 min
- **Env:** none
- **APIs:** DB read
- **Files:** `src/app/api/batches/route.ts`
- **Delivers:** `GET /api/batches` for UI selects
- **Verify:** route typechecks

### Commit 039 — README and judge walkthrough

- **Message:** `docs: add setup README and five-step judge walkthrough`
- **Base.md:** Commit 7
- **Est. time:** 75 min
- **Env:** documents full env table + faucet + register-schemas
- **APIs:** documents all routes
- **Files:** `README.md`
- **Delivers:** `npm install`, `.env`, schema script, `npm run dev`, Vercel notes, 5-step script
- **Verify:** docs match implemented paths

---

## Implementation note

When executing this blueprint in the workspace: land all code as working-tree changes following commits 001→039 order. Create real `git commit`s only if explicitly requested. After the full build, operators still must fund the relayer and run `scripts/register-schemas.ts` to populate schema UIDs for live Base Sepolia demos.
