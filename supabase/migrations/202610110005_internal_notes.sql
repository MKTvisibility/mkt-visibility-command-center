begin; alter table public.cc_businesses add column internal_notes text not null default '' check(char_length(internal_notes)<=10000); commit;
