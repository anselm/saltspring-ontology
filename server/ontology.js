// ECS + prototype ontology primitives. One shape for everything: an entity is
// an id + a coarse kind + remixable components. Prototypes and relations are
// entities too, so the whole graph lives in one collection.
import { createHash } from 'node:crypto'

export const entId = (seed) => 'ent:' + createHash('sha1').update(String(seed)).digest('hex').slice(0, 16)

// canonical name key for first-pass dedup
export const nameKey = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^(the|a|an)\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

// Base prototypes seeded before extraction. The extractor may propose more;
// these give the graph a stable spine and consistent colours.
export const SEED_PROTOTYPES = [
  { name: 'Person', of: ['Agent'] },
  { name: 'Organization', of: ['Agent'] },
  { name: 'Government body', of: ['Organization'] },
  { name: 'Business', of: ['Organization'] },
  { name: 'Place', of: [] },
  { name: 'Road', of: ['Infrastructure'] },
  { name: 'Infrastructure', of: ['Place'] },
  { name: 'Vehicle', of: [] },
  { name: 'Event', of: [] },
  { name: 'Natural feature', of: ['Place'] },
  { name: 'Agent', of: [] },
]

export function makeEntity({ kind, name, components = {} }) {
  const id = entId(`${kind}:${nameKey(name)}`)
  return {
    id,
    kind,
    components: {
      metadata: { name, aliases: [], description: null },
      ...components,
      provenance: {
        sources: [],
        mentions: 0,
        confidence: 0,
        firstSeen: null,
        lastSeen: null,
        ...(components.provenance || {}),
      },
    },
  }
}

export function relationId(predicate, fromId, toId) {
  return entId(`relation:${nameKey(predicate)}:${fromId}:${toId}`)
}

// The kind of an entity is a bucket, but you can also read it off the
// components it carries — the ECS payoff.
export function inferredTraits(entity) {
  const c = entity.components || {}
  const traits = Object.keys(c).filter((k) => c[k] != null)
  return traits
}
