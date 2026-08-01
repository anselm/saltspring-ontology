// Emit the graph.json the front end reads: instances (nodes), relations
// (edges), prototypes (with instance counts), and the component-bucket census.
import { writeFileSync } from 'node:fs'
import { inferredTraits } from './ontology.js'

export async function writeSnapshot(store, path) {
  const all = await store.all()
  const instances = all.filter((e) => e.kind === 'instance')
  const prototypes = all.filter((e) => e.kind === 'prototype')
  const relations = all.filter((e) => e.kind === 'relation')

  // degree per instance
  const degree = new Map()
  for (const r of relations) {
    const { from, to } = r.components.relation
    degree.set(from, (degree.get(from) || 0) + 1)
    degree.set(to, (degree.get(to) || 0) + 1)
  }

  // prototype instance counts
  const protoCount = new Map()
  for (const e of instances)
    for (const pid of e.components.prototype?.of || []) protoCount.set(pid, (protoCount.get(pid) || 0) + 1)

  // component-bucket census across instances (the "components found")
  const compCensus = new Map()
  for (const e of instances)
    for (const t of inferredTraits(e)) compCensus.set(t, (compCensus.get(t) || 0) + 1)

  const protoName = new Map(prototypes.map((p) => [p.id, p.components.metadata.name]))

  const nodes = instances.map((e) => ({
    id: e.id,
    name: e.components.metadata.name,
    description: e.components.metadata.description,
    prototypes: (e.components.prototype?.of || []).map((pid) => protoName.get(pid) || pid),
    protoIds: e.components.prototype?.of || [],
    components: inferredTraits(e),
    location: e.components.location || null,
    mentions: e.components.provenance.mentions,
    confidence: e.components.provenance.confidence,
    degree: degree.get(e.id) || 0,
    sources: e.components.provenance.sources,
  }))

  const edges = relations.map((r) => ({
    id: r.id,
    from: r.components.relation.from,
    to: r.components.relation.to,
    predicate: r.components.relation.predicate,
    mentions: r.components.provenance.mentions,
    sources: r.components.provenance.sources,
  }))

  const protos = prototypes.map((p) => ({
    id: p.id,
    name: p.components.metadata.name,
    of: (p.components.prototype?.of || []).map((pid) => protoName.get(pid) || pid),
    count: protoCount.get(p.id) || 0,
  }))

  const components = [...compCensus.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  const snapshot = {
    generatedAt: new Date().toISOString(),
    stats: { instances: nodes.length, relations: edges.length, prototypes: protos.length },
    nodes,
    edges,
    prototypes: protos.sort((a, b) => b.count - a.count),
    components,
  }
  writeFileSync(path, JSON.stringify(snapshot))
  return snapshot.stats
}
