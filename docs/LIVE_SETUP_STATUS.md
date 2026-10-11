# Live setup status

The existing Supabase project is connected. The initial and four additive migrations have been applied. Business profiles, categories, multi-business message history, purchase tracking and listing publication dates are live database capabilities. See DATABASE_MANAGEMENT.md for import counts, preservation rules and automation limits.

Michelle's enabled owner membership was verified. Anonymous table access remains denied. Tim and Kayli still need verified account/membership setup and explicit hosted sharing; no invitations or emails were sent. The hosted website remains owner-private.

Remaining owner settings: disable public signup (last observed enabled) and enable leaked-password protection (security advisor reports disabled). The available database tools do not expose Auth configuration changes. Review https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection for the latter. Public cc_has_access execution is restricted to authenticated users and is intentional for RLS membership evaluation.

Only the connected MKT Gmail mailbox was verified; reviewing the separate Loving Longmont mailbox requires that mailbox's connection. No full message bodies, actual message summaries, credentials or customer import payloads are tracked in source or shipped in static assets.
