<p align="center"><img src="public/brand/campaignkit-logo.webp" alt="CampaignKit" width="420" /></p>

# CampaignKit

Brand profile once → short campaign brief → AI-generated, editable week-by-week marketing plan with optional AI images.

React + Vite + Tailwind v4 front end; Supabase for auth, Postgres (RLS on every table), Storage and Edge Functions. OpenAI is called **only** from Edge Functions.

## Deployment

- **Backend (Supabase):** `.github/workflows/deploy-supabase.yml` runs on every push to `main` that touches `supabase/`, and can also be run by hand from the Actions tab. It applies migrations and deploys the Edge Functions. It needs the repository secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` and `SUPABASE_PROJECT_ID`. Until those exist it skips with a warning.
- **Website:** any static host that builds from GitHub (for example Bolt.new, Netlify or Vercel). Build command `npm run build`, output folder `dist`, and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `public/_redirects` sends every path to `index.html` so page refreshes work.
- **OpenAI secrets** live only in Supabase: `npx supabase secrets set OPENAI_API_KEY=... OPENAI_MODEL=... OPENAI_IMAGE_MODEL=...`
- `.github/workflows/check.yml` builds the site and type-checks the Edge Functions on every push.

## Local setup

1. **Front-end env**: copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Supabase → Project Settings → API).

2. **Database + Storage**: run `supabase/migrations/20260925000000_campaignkit.sql`. Either paste it into the SQL editor, or:
   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR-PROJECT-REF
   npx supabase db push
   ```
   This creates the tables, RLS policies, the two transactional RPCs, the private `post-images` bucket and its folder-scoped Storage policies.

3. **Secrets** (server side only):
   ```bash
   npx supabase secrets set OPENAI_API_KEY=sk-... OPENAI_MODEL=gpt-5-mini OPENAI_IMAGE_MODEL=gpt-image-1
   ```

4. **Edge Functions**:
   ```bash
   npx supabase functions deploy generate-plan generate-asset generate-images
   ```

5. **Auth URLs**: in Supabase → Authentication → URL Configuration, set the Site URL to your app URL and add `http://localhost:5173/**` to the redirect URLs (needed for email confirmation and password reset links).

6. Run it:
   ```bash
   npm install
   npm run dev
   ```

## How it fits together

| Piece | Where |
| --- | --- |
| Theme tokens (light/dark, channel pills, preview frames) | `src/index.css` (the default Tailwind palette is disabled, so every colour comes from a token) |
| Channel list, hints, image sizes, "see first"/limit numbers | `src/lib/channels.js` and `supabase/functions/_shared/brand.ts` |
| Brand context sent with every OpenAI request | `supabase/functions/_shared/brand.ts` → `buildBrandContext` |
| Campaign + posts saved all-or-nothing | RPC `create_campaign_with_items` |
| Image swap (new rows in, old rows out, in one transaction) | RPC `replace_item_images`; old files are removed only after that succeeds |
| Post previews (8 channel layouts) | `src/components/plan/PostPreview.jsx` |

Edge Functions create their Supabase client with the caller's JWT and the anon key, so RLS applies to every query and every Storage action. They always read the brand profile from the database, never from the request. `generate-plan` also stores a `brand_snapshot` copy of the profile on each new campaign.
