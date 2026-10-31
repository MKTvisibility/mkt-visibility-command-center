# Visibility research and client portal

Business profile → Visibility Check → Run Free Visibility Check starts public web research for the selected business. It also launches the existing HTML SEO audit when a website is present. Research remains a draft; missing or inaccessible evidence is not a negative score.

Research covers identity, official accounts found through search and site links, company background/articles, customer search phrases, content opportunities and three local competitors with review themes. Report text boxes accept team corrections. Save report draft before approval. Snapshot cards, strengths, opportunities, priority actions, channel notes and closing invitation are editable.

## Connections

- `OPENAI_API_KEY`: existing Supabase Edge Function secret, required for automatic research. Usage is billed to the API account. ChatGPT subscription access alone is insufficient.
- `SERPAPI_API_KEY`: optional server secret for numeric Google placement checks. Up to six customer queries are requested with city-level Colorado localization, US/English/desktop. Organic and local results are reported separately. Missing provider, failed queries and no matching domain are explicitly disclosed. Generic web search is never called a measured Google ranking. No new provider subscription is created by this implementation.
- Gmail: existing MKT Visibility OAuth connection in AI Workforce → Email tools. The portal confirmation flow verifies mktvisibility@gmail.com, previews exact recipient/subject/body, checks that the saved reply is unchanged and atomically claims one send. Uncertain delivery is held for reconciliation; no automatic retry or background sender.
- Square checkout is not connected by this change. Client service selections are inquiries with a policy acknowledgement and no card charge. Payment links/invoices and paid-order webhook verification still need to be wired before the portal can accept paid orders and calculate a verified payment-based cancellation deadline. Do not mark an inquiry paid or call submission time the start of the 72-hour period.

## Approval and access

Approve & publish requires an enabled owner/editor, a matching saved research run, explicit accuracy review and a 12–128-character password. Only allowlisted client report fields enter an immutable archive. A unique research-run constraint prevents reapproving altered content under the same version. Saved versions missing a link can have one created without reapproval. Password resets end existing sessions; revocation is checked on every request. Existing PDF-only links remain supported.

The client URL uses the public GitHub Pages application shell. The internal hosted Command Center stays private. Report payloads are delivered only by the password-authenticated backend, never embedded in public HTML. Passwords are PBKDF2 hashes with per-link salts; temporary session tokens are stored only in React memory and as hashes in the database. Public/anonymous clients cannot read portal database tables directly. Sign-in attempts are limited, sessions expire after one hour, and request submissions are rate limited and deduplicated.

## Requests and calls

The client can select one-time/ongoing service support, ask a question, request a 30-minute call or submit cancellation details. All submissions create an internal follow-up task when possible and appear in that business's portal inbox. The connected MKT mailbox also attempts one internal notification email to mktvisibility@gmail.com; a failed notification does not lose the saved request. Duplicate submissions do not resend notifications. Existing public email: mktvisibility@gmail.com.

Mountain Time regular hours are Monday, Tuesday, Wednesday and Friday, 10:00–16:00; the entire call must fit in the window (last start 15:30). Other times are explicitly after-hours requests. All requests await team confirmation. Tim or Michelle can approve a future call or save alternative availability and preview/send an email. Confirmation creates an Appointment Manager task and atomically checks existing confirmed portal calls and existing scheduled Appointment Manager tasks for the assignee. An already confirmed call is changed through Appointment Manager. No calendar or email actions are executed while implementing/testing.

## Refund disclosure

Policy page: `refund-information.html`. It describes a 72-hour cancellation request window measured from payment; any deduction is the original processing fee actually retained by Square, where allowed, without inventing a separate cancellation fee. Mandatory legal rights are preserved. Inquiry acknowledgement is recorded with policy version and timestamp. No refunds are issued automatically.

## Validation

Focused tests cover research identity, source-backed ratings, the research-start UI, public snapshot allowlisting, Mountain Time/DST and invalid dates, Google domain matching/unknowns, anonymous database denial, appointment conflicts/idempotency, and the client service request/policy flow. Four older full-suite UI failures were reproduced against unchanged commit 6c12d33 (appointments-tab, email-approvals-ui, profile-ratings-ui and general ui); they predate this change. Build and lint are checked separately.

Supabase advisors: new portal tables intentionally have RLS with no public policies and grants revoked from anon/authenticated; they are service-only behind the authenticated function. Existing advisories concern pg_net extension placement, the intentional cc_has_access security-definer helper and disabled Auth leaked-password protection; this change does not alter those settings.

## Durable research recovery

Research now submits a background Responses API job and persists its provider response ID. The existing minute worker collects completed responses even when the browser is closed; active profiles can also request collection. Every collection attempt uses a database lease. Network interruptions preserve the job, and report/research unique job indexes prevent duplicate saved results. New clicks reuse an active business job. The former 110-second foreground deadline is removed; each submission/poll is short. The UI continues polling for up to 35 minutes and shows saved progress; the provider job has a 30-minute safety deadline. Only public business research input is submitted, with store=false and temporary provider retention required for background polling.
