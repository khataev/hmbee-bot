# HM Bee Bot CLI Usage

This document describes how to use the CLI for source synchronization.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure your environment:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set `TOCHKA_COOKIE` to the full Tochka `cookie` header value, `TOCHKA_CUSTOMER_ID` to your Tochka customer id, and Honey Money credentials in `HM_USER_EMAIL` and `HM_USER_TOKEN`.

3. Review the data source config:
   ```bash
   cat config/sources.json
   ```
   Adjust the Tochka `customerId` if your account uses a different value.

## Commands

### List Sources
See supported data sources:
```bash
npx tsx src/index.ts list
```

### Sync Records
Fetch records from a source for a specific period:

```bash
npx tsx src/index.ts sync tochka --from 2026-04-01 --to 2026-04-30
```

#### Options
- `--format <adapted|raw>`: Choose between adapter-shaped data (default) or raw response.
- `--out <path>`: Write output to a file instead of STDOUT.

#### Example: Save raw Tochka data
```bash
npx tsx src/index.ts sync tochka --from 2026-04-01 --to 2026-04-30 --format raw --out ./tochka-raw.json
```

## Running against Example Data
The Tochka adapter currently makes real requests. To test the CLI structure without a real session, you can observe the validation failures or mock the adapter for local development.

## Apply to Honey Money
Preview the mapped Honey Money draft for synchronized Tochka records:

```bash
npx tsx src/index.ts apply tochka --preview
```

Send identified income and expense records to Honey Money and print created Honey Money transaction ids:

```bash
npx tsx src/index.ts apply tochka
```

Limit saving to a specific subset of identified source transaction ids:

```bash
npx tsx src/index.ts apply tochka --only-id 4223584703,4223565341
```

The Tochka to Honey Money account mapping is configured in `config/sources.json`.
