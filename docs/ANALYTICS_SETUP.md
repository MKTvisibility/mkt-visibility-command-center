# Website and social statistics

The Dashboard and Website & Social Stats page cover MKT Visibility, MKT Colorado, Loving Longmont, Open Theory Cove and Boulder County Photography. Reports are saved in `cc_statistics`, protected by workspace RLS and immutable audit attribution. Owner/editor members may insert/update; viewers may read. Anonymous and unapproved users have no access. Duplicate brand/channel/metric/period/source rows are rejected. Missing values remain unreported; a verified zero is supported. Reporting periods and sources are shown explicitly. Follower counts are snapshots; overlapping periods are never summed. Report history, brand/channel/date filters, manual entry/editing and CSV exports are available.

## Verified setup on October 10, 2026 (America/Denver)

The connected Metricool account exposes the MKT Visibility brand with Facebook and Instagram. Three verified records were imported: Facebook followers 41 and Instagram followers 5 as of October 9; Facebook Page Media View 61 for October 1–9. Metricool fields FBEV17/IGEV01 use LAST; FBEV49 uses SUM across nine returned daily values. Missing daily values for other requested fields were not treated as complete totals. These are saved reports, not live counters. No publishing or email sends occur.

No Google Analytics/Metricool tracking tags were detected in the five fetched homepages. That observation does not prove the absence of existing Google accounts, Search Console properties, or tracking on every page. Other social connections remain unverified. Automatic background synchronization is not enabled; Nova can retrieve supported Metricool reports and save dated records when requested. Google reporting requires separately authorized account access or report exports. There are no analytics credentials in the browser or repository.

## Owner steps

1. Sign in at https://analytics.google.com/ using an account you control. Create an Analytics account if needed, then one property for each brand. Select United States/Mountain time and USD. Create a Web data stream for each website. Complete Google's account terms yourself.
2. Copy each Measurement ID (G-...) and send Nova the brand, website URL and ID. These IDs are identifiers, not private account credentials. Nova can then install the proper tag in the existing website repositories and verify it without requiring passwords. Installation has not occurred because IDs are not available yet.
3. The tested domain URLs currently redirected to GitHub Pages URLs: MKT Visibility → https://mktvisibility.github.io/website/; MKT Colorado → https://mktvisibility.github.io/Colorado/; Loving Longmont → https://lovinglongmont.github.io/loving-longmont-website/; Open Theory Cove → https://lovinglongmont.github.io/OpenTheoryCove/; Boulder County Photography → https://mktvisibility.github.io/BoulderCountyPhotography/. Preserve the actual destination when choosing URL-prefix Search Console properties. Do not change DNS or canonical-domain hosting merely to enable measurement.
4. At https://search.google.com/search-console/ choose a property for each website. For a Domain property, Google provides a TXT verification record that must be added at the domain's authoritative DNS host. For a URL-prefix property, provide Nova the HTML verification file or meta tag for installation. Ownership verification remains pending; never claim verified until Google confirms it. Keep verified files/tags in place.
5. In https://app.metricool.com/ connect each additional brand's supported social accounts, subject to existing plan limits. MKT Visibility Facebook and Instagram are already connected. Account approvals and any paid plan decision belong to the owner. Provide the account links for unconnected brands. No purchase or subscription upgrade is authorized by this setup.
6. After installation, verify data arrives in each Analytics property. Authorize reporting access separately, or supply exports for import. Newly installed tags cannot recover past untracked website traffic. Automatic scheduled refresh is a separate step requiring a supported, authorized integration; the static dashboard currently reads only saved Supabase reports.

## Official references

- https://support.google.com/analytics/answer/9304153
- https://support.google.com/analytics/answer/12270356
- https://support.google.com/webmasters/answer/9008080

## Validation

27 tests pass, including manual statistic entry and brand isolation, completed-period/value validation, real zero versus missing data, duplicate rejection, and real PostgreSQL editor/viewer/unapproved-user RLS. ESLint passes. Source build and deployed version are verified separately. Browser QA is unavailable in the current managed environment. Existing security advisor warnings remain documented in the approval guide; no unprotected statistics table was introduced.
