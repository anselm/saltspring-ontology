// Runtime LLM: Anthropic API if a key is present, else local ollama on this
// box. Extraction is a structured-output task, so we ask for JSON and parse
// defensively. Embeddings via ollama nomic-embed-text for fuzzy dedup.
import Anthropic from '@anthropic-ai/sdk'

const OLLAMA = process.env.OLLAMA_URL || 'http://localhost:11434'
const GEN_MODEL = process.env.OLLAMA_MODEL || 'gpt-oss:120b'
const EMBED_MODEL = process.env.EMBED_MODEL || 'nomic-embed-text'
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

let anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null
export const providerName = anthropic ? `anthropic:${ANTHROPIC_MODEL}` : `ollama:${GEN_MODEL}`

// Ask for JSON. Returns parsed object or throws.
export async function generateJSON({ system, user, maxTokens = 4000 }) {
  let text
  if (anthropic) {
    const r = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    })
    text = r.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  } else {
    const res = await fetch(`${OLLAMA}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GEN_MODEL,
        stream: false,
        format: 'json',
        options: { temperature: 0.2, num_ctx: 8192 },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: AbortSignal.timeout(300000),
    })
    if (!res.ok) throw new Error(`ollama ${res.status}`)
    const data = await res.json()
    text = data.message?.content || ''
  }
  return parseLoose(text)
}

function parseLoose(text) {
  text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  try {
    return JSON.parse(text)
  } catch {
    const a = text.indexOf('{')
    const b = text.lastIndexOf('}')
    if (a >= 0 && b > a) return JSON.parse(text.slice(a, b + 1))
    throw new Error('no JSON in model output')
  }
}

export async function embed(text) {
  try {
    const res = await fetch(`${OLLAMA}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return null
    const d = await res.json()
    return d.embedding || null
  } catch {
    return null
  }
}

export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1)
}
