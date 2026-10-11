# Website publishing setup

Command Center saves privately until an approved editor previews and explicitly publishes. Choose Loving Longmont, MKT Colorado or both. Removal changes the public website cards only; the client record, tasks, notes and message history remain in Supabase. A GitHub commit is a submitted publication, not proof the hosted page has deployed.

Image uploads use public cc-listing-images Storage. Upload only images intended for website listings: JPEG, PNG or WebP, maximum 5 MB. Image URLs are HTTPS. Images are not automatically removed when listings are removed; they may be shared elsewhere.

The publish-listing Edge Function authenticates each request with Supabase Auth, rechecks approved workspace membership, and reads the saved business/listing records under the caller's RLS. It rejects viewers, nonmembers, unrelated paths, changed previews and unsupported layouts. Publication uses one atomic Git commit per selected website, with fast-forward updates only. Both websites can have separate outcomes; review results before retrying a partial failure.

## Final secure connection

In Supabase project gvmwkltwrlqwbqegieum > Edge Functions > Secrets, set:

- LL_GITHUB_TOKEN: fine-grained token for LovingLongmont/loving-longmont-website, repository Contents read/write only.
- CO_GITHUB_TOKEN: fine-grained token for MKTvisibility/Colorado, repository Contents read/write only.

These repositories belong to two different GitHub accounts. Create each credential while signed into the appropriate account. Do not send tokens in chat, commit them to GitHub, or enter them in the frontend. Use reasonable expiry and rotate them before expiry. The existing ChatGPT GitHub connection cannot be reused as a website server credential.

The function is deployed with gateway JWT verification enabled and also verifies the user against Auth. No service-role key or GitHub token is sent to the browser. Deployment origins are restricted to the current GitHub and original Sites app URLs.

Existing website inventory URLs select the pages to update. For a new placement, enter the selected site's URL with the existing category section, such as https://lovinglongmont.com/businesses.html#shops. New cards are inserted only into a supported grid in that section. Layouts not recognized by the service stop for manual review.

## Public field selections

Free listings default to name, description, one main photo, address, phone and website. The name is required; other fields can be unchecked. Paid listings allow explicit opt-in to public email, social media links, category labels and up to four additional photos. Paid selection does not verify payment or change pricing. The server enforces these selections against saved business metadata. Switching back to Free excludes all paid extras without deleting their saved internal values. No internal notes, tasks, private contact name or billing fields can be selected for publication.

Preview reads the public GitHub source and works before write credentials are connected. Without credentials, the preview clearly disables publishing/removal. Authorized writes still require server-only repository credentials.
