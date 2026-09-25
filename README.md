<p align="center"><img src="public/brand/campaignkit-logo.webp" alt="CampaignKit" width="420" /></p>

# CampaignKit

Brand profile once → short campaign brief → AI-generated, editable week-by-week marketing plan with optional AI images.

React + Vite + Tailwind v4 front end; Supabase for auth, Postgres (RLS on every table), Storage and Edge Functions. OpenAI is called **only** from Edge Functions.

## Deploy your own copy

By default the app connects to the course project's shared Supabase project (public URL + anon key in `src/lib/supabase.js`), so a fresh copy works with no setup. To use your own Supabase project instead, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; they override the defaults. You need a Supabase project, an OpenAI API key and Node 20+.

1. **Supabase project**: create one at supabase.com (the free plan is fine). Note the project ref, the database password, and the URL and anon key under Project Settings → API.
2. **Database, storage and functions** (from a clone of this repo):
   ```bash
   npm install
   npx supabase login
   npx supabase link --project-ref YOUR-PROJECT-REF
   npx supabase db push
   npx supabase functions deploy
   npx supabase secrets set OPENAI_API_KEY=sk-... OPENAI_MODEL=gpt-5-mini OPENAI_IMAGE_MODEL=gpt-image-1
   ```
   If you forked the repo, you can instead add the three repository secrets listed under Deployment and run the "Deploy Supabase" workflow.
3. **Auth URLs**: in Supabase → Authentication → URL Configuration, set the Site URL to where the app runs and add it (plus `http://localhost:5173/**`) to Redirect URLs.
4. **Website**:
   - Locally: copy `.env.example` to `.env.local`, fill in the URL and anon key, then run `npm run dev`.
   - On a host (Bolt, Netlify, Vercel): set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables. Build command `npm run build`, output folder `dist`. Redeploy after changing them.

| Message you see | What's missing |
| --- | --- |
| "CampaignKit needs its Supabase settings" | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (step 4) |
| "This Supabase project isn't set up yet: the database tables are missing" | `supabase db push` (step 2) |
| "The AI feature … isn't set up on this Supabase project yet" | `supabase functions deploy` (step 2) |
| "The AI service is not set up yet" | the OpenAI secrets (step 2) |
| Confirmation email link opens the wrong address | Auth URLs (step 3) |

## Deployment

- **Backend (Supabase):** `.github/workflows/deploy-supabase.yml` runs on every push to `main` that touches `supabase/`, and can also be run by hand from the Actions tab. It applies migrations and deploys the Edge Functions. It needs the repository secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` and `SUPABASE_PROJECT_ID`. Until those exist it skips with a warning.
- **Website:** any static host that builds from GitHub (for example Bolt.new, Netlify or Vercel). Build command `npm run build`, output folder `dist`, and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `public/_redirects` sends every path to `index.html` so page refreshes work.
- **Image model:** `OPENAI_IMAGE_MODEL` can be `gpt-image-1` (needs a verified OpenAI organisation) or `dall-e-3` (3 separate requests, sizes 1024x1024 / 1792x1024 / 1024x1792).
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
