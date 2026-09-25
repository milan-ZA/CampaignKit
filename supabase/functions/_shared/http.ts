import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** An error whose message is safe and helpful to show to the user. */
export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * Builds a Supabase client that acts as the caller (their JWT, the anon key),
 * so Row Level Security applies to every query and Storage call.
 */
export async function getUserClient(req: Request): Promise<{ supabase: SupabaseClient; user: User }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) throw new HttpError(401, 'Please log in again.')

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const token = authHeader.slice('Bearer '.length)
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) throw new HttpError(401, 'Your session has ended. Please log in again.')
  return { supabase, user: data.user }
}

type Handler = (req: Request) => Promise<Response>

/** Wraps a handler with CORS, POST-only and friendly error handling. */
export function serve(handler: Handler) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
    try {
      return await handler(req)
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status)
      console.error(err)
      return json({ error: 'Something went wrong on our side. Please try again.' }, 500)
    }
  })
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json()
    if (body && typeof body === 'object') return body as Record<string, unknown>
  } catch {
    // fall through
  }
  throw new HttpError(400, 'The request was not in the expected format.')
}

export const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
