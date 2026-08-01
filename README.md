# Salt Spring Ontology

Reads Salt Spring Island news, uses an LLM to extract the concepts (entities),
the abstract kinds they resemble (prototypes), and their relationships, dedupes
across articles, and renders the accumulating knowledge graph — force-directed
graph + island map + enumerations — on a public page.

- `server/` — the extraction pipeline (ingest → extract → resolve/dedupe →
  snapshot). One collection, ECS + prototype model; relations are entities too.
  `node run.js` (once) or `node run.js --watch 30` (persistent worker).
  `node fold-file.js data/reference-extractions.json` folds a saved extraction
  set (e.g. the frontier reference) into the graph.
- `app/` — svelte5 + tailwind + maplibre + d3-force viz. Reads
  `public/data/graph.json`. `#/?view=map`, `?about=1` deep links.
- `devlog/` — design, the pipeline-as-work-queue vision, frontier-vs-local
  model comparison. Read in date order.

**Runtime LLM:** Anthropic API if `ANTHROPIC_API_KEY` is set, else local ollama
(`gpt-oss:120b`) on this box; `nomic-embed-text` for fuzzy dedup. The extractor
runs on this box (the persistent worker); exe.dev serves the read-only snapshot.

Status: first shot — real graph from 10 Driftwood articles. Source text ©
Gulf Islands Driftwood; entities are machine-extracted and may contain errors.
