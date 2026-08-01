// Article fetch + HTML→text. Keeps a source list; the Driftwood RSS is the
// live feed, plus any seeded URLs. Robust-ish text extraction: strip chrome,
// keep the article body.
import { writeFileSync, readFileSync, existsSync } from 'node:fs'

const UA = 'Mozilla/5.0 (ontology-extractor; local research)'

export async function driftwoodFeed() {
  try {
    const res = await fetch('https://gulfislandsdriftwood.com/feed/', {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(20000),
    })
    const xml = await res.text()
    const urls = [...xml.matchAll(/<link>([^<]+)<\/link>/g)]
      .map((m) => m[1].trim())
      .filter((u) => u.startsWith('https://gulfislandsdriftwood.com/') && u.replace(/\/$/, '').split('/').length >= 4)
    return [...new Set(urls)]
  } catch {
    return []
  }
}

export async function fetchArticle(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) })
  const html = await res.text()
  const title =
    (html.match(/<meta property="og:title" content="([^"]+)"/) || [])[1] ||
    (html.match(/<title>([^<]+)<\/title>/) || [])[1] ||
    url
  const date =
    (html.match(/<meta property="article:published_time" content="([^"]+)"/) || [])[1] ||
    (html.match(/"datePublished":"([^"]+)"/) || [])[1] ||
    null

  // article body: prefer <article>, else the largest <p>-dense block
  let body = (html.match(/<article[\s\S]*?<\/article>/i) || [])[0] || html
  body = body
    .replace(/<(script|style|nav|footer|header|aside|form)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return { url, title: decodeHtml(title), date, text: body }
}

const decodeHtml = (s) =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/&amp;/g, '&').replace(/&#8217;/g, '’').trim()

export function loadSeenUrls(path) {
  return existsSync(path) ? new Set(JSON.parse(readFileSync(path, 'utf8'))) : new Set()
}
export function saveSeenUrls(path, set) {
  writeFileSync(path, JSON.stringify([...set], null, 0))
}
