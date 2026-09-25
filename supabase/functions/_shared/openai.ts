import { HttpError } from './http.ts'

function env(name: string) {
  const v = Deno.env.get(name)
  if (!v) {
    console.error(`Missing secret ${name}`)
    throw new HttpError(500, 'The AI service is not set up yet. Please contact support.')
  }
  return v
}

async function openaiFetch(path: string, body: unknown) {
  let res: Response
  try {
    res = await fetch(`https://api.openai.com/v1/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.error('OpenAI network error', err)
    throw new HttpError(502, "We couldn't reach the AI service. Please try again.")
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error(`OpenAI ${path} failed`, res.status, detail)
    throw openaiError(res.status, detail, (body as { model?: string })?.model ?? '')
  }
  return res.json()
}

/** Maps an OpenAI error to a message that says what to fix. */
function openaiError(status: number, detail: string, model: string) {
  let code = ''
  let message = ''
  try {
    const parsed = JSON.parse(detail)?.error ?? {}
    code = String(parsed.code ?? parsed.type ?? '')
    message = String(parsed.message ?? '')
  } catch {
    // not JSON
  }
  const text = `${code} ${message}`

  if (status === 401 || code === 'invalid_api_key') {
    return new HttpError(502, 'The OpenAI key saved in Supabase (OPENAI_API_KEY) was not accepted. Check it and save it again.')
  }
  if (code === 'insufficient_quota' || /quota|billing/i.test(text)) {
    return new HttpError(502, 'The OpenAI account has no API credit left. Add credit at platform.openai.com → Settings → Billing.')
  }
  if (/verif/i.test(text)) {
    return new HttpError(
      502,
      `The AI model "${model}" needs a verified OpenAI organisation. Verify it at platform.openai.com → Settings → Organization → General, or choose another model in Supabase.`,
    )
  }
  if (status === 404 || code === 'model_not_found' || /model/i.test(code)) {
    return new HttpError(502, `The AI model "${model}" isn't available on this OpenAI account. Change OPENAI_MODEL or OPENAI_IMAGE_MODEL in Supabase.`)
  }
  if (status === 429) return new HttpError(429, 'The AI service is busy right now. Please wait a moment and try again.')
  if (status === 400 && /safety|moderation/i.test(text)) {
    return new HttpError(400, 'The AI service would not create this. Try changing the wording of the post.')
  }
  if (status === 400 && message) {
    return new HttpError(502, `The AI service rejected the request: ${message.slice(0, 200)}`)
  }
  return new HttpError(502, 'The AI service had a problem. Please try again.')
}

type Message = { role: 'system' | 'user'; content: string }

export async function chatText(messages: Message[]): Promise<string> {
  const data = await openaiFetch('chat/completions', { model: env('OPENAI_MODEL'), messages })
  const text = data?.choices?.[0]?.message?.content?.trim()
  if (!text) throw new HttpError(502, 'The AI service sent back an empty answer. Please try again.')
  return text
}

export async function chatJson(messages: Message[]): Promise<any> {
  const data = await openaiFetch('chat/completions', {
    model: env('OPENAI_MODEL'),
    messages,
    response_format: { type: 'json_object' },
  })
  const text = data?.choices?.[0]?.message?.content
  try {
    return JSON.parse(text)
  } catch {
    console.error('OpenAI returned invalid JSON', text)
    throw new HttpError(502, 'The AI service sent back something we could not read. Please try again.')
  }
}

// dall-e-3 only makes square, 1792x1024 and 1024x1792 images, one per request.
const DALLE3_SIZES: Record<string, string> = {
  '1024x1024': '1024x1024',
  '1536x1024': '1792x1024',
  '1024x1536': '1024x1792',
}

async function toBytes(data: any): Promise<Uint8Array[]> {
  const out: Uint8Array[] = []
  for (const img of data?.data ?? []) {
    if (img.b64_json) {
      out.push(Uint8Array.from(atob(img.b64_json), (c) => c.charCodeAt(0)))
    } else if (img.url) {
      const r = await fetch(img.url)
      if (!r.ok) throw new HttpError(502, "We couldn't download the new images. Please try again.")
      out.push(new Uint8Array(await r.arrayBuffer()))
    }
  }
  return out
}

/**
 * Returns PNG bytes for each generated image and the size actually used.
 * Works with gpt-image-* models (one request, n images) and dall-e-3 (n parallel requests),
 * depending on OPENAI_IMAGE_MODEL.
 */
export async function generateImages(
  prompt: string,
  size: string,
  n: number,
): Promise<{ images: Uint8Array[]; size: string }> {
  const model = env('OPENAI_IMAGE_MODEL')
  let images: Uint8Array[]
  let usedSize = size

  if (model.startsWith('dall-e-3')) {
    usedSize = DALLE3_SIZES[size] ?? '1024x1024'
    const request = () =>
      openaiFetch('images/generations', {
        model,
        prompt: prompt.slice(0, 3900), // dall-e-3 accepts up to 4,000 characters
        n: 1,
        size: usedSize,
        quality: 'standard',
        response_format: 'b64_json',
      }).then(toBytes)
    images = (await Promise.all(Array.from({ length: n }, request))).flat()
  } else {
    images = await toBytes(
      await openaiFetch('images/generations', { model, prompt, n, size, quality: 'medium' }),
    )
  }

  if (images.length < n) {
    console.error(`Expected ${n} images, got ${images.length}`)
    throw new HttpError(502, 'The AI service did not create all the images. Please try again.')
  }
  return { images, size: usedSize }
}
