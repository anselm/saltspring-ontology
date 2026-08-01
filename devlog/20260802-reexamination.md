# Re-examination — a fresh, critical pass over the design (Claude / Fable 5)

Anselm asked for a re-review. Everything below is what a second, harder look
finds wrong or missing in what we shipped yesterday — ordered by how much it
matters to the idea actually working at scale. The first three are the ones
I'd fix before feeding the system more articles.

## 1. Identity is name-derived — that's the deepest flaw

`entId = hash(kind + nameKey(name))`. The stable identity of an entity is a
function of the first name we saw for it. Two consequences:

- **Homonym collision.** Two different real things with the same name key
  become one node forever — "The Local" (the pub) will absorb any future
  entity whose name normalizes to "local". On an island where businesses,
  boats, and roads share names, this *will* happen.
- **Merge is irreversible.** A fuzzy embedding merge folds provenance into the
  winner and the loser never existed. A wrong merge silently poisons the
  graph, and there is no record that a decision was even made.

**Advice:** identity should be arbitrary (random id at creation); names are
*evidence attached to* an entity, not its address. And merges should be
**events, recorded as entities** — `kind:'merge'` with the absorbed id, the
evidence (cosine score, model), and enough provenance to *undo* it. This is
the same move as edges-as-entities, applied to the resolver's own decisions:
the graph should remember its reasoning about itself. A low-confidence merge
then becomes exactly the kind of flagged chore a frontier worker adjudicates.

## 2. "Shared component discovery" isn't actually happening yet

The pipeline names it, the About page describes it — but the extractor only
ever produces four buckets (metadata / prototype / provenance / location).
The census is real but trivial. Anselm's original vision was the interesting
part: *bucket related traits for reuse across kinds* — `person{age,role}`,
`road{status}`, `event{when,status}` — and let entities be understood by what
decorates them.

**Advice:** extend the extraction schema with an open `attributes` object per
entity, then add a **component-induction chore**: cluster recurring attribute
keys across entities into named component buckets (roads keep showing up with
a `status`; events with a `when`). That's genuine discovery — the system
inventing its own schema from usage — and it's the feature that makes this
more than an entity-relation extractor. It is also the stage where a frontier
model visibly out-thinks a local one.

## 3. Predicates have the same disease prototypes had

The model comparison showed prototype labels drift across workers
(Organization vs Government body). Predicates are worse: "repairs" /
"is repairing" / "fixed" mint three distinct edges for one claim, because
`relationId` hashes the raw predicate. Nothing normalizes them.

**Advice:** treat predicates like prototypes — a small seeded spine of
canonical predicates (part-of, member-of, located-in, acts-on, funds,
opposes…), extraction keeps the surface verb as evidence, and a normalization
chore snaps surface forms to canonical ones with the surface text preserved.
Same solution shape in three places (entities, prototypes, predicates) is a
sign the substrate is right: *normalization is just dedup at different
altitudes*.

## 4. Time is recorded but not modeled

`firstSeen/lastSeen` capture when *we* learned something, not when it was
true. "Broadwell Road closed" (Dec 2025) and "repairs underway" (Jul 2026)
both sit in the graph as timeless edges. The contradiction-detection ambition
in the pipeline entry is impossible without statement time.

**Advice:** add a `when` component on edges (asserted-at from article date,
plus optional event-time the model extracts), and make **state-change
detection** a chore: when a new edge about the same subject conflicts with an
open one ("closed" vs "reopened"), close the old edge with an end time
instead of keeping both as eternal truths. The graph then tells stories, not
just facts — which for *news* is the entire point.

## 5. Smaller but real

- **Truncation is silent.** Extraction clips articles at 6,000 chars; the
  pickleball piece (6,473) lost its tail — where the Aug 13 meeting date
  lives. Chunk long articles or raise context; either way, record
  `coverage: partial` in provenance rather than pretending completeness.
- **Confidence is decorative.** `0.4 + 0.15×sources` encodes nothing about
  extractor identity or agreement. With multiple workers, confidence should
  come from *inter-model agreement* (two models assert it → high) — cheap to
  compute in the queue design, and it's what makes the multi-worker idea pay
  for itself in quality, not just throughput.
- **The graph snapshot won't scale past ~1k nodes** (one JSON, whole-graph
  force layout). Fine now; when it grows: ship per-neighborhood slices and
  render the ego-graph of a selection instead of everything. Noting the cliff
  so it isn't a surprise.
- **`seen.json` conflates "fetched" with "fully processed".** One crash
  between stages loses work invisibly. The per-entity `stages` flags from the
  pipeline entry fix this properly; until then it's the queue's weakest joint.
- **Legal/courtesy check** worth doing before publicizing: we quote sentences
  from Driftwood articles with attribution and links. Short quotes with
  citation for a research demo is defensible, but if this becomes an ongoing
  public site, a friendly note to the paper is both polite and strategic —
  they're the obvious partner, and a local paper is more likely to be
  delighted than litigious if asked first.

## What the re-exam *confirms*

Worth stating what held up under a harder look, because it's the foundation:
one collection; ECS components; prototypes-as-entities; **edges-as-entities**
(#1 and #4 above both get *easier* because of it); provenance-per-claim; the
work-queue-of-flagged-chores framing; local models for breadth + frontier for
adjudication. None of these bent under re-examination — the flaws found are
all *within* the substrate, not arguments against it.

## Recommended order

1. Identity decoupled from name + merge events (small change now, impossible
   later — do this before ingesting more).
2. Attributes in extraction + component induction (the vision's missing half).
3. Predicate spine + normalization chore.
4. Edge time + state-change detection.
5. Per-entity stage flags; mongo on exe.dev; agreement-based confidence.
