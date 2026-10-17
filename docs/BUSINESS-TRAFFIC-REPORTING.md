# Loving Longmont business reporting

Use a business's **Edit & publish the live business page → Business traffic & sponsorship report** section. The report defaults to its first known listing date through yesterday, allows a shorter date range, and exports CSV with sources and limitations. Google Analytics is the data source; the server uses the existing read-only connection. Visitors means GA4 active users. Whole-site visitors are audience context, not visitors to that business. Never sum daily active users to produce a monthly unique-visitor count.

## Listing dates

`MKTvisibility/LovingLongmont/assets/reporting/listing-dates.json` preserves dates independently of `published_at`, which changes on republishing. Initial entries use the earliest exact business-name mention in available website HTML revision history, falling back to the available publication timestamp when no mention is found. These are **first known dates**, not a claim that no listing existed before repository records. Entries include an evidence commit. The page publisher inserts a missing entry once, never overwrites an existing baseline, and reports publication separately from a date-write problem. A failed date write can be retried by publishing again. No production database changes were made.

## Measurement coverage

All 163 current root HTML pages carry Google tag `G-85GTDQHKLW`. Every page includes the shared header, which loads `assets/business-analytics.mjs`. Future pages copied from `business.html` inherit coverage. The module initializes the tag only if no gtag function exists, avoiding a second configured pageview. Its source mirror is `src/lib/site-business-analytics.mjs`; keep the website copy synchronized when modifying it.

Custom events added October 17, 2026:

| Event | Meaning |
|---|---|
| `ll_profile_view` | Profile rendered; deduplicated per business per page load |
| `ll_listing_impression` | At least half of a listing visible continuously for one second; once per business per page load |
| `ll_profile_open` | Click from a business listing card |
| `ll_business_click` | Website, phone, email or social link clicked from a business profile |
| `ll_sponsor_interest` | Click on a sponsorship call to action; not a purchase |

No email address, phone number, destination query string or visitor identifier is added to these custom event parameters. The script does not run on file previews and honors Do Not Track for its custom events. Standard Analytics measurement remains governed by existing Analytics settings. Blockers, browser choices and consent can prevent collection.

## One-time Google Analytics owner setup

In property **558375784 (Loving Longmont)**:

1. Admin → Data display → Custom definitions → Create custom dimension. Create event-scoped dimensions for `business_id`, `action_type`, and `placement` with those exact event parameter names. Descriptive display names are fine. `business_id` and `action_type` are needed for the report's exposure and contact-action breakdowns. Do not delete existing dimensions.
2. Check the website data stream's Enhanced measurement settings. Keep page views and outbound clicks enabled. Custom `ll_business_click` is a separate event; do not add standard `click` counts to it, which would double-count the same action.
3. Verify Realtime/DebugView using a named business page and its website/contact links. Allow 24–48 hours for processed custom reports after dimension registration. Missing custom dimensions appear as **Not available**, never as invented zero counts.
4. Review data retention for explorations (14 months if suitable). Standard aggregate reports and retention of user-level exploration data are different. Decide separately whether to set up a long-term raw-data export; this update does not enable a billable Google Cloud service.
5. Establish an internal-traffic filter for Michelle/Tim if desired; test it before activation. Existing reporting can include owner visits.

Analytics installation is recorded as October 11, 2026 UTC (October 10 Mountain). Earlier visits cannot be reconstructed. Custom engagement events begin with this deployment. Historical `business.html#id=...` visits cannot be separated by the standard page-path dimension because fragments are not part of it. New `ll_profile_view` events identify profiles by business ID.

## Campaign attribution

Use UTM parameters on campaign links, e.g. `?utm_source=instagram&utm_medium=dm&utm_campaign=listing_followup_2026_11`. Keep campaign names consistent. Do not put recipients' names, emails or other personal details in URLs. A report measures recorded exposure and actions, not guaranteed leads, purchases or sales.
