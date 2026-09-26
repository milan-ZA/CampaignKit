-- Phase 1 Run 2: preferred content language, website and logo on the brand profile.
-- The logo file lives in the existing private "post-images" bucket under {user_id}/brand/,
-- so the existing storage policies (users only reach their own folder) already protect it.

alter table public.brand_profiles
  add column preferred_language text check (
    preferred_language in ('English', 'Afrikaans', 'isiZulu', 'isiXhosa', 'Sesotho', 'Setswana', 'French', 'Portuguese')
  ),
  add column website text check (website ~* '^https?://\S+$' and char_length(website) <= 300),
  add column logo_path text check (logo_path like user_id::text || '/brand/%');
