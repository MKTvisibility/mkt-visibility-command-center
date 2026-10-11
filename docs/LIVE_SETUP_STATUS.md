# Live setup status

The existing Supabase project is connected using native hosted public environment settings; credentials are absent from tracked source. Michelle applied the initial cc_ migration and approved her owner membership. She signed in, created a test business, refreshed, and confirmed that it persisted. Anonymous business access was rejected by the live API. The live public signup setting was still enabled at last inspection; disable it under Supabase Authentication settings. Tim and Kayli still require verified account/membership setup and explicit hosted sharing.

The message-summary update uses the existing cc_emails table and requires no additional migration. It adds client-profile timelines and readable summaries without inbox connections, sending, or historical imports. See MESSAGE_SUMMARIES.md.
