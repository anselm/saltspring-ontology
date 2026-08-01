// The extraction step: one article's text → proposed entities + relations.
// Prototype-based: the model proposes what abstract kind each entity most
// resembles, rather than fitting a fixed class list.
import { generateJSON } from './llm.js'

const SYSTEM = `You are an ontology extractor for a local-news knowledge graph about Salt Spring Island, British Columbia.
From an article, extract the concrete concepts and how they relate. Use PROTOTYPE-BASED classification: for each entity, name the abstract kind it most resembles (its "prototype"), inventing a prototype name when none of the common ones fit.

Return STRICT JSON, no prose:
{
  "entities": [
    {
      "name": "specific proper name or clear noun phrase",
      "prototype": "abstract kind it resembles, e.g. Road, Person, Government body, Business, Vehicle, Event, Natural feature, Place, Organization",
      "description": "one sentence, grounded in the article",
      "location": "place name if the entity is a physical place on the island, else null",
      "quote": "short verbatim sentence from the article that mentions it"
    }
  ],
  "relations": [
    { "from": "entity name", "predicate": "short verb phrase, e.g. repairs, works for, located on, funds, opposes", "to": "entity name", "quote": "verbatim sentence asserting this" }
  ]
}

Rules:
- Prefer specific instances (a named road, a named person, a specific project) AND their prototypes.
- Deduplicate within the article: one entity per real-world thing.
- Every entity and relation must be supported by a quote from the text.
- relations connect entities you also listed in "entities".
- 6-20 entities, 4-15 relations. Do not invent facts not in the article.`

export async function extractFromArticle({ title, text, url, date }) {
  const clipped = text.replace(/\s+/g, ' ').trim().slice(0, 6000)
  const user = `ARTICLE TITLE: ${title}\nURL: ${url}\n\nARTICLE TEXT:\n${clipped}\n\nReturn the JSON.`
  const out = await generateJSON({ system: SYSTEM, user })
  const entities = Array.isArray(out.entities) ? out.entities : []
  const relations = Array.isArray(out.relations) ? out.relations : []
  return {
    source: { url, title, date },
    entities: entities.filter((e) => e && e.name && e.prototype),
    relations: relations.filter((r) => r && r.from && r.to && r.predicate),
  }
}
