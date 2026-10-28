# MKT Visibility Blog

Public page: https://mktvisibility.github.io/website/blog.html

In Command Center, open **MKT Visibility → MKT Visibility Blog**. Create or select a post, edit its title, author and formatted post text, and save the draft. Use Visual (WYSIWYG) for font family, font size, text color, bold, italic, underline, headings, lists, quotes, alignment and links. The HTML tab edits the same content. A strict allowlist preserves supported styling in both the public article and the private preview. The separate introduction field and article introduction have been removed; existing saved introduction data is retained in the database. Upload JPG, PNG or WebP images up to 8 MB, then add alt text and an optional caption/credit. Uploading first saves the draft.

Use **Preview on website** for an embedded desktop or mobile preview of current saved or unsaved edits, using the same article renderer and CSS as the public site. Then use, then **Publish now → Confirm publication**, or select a future date/time in America/Denver and **Schedule post → Confirm schedule**. The scheduled snapshot becomes publicly readable at its timestamp, with no open browser, cron or GitHub publishing token required. During the repeated fall DST hour, the first occurrence is used; nonexistent spring times are rejected.

Draft edits do not change a published or scheduled snapshot. Save and explicitly publish/schedule again to replace it. A pending replacement leaves the current public version visible until the replacement time. Cancel schedule preserves any current live version. **Unpublish — hide from website** removes all releases and retains the draft and uploaded image. A clear visibility indicator distinguishes visible, hidden and scheduled posts; the saved draft can be published again. Published/scheduled URL slugs cannot change while releases exist. Concurrent draft saves are checked by revision. Re-publication supersedes earlier snapshots in the public view; earlier released text remains accessible in release history until unpublication.

## Backend

Migration `20261028035333_mkt_visibility_blog.sql` creates private workspace drafts, timestamped release snapshots, an RLS-enforced public view, an invoker publishing RPC and a private image bucket. Only enabled workspace owners/editors can write or publish. Viewers can inspect drafts but cannot edit. Anonymous visitors can read only due releases and referenced images. Signed image URLs expire after five minutes; a previously issued image URL can remain usable for that time after unpublishing.

No existing business/task tables or scheduled jobs are changed. No example posts are seeded. Frontend contains only the existing browser-safe publishable key.

## Validation

`node --test tests/blog*.test.mjs`, `npm run lint`, `npm run build`. Live database rollback tests cover draft privacy, future-release filtering, snapshot preservation, image visibility, unpublishing and workspace authorization. The full existing suite also has unrelated assertions that no longer match business-profile tabs, ratings and email approval behavior; these are outside the blog change.

## Layout and paragraph controls

The public directory, individual posts, and embedded website preview share the homepage logo and navigation. The uploaded featured image is used as the directory thumbnail and appears above the post title. Article spacing is compact and leading empty paragraphs are removed from rendering.

**Paragraph** toggles a `2em` first-line indent for the paragraph at the caret or all selected paragraphs. Enter inherits the paragraph style. Changing a whole paragraph to a smaller font promotes that size to the paragraph itself and uses a 1.5 line-height, removing large inline font wrappers that previously held the line spacing open. Mixed-size text keeps the spacing needed for its remaining larger characters.
