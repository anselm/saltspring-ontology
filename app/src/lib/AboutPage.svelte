<script>
  let { stats, onClose } = $props()
</script>

<div class="absolute inset-0 z-30 overflow-y-auto bg-ink-950/95 backdrop-blur">
  <div class="mx-auto max-w-3xl px-5 py-8 text-ink-200">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-ink-100">About this experiment</h1>
      <button onclick={onClose} class="rounded-md border border-ink-700 px-3 py-1.5 text-sm hover:bg-ink-800">Back to the graph</button>
    </div>

    <p class="mt-4 leading-relaxed text-ink-300">
      This page reads Salt Spring Island news and turns it into a
      <strong class="text-ink-100">knowledge graph</strong>: the concepts an article introduces (entities), the
      abstract kinds they resemble (prototypes), and how they relate to each other — accumulated over time and
      de-duplicated so that the same council, road, or organisation is one node no matter how many articles mention
      it. It is an experiment in reading a place through its own local record.
    </p>
    <p class="mt-2 text-sm text-ink-400">
      Current graph: {stats.instances} entities · {stats.relations} relations · {stats.prototypes} prototypes, from
      the Gulf Islands Driftwood.
    </p>

    <h2 class="mt-8 text-lg font-semibold text-ink-100">The data model — one collection, ECS + prototypes</h2>
    <p class="mt-2 leading-relaxed text-ink-300">
      Every node is an <em>entity</em>: an id plus remixable <strong class="text-ink-100">components</strong>.
      Rather than a rigid <code class="text-accent-400">Person&#123;name, lat, lon, age&#125;</code> record, related
      traits are bucketed for reuse across kinds —
      <code class="text-accent-400">metadata&#123;name&#125;</code>,
      <code class="text-accent-400">location&#123;lat,lon&#125;</code>,
      <code class="text-accent-400">provenance&#123;sources,confidence&#125;</code>,
      <code class="text-accent-400">prototype&#123;of&#125;</code>. A thing's kind is a coarse bucket, but you can
      also read it off the components it carries: something decorated with a
      <code class="text-accent-400">relation</code> component is an edge; with a
      <code class="text-accent-400">location</code>, it can go on the map. Richer formalism in how data is
      structured lets the same data be recruited into more views.
    </p>

    <h2 class="mt-6 text-lg font-semibold text-ink-100">Prototype-based, not class-based</h2>
    <p class="mt-2 leading-relaxed text-ink-300">
      There is no fixed class tree. A prototype — <em>Road</em>, <em>Person</em>, <em>Government body</em> — is
      itself an entity, and an instance links to whichever prototypes it resembles. Prototypes can have prototypes
      (<em>Road</em> → <em>Infrastructure</em> → <em>Place</em>), so the abstraction is an open graph you can extend
      at runtime as new kinds of thing show up in the news, rather than a schema you have to design in advance. The
      extractor proposes new prototypes when the common ones don't fit, and they are de-duplicated like anything
      else.
    </p>

    <h2 class="mt-6 text-lg font-semibold text-ink-100">Relationships are first-class entities</h2>
    <p class="mt-2 leading-relaxed text-ink-300">
      A relationship — "the fire district <em>owns</em> the pickleball site", "Owen Page <em>manages roads for</em>
      the Ministry" — is not a property buried on one node, and not a separate table. It is an entity carrying a
      <code class="text-accent-400">relation</code> component. This keeps the single-collection model, and it means
      an edge can carry its own provenance and confidence, be de-duplicated when several articles assert the same
      claim, and be reasoned about like any other node. Stable structural facts could still be embedded as
      components; extracted, sourced, uncertain claims are edges. Everything the model reads from the news is an edge
      entity, because all of it is sourced and uncertain.
    </p>

    <h2 class="mt-6 text-lg font-semibold text-ink-100">The pipeline</h2>
    <ol class="mt-2 space-y-2 text-ink-300">
      <li><strong class="text-ink-100">1 · Ingest.</strong> Fetch article text from the Driftwood feed; strip the page chrome.</li>
      <li><strong class="text-ink-100">2 · Extract.</strong> A language model reads one article and proposes entities (with the prototype each resembles) and relations, each supported by a verbatim quote.</li>
      <li><strong class="text-ink-100">3 · Resolve &amp; de-duplicate.</strong> Match new entities against the accumulating graph by name, alias, and embedding similarity, so "Salt Spring", "the island", and "SSI" converge; merge provenance and bump a mention count.</li>
      <li><strong class="text-ink-100">4 · Discover.</strong> New prototypes and the census of which component buckets are in use fall out of the same step.</li>
      <li><strong class="text-ink-100">5 · Persist.</strong> Write to one collection, flagged so the same article is never processed twice, and emit the snapshot this page reads.</li>
    </ol>
    <p class="mt-2 leading-relaxed text-ink-300">
      The stages are meant to be a <strong class="text-ink-100">queue of small, flagged chores</strong> — ingest,
      extract, dedupe, discover — that any number of language-model workers can pick up against a shared database,
      each writing back completed state and marking the work done so it isn't repeated. Different models can chew on
      the same raw data in parallel; the database is the coordination point. The graph you see is the accumulated
      result.
    </p>

    <h2 class="mt-6 text-lg font-semibold text-ink-100">Reading the graph</h2>
    <ul class="mt-2 space-y-1.5 text-ink-300">
      <li>· <strong class="text-ink-100">Colour</strong> is the prototype; <strong class="text-ink-100">size</strong> is how connected / mentioned an entity is.</li>
      <li>· <strong class="text-ink-100">Dashed links</strong> are "is-a" — an instance to the prototype it resembles, so the classification is visible as structure. <strong class="text-ink-100">Solid links</strong> are the extracted relations.</li>
      <li>· The <strong class="text-ink-100">map</strong> shows entities the gazetteer could place (positions approximate). The <strong class="text-ink-100">enumerations</strong> list the prototypes, component buckets, and entities found. Selecting anything cross-links the views and shows its provenance — the sentences it came from.</li>
    </ul>

    <h2 class="mt-6 text-lg font-semibold text-ink-100">Honest limits</h2>
    <ul class="mt-2 space-y-1.5 text-ink-300">
      <li>· Extraction is imperfect: a model can miss an entity, over-split one into two, or mislabel a prototype. Every claim is shown with its source quote so you can check it.</li>
      <li>· Locations come from a small hand-built gazetteer of island places, so map positions are approximate and some entities aren't placed at all.</li>
      <li>· This snapshot was built from a batch of articles; the design is for continuous ingestion, which accumulates the graph over time.</li>
      <li>· It reads one paper. A fuller picture would fold in more feeds, public data, and community contributions.</li>
    </ul>

    <p class="mt-8 text-xs text-ink-500">
      Built on the ontology-extractor line of work at github.com/orbitalfoundation. Source text © Gulf Islands
      Driftwood; entities and relations are machine-extracted and may contain errors.
    </p>
  </div>
</div>
