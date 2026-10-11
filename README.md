# MKT Visibility Command Center

A React/Vite partner workspace for MKT Visibility, Loving Longmont and MKT Colorado, built by extending Michelle's existing uploaded application.

## Included

Password authentication with Supabase; administrator-approved workspace membership; database row-level security; clients and prospects; linked community listings; manual email and reply tracking; date-based follow-ups; sales pipeline; projects/tasks; dashboard; CSV reports; audit metadata.

No email-sending implementation, credentials, real client seed data, or automatic website publishing is included. Practice mode is clearly labeled and uses fictional data in memory.

## Run

Requires Node 22.12+ or Node 24. Run `npm ci`, copy `.env.example` to ignored `.env.local` and enter public Supabase settings, then `npm run dev`. Missing settings open the connection screen rather than crashing. Settings can also be entered in the app for the current tab.

- `npm test` — domain, repository, SQL security and DOM interaction checks.
- `npm run lint` — source checks.
- `npm run build` — production build and downloadable setup assets.

See [live setup](docs/SETUP.md), [approval and access record](docs/APPROVALS.md), and [verification results](docs/VERIFICATION.md). Migration is additive and refuses to overwrite any existing cc_ tables. No live Supabase changes have been made without project access.

The existing repository README and uploaded app are preserved under docs/original. Uploaded source assets are retained.
