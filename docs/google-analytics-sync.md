# Automatic Google Analytics reporting

The Command Center imports all five GA4 properties daily at **8 AM America/Denver**, accounting for daylight saving time. It refreshes seven daily reports and an independent seven-day total for Active users, Views and Sessions. Daily active-user counts are never added to obtain unique weekly users. Traffic sources and country/city breakdowns are saved with the seven-day report.

## One-time owner setup

1. Open Google Cloud Console with the account that owns the Analytics account. Select or create a project and enable **Google Analytics Data API** (`analyticsdata.googleapis.com`).
2. Under IAM & Admin → Service Accounts, create **Command Center Analytics**. No Google Cloud project role is required for reading GA4 reports. Copy the service-account email.
3. In Google Analytics → Admin → Property access management for each of the five properties below, add that email as **Viewer**. All five are under **MKT Visibility (411410476)**. The owner must explicitly approve granting the dedicated reporting account this read access.
4. In Google Cloud → the service account → Keys → Add key → Create new key → JSON, download the key. If an organization blocks key creation, use an approved alternative; do not weaken the organization policy.
5. In Supabase project `gvmwkltwrlqwbqegieum` → Edge Functions → Secrets, set **GA_SERVICE_ACCOUNT_JSON** to the entire JSON file. Do not send the private key in chat or commit it to GitHub. Only the Edge Function needs it.
6. Reload Command Center → Website & Social Stats → choose a brand → **Refresh now**. Confirm the successful import date and values. Each property's failures are shown independently. The next daily schedule checks all five automatically.

Google Cloud Console could not be reached from the agent browser during implementation. The reporting key and Viewer grant are therefore owner setup steps; deploying this code alone does not mean reports are connected.

## Configured properties

| Brand | Property ID |
|---|---|
| Loving Longmont | 558375784 |
| MKT Colorado | 558329947 |
| MKT Visibility | 558367806 |
| Open Theory Cove | 558417742 |
| Boulder County Photography | 558429449 |

## Implementation and operation

- `sync-google-analytics` accepts a validated user JWT with current enabled workspace membership, or the exact dedicated scheduler token. Gateway JWT verification is off **only because the handler implements both authentication paths**, including cron authorization.
- Viewer members can read connection status. Only owners/editors can refresh. Foreign/revoked memberships and unrecognized brands cannot import. A five-minute lease and one-minute request cooldown avoid duplicate/racing runs.
- Google authentication uses an RS256 service-account assertion with **analytics.readonly** scope. Tokens and keys remain on the backend and are never returned, logged or stored in report notes.
- The dedicated cron token is randomly generated in the database and encrypted in Vault. Its read RPC is granted only to `service_role` and also checks the signed service role claim. Browser roles cannot obtain it.
- Imported statistics use the existing unique workspace/brand/channel/metric/period/source key. Re-running updates values rather than adding duplicate reports. Historical periods remain available. Matching manually captured Google reports for the same period become automatic records after a successful API refresh; manual reports with other sources are untouched.
- Automatic rows are protected from browser inserts/edits by RLS. Each property report is committed atomically with its status and breakdowns. A failed request never replaces old values with zeros. A valid, empty GA response produces a zero report.
- Dates use the Analytics property's reporting timezone returned by Google. Yesterday and the prior six days are refreshed to account for delayed processing. The recent period may still revise. No hostname or internal-traffic exclusion is applied; development/admin visits can be included.
- Source/location detail is limited to the top 20 rows and is subject to Google's privacy thresholds. Those rows should not be added to reconstruct the property total.
- A single Cron job runs at 13:00 and 14:00 UTC; its SQL calls the Edge Function only when it is 8 AM in Denver. Missing credentials produce `needs_setup`, never a false successful import.
- To pause: disable the `cc-google-analytics-daily` Cron job. To revoke access: remove the service account from Analytics and delete its Google key. Rotate the Supabase secret when replacing a key. Existing saved reports remain available.

## Validation

Tests exercise authorization, malformed/partial Google responses, timezone boundaries, independent weekly user totals, transactional rollback, period deduplication and browser RLS protections. The full application suite, lint and production build must pass. An actual Google Data API import remains the final verification after owner setup.

References: [Google Data API quickstart](https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart), [service-account OAuth](https://developers.google.com/identity/protocols/oauth2/service-account), [Supabase scheduled Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions).
