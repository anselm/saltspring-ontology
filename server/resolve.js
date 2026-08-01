// Resolution: fold a single article's extraction into the accumulating graph.
// Dedup by canonical name first, then by embedding cosine for fuzzy matches
// ("Salt Spring", "the island", "SSI"). Prototypes and relations resolve
// through the same path — one code path for every node, because relations are
// entities too.
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeEntity, relationId, nameKey, SEED_PROTOTYPES } from './ontology.js'
import { embed, cosine } from './llm.js'

const MERGE_THRESHOLD = 0.86 // cosine for fuzzy same-entity merge

const GAZ_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'gazetteer.json')
const GAZ = existsSync(GAZ_PATH) ? JSON.parse(readFileSync(GAZ_PATH, 'utf8')) : {}
function geocode(label) {
  if (!label) return null
  const k = nameKey(label)
  if (GAZ[k]) return { lat: GAZ[k][0], lon: GAZ[k][1], method: 'gazetteer' }
  // substring match against known places
  for (const key of Object.keys(GAZ)) if (k.includes(key) || key.includes(k)) return { lat: GAZ[key][0], lon: GAZ[key][1], method: 'gazetteer-fuzzy' }
  return null
}

export function createResolver(store) {
  // in-memory working set keyed by id; embeddings cached alongside
  const index = new Map() // id -> entity
  const embByKind = new Map() // kind -> [{id, vec}]
  const nameToId = new Map() // `${kind}|${nameKey}` -> id

  function register(entity, vec = null) {
    index.set(entity.id, entity)
    nameToId.set(`${entity.kind}|${nameKey(entity.components.metadata.name)}`, entity.id)
    for (const alias of entity.components.metadata.aliases || [])
      nameToId.set(`${entity.kind}|${nameKey(alias)}`, entity.id)
    if (vec) {
      if (!embByKind.has(entity.kind)) embByKind.set(entity.kind, [])
      embByKind.get(entity.kind).push({ id: entity.id, vec })
    }
  }

  async function load() {
    for (const e of await store.all()) register(e)
    // seed prototypes if missing
    for (const p of SEED_PROTOTYPES) await ensurePrototype(p.name, p.of)
  }

  async function ensurePrototype(name, ofNames = []) {
    const key = `prototype|${nameKey(name)}`
    if (nameToId.has(key)) return nameToId.get(key)
    const ofIds = []
    for (const on of ofNames) ofIds.push(await ensurePrototype(on, []))
    const ent = makeEntity({ kind: 'prototype', name, components: { prototype: { of: ofIds } } })
    register(ent)
    await store.put(ent)
    return ent.id
  }

  // Find an existing entity of a kind matching `name`; fuzzy via embeddings.
  async function match(kind, name) {
    const exact = nameToId.get(`${kind}|${nameKey(name)}`)
    if (exact) return index.get(exact)
    if (process.env.FUZZY_MERGE === '0') return {} // deterministic exact-only mode
    const vec = await embed(name)
    if (vec) {
      let best = null, bestScore = 0
      for (const { id, vec: v } of embByKind.get(kind) || []) {
        const s = cosine(vec, v)
        if (s > bestScore) { bestScore = s; best = id }
      }
      if (best && bestScore >= MERGE_THRESHOLD) return { ...index.get(best), _vec: vec }
    }
    return { _vec: vec } // miss — carries the computed vec for reuse
  }

  function addProvenance(ent, source, quote, now) {
    const p = ent.components.provenance
    if (!p.sources.some((s) => s.url === source.url && s.quote === quote))
      p.sources.push({ url: source.url, title: source.title, date: source.date, quote })
    p.mentions = (p.mentions || 0) + 1
    p.confidence = Math.min(1, 0.4 + 0.15 * p.sources.length)
    p.firstSeen = p.firstSeen || now
    p.lastSeen = now
  }

  // Upsert an instance entity; returns its id.
  async function upsertInstance(raw, source, now) {
    const protoId = await ensurePrototype(raw.prototype, [])
    const found = await match('instance', raw.name)
    if (found.id) {
      const ent = index.get(found.id)
      if (!ent.components.prototype.of.includes(protoId)) ent.components.prototype.of.push(protoId)
      if (raw.description && !ent.components.metadata.description)
        ent.components.metadata.description = raw.description
      const k = nameKey(raw.name)
      if (k !== nameKey(ent.components.metadata.name) && !ent.components.metadata.aliases.includes(raw.name)) {
        ent.components.metadata.aliases.push(raw.name)
        nameToId.set(`instance|${k}`, ent.id)
      }
      addProvenance(ent, source, raw.quote, now)
      await store.put(ent)
      return ent.id
    }
    const components = {
      prototype: { of: [protoId] },
      metadata: { name: raw.name, aliases: [], description: raw.description || null },
    }
    if (raw.location) {
      const geo = geocode(raw.location)
      components.location = geo
        ? { label: raw.location, lat: geo.lat, lon: geo.lon, method: geo.method }
        : { label: raw.location, lat: null, lon: null, method: 'ungeocoded' }
    }
    const ent = makeEntity({ kind: 'instance', name: raw.name, components })
    addProvenance(ent, source, raw.quote, now)
    register(ent, found._vec)
    await store.put(ent)
    return ent.id
  }

  async function upsertRelation(fromId, predicate, toId, source, quote, now) {
    const id = relationId(predicate, fromId, toId)
    let ent = index.get(id)
    if (!ent) {
      ent = makeEntity({
        kind: 'relation',
        name: predicate,
        components: { relation: { predicate, from: fromId, to: toId } },
      })
      ent.id = id
      register(ent)
    }
    addProvenance(ent, source, quote, now)
    await store.put(ent)
    return id
  }

  async function fold(extraction) {
    const now = new Date().toISOString()
    const { source } = extraction
    const byName = new Map()
    for (const e of extraction.entities) {
      const id = await upsertInstance(e, source, now)
      byName.set(nameKey(e.name), id)
    }
    for (const r of extraction.relations) {
      const fromId = byName.get(nameKey(r.from))
      const toId = byName.get(nameKey(r.to))
      if (fromId && toId && fromId !== toId) await upsertRelation(fromId, r.predicate, toId, source, r.quote, now)
    }
  }

  return { load, fold, ensurePrototype }
}
