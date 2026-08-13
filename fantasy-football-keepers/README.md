# 2026 Fantasy Football Keeper Portal

A mobile-first keeper selection app styled like a modern sportsbook/fantasy product.

## What it does
- Leaguemate selects their fantasy team.
- App loads their end-of-2025 roster and 2026 keeper point values.
- They can select up to **3 keepers** with an **8-point maximum**.
- Submission is stored in your Notion database: **2026 Keeper Submissions**.
- Returning users select the same team and their current picks load automatically; resubmitting updates the same Notion row.
- NFL player headshots are matched from Sleeper's public player data when available.

## Deploy on Vercel
1. Create a new GitHub repo and put these files in it (or drag the folder into Vercel if using its CLI).
2. In Notion, create an **internal integration** at the Notion developer portal with read + insert + update content capabilities.
3. Copy the integration secret.
4. Open the **2026 Keeper Submissions** database in Notion → `•••` → **Connections / Add connections** → add your integration.
5. In Vercel, import the repo and add an environment variable:
   - `NOTION_TOKEN` = your Notion integration secret
6. Deploy.

The app is already pointed at the Notion data source created for this league:
`1e84f325-7453-43c1-a74f-2bbeb1b0be48`

## Local development
```bash
cp .env.example .env.local
npm install
npm run dev
```
Then open http://localhost:3000.

## Security note
This version intentionally has no login/PIN to keep league use frictionless. Anyone with the URL can select any team and update that team's submission. If you want, add per-team PINs or private team-specific links before sending it out.

## Keeper rule config
The UI and API both have:
- `MAX_POINTS = 8`
- `MAX_KEEPERS = 3`

Change both constants if league rules change.
