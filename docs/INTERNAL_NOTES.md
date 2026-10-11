# Internal notes and partner replies

Client profiles show separate notes after the message timeline. Each note supports one level of partner replies, preserved line breaks, and a 10,000-character limit. New notes are newest first; replies are chronological. Author names come from approved database membership, not editable browser input. Creation and edit times display in America/Denver. Editing retains the original author and creation time and records the most recent editor.

Approved editors may add notes/replies and edit/delete their own entries. The workspace owner may edit/delete any entry. Viewers may only read. Anonymous, unapproved, and revoked users cannot access notes. Threads cannot move between businesses or workspaces; replies require an active root note. Stale updates fail rather than overwriting someone else's change.

Deletion requires confirmation. The server clears the body and marks the entry deleted. Other partner replies remain under a “Note deleted” placeholder. Empty deleted threads disappear from the profile. Deleted entries cannot be restored or replied to. Audit records retain actor/time and changed field names, without note content. No emails or partner notifications are sent.

Existing box text is migrated into one preserved entry per business. Original author and writing time were not recorded, so imported entries explicitly identify those as unknown and show import time. The former box is cleared only after its text has been copied. No customer note text is committed to source control.

Migration: 202610110008_note_threads.sql. Storage: cc_notes. Server policies enforce access and triggers enforce attribution and deletion behavior. PostgreSQL tests cover author spoofing, partner replies, own-entry edits, owner moderation, immutable threads, viewer/stranger/anonymous rejection, and deletion preserving replies. DOM tests cover multiple notes, edit/cancel, replies, and confirmed deletion. Full suite: 31 tests passing; lint passing. Browser QA is unavailable in this managed environment.
