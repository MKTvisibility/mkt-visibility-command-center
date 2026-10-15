# Business discovery: internal profiles for human review

Research up to 10 independent Colorado businesses, artists, musicians, makers and unusual local businesses per run. Never publish public listings or send outreach during discovery.

## Eligibility and duplicate prevention

Both a working official website and an exact publicly published business email are mandatory. Verify from official sources, not guessed addresses or contact forms. Verify Colorado base; a performance in a town does not establish a band's base. Longmont-based profiles use `Loving Longmont`; all other Colorado locations use `MKT Colorado`.

Read all workspace `cc_businesses`, including archived and rejected records, and current listings on BOTH live websites and repositories (`MKTvisibility/LovingLongmont`, `MKTvisibility/Colorado`). Inspect their current sitemaps and category/business pages. Do not use the retired LovingLongmont owner repository. Compare normalized names and aliases, official domain, email, phone and location. Case, punctuation, accents, www, protocol, trailing slashes and LLC suffixes must not hide duplicates. An existing website listing is a duplicate even if missing from the database: report for reconciliation instead of creating a discovery profile. A shared domain/email or uncertain name match needs manual review, not a speculative insert. Respect removals such as PopCakes, Salt and Bread, and Moroccan Rugs & Gifts. Recheck immediately before insertion. If database or website checks cannot be completed, report the blocker and skip creation.

## Persisted contract

Use existing `cc_businesses` columns; no new schema is needed. Workspace is `c8748032-cdd3-443b-8c56-2e846cc9bf31` in project `gvmwkltwrlqwbqegieum`. Verify enabled owner Michelle and attribute writes to that membership under authenticated RLS, preserving existing records and audit trails. New records use `kind: Prospect`, `status: Active`, `stage: New`, zero monetary values, verified contact details, concise original description and factual categories. Never fabricate a listing URL, publication date, completed task, sales value or client relationship.

Encode notes with `encodeMetadata` from `src/lib/portfolio.js` (maximum 4,000 characters):

```json
{
  "format": "mkt-portfolio-v1",
  "brand": "MKT Colorado",
  "outreachDecision": "Not decided",
  "text": "New research profile. Michelle or Tim must review before publishing or outreach.",
  "discovery": {
    "source": "Nova research",
    "status": "Pending review",
    "researchedOn": "YYYY-MM-DD",
    "duplicateCheckedOn": "ISO timestamp",
    "sources": ["https://official-business.example/contact"],
    "reason": "Brief factual reason this business is distinctive"
  }
}
```

Use Mountain local date. Save source URLs proving website, email, location and identity. Idempotently insert only genuinely new candidates, then read back IDs, names, brand and pending status. Do not overwrite existing data or create `Published` listing rows. Checklist work remains incomplete until actually done.

The Dashboard's **New businesses to review** card shows pending count and total researched profiles. Its list opens the existing profile page. Michelle or Tim can mark reviewed, not a match, or return to pending. Pending profiles are excluded from outreach eligibility and email approval. Reviewed does not approve or send any email or publish any website. Report confirmed additions and skips here, with no email report.
