// Fold a reference-extractions file (array of {source, entities, relations})
// through the real resolver → graph.json. Used to build the graph from
// extractions produced by any model (including the frontier reference set),
// exercising the same dedup / prototype / edge-as-entity logic as live runs.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openStore } from './store.js'
import { createResolver } from './resolve.js'
import { writeSnapshot } from './snapshot.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const file = process.argv[2] || join(ROOT, 'data', 'reference-extractions.json')
const SNAPSHOT = join(ROOT, 'app', 'public', 'data', 'graph.json')

const extractions = JSON.parse(readFileSync(file, 'utf8'))
const store = await openStore({ mongoUrl: process.env.MONGO_URL, log: console })
const resolver = createResolver(store)
await resolver.load()

for (const ex of extractions) {
  await resolver.fold(ex)
  console.log(`folded: ${ex.source.title.slice(0, 50)} (+${ex.entities.length} entities, ${ex.relations.length} relations)`)
}

const stats = await writeSnapshot(store, SNAPSHOT)
console.log('\ngraph:', JSON.stringify(stats))
console.log('snapshot →', SNAPSHOT)
