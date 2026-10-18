CREATE OR REPLACE FUNCTION public.cc_ll_validate_settings(s jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare k text; v jsonb; item jsonb;
begin

 -- Validate exact, supported anchors; normalize only the local validation copy.
 if jsonb_typeof(s->'site_placements')='object' then
  for k,v in select key,value from jsonb_each(s->'site_placements') loop
   if jsonb_typeof(v)='array' then
    for item in select value from jsonb_array_elements(v) loop
     if position('#' in (item#>>'{}'))>0 and not coalesce(('{"Loving Longmont": ["animals.html#help-animals", "animals.html#visit-animals", "animals.html#veterinarians", "animals.html#pet-supplies", "animals.html#pet-care", "businesses.html#makers", "businesses.html#local-experiences", "businesses.html#more-local-finds", "community.html#farms", "community.html#food-help", "community.html#faith", "community.html#mindfulness", "community.html#community-help", "events.html#october", "events.html#november", "events.html#december", "jobs.html#government", "jobs.html#job-search", "jobs.html#temp-work", "jobs.html#remote", "jobs.html#side-gigs", "jobs.html#training"], "MKT Colorado": ["events.html#western", "events.html#music", "events.html#food", "events.html#winter", "events.html#community", "events.html#local-resources", "things-to-do.html#attractions", "things-to-do.html#history", "things-to-do.html#parks", "things-to-do.html#scenic", "things-to-do.html#create", "things-to-do.html#farm", "things-to-do.html#food", "things-to-do.html#learn", "things-to-do.html#outdoor"]}'::jsonb->k) ? (item#>>'{}'),false) then raise exception 'Section unavailable on selected page'; end if;
    end loop;
   end if;
  end loop;
  s:=jsonb_set(s,'{site_placements}',coalesce((select jsonb_object_agg(key,case when jsonb_typeof(value)='array' then (select coalesce(jsonb_agg(split_part(x,'#',1)),'[]'::jsonb) from jsonb_array_elements_text(value) x) else value end) from jsonb_each(s->'site_placements')),'{}'::jsonb));
 end if;
 if jsonb_typeof(s)<>'object' or char_length(s::text)>20000 or s-array['tagline','photographer','service_area','story','services','gallery','fields','social_visibility','directory','spotlight_pages','spotlight_order','active','sites','site_placements','home_story']::text[]<>'{}'::jsonb then raise exception 'Invalid page settings';end if;
 foreach k in array array['tagline','photographer','service_area','story'] loop
  if s?k and (jsonb_typeof(s->k)<>'string' or char_length(s->>k)>case when k='story' then 5000 else 300 end) then raise exception 'Invalid page text';end if;
 end loop;
 if jsonb_typeof(coalesce(s->'fields','{}'))<>'object' or (coalesce(s->'fields','{}')-array['description','address','phone','email','website','image_url','categories','social_urls','tagline','photographer','service_area','story','services','gallery']::text[])<>'{}'::jsonb then raise exception 'Invalid public field selection';end if;
 for k,v in select key,value from jsonb_each(coalesce(s->'fields','{}')) loop if jsonb_typeof(v)<>'boolean' then raise exception 'Invalid public field selection';end if;end loop;
 if jsonb_typeof(coalesce(s->'social_visibility','{}'))<>'object' then raise exception 'Invalid social selections';end if;
 for k,v in select key,value from jsonb_each(coalesce(s->'social_visibility','{}')) loop if jsonb_typeof(v)<>'boolean' then raise exception 'Invalid social selections';end if;end loop;
 foreach k in array array['directory','active'] loop if s?k and jsonb_typeof(s->k)<>'boolean' then raise exception 'Invalid publication setting';end if;end loop;
 if s?'spotlight_order' and ((s->>'spotlight_order') !~ '^[0-9]{1,6}$') then raise exception 'Invalid spotlight order';end if;
 if jsonb_typeof(coalesce(s->'services','[]'))<>'array' or jsonb_array_length(coalesce(s->'services','[]'))>30 then raise exception 'Use up to 30 services';end if;
 for item in select value from jsonb_array_elements(coalesce(s->'services','[]')) loop if jsonb_typeof(item)<>'string' or char_length(item#>>'{}')>200 then raise exception 'Invalid service';end if;end loop;
 if jsonb_typeof(coalesce(s->'gallery','[]'))<>'array' or jsonb_array_length(coalesce(s->'gallery','[]'))>4 then raise exception 'Use up to four photos';end if;
 for item in select value from jsonb_array_elements(coalesce(s->'gallery','[]')) loop
  if jsonb_typeof(item)<>'object' or item-array['url','alt','caption','enabled']::text[]<>'{}'::jsonb or coalesce(item->>'url','') !~ '^https://[^[:space:]<>"@]+$' or (item?'enabled' and jsonb_typeof(item->'enabled')<>'boolean') or char_length(item->>'url')>5000 or char_length(coalesce(item->>'alt',''))>300 or char_length(coalesce(item->>'caption',''))>500 then raise exception 'Invalid photo';end if;
 end loop;
 if jsonb_typeof(coalesce(s->'spotlight_pages','[]'))<>'array' then raise exception 'Invalid spotlight pages';end if;
 for item in select value from jsonb_array_elements(coalesce(s->'spotlight_pages','[]')) loop
  if item#>>'{}' not in ('index.html','businesses.html','things-to-do.html','animals.html','community.html','history.html','jobs.html','events.html','spotlight.html','food-drink.html','makers.html','arts-crafts-makers.html','books-comics-games.html','classes-learning.html','faith-spirituality.html','farms-local-essentials.html','food-drink.html','food-assistance-basic-needs.html','health-wellness.html','home-garden-gifts.html','music-entertainment.html','outdoor-recreation-adventure.html','professional-business-services.html','shopping-specialty-stores.html','sports-fitness-equipment.html','museums-historic-sites.html','kids-family-activities.html','event-venues-group-experiences.html','farm-visits-seasonal-fun.html','recovery-peer-support.html','senior-services.html','bakeries-cottage-food.html','vintage-secondhand-creative-reuse.html','find-a-local-volunteer-opportunity.html') then raise exception 'Choose an eligible spotlight page';end if;
 end loop;
 if s?'sites' and (jsonb_typeof(s->'sites')<>'array' or jsonb_array_length(s->'sites')<1 or jsonb_array_length(s->'sites')>2 or exists(select 1 from jsonb_array_elements_text(s->'sites') x where x not in ('Loving Longmont','MKT Colorado'))) then raise exception 'Choose at least one supported website';end if;
 if s?'site_placements' then
 if jsonb_typeof(s->'site_placements')<>'object' or (s->'site_placements')-array['Loving Longmont','MKT Colorado']::text[]<>'{}'::jsonb then raise exception 'Invalid website placements'; end if;
 for k,v in select key,value from jsonb_each(s->'site_placements') loop
 if jsonb_typeof(v)<>'array' then raise exception 'Invalid website page list'; end if;
 for item in select value from jsonb_array_elements(v) loop
 if jsonb_typeof(item)<>'string' or (k='Loving Longmont' and item#>>'{}' not in ('index.html','businesses.html','things-to-do.html','animals.html','community.html','history.html','jobs.html','events.html','spotlight.html','arts-crafts-makers.html','books-comics-games.html','classes-learning.html','faith-spirituality.html','farms-local-essentials.html','food-drink.html','food-assistance-basic-needs.html','health-wellness.html','home-garden-gifts.html','music-entertainment.html','outdoor-recreation-adventure.html','professional-business-services.html','shopping-specialty-stores.html','sports-fitness-equipment.html','museums-historic-sites.html','kids-family-activities.html','event-venues-group-experiences.html','farm-visits-seasonal-fun.html','recovery-peer-support.html','senior-services.html','bakeries-cottage-food.html','vintage-secondhand-creative-reuse.html','find-a-local-volunteer-opportunity.html')) or (k='MKT Colorado' and item#>>'{}' not in ('index.html','businesses.html','events.html','spotlight.html','food-drink.html','makers.html','things-to-do.html')) then raise exception 'Page unavailable on selected website'; end if;
 end loop; end loop; end if;

 if s?'home_story' then
  if jsonb_typeof(s->'home_story') is distinct from 'object' or (s->'home_story')-array['enabled','images','pages']::text[]<>'{}'::jsonb then raise exception 'Invalid home-page story settings';end if;
  if jsonb_typeof(s->'home_story'->'enabled') is distinct from 'boolean' then raise exception 'Choose home-page story visibility';end if;
  if jsonb_typeof(s->'home_story'->'images') is distinct from 'array' or jsonb_array_length(s->'home_story'->'images')>3 then raise exception 'Choose up to three story images';end if;
  for item in select value from jsonb_array_elements(s->'home_story'->'images') loop
   if jsonb_typeof(item)<>'string' or item#>>'{}' not in ('logo','left','photo3') then raise exception 'Invalid story image selection';end if;
  end loop;
  if (select count(*)<>count(distinct value) from jsonb_array_elements_text(s->'home_story'->'images')) then raise exception 'Duplicate story image selection';end if;
  if s->'home_story'?'pages' then
   if jsonb_typeof(s->'home_story'->'pages') is distinct from 'array' or jsonb_array_length(s->'home_story'->'pages')>50 then raise exception 'Invalid story highlight pages';end if;
   if (s->'home_story'->>'enabled')::boolean and jsonb_array_length(s->'home_story'->'pages')=0 then raise exception 'Choose at least one page for the story highlight';end if;
   for item in select value from jsonb_array_elements(s->'home_story'->'pages') loop
    if jsonb_typeof(item)<>'string' or item#>>'{}' not in ('index.html','directory.html','businesses.html','things-to-do.html','events.html','community.html','jobs.html','animals.html','food-assistance-basic-needs.html','faith-spirituality.html','find-a-local-volunteer-opportunity.html','history.html','spotlight.html','food-drink.html','shopping-specialty-stores.html','home-garden-gifts.html','books-comics-games.html','arts-crafts-makers.html','music-entertainment.html','classes-learning.html','outdoor-recreation-adventure.html','sports-fitness-equipment.html','farms-local-essentials.html','professional-business-services.html','health-wellness.html','contact.html','membership.html','pricing.html','become-a-contributor.html','media-kit.html','about.html','sitemap.html','search.html','request-free-profile.html','thank-you.html','index.html','museums-historic-sites.html','kids-family-activities.html','event-venues-group-experiences.html','farm-visits-seasonal-fun.html','recovery-peer-support.html','senior-services.html','bakeries-cottage-food.html','vintage-secondhand-creative-reuse.html','find-a-local-volunteer-opportunity.html') then raise exception 'Choose an eligible navigation page for this story';end if;
   end loop;
   if (select count(*)<>count(distinct value) from jsonb_array_elements_text(s->'home_story'->'pages')) then raise exception 'Duplicate story page selection';end if;
  end if;

 end if;
 return true;
end $function$


