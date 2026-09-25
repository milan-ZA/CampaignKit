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
    if (res.status === 429) throw new HttpError(429, 'The AI service is busy right now. Please wait a moment and try again.')
    if (res.status === 400 && /safety|moderation/i.test(detail)) {
      throw new HttpError(400, 'The AI service would not create this. Try changing the wording of the post.')
    }
    throw new HttpError(502, 'The AI service had a problem. Please try again.')
  }
  return res.json()
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

/** Returns PNG bytes for each generated image. */
export async function generateImages(prompt: string, size: string, n: number): Promise<Uint8Array[]> {
  const data = await openaiFetch('images/generations', {
    model: env('OPENAI_IMAGE_MODEL'),
    prompt,
    n,
    size,
    quality: 'medium',
  })

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
  if (out.length < n) {
    console.error(`Expected ${n} images, got ${out.length}`)
    throw new HttpError(502, 'The AI service did not create all the images. Please try again.')
  }
  return out
}
