# MKT Visibility Command Center

Complete React/Vite source exported from Site version 21, source commit de3efaca41a7a1db9c9e856651cc7ab3631fec8a.

Includes the combined dashboard, five business dashboards, individual Colorado town profiles, client listings, sales pipeline, task priorities and completion evidence, notes/replies, statistics and Supabase authentication/RLS integration.

## Run

Use Node 22.12+ or Node 24. Run `npm ci` then `npm run dev`.

Copy `.env.example` to ignored `.env.local` and set the existing Supabase project URL and browser-safe publishable key, or enter these on the app connection screen. Sign in with an approved Supabase account. Never use a secret or service-role key in the frontend.

Run `npm test` for checks and `npm run build` for production output. Dependency versions are captured in package-lock.json; npm ci installs the exact dependency tree. node_modules is not committed.

## Existing records

This export contains no live client records, task records, private notes, database dump, sessions, passwords or secret credentials. Existing data remains in the existing Supabase project. Use that same project to retain records and approved account access. Exporting does not modify the live Site or database.

Do not rerun the initial migration on the existing database. SQL files are schema/setup references for new installations or reviewed missing migrations. Apply only changes not already present.

## Deploy

Build command: npm run build. Output directory: dist. Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in the hosting provider's build settings. These are public browser configuration. Keep database passwords and service-role keys out of Git and the frontend. .openai/hosting.json preserves the original Site identity and is not required by other static hosts.

Current partnership: Michelle and Tim.
