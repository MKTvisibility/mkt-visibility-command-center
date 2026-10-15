# Hunter: new-business research and review drafts

Ask Hunter inside AI Workforce: “Research five new Longmont businesses and prepare profiles for Michelle or Tim to review.” Requests outside Longmont go to MKT Colorado; Longmont profiles go to Loving Longmont. A batch can return fewer than five, including zero, when sources are insufficient or duplicates are found.

## Actual operations

Only Hunter has the research_new_businesses tool. It uses the current saved human message and active reply claim, one research run per message, and the existing server-side OpenAI key. It reads the current HTML pages of both MKTvisibility/LovingLongmont and MKTvisibility/Colorado at fixed GitHub revisions, then makes one Responses request with up to two web-search calls. The pipeline requires a completed search and candidate citations present in the provider’s retrieved sources. Missing fields remain blank, all AI-extracted details require human verification, and source URLs, date, uncertainties, run ID and requester are saved.

Website text/name matches are conservatively skipped. A serialized database transaction also compares names, websites, emails and phone numbers against every existing business, including paused/archived records and other batches. Matching is conservative, not a guarantee of identity resolution: rebrands and aliases still need human judgment. Failed website inventory blocks saving rather than silently skipping that check. Website pages are cached for at most five minutes in the function instance.

Only internal business records and Draft listing records are created. No live publication snapshot, image, email approval, email, appointment or external contact is created. Review queue: Dashboard → New businesses to review. Source and uncertainty details appear at the top of each profile. The shared dashboard reloads after Hunter’s reply. Marking reviewed is separate from publishing or approving an email. Database guards block email approval/claim and activating publication snapshots while discovery is Pending review; the GitHub listing endpoint checks the same hold. Hunter has no publish, send, approve, arbitrary SQL or arbitrary URL-fetch tool.

## Budget and recovery

Each discovery request reserves $0.15 in the internal safety ledger, not an actual charge. Maximum three batches per rolling day and $3 of discovery reservations per UTC month (20 batches). Discovery and chat share an $8.50 internal reservation ceiling. Existing research workers or other uses of the business API project have separate accounting; these controls do not constitute a provider-wide hard billing cap. No new subscriptions or recurring research schedule are enabled.

Completed/failed/working requests are durable and cannot start another paid search on retry. If a response is interrupted, ask Hunter “Show my recent business research results” using read_discovery_history, and inspect the existing review queue before making a new request. No automatic provider retry occurs. A run that remains Working after an interruption needs inspection; it is never assumed safe to rerun.

Tests use fake provider results and an actual local PostgreSQL-compatible database; live public GitHub inventory reads are verified separately. No test sends or publishes anything. Live paid research should be exercised by a partner’s actual request inside Command Center.
