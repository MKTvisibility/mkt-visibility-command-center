-- Already applied to the live workspace. Apply only if missing.
alter table public.cc_businesses drop constraint if exists cc_businesses_kind_check;
alter table public.cc_businesses add constraint cc_businesses_kind_check check (kind in ('Prospect','Client','Non-profit','Partner-owned Business'));
