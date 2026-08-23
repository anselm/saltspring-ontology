# State of play — pausing here (Claude)

Closing note for the Salt Spring ontology extractor. Read this first on resume.

## What exists and its state

- **Live:** https://ssontology.exe.xyz (VM `ssontology`) — the knowledge graph
  read from 10 Driftwood articles: 71 entities, 53 relations, 17 prototypes.
  Force-directed graph + island map + enumerations + provenance detail + About.
- **Mobile pass done:** drag-to-pan, drag nodes, two-finger pinch / wheel zoom,
  collapsible side panel (overlays on phones, static on desktop). Commit
  `9605d6a`.
- **Git:** clean, fully pushed. Working tree has no uncommitted changes.

## Repo move (done outside the build sessions)

The folder was renamed `ontology` → `saltspring-ontology`, and the canonical
git remote is now **github.com/anselm/saltspring-ontology** (was originally
created under the `orbitalfoundation` org). This entry's commit also updates
`deploy/setup-autodeploy.sh` and `deploy/autodeploy.sh` to reference the
`anselm/` repo so they match the remote.

⚠️ **Autodeploy caveat:** the `ssontology` VM's autodeploy timer was installed
polling the *old* `orbitalfoundation/saltspring-ontology` repo (with a deploy
key there). Until `deploy/setup-autodeploy.sh ssontology` is re-run against the
new `anselm/` repo (it needs a read-only deploy key on that repo), pushing to
`anselm/main` will **not** auto-update the live VM. To ship in the meantime:
`deploy/deploy.sh ssontology` (manual build + rsync). Re-running
setup-autodeploy once will restore push-to-deploy.

## Architecture recap (why it's shaped this way)

One `entities` collection; ECS components; prototypes are entities
(prototype-based, open hierarchy); **relations are entities** carrying
provenance + confidence. Every node traces to a source quote. Pipeline:
ingest → extract (Anthropic `claude-fable-5` w/ Opus fallback if a key is set,
else local ollama `gpt-oss:120b`; `nomic-embed-text` for fuzzy dedup) →
resolve/dedup + prototype/component discovery → `graph.json` snapshot. The
extractor is meant to run on this box (the persistent worker); exe.dev serves
the read-only snapshot. See `20260801-*` and `20260802-reexamination.md`.

## Recommended next step

From the re-examination, in priority order — **#1 gates the rest and should
land before ingesting more articles:**

1. **Decouple identity from name.** Today `entId = hash(kind+name)`, so
   homonyms collide permanently and merges are irreversible. Use arbitrary ids
   with names as evidence, and record merges as entities (the graph remembering
   its own reasoning). Small now, near-impossible to retrofit later.
2. Open `attributes` in extraction + a component-induction chore (the missing
   half of "shared component discovery").
3. Predicate spine + normalization ("normalization is dedup at different
   altitudes").
4. Edge validity time + state-change detection (turns facts into stories).
5. Per-entity stage flags; mongo on exe.dev; agreement-based confidence.

## Courtesy note

The page quotes Driftwood sentences with attribution + links (defensible for a
research demo). Before publicizing further, a friendly heads-up to the paper is
both polite and strategic — they're the obvious partner.
