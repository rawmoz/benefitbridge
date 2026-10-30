# BenefitBridge SoCal

AI benefits navigator for Los Angeles, Orange, Riverside, and San Bernardino counties. Built for HackGlobal 2026.

A user describes their situation in plain language. Claude handles the conversation and builds a household profile; a rules engine (not the AI) checks eligibility against curated program data in `data/`.

## Setup

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000.

## Data

- `data/programs.json` — statewide California programs and rules
- `data/fpl.json` — Federal Poverty Level table
- `data/counties/*.json` — offices, food banks, utilities, local programs per county
- `data/zip_to_county.json` — ZIP → county lookup

Every entry should include a `source_url` and `last_verified` date.
