# The pipeline as a work queue of flagged chores (Claude)

Anselm's framing, mid-build: this isn't one script, it's a **multi-stage
pipeline** — raw article ingestion → entity extraction → de-duplication →
prototype discovery → shared-component discovery — populating a database,
flagged so no work is done twice, and worked by **many LLM workers in
parallel**. Different models (the local ollama fleet, and me, Claude, right
here as a frontier worker) can each pick up chores, chew on raw data, and
write back completed state. The database is the coordination point.

This entry records that design; the current build already embodies the stages,
and the direction is to make the flagging and the shared DB first-class.

## The stages, as claimable chores

Each is a small, idempotent unit of work with an input flag and an output:

| Stage | Input | Output | "done" flag |
|---|---|---|---|
| ingest | a source URL | article text entity | `stages.ingested` |
| extract | ingested article | proposed entities+relations | `stages.extracted` |
| resolve | proposed entities | merged into graph (dedup) | `stages.resolved` |
| prototype-discover | resolved entities | prototype entities + links | `stages.prototyped` |
| component-discover | resolved entities | component census | (derived) |
| embed | an entity name | vector (for fuzzy dedup) | `stages.embedded` |
| geocode | a place entity | lat/lon from gazetteer | `location.method` |

A worker's loop is the same regardless of who runs it: *claim an item whose
next-stage flag is unset, do the stage, write the result, set the flag.*
Because the flag is the claim, two workers never redo the same chore, and a
crashed worker just leaves the item unflagged for the next one.

## Who the workers are

- **The local ollama fleet on this box** — `gpt-oss:120b` etc. Persistent,
  free, slower (~3 min/article — see the model-comparison entry). The natural
  home for the always-on crawl.
- **A frontier model** — Anthropic API when a key is present, *or me, Claude,
  in this session*. Faster and cleaner on the hard classification calls
  (prototype consistency, tricky dedup). Good for the initial reference graph
  and for adjudicating merges the local model is unsure about.
- The point is they are **interchangeable at the chore boundary**. The graph
  doesn't care which model extracted an entity, only that the provenance and
  confidence are recorded — which they are, per entity and per edge.

## Where the shared state lives

We are not on an always-on box for serving, but this box *is* the persistent
worker, and **exe.dev can host the shared mongo**. So the mature architecture:

```
   ollama worker (this box) ─┐
   Claude worker (here)   ───┼──▶  mongo on exe.dev  ──▶  static snapshot ──▶ public page
   future workers         ───┘     (the claimable
                                     work queue +
                                     accumulated graph)
```

Every worker reads and writes the one `entities` collection; the flags make it
a queue; the page renders a periodically-emitted snapshot. This is the same
single-collection ECS model the whole project uses — the work queue is just
entities with unset stage flags, so *even the chores are entities*.

## What's built now vs next

- **Built:** the stages exist as functions (`sources`→`extract`→`resolve`→
  `snapshot`); dedup by name + embedding; prototype discovery (the extractor
  proposes, they dedupe); component census; `seen.json` as the first, coarse
  "don't redo" flag at the article level.
- **Next:** generalize the flag from a per-URL set to a `stages` component on
  every entity, so any stage can be claimed independently and re-run
  selectively (e.g. re-embed with a better model without re-extracting). Put
  mongo on exe.dev. Let a frontier worker adjudicate low-confidence merges the
  local model flags. Add stages: coreference across articles, relationship
  inference, contradiction detection ("road closed" then "road reopened").

## Why this is the interesting part

Extraction quality is table stakes; the durable idea is the **substrate**: a
single-collection graph where nodes, edges, prototypes, and pending chores are
all the same kind of thing, and any number of heterogeneous models can
collaborate on it asynchronously by claiming flagged work. That's what turns a
one-off extraction into a living, shared understanding of a place.
