// One collection: `entities`. Mongo when MONGO_URL is set (survives redeploy),
// in-memory Map otherwise. Everything — instances, prototypes, relations —
// lives here, which is what makes relationships just another query.
import { MongoClient } from 'mongodb'

export async function openStore({ mongoUrl, log = console } = {}) {
  let col = null
  const mem = new Map()

  if (mongoUrl) {
    try {
      const client = new MongoClient(mongoUrl, { serverSelectionTimeoutMS: 3000 })
      await client.connect()
      col = client.db('ontology').collection('entities')
      await col.createIndex({ kind: 1 })
      await col.createIndex({ 'components.metadata.name': 1 })
      log.info?.('[store] mongo connected: ontology.entities')
    } catch (err) {
      log.warn?.(`[store] mongo unavailable (${err.message}) — in-memory`)
    }
  } else {
    log.info?.('[store] in-memory (no MONGO_URL)')
  }

  return {
    async get(id) {
      return col ? col.findOne({ id }, { projection: { _id: 0 } }) : mem.get(id) || null
    },
    async put(entity) {
      if (col) await col.replaceOne({ id: entity.id }, entity, { upsert: true })
      else mem.set(entity.id, entity)
    },
    async all() {
      if (col) return col.find({}, { projection: { _id: 0 } }).toArray()
      return [...mem.values()]
    },
    async byKind(kind) {
      if (col) return col.find({ kind }, { projection: { _id: 0 } }).toArray()
      return [...mem.values()].filter((e) => e.kind === kind)
    },
  }
}
