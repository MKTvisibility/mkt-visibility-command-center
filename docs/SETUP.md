# MKT Visibility Command Center — live setup

The application is built from Michelle's uploaded React/Vite project. Original navigation and brand colors are retained. A copy of the uploaded App.jsx is in docs/original, and GitHub's existing README is retained in docs/original/repository-README.md. Existing Supabase tables and data are never overwritten.

## Current boundary

The hosted application can be opened and explored in Practice mode. Practice data is fictional, stays in memory, is never sent to Supabase, and resets on reload or leaving the workspace. Do not use it for real client information.

Live mode uses your existing Supabase project. The browser-safe publishable key, live database schema, and approved account user IDs were not supplied. No live migration, account creation, contact import, or inbox connection has been performed. A screenshot of a healthy project is not database-administrator access.

## 1. Apply the database migration

In your existing Supabase project, open SQL Editor > New query. Review and run supabase/migrations/202610110001_command_center.sql (also downloadable as /setup/database.sql from the app).

It adds isolated cc_ tables with row-level security, member-only reads, owner/editor writes, no anonymous access, no browser membership editing, and an append-only audit log. It stops before any changes if Command Center tables already exist. If it stops, inspect existing tables instead of dropping them. Take an appropriate project backup before applying production migrations. Local PostgreSQL security tests do not replace a live-project verification.

## 2. Configure approved accounts

In Authentication settings, disable public sign-ups. In Authentication > Users, use Add user > Create new user to create approved password accounts. Approved partners are Michelle, Tim, and Kayli; verify each person's email with Michelle before creating accounts. No invitation or password-reset email should be sent without separate authorization. Handle passwords outside GitHub and chat.

Copy each created user UUID into supabase/members.example.sql and run the edited SQL as database administrator. Michelle is owner, Tim and Kayli are editors. A viewer role is available for read-only access. Only the SQL administrator can change membership. An Auth account alone does not grant database access.

## 3. Connect the app

Use Settings > API Keys in Supabase to locate the publishable key beginning sb_publishable_. The setup screen accepts only a HTTPS project URL ending .supabase.co and a publishable key. It rejects secret/service-role keys and all legacy JWT keys. Public configuration and auth sessions are stored in sessionStorage for the current browser tab; client records are not cached in browser storage.

For hosted setup, enter the project URL and publishable key in the app's Connection screen, then sign in. These public settings are not committed to GitHub. Each tab can be configured this way until build-time deployment settings are supplied.

For local development, copy .env.example to .env.local and replace its placeholders. Put those lines in the file, not the PowerShell terminal. Run npm ci and npm run dev. Keep .env.local untracked.

## 4. Verify live mode before entering real client data

Sign in as an approved partner. Add a temporary test business, directory listing, email tracking record and follow-up. Check editing, completion, dashboard totals, and CSV export. Refresh and confirm records persist. Archive the test business/listing and cancel the reminder after verification.

Verify a nonmember cannot read or write any cc_ records, a viewer cannot write, and a revoked member loses access. The app checks membership again before writes; Supabase RLS enforces security even if a client is modified. Client sessions are cleared from the workspace on sign-out. Authentication is password-based, without automatic signup, magic links, invitations, or password-reset email sending.

## Daily use

- Clients & Prospects: manage contacts, notes, relationship, sales stage and recurring fees. Archive rather than delete.
- Loving Longmont / MKT Colorado: link listings to businesses, track every page in a comma-separated page list, record listing URL and status. Tracking does not publish site changes.
- Email Campaigns: record drafts, planned outreach, sent messages, bounces, and reply records. Manually confirm sent/replied dates. This is not mailbox sync or open tracking. Nothing sends email.
- Follow-Ups: date-based reminders with owner and completion status. Due counts exclude done/cancelled records. No background notifications are sent.
- Sales Pipeline: change stages and track potential deal value. A Won stage does not automatically set Client status.
- Projects & Tasks: assign work to Michelle, Tim, Kayli or Unassigned.
- Reports: recurring contracted fees, directory counts, manual campaign activity, CSV exports. Recurring fees are not cash collected, profit or take-home pay. Exports contain contacts and should be stored privately.

## Hosting

The delivered URL uses a private ChatGPT Site. It is initially accessible to Michelle's owning account; it is not yet a shared partner URL. Do not change its audience without Michelle's direction. The same Vite project can be deployed to Cloudflare Pages: build command npm run build, output dist. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY as deployment settings. Never use service-role keys. _headers supplies security headers on hosts that support that file. Header enforcement and real browser testing require verification on the chosen final host.

No service worker caches confidential records. A web manifest is supplied; full offline support is deliberately absent. Installation support depends on the browser and final host.

## Actions needing access or approval

Blocked by missing access/settings: live migration, approved Auth account creation, membership IDs, publishable key, and live persistence/RLS verification.

Separate approval required: sending any email; enabling automatic outreach, mailbox access, background notifications; importing real contact files; changing Site sharing to partners/public; changing existing community websites; merging the review branch into main. No such actions were performed.

Cloudflare Pages account access and project selection are needed to deploy on Michelle's own Cloudflare account. The current private Site link is usable for review.
