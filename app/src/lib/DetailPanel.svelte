<script>
  // Selected entity: its prototype chain, the component buckets it carries,
  // its relations (in and out), and the provenance — the actual sentences from
  // the articles that asserted it, with source links. Provenance is the point:
  // every node traces back to text.
  let { entity, graph, palette, onSelect, onClose } = $props()

  const byId = $derived(new Map(graph.nodes.map((n) => [n.id, n])))
  const col = (p) => palette.get(p) || '#7c92a8'

  const outgoing = $derived(graph.edges.filter((e) => e.from === entity.id))
  const incoming = $derived(graph.edges.filter((e) => e.to === entity.id))
  const name = (id) => byId.get(id)?.name || id
</script>

<div class="flex h-full flex-col">
  <div class="flex items-start justify-between gap-2 border-b border-ink-800 p-3">
    <div class="min-w-0">
      <div class="flex items-center gap-2">
        <span class="h-3 w-3 shrink-0 rounded-full" style="background:{col(entity.prototypes?.[0])}"></span>
        <h2 class="truncate font-semibold text-ink-100">{entity.name}</h2>
      </div>
      <div class="mt-0.5 flex flex-wrap gap-1">
        {#each entity.prototypes || [] as p (p)}
          <span class="rounded bg-ink-800 px-1.5 py-0.5 text-[10px]" style="color:{col(p)}">{p}</span>
        {/each}
      </div>
    </div>
    <button onclick={onClose} class="shrink-0 rounded p-1 text-ink-400 hover:text-ink-200" aria-label="Close">
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  </div>

  <div class="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-sm">
    {#if entity.description}
      <p class="leading-relaxed text-ink-300">{entity.description}</p>
    {/if}

    <div class="flex flex-wrap gap-1.5 text-[11px]">
      <span class="rounded bg-ink-800 px-2 py-0.5 text-ink-300">{entity.mentions} mention{entity.mentions === 1 ? '' : 's'}</span>
      <span class="rounded bg-ink-800 px-2 py-0.5 text-ink-300">confidence {entity.confidence?.toFixed?.(2) ?? '—'}</span>
      {#if entity.location?.lat}<span class="rounded bg-ink-800 px-2 py-0.5 text-ink-300">◍ {entity.location.label}</span>{/if}
    </div>

    <div>
      <h3 class="mb-1 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Components</h3>
      <div class="flex flex-wrap gap-1">
        {#each entity.components || [] as c (c)}
          <span class="rounded border border-ink-700 bg-ink-900 px-1.5 py-0.5 font-mono text-[11px] text-accent-400">{c}</span>
        {/each}
      </div>
    </div>

    {#if outgoing.length || incoming.length}
      <div>
        <h3 class="mb-1 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Relations</h3>
        <ul class="space-y-1">
          {#each outgoing as e (e.id)}
            <li class="text-ink-300">
              <span class="text-ink-400">{entity.name}</span>
              <span class="text-accent-400">{e.predicate}</span>
              <button class="text-ink-100 underline decoration-ink-700 hover:decoration-accent-400" onclick={() => onSelect(byId.get(e.to))}>{name(e.to)}</button>
            </li>
          {/each}
          {#each incoming as e (e.id)}
            <li class="text-ink-300">
              <button class="text-ink-100 underline decoration-ink-700 hover:decoration-accent-400" onclick={() => onSelect(byId.get(e.from))}>{name(e.from)}</button>
              <span class="text-accent-400">{e.predicate}</span>
              <span class="text-ink-400">{entity.name}</span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <div>
      <h3 class="mb-1 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Provenance</h3>
      <ul class="space-y-2">
        {#each entity.sources || [] as s (s.url + s.quote)}
          <li class="rounded border border-ink-800 bg-ink-900 p-2">
            <p class="text-[13px] leading-relaxed text-ink-200 italic">“{s.quote}”</p>
            <a href={s.url} target="_blank" rel="noopener" class="mt-1 block truncate text-[11px] text-accent-400 hover:underline">{s.title} ↗</a>
          </li>
        {/each}
      </ul>
    </div>
  </div>
</div>
