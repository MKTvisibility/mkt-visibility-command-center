# Verification

## Local results

21 automated checks passed, including 11 PostgreSQL security subtests.

- Production Vite build: passed.
- ESLint source checks: passed.
- Domain/repository tests: dashboard calculations, due dates, key validation, safe links, input sanitization, CSV formula escaping, practice isolation, pagination beyond the API row cap, membership rejection.
- PostgreSQL tests use PGlite, an actual PostgreSQL engine, with mock Supabase auth roles and auth.uid(). The migration executes successfully; RLS blocks anonymous/nonmember/revoked access; viewers cannot write; approved editors can write; membership self-promotion and audit tampering are denied; cross-workspace writes fail; constraints and immutable provenance are enforced; rerunning the migration refuses to overwrite existing tables.
- UI checks use a simulated DOM for setup validation, practice create/edit, both listing registers, manual email logging, completing reminders, pipeline stage changes, recurring-fee reporting and leaving/resetting practice mode. Practice mode is tested to make zero network calls.

## Limits

No real-browser visual/responsive QA was performed: the required managed browser-control capability is unavailable. DOM simulation does not verify browser layout, download behavior or hosted security headers.

No live Supabase migration, account creation, password sign-in, session persistence, or real database persistence check was possible without the publishable key, approved user IDs and project administration access. Tests exercise the production SQL locally, not the existing hosted project. No claim is made that the live database is configured.

No emails were sent. No inbox integration, background notifications, community website publication or real business data import was performed. No credentials are present in the committed application source. Live contact records are stored in Supabase, not browser localStorage. Practice mode is in memory only.
