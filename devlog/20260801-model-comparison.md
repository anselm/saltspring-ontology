# Frontier vs local extraction — first comparison (Claude)

Per Anselm's suggestion to run early tests myself and then see how the ollama
models chew the same texts. Same three articles, two extractors.

## Setup

- **Frontier (me, Claude, this session):** read the article texts and produced
  the reference extractions in `data/reference-extractions.json`. This is what
  the deployed graph is built from.
- **Local (`gpt-oss:120b` via ollama on this box):** the production
  `server/extract.js` prompt, run over three of the same articles. Output in
  `data/ollama-comparison.json`. Cold model load ~2.5 min (78.8 GB into VRAM);
  then ~170–260 s per article.

## Results

| Article | Frontier (mine) | gpt-oss:120b | time |
|---|---|---|---|
| Grass fire | 7 ent / 5 rel | 18 ent / 14 rel | 263 s |
| Pickleball | 14 ent / 10 rel | 20 ent / 14 rel | 169 s |
| Road repairs | 11 ent / 8 rel | 15 ent / 13 rel | 171 s |

**The local model is genuinely capable.** On the same text it produced valid,
JSON-clean extractions with sensible prototypes, and in every case found
*more* entities than my reference — including real ones I dropped (Bruce
Cameron and Jen in the fire story, Dan Ovington and Duck Creek Park in the
pickleball story). Higher recall, at the cost of speed.

**Where it's noisier: prototype consistency.** The differences are almost all
in the abstract-kind label, exactly where prototype-based classification is
subjective:

| Entity | I said | gpt-oss said |
|---|---|---|
| Salt Spring Island Fire Rescue | Government body | Organization |
| Local Community Commission | Government body | Organization |
| Fire Hall No. 2 | Infrastructure | Building |
| Cusheon Lake neighbourhood | (skipped) | Place |

None of these are *wrong* — "Building" and "Infrastructure" both fit a fire
hall — but inconsistency across workers is a real problem for a shared graph,
because it splits what should be one prototype into several.

## What this tells the design

1. **The local model can do the always-on crawl.** Quality is good enough;
   ~3 min/article is fine for a background worker that never sleeps.
2. **Prototype normalization is a required stage, not a nicety.** With multiple
   workers proposing prototypes, we need a merge step that collapses
   Organization/Government body/Building-style near-synonyms — either a fixed
   prototype spine that proposals snap to, or a frontier worker that
   adjudicates the prototype of ambiguous entities. This is a concrete argument
   for the "frontier worker adjudicates" role in the pipeline design.
3. **Recall vs precision splits by model.** The local model over-produces
   (higher recall, more noise); a frontier pass is better at the judgment
   calls (what's the right prototype, are these two the same entity). That maps
   cleanly onto a two-tier worker pool: local for breadth, frontier for the
   hard adjudications — both writing to the same graph.
4. **Confidence should encode the source model.** An entity extracted only by
   the local model at a novel prototype deserves lower confidence than one two
   models agree on. The provenance already records sources; it should also
   record which worker/model asserted each claim.

Net: local extraction is viable for the bulk of the work, and the frontier
model earns its place on adjudication rather than raw extraction — which is a
better use of credits than running every article through it.
