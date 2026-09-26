-- Add Spanish to the content languages. Sesotho and Setswana stay allowed so any saved
-- profiles keep working, even though the Brand guidelines tab no longer offers them.

alter table public.brand_profiles drop constraint if exists brand_profiles_preferred_language_check;
alter table public.brand_profiles add constraint brand_profiles_preferred_language_check check (
  preferred_language in (
    'English', 'French', 'Spanish', 'Portuguese', 'Afrikaans', 'isiZulu', 'isiXhosa', 'Sesotho', 'Setswana'
  )
);
