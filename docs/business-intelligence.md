# Business Intelligence and master tasks

Open the existing GitHub Pages Command Center and sign in as Michelle or Tim. Existing workspace membership and publishing remain in place.

## Business Intelligence

- All Businesses connects the existing central business IDs. Directory filters identify Loving Longmont and MKT Colorado placements.
- Research Queue lists assessments never approved or older than 90 days. Select individual businesses, filter a town/category, or queue up to 50 matching unreviewed businesses.
- Research Business / Research Again queues a server job. The worker runs every minute, one queued business per invocation. Active-job uniqueness prevents accidental duplicate requests; overdue leases are marked failed.
- Awaiting Approval shows proposals and partial research. Review each value, source and rating; correct facts, platform criteria, lead signals and notes. Save a review draft or approve. Research proposals never replace approved data.
- Public business changes still use the existing business profile/publishing editor. Approval of private research does not publish changes to either directory.
- A rating needs an explanation and evidence URL. Scores are not fabricated for inaccessible profiles. Criteria unobserved by public research remain unknown. Manual reviewers should verify design, mobile usability, booking, technical performance and social activity.
- Suggested Tasks stays outside the active queue. Accept activates or links to a matching existing task; reject keeps an audit trail.
- CRM details support eight stages, follow-up dates, proposals, assigned team members and potential/actual values. Do Not Contact is permanent and enforced in the database. It does not send emails.
- Existing message summaries are shown on business records. Gmail polling is not configured by this release.

## Scoring

Need = weighted average of known relevant platform weaknesses. 5 stars = 0% need, 4 = 25%, 3 = 50%, 2 = 75%, 1 = 100%. Confirmed relevant missing presence = 100%; unknown, irrelevant and unverified presence excluded.

Potential = average of evidenced service relevance, operating activity, ongoing service fit, expressed interest and confirmed budget fit. Unknowns excluded, never zero-filled. Do not infer budget or willingness to pay.

Priority = known weighted need (40%), potential (35%), contact readiness (15%), previous engagement (10%), normalized to known weights. Categories require known need and potential and at least 65% component coverage. High >=70, Medium >=45, otherwise Low. Suppressed/closed businesses are Not Qualified. Unreviewed assessments are marked provisional.

Scoring Settings changes priority weights (total 100), platform weights and platform criteria. Changes recalculate displayed reports; prior evidence and approved assessments remain saved.

## Master Tasks

All existing tasks keep their IDs, status codes and completion evidence. Master Tasks presents the requested status labels, five-company filters, projects, businesses, assignees, dates, search, priorities, bulk editing, calendar agenda, My Tasks, completed and recurring views.

Task details support descriptions, categories, dependencies, document links, execution type and recurrence. Dependencies use saved task IDs in the same workspace. Tasks cannot be completed while a dependency remains unfinished. Daily/Weekly/Monthly completion creates the next occurrence once, including repeated reopening/completion of the same original task. Historical completion fields remain intact. Attachments are secure document URLs; binary file upload is not included.

## Reports and exports

Business Intelligence > Opportunity Reports provides nine report choices. Business filters and sorting apply to rankings and opportunity tables; dates refer to research dates. Team productivity uses task creation dates. CSV exports filtered records. Print / Save PDF uses the browser's PDF destination. A Visibility Check removes private lead scores and sales notes and identifies drafts. Review before sharing. Printing/exporting does not contact clients.

## One-time cloud research connection

In the existing Supabase project's Edge Function Secrets, add OPENAI_API_KEY. Do not enter it in the public app or Git. Optionally set BI_RESEARCH_MODEL (default gpt-5-mini). This uses the OpenAI Responses API with public web search and incurs provider usage charges. Configure your API project's budget/limits before enabling.

Without the key, the worker records Blocked with setup instructions; it does not pretend research ran. Existing assessments and manual review work normally. After adding the key, queue Research Again for blocked businesses. Validate a single business before processing a large queue.

## Validation and rollback

Additive BI tables are workspace-protected with RLS; anonymous roles have no access. The existing member check bounds reads and editor writes. Server validation protects ratings, provenance, suppression, task dependencies and recurrence. Research jobs cannot overwrite approved data. No secret is in the frontend.

cc_bi_private.backup_20261014 stores pre-migration businesses, tasks and listings inside the database, excluded from public API permissions and Git. An administrator can recover these records after reviewing conflicts. Existing Git history preserves the previous frontend. Roll back the frontend first; keep additive tables to retain research and audit records. Cancel the cc-business-research-worker cron job if research needs to be paused.

External provider research, live authenticated UI actions, Gmail polling and platform-private analytics require their respective connections. Tests with simulated browser/Postgres are distinct from live partner sign-in tests.
