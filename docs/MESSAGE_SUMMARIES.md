# Client message summaries

Open Clients & Prospects and click a business name. Its profile contains a message timeline. Add a message summary there to automatically link it to the business, or edit a record under Email Campaigns and choose its business.

Store the actual message date, direction, subject, From and To addresses, a brief summary, optional next action/contact date, response status and verification. Dates default to blank rather than today. Sent/reply records require their actual date. Planned and draft entries are labelled separately and never count as messages already sent in the timeline. Inbound records use the existing Replied tracking status, rendered as Received in the timeline. A reply is a separate entry rather than an overwrite of the original sent message.

No Gmail URLs, original message bodies, email credentials or inbox attachments are stored by this feature. Use Gmail search to find the original by its subject, address and date. The app does not connect to Gmail, import past messages, send messages or run automatic follow-ups. Future summaries must be added explicitly until an authorized integration is implemented. An entered next contact date is informational; create a Follow-Up reminder for the dashboard's due-task count.

## Compatibility and storage

The original summary envelope used the existing notes column. The later additive profile migrations add source identifiers, related businesses, timestamps and message types; these have been applied to the connected project. The summaries still use the existing RLS-protected cc_emails table. Subject, recipient, direction, status, occurred_on, and business_id remain ordinary columns. The existing notes column contains versioned JSON marked format=mkt-message-summary-v1 with sender, summary, next_action, follow_up_on, response_status, and verification. The entire envelope must fit the existing 4,000-character database constraint; summaries are limited to 2,500 characters and next actions to 500. Oversized encoded summaries are rejected, never silently truncated.

Existing plain-text notes are shown as unverified summaries with unknown sender. They are not rewritten during loading or unrelated record saves. Editing a long legacy note into a summary requires explicitly shortening it; the app rejects excess length rather than removing historical text silently. Exports flatten the metadata to readable columns. Existing owner/editor/viewer and workspace security remain unchanged. Rendering uses React text, never HTML.

## Validation

Automated tests cover summary round trips, legacy notes, invalid addresses/dates, escaped size limits, readable exports, business isolation, date ordering, client profile creation/editing, inbound messages, pre-linked business selection, and inert script-like summary text. Existing PostgreSQL RLS tests also run. Practice data remains isolated in memory and makes no network requests. Real-browser QA is unavailable in the managed environment; 119 reviewed business message summaries have now been imported through the authorized Gmail/Supabase connectors. Full bodies are not stored in the database. See DATABASE_MANAGEMENT.md for scope and remaining inbox access.
