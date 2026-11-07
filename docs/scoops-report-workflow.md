# Client report editing

Open the business profile → Visibility Check → Report editor & secure client portal. Research and internal notes are stored privately in the database, never in public source files. Preview current edits shows unsaved changes; Save report draft persists them. After review, Update client page archives a new version and moves the existing protected link to it without changing its code. Earlier versions remain archived. Existing sessions end after an update so readers reopen the latest version.

Report access supports a 4–8 digit code or a 12–128 character password. Salted PBKDF2 hashes, per-link/IP attempt limits, expiring sessions and private database grants remain in place. No code or report-specific content is embedded in the application bundle. Anonymous users cannot read reports, codes or research directly.

Server-only SELECT/INSERT/UPDATE/DELETE grants were restored for report links, sign-in attempts and report archives, plus the attempt identity sequence. This fixes the pre-existing Sign-in temporarily unavailable error without granting public access.

Square checkout and automatic questionnaire emails remain a separate future integration. Existing service inquiry forms do not charge a card. Do not submit inquiry forms during testing because they can send real notifications.
