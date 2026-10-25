begin;
alter table public.cc_knowledge_topics drop constraint if exists cc_knowledge_topics_page_check;
alter table public.cc_knowledge_topics add constraint cc_knowledge_topics_page_check
  check (page in ('Future Development','How To','AI Prompts'));
-- Existing enabled-partner RLS policies restrict reads and owner/editor inserts.
grant select, insert on public.cc_knowledge_topics to authenticated;
commit;
