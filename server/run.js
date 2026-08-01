// The extraction run. One-shot by default; `--watch <minutes>` to run
// persistently on this box (the LLM worker), re-checking the Driftwood feed
// and folding new articles into the accumulating graph, then re-emitting the
// snapshot the front end serves.
//
// Usage:
//   node server/run.js                     # process new feed articles once
//   node server/run.js --seed <url> ...    # also include specific URLs
//   node server/run.js --watch 30          # every 30 min, forever
//   node server/run.js --max 10            # cap articles this run
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openStore } from './store.js'
import { createResolver } from './resolve.js'
import { extractFromArticle } from './extract.js'
import { driftwoodFeed, fetchArticle, loadSeenUrls, saveSeenUrls } from './sources.js'
import { writeSnapshot } from './snapshot.js'
import { providerName } from './llm.js'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..')
const SNAPSHOT = join(ROOT, 'app', 'public', 'data', 'graph.json')
const SEEN = join(ROOT, 'data', 'seen.json')

const args = process.argv.slice(2)
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : def
}
const seedUrls = args.includes('--seed') ? args.slice(args.indexOf('--seed') + 1).filter((a) => a.startsWith('http')) : []
const maxArticles = Number(flag('max', 12))
const watchMin = flag('watch', null)

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

async function pass(store, resolver) {
  const seen = loadSeenUrls(SEEN)
  const feed = await driftwoodFeed()
  const urls = [...new Set([...seedUrls, ...feed])].filter((u) => !seen.has(u)).slice(0, maxArticles)
  log(`provider ${providerName} · ${feed.length} in feed · ${urls.length} new to process`)

  let ok = 0
  for (const url of urls) {
    try {
      const article = await fetchArticle(url)
      if (!article.text || article.text.length < 400) {
        log(`skip (thin) ${url}`)
        seen.add(url)
        continue
      }
      log(`extract: ${article.title.slice(0, 60)}`)
      const extraction = await extractFromArticle(article)
      await resolver.fold(extraction)
      log(`  +${extraction.entities.length} entities, ${extraction.relations.length} relations`)
      seen.add(url)
      ok++
      saveSeenUrls(SEEN, seen)
      const stats = await writeSnapshot(store, SNAPSHOT)
      log(`  graph now: ${stats.instances} instances · ${stats.relations} relations · ${stats.prototypes} prototypes`)
    } catch (err) {
      log(`  ERROR ${url}: ${err.message}`)
    }
  }
  return ok
}

async function main() {
  const store = await openStore({ mongoUrl: process.env.MONGO_URL, log: console })
  const resolver = createResolver(store)
  await resolver.load()
  await pass(store, resolver)
  await writeSnapshot(store, SNAPSHOT)

  if (watchMin) {
    const ms = Number(watchMin) * 60000
    log(`watching — every ${watchMin} min`)
    setInterval(() => pass(store, resolver).catch((e) => log('pass error', e.message)), ms)
  } else {
    log('done')
    process.exit(0)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
