# VeriDose Lite

Pharmaceutical anti-counterfeit & recall prototype on **Base Sepolia** using:

- Rolling NFC SUN-style URLs (AES-128 CMAC + monotonic counters)
- Ethereum Attestation Service (EAS) for public `ATP_Credential` / `Batch_Status` anchors
- Gasless EIP-712 off-chain `Custody_Handoff` attestations
- Sponsored testnet relayer (no MetaMask required for judges)

See [`Base.md`](Base.md) for product vision and [`commit.md`](commit.md) for the atomic build sequence + time estimates.

## Quick start

```bash
npm install
cp .env.example .env
# edit .env — see table below
npx tsx scripts/register-schemas.ts   # requires funded RELAYER_PRIVATE_KEY
# paste printed ATP_SCHEMA_UID / BATCH_SCHEMA_UID / CUSTODY_SCHEMA_UID into .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Where to get it |
|---|---|---|
| `BASE_SEPOLIA_RPC_URL` | Recommended | Default `https://sepolia.base.org` ([Base docs](https://docs.base.org/docs/network-information)). Optional Alchemy/QuickNode Base Sepolia URL. |
| `RELAYER_PRIVATE_KEY` | Yes for writes | Throwaway wallet private key. Fund via [Base Sepolia faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet). Never commit the real key. |
| `ATP_SCHEMA_UID` | Yes for ATP/seed | Printed by `npx tsx scripts/register-schemas.ts` / [EASScan](https://base-sepolia.easscan.org) |
| `BATCH_SCHEMA_UID` | Yes for issue/flag | Same |
| `CUSTODY_SCHEMA_UID` | Yes for handoffs | Same |
| `NEXT_PUBLIC_APP_URL` | Optional | Public origin for absolute simulate URLs (e.g. Vercel URL) |

**Hardcoded Base Sepolia constants**

- EAS: `0x4200000000000000000000000000000000000021`
- Schema Registry: `0x4200000000000000000000000000000000000020`
- Explorer: `https://base-sepolia.easscan.org`
- Chain ID: `84532`

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run register-schemas` | Register the 3 EAS schemas and print `.env` lines |

## API routes

- `POST /api/batches/issue` — manufacturer batch + NFC tag mint
- `POST /api/batches/handoff` — off-chain custody attestation
- `POST /api/batches/flag` — pharmacist flag (1) / recall (2)
- `GET /api/batches` — list anchored batches for UI
- `GET /api/verify` — NFC + EAS unified verdict
- `POST /api/nfc/simulate` — next tap or clone replay URL
- `POST /api/demo/seed` — load pre-seeded demo scenario
- `GET /api/roles` — demo role identities

## Judge walkthrough (5 steps)

1. Click **Load Pre-Seeded Demo Scenario** (or issue a batch as Manufacturer).
2. Click **Simulate Patient Scan** → `/verify` shows green **VERIFIED AUTHENTIC**.
3. Switch to **Distributor**, sign a cold-chain handoff, download the JSON proof (zero gas).
4. From Manufacturer, click **Simulate Cloned Label Replay** → red **CLONE / REPLAY DETECTED**.
5. Switch to **Pharmacist**, flag or recall → amber/red **DO NOT DISPENSE** with EASScan link.

## Physical NFC tags (prototype)

VeriDose treats a **blank NFC sticker** (NTAG213/215/216) as a medicine batch label by writing the signed `/verify?uid=&counter=&cmac=` URL onto it (Web NFC).

1. **Manufacturer** issues a batch → **Write batch URL to NFC tag** → hold sticker to an Android phone (Chrome, NFC on, HTTPS or localhost).
2. **Patient / Scanner** → **Scan NFC Tag** (or let Android open the URL on tap) → trust banner on `/verify`.
3. First successful scan consumes that counter; tapping the **same written URL** again shows **CLONE / REPLAY DETECTED**.

Requirements: Chrome on Android + NFC. Desktop browsers cannot use Web NFC — use the Simulate buttons instead. True NTAG 424 DNA SUN hardware still works if it opens the same query URL format.

## Vercel notes

- `better-sqlite3` uses a local `data/veridose.db` file. On Vercel’s ephemeral filesystem this will not persist across instances — fine for short demos; for production swap `src/lib/db.ts` to LibSQL/Turso or another KV.
- Set all env vars in the Vercel project settings.
- Mark native module as external (already configured via `serverComponentsExternalPackages`).

## License

Hackathon prototype — provided as-is.
